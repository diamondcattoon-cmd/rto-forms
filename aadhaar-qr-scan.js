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

/* Called from onDocReady() (pro-wallet.js) for every doc-upload key, every
   time — the key!=='aadhaar_buyer_front' guard is what makes this a no-op
   everywhere else (seller's Aadhaar, both back sides, PAN, RC, face
   photo). Never throws outward: any failure here is either silently
   counted or shown as the one old-format notice, but always lets the
   upload flow itself continue untouched. */
async function attemptAadhaarQrFromUpload(key){
  if(key!=='aadhaar_buyer_front') return;
  const doc=DOC_STATE[key];
  if(!doc || !doc.dataUrl) return;
  if(typeof jsQR!=='function') return; // library failed to load from the CDN — silent, same as "no QR found"

  let code=null;
  try{
    const img=await loadImageEl(doc.dataUrl);
    const canvas=document.createElement('canvas');
    canvas.width=img.naturalWidth;
    canvas.height=img.naturalHeight;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);
    code=jsQR(imageData.data, imageData.width, imageData.height);
  }catch(e){
    bumpAadhaarQrFail('not-found');
    return;
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
