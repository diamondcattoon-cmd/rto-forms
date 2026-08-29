/* ════════ PRO — AI AUTO-FILL (Gemini Vision) + Wallet (Razorpay-first) ════════
   Everything behind the paid "PRO" features: document upload → Gemini
   extraction via the Cloudflare Worker, and the wallet (Razorpay recharge +
   SMS-based recovery). Depends on field-mapping.js (AI_FIELD_MAP) and
   forms-data.js (VALS, scheduleSaveVals, AI_FILLED_FIELDS) already being
   loaded, and calls updateSections() (ui.js) after a successful extraction
   — safe regardless of load order relative to ui.js since that call only
   happens from a user-triggered handler, well after every script has
   finished loading. Ends with its own on-load bootstrap (balance fetch,
   recovery-link claim check) — self-contained.

   Wallet identity: PRO.walletId is a random token, never a mobile number —
   there is no upfront "set up your wallet" step. It's minted by the Worker
   on first payment (see startPayment()) and reused for every /balance and
   /extract call after that (sent as the `token` param — token IS the
   walletId, see worker/src/index.js). There is no account-recovery path if
   this token is lost (cleared storage, new device) — an earlier MSG91-based
   recovery-link flow was removed since it was never actually configured in
   production. */
const WORKER_URL='https://rto-ai-extract.diamondcattoon.workers.dev';

let PRO=Object.assign({walletId:''}, JSON.parse(localStorage.getItem('rtoProState')||'{}'));
delete PRO.role; /* migrate away from the old single global role (pre-per-document DOC_ROLE) if a stale copy is still in localStorage */
PRO.uploads={}; /* images kept in memory only for this session — used for PDF attachment */
PRO.balancePaise=0;

/* ── Per-document role ──
   Replaces the old single global "fill as seller/buyer" toggle. Each
   document type that DOC_RULES (field-mapping.js) marks as 'choice' (i.e.
   could belong to either party — aadhaar, pan) gets its OWN role, so a user
   can extract the seller's Aadhaar and the buyer's Aadhaar in the same
   session without one overwriting the other's setting. A 'fixed'-role doc
   type (rc) has no entry here at all — its role is never asked for, never
   stored, and AI_FIELD_MAP.rc ignores whatever's passed to it anyway (see
   field-mapping.js). Defaults come from DOC_RULES itself, not hardcoded
   here, so a new 'choice' doc type added there needs no change in this file. */
let DOC_ROLE={};
Object.keys(DOC_RULES).forEach(docType=>{
  if(DOC_RULES[docType].role==='choice') DOC_ROLE[docType]=DOC_RULES[docType].defaultRole;
});
try{
  const savedRoles=JSON.parse(localStorage.getItem('rtoProState')||'{}').docRole;
  if(savedRoles && typeof savedRoles==='object'){
    Object.keys(DOC_ROLE).forEach(docType=>{ if(savedRoles[docType]==='seller'||savedRoles[docType]==='buyer') DOC_ROLE[docType]=savedRoles[docType]; });
  }
}catch(e){}

function saveProState(){ localStorage.setItem('rtoProState', JSON.stringify({walletId:PRO.walletId, docRole:DOC_ROLE})); }
function setDocRole(docType, role){
  if(!(docType in DOC_ROLE)) return; /* not a 'choice' doc type — nothing to set */
  DOC_ROLE[docType]=(role==='buyer')?'buyer':'seller';
  saveProState();
}

/* The role actually used for a given extraction:
   - 'fixed'-role doc types (rc) always resolve through resolveDocRole() to
     their defaultRole, ignoring everything below (field-mapping.js already
     enforces this too — this is belt-and-suspenders, not the only guard).
   - Otherwise, if none of the currently CHECKED forms need a buyer at all
     (PICKS[i].needB — see forms-data.js), there's no buyer to fill in, so
     force 'seller' regardless of what DOC_ROLE has stored. This covers the
     case where a buyer role was chosen earlier and the user then switched
     to a buyer-less package (e.g. RC renewal) without manually resetting it. */
function getEffectiveRole(docType){
  const rule=DOC_RULES[docType];
  if(rule && rule.role==='fixed') return rule.defaultRole;
  const anyB=typeof PICKS!=='undefined' && PICKS.filter(p=>CHECKED[p.id]).some(p=>p.needB);
  if(!anyB) return 'seller';
  return DOC_ROLE[docType] || (rule && rule.defaultRole) || 'seller';
}

/* Updates every balance badge on the page — the AI panel's own
   (#proCreditsBadge, only present once the panel is open) and the header
   one (#hdrWalletBadge, present on every page, every state — shows ₹0.00
   for a brand-new visitor with no wallet yet, same as anyone else). */
function renderProCredits(){
  const text='₹'+(PRO.balancePaise/100).toFixed(2);
  const el=document.getElementById('proCreditsBadge');
  if(el) el.textContent=text;
  const hdrEl=document.getElementById('hdrWalletBadge');
  if(hdrEl) hdrEl.textContent=text;
}

async function fetchWalletBalance(){
  if(!PRO.walletId) return;
  try{
    const res=await fetch(WORKER_URL+'/balance?token='+encodeURIComponent(PRO.walletId));
    const j=await res.json();
    if(j.balancePaise!==undefined){ PRO.balancePaise=j.balancePaise; renderProCredits(); }
  }catch(e){ /* silent — balance will refresh on next action */ }
}

/* DOC_STATE holds the confirmed image (dataUrl + mimeType) the user has previewed & approved, per slot key */
const DOC_STATE={};

function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(r.result);
    r.onerror=reject;
    r.readAsDataURL(file);
  });
}
function loadImageDims(dataUrl){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve({w:img.naturalWidth||800,h:img.naturalHeight||600});
    img.onerror=()=>resolve({w:800,h:600});
    img.src=dataUrl;
  });
}
/* Downscales large photos (mobile cameras easily produce 10-20MB files) before upload —
   keeps text legible for AI extraction while avoiding slow/failed uploads on weak networks. */
function compressImage(dataUrl, maxDim, quality){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      let w=img.naturalWidth, h=img.naturalHeight;
      if(w>maxDim || h>maxDim){
        const scale=maxDim/Math.max(w,h);
        w=Math.round(w*scale); h=Math.round(h*scale);
      }
      const canvas=document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL('image/jpeg', quality||0.85));
    };
    img.onerror=()=>resolve(dataUrl);
    img.src=dataUrl;
  });
}

/* toISODate() and AI_FIELD_MAP now live in field-mapping.js (loaded above as
   a plain <script>) so the Node test suite can require() the exact same
   code the browser runs. */

/* ── Consent gate: the 4 identity-document inputs (aadhaar front/back, PAN, RC) start
   `disabled` in the HTML — this just mirrors that state once the user ticks the consent
   checkbox above them. The face-photo upload is intentionally excluded: it never leaves
   the browser (attached to the PDF locally), so it isn't sent to Gemini and needs no consent. */
/* Each original single input is now a camera/gallery pair (see the
   doc-input-row markup) — both members of every pair still gate on the
   same consent checkbox. */
const CONSENT_GATED_INPUT_IDS=[
  'file-aadhaar-front-camera','file-aadhaar-front-file',
  'file-aadhaar-back-camera','file-aadhaar-back-file',
  'file-pan-camera','file-pan-file',
  'file-rc-camera','file-rc-file'
];
/* One hint per gated slot (not per input — aadhaar front+back share one slot/hint) — see
   consentHint-* in index.html, sitting right above the greyed-out inputs so it's obvious
   why they're disabled. */
const CONSENT_HINT_IDS=['consentHint-aadhaar','consentHint-pan','consentHint-rc'];
/* Task-page v2 layout only — these three cards get a visibly "locked" look
   (faded + lock icon, see .ai-box-picker .upload-slot.locked in style.css)
   until consent is given. The root page's older PRO panel doesn't use this
   class at all, so toggling it there is a harmless no-op. */
const CONSENT_GATED_SLOT_IDS=['docSlot-rc','docSlot-aadhaar','docSlot-pan'];
function onConsentChange(){
  const checked=document.getElementById('uploadConsentChk').checked;
  CONSENT_GATED_INPUT_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.disabled=!checked;
    const row=el.closest('.doc-input-row');
    if(row) row.classList.toggle('doc-input-disabled', !checked);
  });
  CONSENT_HINT_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display=checked?'none':'block';
  });
  CONSENT_GATED_SLOT_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.toggle('locked', !checked);
  });
}

/* Clicking a locked upload card (task-page v2 layout) does nothing to the
   card itself (its file input is disabled) — instead it nudges the user
   back to the consent checkbox they haven't ticked yet, rather than
   silently doing nothing. Wired via onclick="onDocSlotGridClick(event)"
   on #docSlotGrid in the task-page HTML — root's #docSlotGrid has no such
   handler, so this is never called there. */
function onDocSlotGridClick(e){
  const consentEl=document.getElementById('uploadConsentChk');
  if(!consentEl || consentEl.checked) return;
  if(!e.target.closest('.upload-slot')) return;
  const box=document.querySelector('.consent-chk');
  if(!box) return;
  box.classList.remove('shake');
  void box.offsetWidth; /* restart the CSS animation even on a repeat click */
  box.classList.add('shake','consent-highlight');
  box.scrollIntoView({behavior:'smooth', block:'center'});
  setTimeout(()=>box.classList.remove('shake'), 450);
  setTimeout(()=>box.classList.remove('consent-highlight'), 1500);
}

/* ── File selection: shows a preview immediately. PDFs render to page thumbnails so the
   right page can be picked (handles multi-page / multi-document PDFs and scans). ── */
async function handleFileSelect(key, file){
  if(!file) return;
  /* Belt-and-suspenders: the input itself is `disabled` until consent is given, but this
     guard covers any path that could still fire (e.g. a value set programmatically). */
  const consentEl=document.getElementById('uploadConsentChk');
  if(consentEl && !consentEl.checked) return;
  const isPdf = file.type==='application/pdf' || /\.pdf$/i.test(file.name||'');
  const previewEl=document.getElementById('preview-'+key);
  const pickerEl=document.getElementById('pages-'+key);
  previewEl.innerHTML='<p class="fld-hint">'+t('status.loadingPreview')+'</p>';
  pickerEl.style.display='none'; pickerEl.innerHTML='';

  if(isPdf){
    try{
      const dataUrl=await fileToBase64(file);
      const raw=atob(dataUrl.split(',')[1]);
      const bytes=new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
      const pdf=await pdfjsLib.getDocument({data:bytes}).promise;
      const pageCount=Math.min(pdf.numPages, 8);
      const thumbs=[];
      for(let p=1;p<=pageCount;p++){
        const page=await pdf.getPage(p);
        const viewport=page.getViewport({scale:1.1});
        const canvas=document.createElement('canvas');
        canvas.width=viewport.width; canvas.height=viewport.height;
        await page.render({canvasContext:canvas.getContext('2d'), viewport}).promise;
        thumbs.push(canvas.toDataURL('image/jpeg',0.85));
      }
      if(thumbs.length===1){
        setDocImage(key, thumbs[0]);
      }else{
        previewEl.innerHTML='<p class="fld-hint">'+t('status.pdfPagePicker',{n:thumbs.length})+'</p>';
        pickerEl.style.display='flex';
        thumbs.forEach((th,i)=>{
          const img=document.createElement('img');
          img.src=th; img.className='pdf-page-thumb'; img.title=t('ai.pageN',{n:i+1});
          img.onclick=()=>{ selectPdfPage(key, th, pickerEl); };
          pickerEl.appendChild(img);
        });
      }
    }catch(err){
      previewEl.innerHTML='<p class="fld-hint" style="color:var(--stamp)">'+t('status.pdfReadError',{msg:err.message})+'</p>';
    }
  }else{
    const rawDataUrl=await fileToBase64(file);
    const dataUrl=await compressImage(rawDataUrl, 1800, 0.85);
    setDocImage(key, dataUrl);
  }
}

function selectPdfPage(key, dataUrl, pickerEl){
  [...pickerEl.children].forEach(el=>el.classList.remove('sel'));
  const clicked=[...pickerEl.children].find(el=>el.src===dataUrl);
  if(clicked) clicked.classList.add('sel');
  setDocImage(key, dataUrl, true);
}

function setDocImage(key, dataUrl, keepPicker){
  DOC_STATE[key]={dataUrl, mimeType:'image/jpeg'};
  const previewEl=document.getElementById('preview-'+key);
  if(!keepPicker){
    previewEl.innerHTML='';
    const img=document.createElement('img');
    img.src=dataUrl;
    previewEl.appendChild(img);
  }else{
    let img=previewEl.querySelector('img.doc-main-preview');
    if(!img){
      previewEl.innerHTML='';
      img=document.createElement('img');
      img.className='doc-main-preview';
      previewEl.appendChild(img);
    }
    img.src=dataUrl;
  }
  onDocReady(key);
}

function onDocReady(key){
  const docType = (key==='aadhaar_front' || key==='aadhaar_back') ? 'aadhaar' : key;
  const stateEl=document.getElementById('state-'+docType);
  stateEl.textContent=t('ai.previewReady');
  stateEl.className='upload-slot-state';
  /* Purely additive visual cue ("this card is ready") — harmless on the
     root page too (no CSS targets .ready outside the task-page v2 layout,
     see .ai-box-picker .upload-slot.ready in style.css), but added
     unconditionally here since it's the same slot element either way. */
  const slotEl=document.getElementById('docSlot-'+docType);
  if(slotEl) slotEl.classList.add('ready');
  const removeBtn=document.getElementById('remove-'+docType);
  if(removeBtn) removeBtn.style.display='inline';
  updateCheckoutBox();
}

/* ── Desktop camera capture (getUserMedia) ──
   Mobile keeps using the native <input capture=environment> (still wired
   up unchanged in the HTML) — that's the better UX there and isn't
   touched. This is ONLY for a laptop/desktop, where `capture` is ignored
   and clicking that file input just opens a plain file picker with no
   camera at all. Every "Take photo" button (rc/aadhaar_front/aadhaar_back/
   pan/photo) now calls handleTakePhotoClick(key) instead of being a plain
   <label for=...>, so it can pick the right path per device.

   The captured frame is wrapped into a real `File` and passed to the
   EXACT SAME handleFileSelect()/handlePhotoUpload() used for a picked
   file — not a parallel code path — so it goes through the identical
   compression/preview/state pipeline either way; there is nothing
   camera-specific to keep in sync with those. */
function isTouchPrimaryDevice(){
  return !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
}

let CAMERA_TARGET_KEY=null;
let CAMERA_STREAM=null;

function handleTakePhotoClick(key){
  if(isTouchPrimaryDevice()){
    const nativeInput=document.getElementById('file-'+key.replace(/_/g,'-')+'-camera');
    if(nativeInput) nativeInput.click();
    return;
  }
  openCameraModal(key);
}

async function openCameraModal(key){
  CAMERA_TARGET_KEY=key;
  const modal=document.getElementById('cameraModal');
  const video=document.getElementById('cameraVideo');
  const capturedImg=document.getElementById('cameraCapturedImg');
  const errEl=document.getElementById('cameraError');
  const captureBtn=document.getElementById('cameraCaptureBtn');
  const retakeBtn=document.getElementById('cameraRetakeBtn');
  const useBtn=document.getElementById('cameraUseBtn');
  const fallbackBtn=document.getElementById('cameraChooseFileFallback');

  modal.style.display='flex';
  errEl.style.display='none'; errEl.textContent='';
  video.style.display='block'; capturedImg.style.display='none';
  captureBtn.style.display='inline-block'; retakeBtn.style.display='none'; useBtn.style.display='none';
  fallbackBtn.style.display='none';

  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    showCameraError(t('camera.notAvailable'));
    return;
  }
  try{
    CAMERA_STREAM=await navigator.mediaDevices.getUserMedia({video:true, audio:false});
    video.srcObject=CAMERA_STREAM;
  }catch(err){
    let msg=t('camera.genericError');
    if(err && err.name==='NotAllowedError') msg=t('camera.permissionDenied');
    else if(err && err.name==='NotFoundError') msg=t('camera.notFound');
    showCameraError(msg);
  }
}

function showCameraError(msg){
  const errEl=document.getElementById('cameraError');
  errEl.textContent=msg+' '+t('camera.useFileInstead');
  errEl.style.display='block';
  document.getElementById('cameraCaptureBtn').style.display='none';
  const fallbackBtn=document.getElementById('cameraChooseFileFallback');
  fallbackBtn.style.display='inline-block';
  fallbackBtn.textContent=t('camera.chooseFile');
}

function stopCameraStream(){
  if(CAMERA_STREAM){
    CAMERA_STREAM.getTracks().forEach(tr=>tr.stop());
    CAMERA_STREAM=null;
  }
}

function closeCameraModal(){
  stopCameraStream();
  const modal=document.getElementById('cameraModal');
  if(modal) modal.style.display='none';
  CAMERA_TARGET_KEY=null;
}

function captureCameraPhoto(){
  const video=document.getElementById('cameraVideo');
  const canvas=document.getElementById('cameraCanvas');
  const capturedImg=document.getElementById('cameraCapturedImg');
  canvas.width=video.videoWidth||1280;
  canvas.height=video.videoHeight||960;
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  capturedImg.src=canvas.toDataURL('image/jpeg',0.92);

  video.style.display='none';
  capturedImg.style.display='block';
  document.getElementById('cameraCaptureBtn').style.display='none';
  document.getElementById('cameraRetakeBtn').style.display='inline-block';
  document.getElementById('cameraUseBtn').style.display='inline-block';
}

function retakeCameraPhoto(){
  document.getElementById('cameraCapturedImg').style.display='none';
  document.getElementById('cameraVideo').style.display='block';
  document.getElementById('cameraCaptureBtn').style.display='inline-block';
  document.getElementById('cameraRetakeBtn').style.display='none';
  document.getElementById('cameraUseBtn').style.display='none';
}

function useCameraPhoto(){
  const canvas=document.getElementById('cameraCanvas');
  const key=CAMERA_TARGET_KEY;
  canvas.toBlob(blob=>{
    if(!blob || !key) return;
    const file=new File([blob], 'camera-photo.jpg', {type:'image/jpeg'});
    closeCameraModal();
    if(key==='photo') handlePhotoUpload(file);
    else handleFileSelect(key, file);
  }, 'image/jpeg', 0.92);
}

function useChooseFileFallback(){
  const key=CAMERA_TARGET_KEY;
  closeCameraModal();
  if(!key) return;
  const fileInput=document.getElementById('file-'+key.replace(/_/g,'-')+'-file');
  if(fileInput) fileInput.click();
}

/* Clears one document's uploaded photo(s) and, if it had already been
   successfully extracted, everything that extraction wrote — after
   confirming, since that ₹5 was already charged and won't be refunded by
   removing the result. 'aadhaar' clears both front and back as one unit
   (they're billed and extracted together — see getBatchItem()); 'photo'
   is the plain (never billed, never extracted) face-photo attachment and
   skips all of that. Task-page v2 layout only — root's markup has no
   #remove-* buttons wired to this. */
function removeDoc(docType){
  if(docType==='photo'){
    delete PRO.uploads.photo;
    const prev=document.getElementById('preview-photo'); if(prev) prev.innerHTML='';
    const f=document.getElementById('file-photo'); if(f) f.value='';
    const stateEl=document.getElementById('state-photo');
    if(stateEl){ stateEl.textContent=t('ai.notUploaded'); stateEl.className='upload-slot-state'; }
    const removeBtn=document.getElementById('remove-photo');
    if(removeBtn) removeBtn.style.display='none';
    return;
  }

  const alreadyExtracted=EXTRACTED_SET.has(docType);
  if(alreadyExtracted){
    const ok=confirm(t('ai.removeConfirm'));
    if(!ok) return;
  }

  if(docType==='aadhaar'){
    delete DOC_STATE.aadhaar_front;
    delete DOC_STATE.aadhaar_back;
    ['aadhaar_front','aadhaar_back'].forEach(key=>{
      const prev=document.getElementById('preview-'+key); if(prev) prev.innerHTML='';
      const pages=document.getElementById('pages-'+key); if(pages){ pages.style.display='none'; pages.innerHTML=''; }
    });
    const fFront=document.getElementById('file-aadhaar-front'); if(fFront) fFront.value='';
    const fBack=document.getElementById('file-aadhaar-back'); if(fBack) fBack.value='';
  } else {
    delete DOC_STATE[docType];
    const prev=document.getElementById('preview-'+docType); if(prev) prev.innerHTML='';
    const pages=document.getElementById('pages-'+docType); if(pages){ pages.style.display='none'; pages.innerHTML=''; }
    const f=document.getElementById('file-'+docType); if(f) f.value='';
  }

  const slotEl=document.getElementById('docSlot-'+docType);
  if(slotEl) slotEl.classList.remove('ready');
  const stateEl=document.getElementById('state-'+docType);
  if(stateEl){ stateEl.textContent=t('ai.notUploaded'); stateEl.className='upload-slot-state'; }
  const removeBtn=document.getElementById('remove-'+docType);
  if(removeBtn) removeBtn.style.display='none';
  const retryBtn=document.getElementById('extract-'+docType);
  if(retryBtn) retryBtn.style.display='none';

  if(alreadyExtracted){
    EXTRACTED_SET.delete(docType);
    /* Only fields THIS document still owns — a field the user has since
       manually edited is no longer in FIELD_SOURCE (handleInput() deletes
       it there), so it's correctly left untouched. */
    Object.keys(FIELD_SOURCE).forEach(f=>{
      if(FIELD_SOURCE[f]===docType){
        VALS[f]='';
        delete FIELD_SOURCE[f];
        AI_FILLED_FIELDS.delete(f);
        VERIFIED_FIELDS.delete(f);
      }
    });
    scheduleSaveVals();
    updateSections();
  }
  updateCheckoutBox();
}

/* ── Combined AI checkout — package pricing ──
   One flat price for the whole TASK (task-pricing.js's TASK_PRICING),
   charged ONCE for every ready document together — never per document.
   See worker/src/index.js's /extract-package: it runs every document
   first and only deducts if ALL of them succeed, so there is no
   "charge then refund" path here to get wrong — a partial failure simply
   never gets charged in the first place. */
const EXTRACTED_SET=new Set(); // docTypes successfully extracted this session

/* Returns {docType, images, uploadsKey} for a docType if its preview is
   ready, else null. Aadhaar combines front (+ optional back) into one call. */
function getBatchItem(docType){
  if(docType==='aadhaar'){
    const front=DOC_STATE.aadhaar_front;
    if(!front) return null;
    const images=[front];
    if(DOC_STATE.aadhaar_back) images.push(DOC_STATE.aadhaar_back);
    return {docType:'aadhaar', images, uploadsKey:'aadhaar'};
  }
  const doc=DOC_STATE[docType];
  if(!doc) return null;
  return {docType, images:[doc], uploadsKey:docType};
}

/* Everything with a ready preview that hasn't been successfully extracted
   yet — a doc that failed (or was never attempted because an earlier doc
   in the same package failed) stays in this list, so clicking the button
   again naturally retries just what's left. */
function computeReadyDocs(){
  return ['aadhaar','pan','rc'].map(getBatchItem).filter(item=>item && !EXTRACTED_SET.has(item.docType));
}

/* Current package price in paise for whatever's checked/on this page right
   now — see getCurrentTaskId() (ui.js) and TASK_PRICING (task-pricing.js).
   This is a LABEL only; the Worker decides for itself what to actually
   charge and never trusts a client-sent amount. */
function getCurrentPackagePrice(){
  const taskId=(typeof getCurrentTaskId==='function') ? getCurrentTaskId() : 'default';
  return TASK_PRICING[taskId] ?? TASK_PRICING.default;
}

/* Tracks which action the single checkout button currently performs —
   'idle' starts/retries extraction, 'low-balance' opens the top-up modal
   instead. Read by checkoutBtnAction(), set by updateCheckoutBox(). */
let CHECKOUT_BTN_MODE='idle';

/* Renders the ONE checkout button + one status line — nothing else. Three
   states only, per spec: idle (shows the flat price), failed (retry, not
   charged), low-balance (add money). lastFailed is true right after a
   package attempt came back with at least one failed document. */
function updateCheckoutBox(failReason){
  const box=document.getElementById('checkoutBox');
  const payBtn=document.getElementById('checkoutPayBtn');
  const resultEl=document.getElementById('checkoutResult');
  if(!box) return;

  const batch=computeReadyDocs();
  if(!batch.length && !failReason){ box.style.display='none'; return; }
  box.style.display='block';

  const price=getCurrentPackagePrice();
  const priceRs=(price/100).toFixed(0);

  if(failReason){
    CHECKOUT_BTN_MODE='idle';
    payBtn.textContent=t('ai.retryBtn');
    payBtn.style.display=batch.length?'':'none';
    resultEl.textContent = failReason==='network' ? t('err.connectionLost') : t('ai.extractFailed');
    resultEl.className='status err';
  } else if(PRO.balancePaise<price){
    CHECKOUT_BTN_MODE='low-balance';
    payBtn.textContent=t('ai.addMoneyBtn');
    payBtn.style.display='';
    resultEl.textContent=t('ai.balanceTooLow',{price:priceRs});
    resultEl.className='status err';
  } else {
    CHECKOUT_BTN_MODE='idle';
    payBtn.textContent=t('ai.fillWithAi',{price:priceRs});
    payBtn.style.display='';
    resultEl.textContent='';
    resultEl.className='status';
  }
}

function checkoutBtnAction(){
  if(CHECKOUT_BTN_MODE==='low-balance') openBuyModal();
  else startPackageExtraction();
}

/* ── AI box (task-page v2 layout only) ──
   #aiBox and its three state children (#aiBoxCta/#aiBoxPicker/#aiBoxSummary)
   only exist on a rewritten task page — every function below starts with a
   missing-element guard, so on the root page or a not-yet-rewritten task
   page this whole block is inert dead code, never called from anywhere. */
function setAiBoxState(state){
  const cta=document.getElementById('aiBoxCta');
  const picker=document.getElementById('aiBoxPicker');
  const summary=document.getElementById('aiBoxSummary');
  const freeLine=document.getElementById('aiBoxFreeLine');
  if(!cta || !picker || !summary) return;
  cta.style.display = state==='cta' ? '' : 'none';
  picker.style.display = state==='picker' ? '' : 'none';
  summary.style.display = state==='summary' ? '' : 'none';
  if(freeLine) freeLine.style.display = state==='summary' ? 'none' : '';
}
function showAiBoxPicker(){ setAiBoxState('picker'); }

/* Collapses the AI box to its one-line summary — only on a batch that
   finished cleanly (nothing failed, balance didn't run out) — a partial
   result stays in the picker view so the Retry button and per-document
   status are still visible instead of being hidden behind a "done" line
   that isn't quite true yet. Clicking the summary re-opens the picker
   (see the onclick on #aiBoxSummary in the task page's HTML). */
function collapseAiBoxToSummary(){
  const el=document.getElementById('aiBoxSummaryText');
  if(!el) return;
  const n=EXTRACTED_SET.size;
  if(!n) return;
  const need=new Set(typeof PICKS!=='undefined' ? PICKS.filter(p=>CHECKED[p.id]).flatMap(p=>p.fields||[]) : []);
  const filled=[...need].filter(f=>FIELD_SOURCE[f] && EXTRACTED_SET.has(FIELD_SOURCE[f])).length;
  /* AI_MISSED_FIELDS (forms-data.js) is only ever populated with fields
     THIS extraction batch's doc(s) could have supplied (see
     startPackageExtraction()), so intersecting with `need` here is just
     defensive — a field from an unrelated docType never ends up in it. */
  const missed=[...AI_MISSED_FIELDS].filter(f=>need.has(f)).length;
  el.textContent = missed>0
    ? t('status.filledAndMissed',{filled,fs:filled===1?'':'s',missed})
    : t('status.docsExtractedSummary',{n,s:n>1?'s':'',filled,fs:filled===1?'':'s'});
  setAiBoxState('summary');
}

/* Manual Individual/Firm toggle next to the Seller section (index.html,
   rendered by ui.js's updateSections()) — lets the user correct a wrong
   AI guess, or set this without ever using AI extraction at all. Latest
   action wins over whatever RC extraction last set — see SELLER_OWNER_TYPE's
   doc comment in forms-data.js. */
function setSellerOwnerType(type){
  SELLER_OWNER_TYPE=(type==='firm')?'firm':'individual';
  updateSections();
}

/* The "use <other document>'s value instead" button rendered under a
   field by fieldHTML() (ui.js) when PENDING_CONFLICTS has an entry for
   it — switches to the document that LOST the priority comparison (see
   mergeExtractedFields, field-mapping.js) and makes that the field's new
   source, exactly as if that document had won in the first place. */
function switchFieldConflict(fieldId){
  const conflict=PENDING_CONFLICTS[fieldId];
  if(!conflict) return;
  VALS[fieldId]=conflict.loser.value;
  FIELD_SOURCE[fieldId]=conflict.loser.docType;
  AI_FILLED_FIELDS.add(fieldId);
  VERIFIED_FIELDS.delete(fieldId); // a freshly-applied AI value is unreviewed again, even if this field was verified before
  delete PENDING_CONFLICTS[fieldId];
  scheduleSaveVals();
  updateSections();
}

/* Dismisses a conflict notice without changing anything — the
   higher-priority value already applied stays applied, the notice just
   stops showing (e.g. the user already knows and doesn't need reminding). */
function dismissFieldConflict(fieldId){
  delete PENDING_CONFLICTS[fieldId];
  updateSections();
}

/* Applies ONE document's already-successful extraction to the form fields
   — same mapping/merge/highlight logic for every doc regardless of whether
   the overall package ended up charged (see startPackageExtraction()):
   Gemini already did the work, so there's no reason to hide a result that
   happened to sit in a package where a DIFFERENT document failed. Only the
   wallet balance is conditional on the whole package succeeding. */
async function applyExtractionResult(docType, data, item){
  const mapped=AI_FIELD_MAP[docType](data, getEffectiveRole(docType));
  /* Uppercase first (matches every other AI-written or manually-typed
     value in this app — see handleInput() in ui.js), THEN merge — so
     the values compared/stored by mergeExtractedFields, including
     whatever ends up in a conflict notice, are already in the app's
     one display convention. */
  const upperMapped={};
  Object.keys(mapped).forEach(k=>{ if(mapped[k]) upperMapped[k]=String(mapped[k]).toUpperCase(); });
  mergeExtractedFields(docType, upperMapped, {vals:VALS, fieldSource:FIELD_SOURCE, pendingConflicts:PENDING_CONFLICTS});
  /* Only mark a field as "AI-filled" (amber badge) if THIS extraction is
     the one whose value is actually showing — a field mergeExtractedFields
     skipped (lower priority than what's already applied) doesn't newly
     become AI-sourced from this call; whatever already owns it keeps
     owning it, untouched. */
  Object.keys(upperMapped).forEach(k=>{ if(FIELD_SOURCE[k]===docType){ AI_FILLED_FIELDS.add(k); VERIFIED_FIELDS.delete(k); } });

  /* RC is the only document that ever signals firm-vs-individual
     ownership (see PROMPTS.rc, worker/src/index.js) — updateSections()
     below picks this up to hide the (inapplicable) father's-name field
     for a firm, and generatePDF() (ui.js) blanks it on the printed PDF
     regardless of any stray value sitting in VALS.s_father. */
  if(docType==='rc') SELLER_OWNER_TYPE=resolveOwnerType(data);

  scheduleSaveVals();
  updateSections();

  const dims=await loadImageDims(item.images[0].dataUrl);
  PRO.uploads[item.uploadsKey]={dataUrl:item.images[0].dataUrl,w:dims.w,h:dims.h,raw:data};

  EXTRACTED_SET.add(docType);
  renderProResult(docType, data);
}

/* The single "Fill with AI / Retry" button: sends every ready document as
   ONE package to /extract-package (worker/src/index.js), which charges the
   flat task price once — and only if every document in the package
   succeeded. A partial failure applies whatever DID succeed (see
   applyExtractionResult() above) and leaves the failed doc(s) in
   computeReadyDocs() for the next click to retry, without re-billing for
   what already worked. */
async function startPackageExtraction(){
  const batch=computeReadyDocs();
  if(!batch.length) return;
  const taskId=(typeof getCurrentTaskId==='function') ? getCurrentTaskId() : 'default';
  const price=getCurrentPackagePrice();

  if(PRO.balancePaise<price){
    updateCheckoutBox();
    openBuyModal();
    return;
  }

  const payBtn=document.getElementById('checkoutPayBtn');
  if(payBtn) payBtn.disabled=true;
  batch.forEach(item=>{
    const stateEl=document.getElementById('state-'+item.docType);
    if(stateEl){ stateEl.textContent=t('ai.extractingBadge'); stateEl.className='upload-slot-state'; }
  });
  const statusEl=document.getElementById('proStatus');
  if(statusEl){
    statusEl.innerHTML='';
    const l1=document.createElement('div'); l1.textContent=t('status.readingDoc');
    const l2=document.createElement('div'); l2.textContent=t('status.onlyChargedIfSuccess');
    statusEl.appendChild(l1); statusEl.appendChild(l2);
    statusEl.className='status';
  }

  try{
    const res=await fetch(WORKER_URL+'/extract-package',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        token:PRO.walletId,
        taskId,
        docs:batch.map(item=>({docType:item.docType, images:item.images.map(img=>({data:img.dataUrl, mimeType:img.mimeType}))}))
      })
    });
    const json=await res.json();

    if(json.code==='AUTH_REQUIRED'){
      PRO.walletId=''; saveProState();
      const e=new Error(t('err.walletReset')); e.isWalletReset=true; throw e;
    }
    if(res.status===402){
      PRO.balancePaise=json.balancePaise||0; renderProCredits();
      if(payBtn) payBtn.disabled=false;
      if(statusEl){ statusEl.textContent=''; }
      updateCheckoutBox();
      openBuyModal();
      return;
    }
    if(!res.ok) throw new Error(json.error||t('ai.extractFailed'));

    const results=json.results||[];
    for(const r of results){
      const stateEl=document.getElementById('state-'+r.docType);
      if(!r.ok){
        if(stateEl){ stateEl.textContent=t('status.failed'); stateEl.className='upload-slot-state err'; }
        continue;
      }
      const item=batch.find(b=>b.docType===r.docType);
      await applyExtractionResult(r.docType, r.data, item);
      if(stateEl){ stateEl.textContent=t('status.extracted'); stateEl.className='upload-slot-state done'; }
    }

    if(payBtn) payBtn.disabled=false;
    if(statusEl){ statusEl.textContent=''; }
    if(json.ok){
      PRO.balancePaise=json.balancePaise; renderProCredits();
      /* Which fields THIS batch's doc(s) could have supplied — see
         docTypeOutputFields() (ui.js) — vs which ones actually ended up
         filled. A field that's still empty here wasn't skipped, it's one
         Gemini genuinely couldn't read (see AI_MISSED_FIELDS, forms-data.js) —
         the extraction still succeeded and still got charged; this is a
         per-field gap, not a failure. */
      const need=new Set(typeof PICKS!=='undefined' ? PICKS.filter(p=>CHECKED[p.id]).flatMap(p=>p.fields||[]) : []);
      results.forEach(r=>{
        if(!r.ok) return;
        const coverable=(typeof docTypeOutputFields==='function') ? docTypeOutputFields(r.docType) : new Set();
        [...coverable].filter(f=>need.has(f)).forEach(f=>{
          if(g(f)) AI_MISSED_FIELDS.delete(f); else AI_MISSED_FIELDS.add(f);
        });
      });
      updateSections();
      updateCheckoutBox();
      collapseAiBoxToSummary();
    } else {
      updateCheckoutBox('doc-failed');
    }
  }catch(err){
    if(payBtn) payBtn.disabled=false;
    batch.forEach(item=>{
      const stateEl=document.getElementById('state-'+item.docType);
      if(stateEl && !EXTRACTED_SET.has(item.docType)){ stateEl.textContent=t('status.failed'); stateEl.className='upload-slot-state err'; }
    });
    if(err.isWalletReset){
      if(statusEl){ statusEl.textContent=err.message; statusEl.className='status err'; }
      updateCheckoutBox();
    } else {
      if(statusEl){ statusEl.textContent=''; }
      updateCheckoutBox('network');
    }
  }
}

async function handlePhotoUpload(file){
  if(!file) return;
  const stateEl=document.getElementById('state-photo');
  stateEl.textContent=t('status.reading');
  const rawDataUrl=await fileToBase64(file);
  const dataUrl=await compressImage(rawDataUrl, 1400, 0.85);
  const dims=await loadImageDims(dataUrl);
  PRO.uploads.photo={dataUrl,w:dims.w,h:dims.h};
  const previewEl=document.getElementById('preview-photo');
  previewEl.innerHTML='';
  const img=document.createElement('img'); img.src=dataUrl;
  previewEl.appendChild(img);
  stateEl.textContent=t('status.uploaded'); stateEl.className='upload-slot-state done';
  const removeBtn=document.getElementById('remove-photo');
  if(removeBtn) removeBtn.style.display='inline';
}

function renderProResult(docType, data){
  const wrap=document.getElementById('proResults');
  const rows=Object.keys(data).filter(k=>data[k]).map(k=>
    `<div class="pro-result-row"><span>${k.replace(/_/g,' ')}</span><b>${String(data[k]).replace(/</g,'&lt;')}</b></div>`
  ).join('');
  const card=document.createElement('div');
  card.className='pro-result-card';
  card.innerHTML=`<b>${docType.toUpperCase()} extracted</b>${rows}`;
  wrap.prepend(card);
}

/* ── Add Money — Razorpay auto-payment, credits instantly on success.
   No wallet check needed to even open the modal — a brand-new user with no
   walletId yet gets one minted by /order below. ── */
function openBuyModal(){
  document.getElementById('proBuyModal').style.display='flex';
}
function closeBuyModal(){ document.getElementById('proBuyModal').style.display='none'; }

async function startPayment(amountRs){
  if(!amountRs || amountRs<=0){ alert(t('err.amount')); return; }
  const statusEl=document.getElementById('proCodeStatus');
  statusEl.textContent=t('status.paymentStarting'); statusEl.className='status';

  try{
    /* Only send walletId if we already have one (returning user topping
       up) — otherwise the Worker mints a fresh one and hands it back. */
    const orderBody=PRO.walletId ? {walletId:PRO.walletId, amountRs} : {amountRs};
    const orderRes=await fetch(WORKER_URL+'/order',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(orderBody)
    });
    const order=await orderRes.json();
    if(!orderRes.ok || order.error) throw new Error(order.error||'Order create failed');

    /* Store the (possibly brand-new) walletId right away, before payment
       even completes — /order and /verify must agree on the same id. */
    PRO.walletId=order.walletId; saveProState();

    const rzp=new Razorpay({
      key:order.keyId,
      amount:order.amountPaise,
      currency:'INR',
      order_id:order.orderId,
      name:'RTO Forms India',
      description:'Wallet recharge — AI auto-fill',
      /* No prefill.contact — Razorpay asks for it itself during checkout;
         that's the only place a mobile number is ever collected here, and
         only ever as a recovery contact, never as the wallet identity. */
      theme:{ color:'#D6481F' },
      handler:async function(resp){
        statusEl.textContent=t('status.paymentConfirming'); statusEl.className='status';
        try{
          const verifyRes=await fetch(WORKER_URL+'/verify',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              walletId:PRO.walletId,
              razorpay_order_id:resp.razorpay_order_id,
              razorpay_payment_id:resp.razorpay_payment_id,
              razorpay_signature:resp.razorpay_signature
            })
          });
          const v=await verifyRes.json();
          if(!verifyRes.ok || v.error) throw new Error(v.error||t('err.verificationFailed'));
          PRO.balancePaise=v.balancePaise; renderProCredits();
          statusEl.textContent=t('status.amountAdded',{n:amountRs,bal:v.balanceRs});
          statusEl.className='status ok';
          setTimeout(closeBuyModal, 1500);
        }catch(err){
          /* Razorpay itself already confirmed the charge (this handler only
             fires on a successful payment) — what failed is OUR /verify
             call, e.g. a network blip right after. The money is not lost;
             say so plainly instead of surfacing whatever err.message is
             (a raw fetch/HTTP error means nothing to the user here). */
          statusEl.innerHTML='';
          const l1=document.createElement('div'); l1.textContent=t('pay.receivedNotConfirmed');
          const l2=document.createElement('div'); l2.textContent=t('pay.balanceWillUpdate');
          const refreshBtn=document.createElement('button');
          refreshBtn.type='button';
          refreshBtn.className='settings-reset';
          refreshBtn.textContent=t('pay.refreshBalance');
          refreshBtn.onclick=async function(){
            refreshBtn.disabled=true;
            await fetchWalletBalance();
            statusEl.textContent=t('pay.balanceRefreshed',{bal:(PRO.balancePaise/100).toFixed(2)});
            statusEl.className='status ok';
          };
          statusEl.appendChild(l1); statusEl.appendChild(l2); statusEl.appendChild(refreshBtn);
          statusEl.className='status err';
        }
      },
      modal:{ ondismiss:function(){ statusEl.textContent=''; } }
    });

    /* Razorpay's standard integration expects this bound separately (not
       inside the constructor options above) — it fires when an attempted
       payment itself is declined/errors out while the checkout modal is
       still open (card decline, insufficient funds, etc.), which is a
       different event from the user just closing the modal (ondismiss,
       above) or a successful payment (handler, above). Never surfaces
       Razorpay's own err.description/err.reason — that's raw payment-
       gateway/bank text ("technical error text"), not something a user
       needs; the only fact that matters is nothing was charged. */
    rzp.on('payment.failed', function(){
      statusEl.innerHTML='';
      const msg=document.createElement('div');
      msg.textContent=t('pay.failed');
      const retryBtn=document.createElement('button');
      retryBtn.type='button';
      retryBtn.className='settings-reset';
      retryBtn.textContent=t('pay.tryAgain');
      retryBtn.onclick=function(){ startPayment(amountRs); };
      statusEl.appendChild(msg);
      statusEl.appendChild(retryBtn);
      statusEl.className='status err';
    });

    rzp.open();
  }catch(err){
    /* Failed before Razorpay's checkout even opened (e.g. /order couldn't
       be reached) — nothing was ever charged. */
    statusEl.textContent=t('pay.couldNotStart');
    statusEl.className='status err';
  }
}

renderProCredits();
fetchWalletBalance();
console.log('RTO PRO build: v7 (Razorpay-first wallet — random token identity, no recovery path)');
