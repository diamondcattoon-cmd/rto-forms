/* ════════ Aadhaar Secure QR — scan UI (camera + photo fallback) ════════
   Wires the "Scan QR" button in the buyer's Aadhaar box (docSlot-aadhaar-buyer
   in the task page markup) to a live getUserMedia scan loop (jsQR, loaded
   from a CDN as the global window.jsQR) plus an always-available "choose a
   photo instead" fallback — both funnel into the same decodeAadhaarSecureQr()
   (aadhaar-qr.js). Nothing here ever calls our Worker or any server: this is
   a completely separate, free code path from pro-wallet.js's paid RC/AI
   extraction — no wallet, no EXTRACTED_SET/FIELD_SOURCE bookkeeping, no
   Gemini.

   Only the buyer's Aadhaar box gets this button, in every task page: the RC
   already supplies the seller's details (DOC_RULES.rc, field-mapping.js is
   fixed to 'seller'), so a scanned Aadhaar QR is always mapped onto the
   buyer's fields regardless of whose physical Aadhaar was scanned — see
   aadhaarQrMapToBuyerFields()'s own comment for the same reasoning applied
   the other way. That also means these functions don't take a slotId param
   the way pro-wallet.js's do — there's exactly one caller.

   Live camera is the primary path (getUserMedia + jsQR, continuous frames —
   far more reliable than a single static photo, since the user gets to
   adjust framing/focus in real time); a picked photo is decoded once,
   client-side, as a fallback for when camera access isn't available. */

let AADHAAR_QR_STREAM=null;
let AADHAAR_QR_SCANNING=false;
let AADHAAR_QR_RESUME_TIMER=null;

/* ── Failure counter (localStorage only — no personal data, just tallies
   how often each failure reason happens) — see the file's task instructions:
   this is how we'll eventually decide whether an OCR fallback is worth
   building, not something read back into the UI anywhere. ── */
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

function openAadhaarQrScan(){
  const modal=document.getElementById('qrScanModal');
  if(!modal) return;
  modal.style.display='flex';
  const errEl=document.getElementById('qrScanError');
  if(errEl){ errEl.style.display='none'; errEl.textContent=''; }
  const statusLine=document.getElementById('qrScanStatusLine');
  if(statusLine) statusLine.textContent=t('ai.qrScanning');
  const resultEl=document.getElementById('qrScanResult');
  if(resultEl) resultEl.style.display='none';
  startAadhaarQrCamera();
}

function closeAadhaarQrScan(){
  AADHAAR_QR_SCANNING=false;
  if(AADHAAR_QR_RESUME_TIMER){ clearTimeout(AADHAAR_QR_RESUME_TIMER); AADHAAR_QR_RESUME_TIMER=null; }
  if(AADHAAR_QR_STREAM){
    AADHAAR_QR_STREAM.getTracks().forEach(tr=>tr.stop());
    AADHAAR_QR_STREAM=null;
  }
  const modal=document.getElementById('qrScanModal');
  if(modal) modal.style.display='none';
}

async function startAadhaarQrCamera(){
  const video=document.getElementById('qrScanVideo');
  const errEl=document.getElementById('qrScanError');
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    showAadhaarQrError(t('camera.notAvailable')+' '+t('ai.qrChoosePhotoHint'));
    return;
  }
  try{
    /* Rear camera preferred (a laptop's front-facing webcam still works via
       plain `ideal`, it just won't be steered toward any particular lens). */
    AADHAAR_QR_STREAM=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}, audio:false});
    video.srcObject=AADHAAR_QR_STREAM;
    AADHAAR_QR_SCANNING=true;
    requestAnimationFrame(scanAadhaarQrFrame);
  }catch(err){
    let msg=t('camera.genericError');
    if(err && err.name==='NotAllowedError') msg=t('camera.permissionDenied');
    else if(err && err.name==='NotFoundError') msg=t('camera.notFound');
    showAadhaarQrError(msg+' '+t('ai.qrChoosePhotoHint'));
  }
}

function scanAadhaarQrFrame(){
  if(!AADHAAR_QR_SCANNING) return;
  const video=document.getElementById('qrScanVideo');
  const canvas=document.getElementById('qrScanCanvas');
  if(video && canvas && video.readyState===video.HAVE_ENOUGH_DATA && typeof jsQR==='function'){
    canvas.width=video.videoWidth;
    canvas.height=video.videoHeight;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);
    const code=jsQR(imageData.data, imageData.width, imageData.height, {inversionAttempts:'dontInvert'});
    if(code && code.data){
      AADHAAR_QR_SCANNING=false;
      processAadhaarQrText(code.data);
      return;
    }
  }
  requestAnimationFrame(scanAadhaarQrFrame);
}

/* "Choose a photo instead" — decodes once against the picked image, no
   loop. Used both as the always-available secondary path and as what a
   user reaches for when camera access itself failed. */
async function handleQrScanFileSelect(file){
  if(!file) return;
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{
      const el=new Image();
      el.onload=()=>resolve(el);
      el.onerror=reject;
      el.src=url;
    });
    const canvas=document.getElementById('qrScanCanvas');
    canvas.width=img.naturalWidth;
    canvas.height=img.naturalHeight;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);
    const code=(typeof jsQR==='function') ? jsQR(imageData.data, imageData.width, imageData.height) : null;
    if(!code || !code.data){
      bumpAadhaarQrFail('not-found');
      showAadhaarQrError(t('ai.qrCouldNotRead'));
      return;
    }
    AADHAAR_QR_SCANNING=false;
    await processAadhaarQrText(code.data);
  }catch(e){
    bumpAadhaarQrFail('not-found');
    showAadhaarQrError(t('ai.qrCouldNotRead'));
  }finally{
    URL.revokeObjectURL(url);
  }
}

/* Common path for both a QR the live loop found and one decoded from a
   photo: a QR pattern WAS found (jsQR itself only returns a checksum-valid
   symbol, never garbage) — what's left is asking decodeAadhaarSecureQr()
   whether it's a Secure QR we can use. On failure, live scanning resumes
   automatically after a short pause so the user doesn't have to close and
   reopen the modal to try again (e.g. after swapping which document they're
   holding up); a photo-fallback failure just leaves the picker available. */
async function processAadhaarQrText(qrText){
  const statusLine=document.getElementById('qrScanStatusLine');
  if(statusLine) statusLine.textContent=t('status.reading');
  const result=await decodeAadhaarSecureQr(qrText);
  if(!result.ok){
    bumpAadhaarQrFail(result.reason);
    showAadhaarQrError(result.reason==='old-format' ? t('ai.qrOldFormat') : t('ai.qrCouldNotRead'));
    const modal=document.getElementById('qrScanModal');
    if(AADHAAR_QR_STREAM && modal && modal.style.display!=='none'){
      AADHAAR_QR_RESUME_TIMER=setTimeout(()=>{
        AADHAAR_QR_RESUME_TIMER=null;
        if(!AADHAAR_QR_STREAM) return; // modal was closed in the meantime
        AADHAAR_QR_SCANNING=true;
        if(statusLine) statusLine.textContent=t('ai.qrScanning');
        requestAnimationFrame(scanAadhaarQrFrame);
      }, 2500);
    }
    return;
  }
  applyAadhaarQrResult(result.mapped);
  closeAadhaarQrScan();
  showAadhaarQrFilledNotice();
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

function showAadhaarQrError(msg){
  const errEl=document.getElementById('qrScanError');
  const statusLine=document.getElementById('qrScanStatusLine');
  if(statusLine) statusLine.textContent='';
  if(errEl){ errEl.textContent=msg; errEl.style.display='block'; }
}

/* The box-level "Details filled from Aadhaar QR" line (docSlot-aadhaar-buyer
   markup) — separate from state-aadhaar-buyer, which still tracks the
   physical attachment's own upload state and is untouched by this. */
function showAadhaarQrFilledNotice(){
  const resultEl=document.getElementById('qrScanResult');
  if(!resultEl) return;
  resultEl.textContent=t('ai.qrFilled');
  resultEl.style.display='block';
}
