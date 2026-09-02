/* ════════ Aadhaar Secure QR — live camera scan (mobile only) ════════
   A second, optional way to fill the buyer's Aadhaar fields, alongside
   the existing auto-scan-from-uploaded-photo in aadhaar-qr-scan.js: a
   "Scan QR" button that opens a live getUserMedia viewfinder and keeps
   decoding incoming video frames until a QR is found, auto-confirming
   with no manual capture step. A single still photo only gets one shot
   at whatever angle/distance/focus it happened to be taken at; a live
   feed lets the user adjust in real time across many frames, which is
   the actual reason live scanning is more reliable for a QR this dense.

   Decoding here uses @zxing/browser's BrowserQRCodeReader (CDN, global
   window.ZXingBrowser) rather than jsQR — jsQR is a bare single-frame
   decoder with no camera/video plumbing of its own; ZXing's browser
   package ships a purpose-built continuous-video-scan API
   (decodeFromVideoDevice) that owns the whole getUserMedia + per-frame
   decode + stream-cleanup lifecycle, which is exactly this feature's
   shape. The existing upload-flow scan (aadhaar-qr-scan.js) still runs
   on jsQR, unchanged, per spec — this is additive, not a replacement.

   Whatever this decodes is handed to the EXACT same
   processAadhaarQrText() (aadhaar-qr-scan.js) the upload flow already
   uses, so old-format detection, field-mapping, and the on-screen notice
   are identical either way — this file only owns getting a QR string out
   of a live camera feed, nothing about what happens with it after.

   Mobile only: isTouchPrimaryDevice() (pro-wallet.js) gates the button's
   very existence. Desktop keeps exactly what it had — upload + the
   existing auto-scan-from-photo — untouched. */

const AADHAAR_QR_LIVE_SCAN_MAX_MS = 60000; // generous — real QR-scanner apps don't rush the user either, but an unattended/forgotten scan shouldn't hold the camera open forever

/* Returns Promise<string|null>: the decoded QR text once found, or null
   if the user closes the scanner (or it times out) without one. */
function openAadhaarQrLiveScanModal(){
  return new Promise((resolve) => {
    let settled = false;
    let controls = null;
    let timeoutId = null;

    const settle = (result) => {
      if(settled) return;
      settled = true;
      if(timeoutId) clearTimeout(timeoutId);
      if(controls){ try{ controls.stop(); }catch(e){ /* best-effort */ } }
      // Belt-and-suspenders: also stop the raw stream tracks directly, in
      // case controls.stop() didn't fully release the camera for some
      // reason — leaving the camera light on after closing would be a
      // real privacy/battery problem, worth not trusting a single path for.
      if(video.srcObject){
        try{ video.srcObject.getTracks().forEach(tr => tr.stop()); }catch(e){ /* best-effort */ }
      }
      if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(result);
    };

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box qr-live-scan-box">
        <div class="modal-head">
          <h3>${t('qrLive.title')}</h3>
          <button type="button" class="modal-close" id="qrLiveClose">&times;</button>
        </div>
        <p class="modal-sub">${t('qrLive.hint')}</p>
        <div class="camera-viewport">
          <video id="qrLiveVideo" autoplay playsinline muted></video>
          <div class="qr-live-guide"></div>
        </div>
        <p class="status" id="qrLiveStatus"></p>
      </div>`;
    document.body.appendChild(overlay);

    const video = overlay.querySelector('#qrLiveVideo');
    const statusEl = overlay.querySelector('#qrLiveStatus');
    overlay.querySelector('#qrLiveClose').onclick = () => settle(null);

    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof ZXingBrowser==='undefined'){
      statusEl.textContent = t('camera.notAvailable');
      statusEl.className = 'status err';
      return;
    }

    (async () => {
      try{
        const reader = new ZXingBrowser.BrowserQRCodeReader();
        // deviceId left undefined -- decodeFromVideoDevice prefers the
        // main/environment-facing camera on its own when available.
        controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if(settled || !result) return; // the callback also fires on every non-decoding frame with an error -- that's expected, not a failure worth surfacing
          settle(result.getText());
        });
      }catch(err){
        let msg = t('camera.genericError');
        if(err && err.name==='NotAllowedError') msg = t('camera.permissionDenied');
        else if(err && err.name==='NotFoundError') msg = t('camera.notFound');
        statusEl.textContent = msg;
        statusEl.className = 'status err';
      }
    })();

    timeoutId = setTimeout(() => {
      if(settled) return;
      statusEl.textContent = t('qrLive.timeout');
      statusEl.className = 'status err';
      setTimeout(() => settle(null), 1800); // leave the message on screen briefly before auto-closing
    }, AADHAAR_QR_LIVE_SCAN_MAX_MS);
  });
}

async function handleScanQrClick(){
  const qrText = await openAadhaarQrLiveScanModal();
  if(!qrText) return;
  await processAadhaarQrText(qrText);
}

/* Injects the mobile-only "Scan QR" button next to the existing Take-
   photo/Choose-file row on the buyer's Aadhaar FRONT side -- the only
   place the whole Aadhaar-QR feature applies (see aadhaar-qr-scan.js).
   Built dynamically rather than added to each task page's HTML, same
   convention as photo-editor.js/pwa-install.js -- one shared script,
   no per-page markup to keep in sync across the 6 task pages this
   loads on. Runs once at script-load time: this file loads near the
   end of body, after the static doc-slot markup above it has already
   parsed and after pro-wallet.js (isTouchPrimaryDevice), so both are
   ready by the time this executes. */
function injectScanQrButton(){
  if(typeof isTouchPrimaryDevice!=='function' || !isTouchPrimaryDevice()) return;
  const fileInput = document.getElementById('file-aadhaar-buyer-front-file');
  const row = fileInput && fileInput.closest('.doc-input-row');
  if(!row || document.getElementById('scanQrBtn')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'scanQrBtn';
  btn.className = 'btn-scan-qr';
  btn.textContent = t('qrLive.scanBtn');
  btn.onclick = handleScanQrClick;
  row.insertAdjacentElement('afterend', btn);
}
injectScanQrButton();
