/* Face-photo editor — crop / rotate / resize, entirely client-side.

   Called from handlePhotoUpload() (pro-wallet.js) right after it runs the
   picked/captured file through compressImageFile() — so by the time an
   image ever reaches this file, it has already been downscaled to <=1400px
   on its longer side and had EXIF orientation baked into the actual pixels
   (compressImageFile() decodes via createImageBitmap({imageOrientation:
   'from-image'}) — the same fix that solved the Android "low memory" crash
   on camera uploads). Cropper.js is only ever handed that already-small
   image, so its own internal canvases stay bounded too — this can't
   reintroduce the full-resolution-decode crash the earlier fix removed.

   Uses Cropper.js (CDN, global window.Cropper) for the crop/rotate UI
   rather than a hand-rolled drag interaction. Nothing here calls out to
   any network — pure canvas/DOM.

   openPhotoEditor(dataUrl) returns Promise<string|null>: the edited image
   as a new JPEG dataUrl if the user saves, or null if they close/cancel
   without saving. */

const PHOTO_EDITOR_ASPECT = 35 / 45; // Indian passport-photo ratio (3.5cm x 4.5cm)
const PHOTO_EDITOR_MAX_SIDE = 540; // final export cap — plenty for a printed form page, not a huge file

function openPhotoEditor(dataUrl){
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if(settled) return;
      settled = true;
      if(cropper){ cropper.destroy(); cropper = null; }
      if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(result);
    };

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay photo-editor-overlay';
    overlay.innerHTML = `
      <div class="modal-box photo-editor-box">
        <div class="modal-head">
          <h3>${t('pe.title')}</h3>
          <button type="button" class="modal-close" id="peClose">&times;</button>
        </div>
        <div class="photo-editor-canvas-wrap">
          <img id="peImg" alt="">
        </div>
        <div class="photo-editor-controls">
          <div class="photo-editor-row">
            <button type="button" class="btn-blank" id="peRotateLeft">⟲ ${t('pe.rotateLeft')}</button>
            <button type="button" class="btn-blank" id="peRotateRight">⟳ ${t('pe.rotateRight')}</button>
          </div>
          <div class="photo-editor-row photo-editor-slider-row">
            <label for="peFineRotate">${t('pe.fineRotate')}</label>
            <input type="range" id="peFineRotate" min="-45" max="45" value="0" step="1">
          </div>
          <label class="photo-editor-free-chk"><input type="checkbox" id="peFreeCrop"> ${t('pe.freeCrop')}</label>
        </div>
        <div class="camera-modal-actions">
          <button type="button" class="btn-blank" id="peReset">${t('pe.reset')}</button>
          <button type="button" class="btn-generate" id="peSave">${t('pe.save')}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const imgEl = overlay.querySelector('#peImg');
    let cropper = null;
    let baseRotation = 0;
    let fineRotation = 0;

    function applyRotation(){ if(cropper) cropper.rotateTo(baseRotation + fineRotation); }

    imgEl.onload = () => {
      cropper = new Cropper(imgEl, {
        aspectRatio: PHOTO_EDITOR_ASPECT,
        viewMode: 1,
        autoCropArea: 0.9,
        responsive: true,
        movable: true,
        zoomable: true,
        rotatable: true,
        scalable: false,
        background: false
      });
    };
    imgEl.src = dataUrl;

    overlay.querySelector('#peRotateLeft').onclick = () => { baseRotation = (baseRotation - 90 + 360) % 360; applyRotation(); };
    overlay.querySelector('#peRotateRight').onclick = () => { baseRotation = (baseRotation + 90) % 360; applyRotation(); };
    overlay.querySelector('#peFineRotate').oninput = (e) => { fineRotation = Number(e.target.value); applyRotation(); };
    overlay.querySelector('#peFreeCrop').onchange = (e) => {
      if(!cropper) return;
      cropper.setAspectRatio(e.target.checked ? NaN : PHOTO_EDITOR_ASPECT);
    };
    overlay.querySelector('#peReset').onclick = () => {
      if(!cropper) return;
      baseRotation = 0; fineRotation = 0;
      overlay.querySelector('#peFineRotate').value = 0;
      overlay.querySelector('#peFreeCrop').checked = false;
      cropper.setAspectRatio(PHOTO_EDITOR_ASPECT);
      cropper.reset();
    };
    overlay.querySelector('#peSave').onclick = () => {
      if(!cropper) return;
      const data = cropper.getData();
      const w = Math.max(1, Math.round(Math.abs(data.width)));
      const h = Math.max(1, Math.round(Math.abs(data.height)));
      let targetW = w, targetH = h;
      const longSide = Math.max(w, h);
      if(longSide > PHOTO_EDITOR_MAX_SIDE){
        const scale = PHOTO_EDITOR_MAX_SIDE / longSide;
        targetW = Math.round(w * scale);
        targetH = Math.round(h * scale);
      }
      const canvas = cropper.getCroppedCanvas({ width: targetW, height: targetH, imageSmoothingQuality: 'high' });
      settle(canvas.toDataURL('image/jpeg', 0.9));
    };
    overlay.querySelector('#peClose').onclick = () => settle(null);
  });
}
