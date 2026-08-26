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
   walletId, see worker/src/index.js). A mobile number is only ever
   collected inside Razorpay's own checkout UI, purely as a recovery contact
   — see sendWalletLink()/claimWalletLinkFromUrl(). */
const WORKER_URL='https://rto-ai-extract.diamondcattoon.workers.dev';

let PRO=Object.assign({role:'seller',walletId:''}, JSON.parse(localStorage.getItem('rtoProState')||'{}'));
PRO.uploads={}; /* images kept in memory only for this session — used for PDF attachment */
PRO.balancePaise=0;

function saveProState(){ localStorage.setItem('rtoProState', JSON.stringify({role:PRO.role, walletId:PRO.walletId})); }
function setProRole(role){ PRO.role=role; saveProState(); }

function renderProCredits(){
  const el=document.getElementById('proCreditsBadge');
  if(el) el.textContent='₹'+(PRO.balancePaise/100).toFixed(2);
}

/* ── Account recovery (mobile number → existing wallet, not identity) ──
   Collapsed by default (see toggleRecoveryForm() / #recoveryForm in
   index.html) — this is a fallback for "I'm on a new device/browser and my
   old wallet's token is gone", not part of the normal first-time flow. */
function toggleRecoveryForm(){
  const el=document.getElementById('recoveryForm');
  if(!el) return;
  const show=el.style.display==='none';
  el.style.display=show?'block':'none';
  if(show) document.getElementById('walletMobileInput').focus();
}
async function sendWalletLink(){
  const input=document.getElementById('walletMobileInput');
  const v=input.value.replace(/\D/g,'');
  const statusEl=document.getElementById('walletLinkStatus');
  if(v.length!==10 || !/^[6-9]/.test(v)){ statusEl.textContent='Valid 10-digit mobile number daalo.'; statusEl.className='status err'; return; }

  const btn=document.getElementById('sendLinkBtn');
  btn.disabled=true; statusEl.textContent='Link bhej rahe hain...'; statusEl.className='status';
  try{
    const res=await fetch(WORKER_URL+'/link/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mobile:v})});
    const j=await res.json();
    if(!res.ok || j.error){
      statusEl.textContent = j.code==='NO_WALLET_FOUND'
        ? 'Is number se koi wallet linked nahi mila. Pehli baar hai to seedha document upload karke extract try karo — payment ke waqt wallet ban jayega.'
        : (j.error||'Link bhejne mein error aaya.');
      statusEl.className='status err';
      btn.disabled=false;
      return;
    }
    statusEl.textContent='Recovery link bhej diya '+v+' par — SMS kholke usi phone pe link click karo (30 min valid).'; statusEl.className='status ok';
  }catch(e){
    statusEl.textContent='Network error — dobara try karo.'; statusEl.className='status err';
    btn.disabled=false;
  }
}
/* Runs once on page load: if the URL is a claim link (/w/<token>, from the
   recovery SMS), claim it immediately — this rotates to a brand-new
   walletId server-side and carries the balance across — store the result,
   and strip the token out of the visible URL/history so it doesn't linger. */
async function claimWalletLinkFromUrl(){
  const m=/^\/w\/([a-f0-9]+)$/.exec(location.pathname);
  if(!m) return;
  const claimToken=m[1];
  history.replaceState(null,'','/'); // scrub the token from the address bar right away

  const statusEl=document.getElementById('walletLinkStatus');
  if(statusEl){ statusEl.textContent='Recover ho raha hai...'; statusEl.className='status'; }
  try{
    const res=await fetch(WORKER_URL+'/link/claim/'+encodeURIComponent(claimToken),{method:'POST'});
    const j=await res.json();
    if(!res.ok || j.error){
      if(statusEl){ statusEl.textContent=j.error||'Link invalid ya expire ho chuka hai — naya link mangwao.'; statusEl.className='status err'; }
      return;
    }
    PRO.walletId=j.walletId; PRO.balancePaise=j.balancePaise; saveProState();
    renderProCredits();
    if(statusEl){ statusEl.textContent='Wallet recover ho gaya ✓ Balance: ₹'+j.balanceRs; statusEl.className='status ok'; }
    document.getElementById('tool').scrollIntoView({behavior:'smooth'});
  }catch(e){
    if(statusEl){ statusEl.textContent='Network error — link dobara mangwao.'; statusEl.className='status err'; }
  }
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
const CONSENT_GATED_INPUT_IDS=['file-aadhaar-front','file-aadhaar-back','file-pan','file-rc'];
/* One hint per gated slot (not per input — aadhaar front+back share one slot/hint) — see
   consentHint-* in index.html, sitting right above the greyed-out inputs so it's obvious
   why they're disabled. */
const CONSENT_HINT_IDS=['consentHint-aadhaar','consentHint-pan','consentHint-rc'];
function onConsentChange(){
  const checked=document.getElementById('uploadConsentChk').checked;
  CONSENT_GATED_INPUT_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.disabled=!checked;
  });
  CONSENT_HINT_IDS.forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display=checked?'none':'block';
  });
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
  previewEl.innerHTML='<p class="fld-hint">Loading preview...</p>';
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
        previewEl.innerHTML='<p class="fld-hint">Is PDF mein '+thumbs.length+' pages hain — sahi page choose karo:</p>';
        pickerEl.style.display='flex';
        thumbs.forEach((t,i)=>{
          const img=document.createElement('img');
          img.src=t; img.className='pdf-page-thumb'; img.title='Page '+(i+1);
          img.onclick=()=>{ selectPdfPage(key, t, pickerEl); };
          pickerEl.appendChild(img);
        });
      }
    }catch(err){
      previewEl.innerHTML='<p class="fld-hint" style="color:var(--stamp)">PDF read nahi ho paayi: '+err.message+'</p>';
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
  if(key==='aadhaar_front' || key==='aadhaar_back'){
    document.getElementById('state-aadhaar').textContent='Preview ready';
    document.getElementById('state-aadhaar').className='upload-slot-state';
    if(DOC_STATE.aadhaar_front) document.getElementById('extract-aadhaar').style.display='block';
  }else{
    document.getElementById('state-'+key).textContent='Preview ready';
    document.getElementById('state-'+key).className='upload-slot-state';
    document.getElementById('extract-'+key).style.display='block';
  }
}

/* ── Extract: only runs when the user clicks the button, after reviewing the preview ──
   No wallet check upfront — runExtraction() itself sends straight to
   Razorpay checkout if the balance is too low (which is also true for a
   brand-new user who has never paid: PRO.balancePaise starts at 0). */
async function extractSingle(docType){
  const doc=DOC_STATE[docType];
  if(!doc){ return; }
  await runExtraction(docType, [doc], 'extract-'+docType, 'state-'+docType, docType);
}

async function extractAadhaar(){
  const front=DOC_STATE.aadhaar_front;
  if(!front){ return; }
  const images=[front];
  if(DOC_STATE.aadhaar_back) images.push(DOC_STATE.aadhaar_back);
  await runExtraction('aadhaar', images, 'extract-aadhaar', 'state-aadhaar', 'aadhaar');
}

async function runExtraction(docType, images, btnId, stateId, uploadsKey){
  const statusEl=document.getElementById('proStatus');
  const stateEl=document.getElementById(stateId);
  const btn=document.getElementById(btnId);

  if(PRO.balancePaise<500){
    statusEl.textContent='₹5 chahiye is extraction ke liye — payment window khul raha hai...';
    statusEl.className='status';
    openBuyModal();
    return;
  }

  btn.disabled=true; btn.textContent='Extracting...';
  statusEl.textContent='AI se data extract ho raha hai...'; statusEl.className='status';

  try{
    const res=await fetch(WORKER_URL+'/extract',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({token:PRO.walletId, docType, images: images.map(img=>({data:img.dataUrl, mimeType:img.mimeType}))})
    });
    const json=await res.json();
    if(!res.ok || json.error){
      if(json.code==='AUTH_REQUIRED'){ PRO.walletId=''; saveProState(); throw new Error('Wallet reset ho gaya — dobara try karo.'); }
      if(res.status===402){ PRO.balancePaise=json.balancePaise||0; renderProCredits(); openBuyModal(); }
      throw new Error(json.error||'Extraction failed');
    }

    const data=json.data;
    const mapped=AI_FIELD_MAP[docType](data, PRO.role);
    Object.keys(mapped).forEach(k=>{ if(mapped[k]){ VALS[k]=String(mapped[k]).toUpperCase(); AI_FILLED_FIELDS.add(k); } });
    scheduleSaveVals();
    updateSections();

    const dims=await loadImageDims(images[0].dataUrl);
    PRO.uploads[uploadsKey]={dataUrl:images[0].dataUrl,w:dims.w,h:dims.h,raw:data};

    PRO.balancePaise=json.balancePaise; renderProCredits();

    stateEl.textContent='Extracted \u2713'; stateEl.className='upload-slot-state done';
    btn.textContent='Extracted \u2713'; btn.disabled=true;
    statusEl.textContent=docType.toUpperCase()+' se data auto-fill ho gaya. Balance: ₹'+json.balanceRs;
    statusEl.className='status ok';
    renderProResult(docType, data);
  }catch(err){
    stateEl.textContent='Failed'; stateEl.className='upload-slot-state err';
    btn.disabled=false; btn.textContent='Retry Extract (₹5)';
    statusEl.textContent='Error: '+err.message;
    statusEl.className='status err';
  }
}

async function handlePhotoUpload(file){
  if(!file) return;
  const stateEl=document.getElementById('state-photo');
  stateEl.textContent='Reading...';
  const rawDataUrl=await fileToBase64(file);
  const dataUrl=await compressImage(rawDataUrl, 1400, 0.85);
  const dims=await loadImageDims(dataUrl);
  PRO.uploads.photo={dataUrl,w:dims.w,h:dims.h};
  const previewEl=document.getElementById('preview-photo');
  previewEl.innerHTML='';
  const img=document.createElement('img'); img.src=dataUrl;
  previewEl.appendChild(img);
  stateEl.textContent='Uploaded \u2713'; stateEl.className='upload-slot-state done';
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
  if(!amountRs || amountRs<=0){ alert('Sahi amount daalo.'); return; }
  const statusEl=document.getElementById('proCodeStatus');
  statusEl.textContent='Payment shuru ho raha hai...'; statusEl.className='status';

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
        statusEl.textContent='Payment confirm ho raha hai...'; statusEl.className='status';
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
          if(!verifyRes.ok || v.error) throw new Error(v.error||'Verification failed');
          PRO.balancePaise=v.balancePaise; renderProCredits();
          statusEl.textContent='₹'+amountRs+' add ho gaye! Balance: ₹'+v.balanceRs;
          statusEl.className='status ok';
          setTimeout(closeBuyModal, 1500);
        }catch(err){
          statusEl.textContent='Payment hua par confirm nahi ho paya: '+err.message+'. Refresh karke balance check karo.';
          statusEl.className='status err';
        }
      },
      modal:{ ondismiss:function(){ statusEl.textContent=''; } }
    });
    rzp.open();
  }catch(err){
    statusEl.textContent='Error: '+err.message;
    statusEl.className='status err';
  }
}

renderProCredits();
fetchWalletBalance();
claimWalletLinkFromUrl();
console.log('RTO PRO build: v6 (Razorpay-first wallet — random token identity, mobile only for recovery)');
