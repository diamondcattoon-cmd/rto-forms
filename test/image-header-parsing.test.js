const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/* pro-wallet.js is a plain DOM-heavy script, not a require()-able module —
   but parsePngDimensions/parseJpegDimensions/parseJpegOrientation/
   readExifOrientation/probeImageDimensionsFromHeader are pure, DOM-free
   functions (no `document`/`window` references), so this test pulls their
   exact source text out of the real file and evals it, the same way
   worker-frontend-contract.test.js diffs against the Worker's real source
   rather than a hand-copied duplicate. That matters here specifically:
   compressImageFile() already regressed once in production (the original
   "fix" for the Android low-memory crash still probed dimensions via a
   bare, unbounded createImageBitmap(file) call) — this test exists so a
   future edit that reintroduces an unbounded probe, or breaks EXIF
   orientation handling, fails a test instead of shipping quietly. */
const src = fs.readFileSync(path.join(__dirname, '..', 'pro-wallet.js'), 'utf8');
function extract(name){
  let start = src.indexOf('function ' + name + '(');
  if(start === -1) throw new Error('function not found in pro-wallet.js: ' + name);
  if(src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
  let depth = 0, i = src.indexOf('{', start), end = -1;
  for(; i < src.length; i++){
    if(src[i] === '{') depth++;
    else if(src[i] === '}'){ depth--; if(depth === 0){ end = i + 1; break; } }
  }
  if(end === -1) throw new Error('could not find matching brace for: ' + name);
  return src.slice(start, end);
}
const code = [
  'parsePngDimensions', 'parseJpegDimensions', 'parseJpegOrientation',
  'readExifOrientation', 'probeImageDimensionsFromHeader'
].map(extract).join('\n');
// eslint-disable-next-line no-eval
eval(code);

// ── Minimal synthetic JPEG/PNG byte builders — no pixel/scan data needed
//    since these parsers only ever read header bytes. ──

function u16be(n){ return [(n >> 8) & 0xff, n & 0xff]; }

function buildSOF0(width, height){
  const payload = [8, ...u16be(height), ...u16be(width), 1, /*component*/ 1, 0x11, 0];
  return [0xFF, 0xC0, ...u16be(payload.length + 2), ...payload];
}

function buildExifApp1(orientation){
  const tiffHeader = [0x49, 0x49, 42, 0, 8, 0, 0, 0]; // "II", magic 42 (LE), IFD0 @ offset 8
  const entry = [
    0x12, 0x01, // tag 0x0112 (LE)
    3, 0,       // type SHORT (LE)
    1, 0, 0, 0, // count 1 (LE)
    orientation, 0, 0, 0 // value in first 2 bytes, then padding
  ];
  const ifd0 = [1, 0, ...entry, 0, 0, 0, 0]; // 1 entry, then next-IFD offset = 0
  const exifPayload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiffHeader, ...ifd0]; // "Exif\0\0" + TIFF
  return [0xFF, 0xE1, ...u16be(exifPayload.length + 2), ...exifPayload];
}

function buildJpeg({ width, height, orientation, paddingSegmentBytes }){
  const bytes = [0xFF, 0xD8]; // SOI
  if(paddingSegmentBytes){
    // A large APP1-ish filler segment before the real EXIF/SOF, simulating
    // a phone's big ICC/EXIF blob — proves the scanner skips by declared
    // segment length rather than by scanning content.
    bytes.push(0xFF, 0xEE, ...u16be(paddingSegmentBytes + 2), ...new Array(paddingSegmentBytes).fill(0));
  }
  if(orientation != null) bytes.push(...buildExifApp1(orientation));
  bytes.push(...buildSOF0(width, height));
  bytes.push(0xFF, 0xD9); // EOI
  return new Uint8Array(bytes);
}

function buildPng(width, height){
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  const w = [(width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff];
  const h = [(height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff];
  return new Uint8Array([...sig, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...w, ...h, 8, 6, 0, 0, 0]);
}

test('parseJpegDimensions: reads the SOF0 width/height', () => {
  const bytes = buildJpeg({ width: 8000, height: 6000 });
  assert.deepEqual(parseJpegDimensions(bytes), { w: 8000, h: 6000 });
});

test('parseJpegDimensions: skips a large filler segment by its declared length, not by scanning', () => {
  const bytes = buildJpeg({ width: 5000, height: 7000, paddingSegmentBytes: 60000 });
  assert.deepEqual(parseJpegDimensions(bytes), { w: 5000, h: 7000 });
});

test('parseJpegDimensions: non-JPEG bytes return null, never throw', () => {
  assert.equal(parseJpegDimensions(new Uint8Array([1, 2, 3, 4])), null);
  assert.equal(parseJpegDimensions(new Uint8Array(0)), null);
});

test('parsePngDimensions: reads width/height from IHDR', () => {
  assert.deepEqual(parsePngDimensions(buildPng(7000, 5000)), { w: 7000, h: 5000 });
});

test('parsePngDimensions: wrong signature returns null', () => {
  assert.equal(parsePngDimensions(new Uint8Array(30)), null);
});

test('parseJpegOrientation: reads the EXIF orientation tag', () => {
  const bytes = buildJpeg({ width: 100, height: 100, orientation: 6 });
  assert.equal(parseJpegOrientation(bytes), 6);
});

test('parseJpegOrientation: defaults to 1 with no EXIF segment', () => {
  const bytes = buildJpeg({ width: 100, height: 100 });
  assert.equal(parseJpegOrientation(bytes), 1);
});

test('probeImageDimensionsFromHeader: orientation 6 (90 degree rotation) swaps w/h', async () => {
  const bytes = buildJpeg({ width: 8000, height: 6000, orientation: 6 });
  const file = new File([bytes], 'huge.jpg', { type: 'image/jpeg' });
  assert.deepEqual(await probeImageDimensionsFromHeader(file), { w: 6000, h: 8000 });
});

test('probeImageDimensionsFromHeader: orientation 3 (180 degrees) does NOT swap w/h', async () => {
  const bytes = buildJpeg({ width: 8000, height: 6000, orientation: 3 });
  const file = new File([bytes], 'huge.jpg', { type: 'image/jpeg' });
  assert.deepEqual(await probeImageDimensionsFromHeader(file), { w: 8000, h: 6000 });
});

test('probeImageDimensionsFromHeader: no EXIF -> raw SOF dims, unswapped', async () => {
  const bytes = buildJpeg({ width: 4032, height: 3024 });
  const file = new File([bytes], 'plain.jpg', { type: 'image/jpeg' });
  assert.deepEqual(await probeImageDimensionsFromHeader(file), { w: 4032, h: 3024 });
});

test('probeImageDimensionsFromHeader: PNG works too', async () => {
  const file = new File([buildPng(1200, 1600)], 'x.png', { type: 'image/png' });
  assert.deepEqual(await probeImageDimensionsFromHeader(file), { w: 1200, h: 1600 });
});

test('probeImageDimensionsFromHeader: unrecognised format resolves to null, not a throw', async () => {
  const file = new File([new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9])], 'x.bin');
  assert.equal(await probeImageDimensionsFromHeader(file), null);
});
