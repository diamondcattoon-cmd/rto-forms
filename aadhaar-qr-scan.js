/* ════════ Aadhaar Secure QR — auto-detect from the uploaded photo ════════
   Right after the buyer's Aadhaar FRONT-side photo is attached — "Take
   photo" or "Choose file", both converge on handleFileSelect() →
   setDocImage() → onDocReady() in pro-wallet.js — this runs jsQR (loaded
   from a CDN as the global window.jsQR) against that same image via
   canvas, entirely in the browser: no Worker call, no Gemini, nothing
   sent anywhere. If UIDAI's Secure QR is found, decodeAadhaarSecureQr()
   (aadhaar-qr.js) reads it and fills the buyer's fields, for free. There
   is no separate scan step or camera modal any more — this used to be a
   live getUserMedia scan behind its own "Scan QR" button; seeing PDF-OCR
   feasibility work land in the same codebase argued for one fewer manual
   step here too, so it now just rides along on the upload everyone
   already does.

   Failure is silent to the user in every case except one: a real,
   correctly-read QR that turns out to be the OLD format (pre-2018,
   carries the full 12-digit Aadhaar number) — that's the one outcome
   worth surfacing, since "use a recent Aadhaar" is genuinely actionable
   advice. Every other failure (no QR in the photo at all, blurry, wrong
   angle, compression artefacts) just quietly falls back to manual entry
   — a single still photo the user took for an unrelated reason (proving
   identity, not framing a QR code) is a much less forgiving source than
   a dedicated live scan was, so failing here is the common case, not an
   error worth interrupting anyone over.

   Only the buyer's Aadhaar gets this: the RC already supplies the
   seller's details (DOC_RULES.rc, field-mapping.js, fixed to 'seller'),
   so a decoded Aadhaar QR is always mapped onto the buyer's fields
   regardless — mirrors DOC_RULES.rc's own fixed role the other way. */

function aadhaarQrFailCounts(){
  try{ return JSON.parse(localStorage.getItem('aadhaarQrFailCounts')||'{}'); }
  catch(e){ return {}; }
}
function bumpAadhaarQrFail(reason){
  try{
    const counts=aadhaarQrFailCounts();
    counts[reason]=(counts[reason]||0)+1;
    localStorage.setItem('aadhaarQrFailCounts', JSON.stringify(counts));
  }catch(e){ /* best-effort telemetry only — a full/blocked localStorage just means we don't count this one */ }
}

function loadImageEl(dataUrl){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=reject;
    img.src=dataUrl;
  });
}

/* UIDAI's Secure QR is unusually data-dense (name, address, a downsampled
   photo, and a digital signature all packed into one symbol — a real
   Aadhaar QR routinely needs a QR version in the 20s-30s, which is far
   denser than a typical URL QR). A real module needs several real pixels
   to read reliably. The ~1800px copy setDocImage() keeps for preview/
   PDF-attachment/extraction is plenty for a human or for Gemini, but on a
   full card photo it can downsample the QR itself — which is only a small
   region of the frame — past the point jsQR can lock onto it, which is
   why this used to silently "not find" a QR that was genuinely there.
   4500px keeps real headroom for QR legibility while staying well inside
   the memory-safe range createImageBitmap's resize options were built to
   guarantee (see compressImageFile() in pro-wallet.js and the crash it
   fixed): even a 4500x3375 target is ~15MP, meaningfully less than the
   ~48MP-class source that actually caused that crash, and it's still a
   resize-during-decode, never the source's true native resolution.
   Confirmed against a real 2.8MB Aadhaar photo (reported: jsQR still
   "not found" at 1441x3200/810x1800) that resolution alone wasn't
   enough — buildHighResQrCanvas() being under-resolution wasn't
   necessarily the issue on that photo specifically, but there's no
   reason to leave headroom on the table, and it costs nothing extra
   (still a single bounded decode). */
const AADHAAR_QR_SCAN_MAX_DIM=4500;

/* Builds a canvas from the ORIGINAL uploaded file (doc.sourceFile, see
   setDocImage() in pro-wallet.js) at up to AADHAAR_QR_SCAN_MAX_DIM —
   still resize-constrained, decode-time-downsampled, never a bare/
   unbounded createImageBitmap(file) call. Returns null (never throws) if
   there's no sourceFile to work from (e.g. a PDF upload) or anything
   here fails, so the caller can fall back to the existing display copy. */
async function buildHighResQrCanvas(doc){
  if(!doc.sourceFile || typeof createImageBitmap!=='function'){
    console.log('[aadhaar-qr] buildHighResQrCanvas: skipped — sourceFile=', !!doc.sourceFile, 'createImageBitmap=', typeof createImageBitmap);
    return null;
  }
  try{
    let dims = (typeof probeImageDimensionsFromHeader==='function')
      ? await probeImageDimensionsFromHeader(doc.sourceFile)
      : null;
    if(!dims){
      const probe=await createImageBitmap(doc.sourceFile);
      dims={w:probe.width, h:probe.height};
      probe.close();
    }
    let w=dims.w, h=dims.h;
    if(w>AADHAAR_QR_SCAN_MAX_DIM || h>AADHAAR_QR_SCAN_MAX_DIM){
      const scale=AADHAAR_QR_SCAN_MAX_DIM/Math.max(w,h);
      w=Math.round(w*scale); h=Math.round(h*scale);
    }
    const bmp=await createImageBitmap(doc.sourceFile, {resizeWidth:w, resizeHeight:h, resizeQuality:'high', imageOrientation:'from-image'});
    const canvas=document.createElement('canvas');
    canvas.width=w; canvas.height=h;
    canvas.getContext('2d').drawImage(bmp,0,0,w,h);
    bmp.close();
    console.log('[aadhaar-qr] buildHighResQrCanvas: built', w+'x'+h, 'from sourceFile', doc.sourceFile.size, 'bytes');
    return canvas;
  }catch(e){
    console.log('[aadhaar-qr] buildHighResQrCanvas: failed —', e && e.message);
    return null;
  }
}

async function buildDisplayCopyQrCanvas(doc){
  const img=await loadImageEl(doc.dataUrl);
  const canvas=document.createElement('canvas');
  canvas.width=img.naturalWidth;
  canvas.height=img.naturalHeight;
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  return canvas;
}

/* ── Grayscale + contrast preprocessing ──
   Photographed (not scanned) documents routinely blur the black/white
   module edges jsQR's binarizer relies on — JPEG compression ringing,
   uneven lighting, a slight gradient across the card. A percentile-based
   contrast stretch and Otsu's automatic threshold are the two standard,
   cheap techniques for sharpening exactly that boundary before handing
   the image to a QR reader. Both work from one shared grayscale+histogram
   pass over the source canvas — cheap (one read of already-decoded
   pixels, no re-decode of the file) and reused by both variants below. */
function buildGrayscaleHistogram(sourceCanvas){
  const w=sourceCanvas.width, h=sourceCanvas.height;
  const src=sourceCanvas.getContext('2d').getImageData(0,0,w,h).data;
  const gray=new Uint8ClampedArray(w*h);
  const histogram=new Uint32Array(256);
  for(let i=0,p=0;i<src.length;i+=4,p++){
    const g=(0.299*src[i]+0.587*src[i+1]+0.114*src[i+2])|0;
    gray[p]=g;
    histogram[g]++;
  }
  return {w,h,gray,histogram};
}

function grayscaleValuesToCanvas(w,h,values){
  const canvas=document.createElement('canvas');
  canvas.width=w; canvas.height=h;
  const ctx=canvas.getContext('2d');
  const imageData=ctx.createImageData(w,h);
  const out=imageData.data;
  for(let p=0;p<values.length;p++){
    const v=values[p], o=p*4;
    out[o]=out[o+1]=out[o+2]=v; out[o+3]=255;
  }
  ctx.putImageData(imageData,0,0);
  return canvas;
}

/* Linear contrast stretch between the 1st and 99th percentile of the
   grayscale histogram (not the raw min/max — a handful of outlier pixels,
   e.g. a glare speck or a deep shadow crease, would otherwise dominate
   the whole stretch and undo the point of it). */
function percentileStretchCanvas({w,h,gray,histogram}){
  const total=w*h;
  const lowTarget=Math.floor(total*0.01), highTarget=Math.floor(total*0.01);
  let cum=0, lo=0, hi=255;
  for(let v=0;v<256;v++){ cum+=histogram[v]; if(cum>lowTarget){ lo=v; break; } }
  cum=0;
  for(let v=255;v>=0;v--){ cum+=histogram[v]; if(cum>highTarget){ hi=v; break; } }
  const range=Math.max(1, hi-lo);
  const out=new Uint8ClampedArray(gray.length);
  for(let p=0;p<gray.length;p++) out[p]=Math.min(255,Math.max(0,Math.round((gray[p]-lo)*255/range)));
  return grayscaleValuesToCanvas(w,h,out);
}

/* Otsu's method: the threshold that maximises between-class variance
   between "black module" and "white module" pixel populations — the
   standard automatic-binarization algorithm for exactly this job. */
function otsuThreshold(histogram, total){
  let sumAll=0;
  for(let v=0;v<256;v++) sumAll+=v*histogram[v];
  /* A genuine gap between two clean clusters (exactly the case Otsu is
     used for — cleanly separated black/white modules) produces a run of
     consecutive t's that all tie for the same maximum between-class
     variance, since nothing about the split changes while histogram[t]
     is zero. Taking the very FIRST t in that tie would put the threshold
     right at the edge of the dark cluster instead of in the middle of
     the gap; averaging every tied t lands it in the middle, which is the
     standard convention and what a photographed QR actually needs. */
  let sumB=0, wB=0, maxVar=-1, thresholdSum=0, thresholdCount=0;
  for(let t=0;t<256;t++){
    wB+=histogram[t];
    if(wB===0) continue;
    const wF=total-wB;
    if(wF===0) break;
    sumB+=t*histogram[t];
    const mB=sumB/wB, mF=(sumAll-sumB)/wF;
    const between=wB*wF*(mB-mF)*(mB-mF);
    if(between>maxVar){ maxVar=between; thresholdSum=t; thresholdCount=1; }
    else if(between===maxVar){ thresholdSum+=t; thresholdCount++; }
  }
  return thresholdCount ? Math.round(thresholdSum/thresholdCount) : 127;
}

function otsuBinarizedCanvas({w,h,gray,histogram}){
  const threshold=otsuThreshold(histogram, w*h);
  const out=new Uint8ClampedArray(gray.length);
  for(let p=0;p<gray.length;p++) out[p]=gray[p]>threshold?255:0;
  return grayscaleValuesToCanvas(w,h,out);
}

/* ── Quadrant crops ──
   Aadhaar's QR sits in a fixed, small region of the card layout, wherever
   that is on a given card format — rather than guessing one exact corner
   (layouts have varied across print vintages/e-Aadhaar/PVC card), crop to
   each of the 4 corners at 60% width/height (so adjacent crops overlap in
   the middle — nothing near the midline falls outside every crop) and
   zoom each one in. A crop that isolates just the QR's corner both raises
   its effective pixel density and removes the surrounding card text/
   graphics that can otherwise distract jsQR's finder-pattern search. */
const AADHAAR_QR_CROP_FRACTION=0.6;
const AADHAAR_QR_CROP_ZOOM=1.5;
const AADHAAR_QR_CROP_MAX_DIM=3500;

/* Pure geometry — no canvas/DOM — so it's unit-testable on its own
   (test/aadhaar-qr-crop-geometry.test.js): the 4 corner rectangles to
   crop from a w x h source, each with its own zoomed output size, capped
   at AADHAAR_QR_CROP_MAX_DIM. */
function quadrantCropRects(w,h){
  const cw=Math.round(w*AADHAAR_QR_CROP_FRACTION), ch=Math.round(h*AADHAAR_QR_CROP_FRACTION);
  const corners=[
    {x:0,y:0,label:'top-left'}, {x:w-cw,y:0,label:'top-right'},
    {x:0,y:h-ch,label:'bottom-left'}, {x:w-cw,y:h-ch,label:'bottom-right'}
  ];
  let scale=AADHAAR_QR_CROP_ZOOM;
  if(cw*scale>AADHAAR_QR_CROP_MAX_DIM || ch*scale>AADHAAR_QR_CROP_MAX_DIM){
    scale=AADHAAR_QR_CROP_MAX_DIM/Math.max(cw,ch);
  }
  const outW=Math.round(cw*scale), outH=Math.round(ch*scale);
  return corners.map(({x,y,label})=>({label,x,y,cw,ch,outW,outH}));
}

function quadrantCrops(sourceCanvas){
  const w=sourceCanvas.width, h=sourceCanvas.height;
  return quadrantCropRects(w,h).map(({label,x,y,cw,ch,outW,outH})=>({
    label,
    build:()=>{
      const canvas=document.createElement('canvas');
      canvas.width=outW; canvas.height=outH;
      canvas.getContext('2d').drawImage(sourceCanvas, x,y,cw,ch, 0,0,outW,outH);
      return canvas;
    }
  }));
}

function tryJsQrOnCanvas(canvas, label){
  try{
    const imageData=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
    const code=jsQR(imageData.data, imageData.width, imageData.height);
    console.log('[aadhaar-qr] jsQR on', label, canvas.width+'x'+canvas.height, '->', code ? 'FOUND (' + code.data.length + ' chars)' : 'not found');
    return (code && code.data) ? code : null;
  }catch(e){
    console.log('[aadhaar-qr] jsQR threw on', label, canvas.width+'x'+canvas.height, '—', e && e.message);
    return null;
  }
}

/* Called from onDocReady() (pro-wallet.js) for every doc-upload key, every
   time — the key!=='aadhaar_buyer_front' guard is what makes this a no-op
   everywhere else (seller's Aadhaar, both back sides, PAN, RC, face
   photo). Never throws outward: any failure here is either silently
   counted or shown as the one old-format notice, but always lets the
   upload flow itself continue untouched.

   Tries, in order, stopping at the first successful decode: the raw
   high-res frame, an Otsu-binarized version of it, a contrast-stretched
   grayscale version of it, each of the 4 zoomed corner crops, and finally
   the old ~1800px display copy (covers the rare case a sourceFile isn't
   available at all). Candidates are built one at a time — never all held
   in memory together — specifically so trying several full-size variants
   doesn't reintroduce the kind of memory pressure the low-memory crash
   fix was about; only the base high-res canvas (crops/preprocessing are
   derived from it) and whichever single candidate is being tested exist
   at once. */
async function attemptAadhaarQrFromUpload(key){
  if(key!=='aadhaar_buyer_front') return;
  const doc=DOC_STATE[key];
  console.log('[aadhaar-qr] attemptAadhaarQrFromUpload: key=', key, 'hasDoc=', !!doc, 'hasDataUrl=', !!(doc && doc.dataUrl), 'hasSourceFile=', !!(doc && doc.sourceFile), 'jsQR=', typeof jsQR);
  if(!doc || !doc.dataUrl) return;
  if(typeof jsQR!=='function') return; // library failed to load from the CDN — silent, same as "no QR found"

  const hiRes=await buildHighResQrCanvas(doc);
  let code=null;

  if(hiRes){
    code=tryJsQrOnCanvas(hiRes, 'raw');
    if(!code){
      let gh=null;
      try{ gh=buildGrayscaleHistogram(hiRes); }catch(e){ console.log('[aadhaar-qr] buildGrayscaleHistogram failed —', e && e.message); }
      if(gh){
        try{ code=tryJsQrOnCanvas(otsuBinarizedCanvas(gh), 'otsu'); }catch(e){ console.log('[aadhaar-qr] otsu failed —', e && e.message); }
        if(!code){
          try{ code=tryJsQrOnCanvas(percentileStretchCanvas(gh), 'contrast-stretch'); }catch(e){ console.log('[aadhaar-qr] contrast-stretch failed —', e && e.message); }
        }
      }
    }
    if(!code){
      for(const crop of quadrantCrops(hiRes)){
        try{ code=tryJsQrOnCanvas(crop.build(), 'crop:'+crop.label); }catch(e){ console.log('[aadhaar-qr] crop', crop.label, 'failed —', e && e.message); }
        if(code) break;
      }
    }
  }

  if(!code){
    try{ code=tryJsQrOnCanvas(await buildDisplayCopyQrCanvas(doc), 'display-copy'); }
    catch(e){ console.log('[aadhaar-qr] buildDisplayCopyQrCanvas failed —', e && e.message); }
  }

  if(!code || !code.data){
    bumpAadhaarQrFail('not-found');
    return;
  }
  await processAadhaarQrText(code.data);
}

/* A QR pattern WAS found in the photo (jsQR only ever returns a
   checksum-valid symbol, never garbage) — what's left is asking
   decodeAadhaarSecureQr() whether it's a Secure QR we can use.
   'decode-error' (found a QR, but not a parseable Secure Aadhaar one —
   e.g. an unrelated QR happened to be in frame) stays silent, same as
   not-found; only 'old-format' is worth telling the user about. */
async function processAadhaarQrText(qrText){
  const result=await decodeAadhaarSecureQr(qrText);
  console.log('[aadhaar-qr] decodeAadhaarSecureQr ->', result.ok ? 'ok' : ('rejected: ' + result.reason));
  if(!result.ok){
    bumpAadhaarQrFail(result.reason);
    if(result.reason==='old-format') showAadhaarQrNotice(t('ai.qrOldFormat'), 'err');
    return;
  }
  applyAadhaarQrResult(result.mapped);
  showAadhaarQrNotice(t('ai.qrFilled'), 'ok');
}

/* Same field-write pattern as pro-wallet.js's applyExtractionResult()
   (uppercase, then straight into VALS) — minus AI_FIELD_MAP/FIELD_SOURCE/
   AI_FILLED_FIELDS entirely: those exist for the paid Gemini pipeline's
   conflict-arbitration and "AI" badge, neither of which applies here (QR
   data has no competing source to arbitrate against, and it isn't AI —
   badging it that way would just be wrong). */
function applyAadhaarQrResult(mapped){
  Object.keys(mapped).forEach(k=>{ if(mapped[k]) VALS[k]=String(mapped[k]).toUpperCase(); });
  scheduleSaveVals();
  updateSections();
}

/* #qrScanResult sits in the buyer Aadhaar box's own markup, right under
   its header — the only place this feature ever speaks up. */
function showAadhaarQrNotice(msg, kind){
  const el=document.getElementById('qrScanResult');
  if(!el) return;
  el.textContent=msg;
  el.className='qr-scan-result'+(kind==='err' ? ' err' : '');
  el.style.display='block';
}

/* Clears a stale notice ("Details filled from Aadhaar QR" / the
   old-format warning) when the buyer's Aadhaar is removed — called from
   removeDoc('aadhaar_buyer') (pro-wallet.js) so a removed photo doesn't
   leave a claim on screen about a photo that's no longer there. */
function clearAadhaarQrNotice(){
  const el=document.getElementById('qrScanResult');
  if(!el) return;
  el.style.display='none';
  el.textContent='';
}
