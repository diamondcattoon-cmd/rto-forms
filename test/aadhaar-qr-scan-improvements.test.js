const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/* aadhaar-qr-scan.js is a plain DOM-heavy script, not a require()-able
   module — but otsuThreshold() and quadrantCropRects() are pure, DOM-free
   functions (no canvas/document references), so this test pulls their
   exact source text out of the real file and evals it, same convention as
   test/image-header-parsing.test.js. */
const src = fs.readFileSync(path.join(__dirname, '..', 'aadhaar-qr-scan.js'), 'utf8');
function extract(name){
  let start = src.indexOf('function ' + name + '(');
  if(start === -1) throw new Error('function not found in aadhaar-qr-scan.js: ' + name);
  if(src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
  let depth = 0, i = src.indexOf('{', start), end = -1;
  for(; i < src.length; i++){
    if(src[i] === '{') depth++;
    else if(src[i] === '}'){ depth--; if(depth === 0){ end = i + 1; break; } }
  }
  if(end === -1) throw new Error('could not find matching brace for: ' + name);
  return src.slice(start, end);
}
function extractConst(name){
  const re = new RegExp('const ' + name + '=[^\\n;]+;?');
  const m = src.match(re);
  if(!m) throw new Error('const not found in aadhaar-qr-scan.js: ' + name);
  return m[0];
}
const code = [
  extractConst('AADHAAR_QR_CROP_FRACTION'),
  extractConst('AADHAAR_QR_CROP_ZOOM'),
  extractConst('AADHAAR_QR_CROP_MAX_DIM'),
  extract('otsuThreshold'),
  extract('quadrantCropRects')
].join('\n');
// eslint-disable-next-line no-eval
eval(code);

test('otsuThreshold: splits a clean bimodal (black/white QR-like) histogram down the middle of the gap', () => {
  const histogram = new Uint32Array(256);
  histogram[10] = 5000;  // "black module" cluster
  histogram[245] = 5000; // "white module" cluster
  const t = otsuThreshold(histogram, 10000);
  assert.ok(t > 10 && t < 245, 'threshold ' + t + ' should fall strictly between the two clusters');
});

test('otsuThreshold: a threshold change never flips the FEWER pixels than the majority class', () => {
  const histogram = new Uint32Array(256);
  histogram[50] = 9000;  // large majority (background)
  histogram[220] = 1000; // small minority (the actual black modules, say)
  const t = otsuThreshold(histogram, 10000);
  assert.ok(t > 50 && t < 220);
});

test('otsuThreshold: never throws or returns NaN on a degenerate (all-one-value) histogram', () => {
  const histogram = new Uint32Array(256);
  histogram[128] = 10000;
  const t = otsuThreshold(histogram, 10000);
  assert.equal(Number.isNaN(t), false);
  assert.ok(t >= 0 && t <= 255);
});

test('quadrantCropRects: covers all 4 corners with the configured overlap fraction, no gaps at the midline', () => {
  const rects = quadrantCropRects(4000, 3000);
  assert.equal(rects.length, 4);
  const labels = rects.map(r => r.label).sort();
  assert.deepEqual(labels, ['bottom-left', 'bottom-right', 'top-left', 'top-right']);

  const topLeft = rects.find(r => r.label === 'top-left');
  const topRight = rects.find(r => r.label === 'top-right');
  // Adjacent crops must overlap (fraction > 50%) so nothing near the
  // midline falls outside every single crop.
  assert.ok(topLeft.x + topLeft.cw > topRight.x, 'top-left and top-right must overlap horizontally');

  for(const r of rects){
    assert.ok(r.x >= 0 && r.y >= 0, r.label + ' origin must be non-negative');
    assert.ok(r.x + r.cw <= 4000 && r.y + r.ch <= 3000, r.label + ' must stay inside the source bounds');
    assert.ok(r.outW <= 3500 && r.outH <= 3500, r.label + ' zoomed output must respect the max-dim cap');
    assert.ok(r.outW >= r.cw, r.label + ' zoomed output should never be smaller than the crop itself');
  }
});

test('quadrantCropRects: caps zoom instead of exceeding AADHAAR_QR_CROP_MAX_DIM on a large source', () => {
  const rects = quadrantCropRects(4500, 4500);
  for(const r of rects) assert.ok(r.outW <= 3500 && r.outH <= 3500);
});

test('quadrantCropRects: handles a tiny source without producing zero/negative dimensions', () => {
  const rects = quadrantCropRects(100, 100);
  for(const r of rects){
    assert.ok(r.cw > 0 && r.ch > 0);
    assert.ok(r.outW > 0 && r.outH > 0);
  }
});
