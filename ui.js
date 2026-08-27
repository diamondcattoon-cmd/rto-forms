/* ════════ UI — rendering, event handlers ════════
   Everything that touches the DOM in response to data changing or the user
   clicking something: the forms-catalog grid (renderForms/fillNow/
   openOfficial/filterCat), the fill-tool's dynamic sections (buildBundles/
   buildPicks/updateSections/fieldHTML/handleInput), the restore-notice
   banner, the Jharkhand cost calculator, and generatePDF() (which hands off
   to the PICKS[i].gen functions in pdf-generate.js). Loads after
   forms-data.js — its own bootstrap calls at the bottom (renderForms(),
   buildBundles(); buildPicks(); updateSections();) need FORMS/PICKS/FIELDS/
   CHECKED to already exist. */

/* ════════ FORMS CATALOG DATA ════════ */
/* Auto-detect local forms folder */
let USE_LOCAL=false;
(async()=>{try{const r=await fetch('/forms/FORM-29.pdf',{method:'HEAD'});USE_LOCAL=r.ok;if(USE_LOCAL)renderForms();}catch(e){USE_LOCAL=false;}})();

let curCat='all';
function renderForms(){
  const grid=document.getElementById('formsGrid');
  /* Not every page has the full 31-form catalog grid — a task page (e.g.
     /vehicle-transfer) deliberately omits it to stay focused, reachable
     instead via the "Saare 31 forms dekho" toggle (#fullFormPicker) or a
     link back to the homepage's catalog. Without this guard, the
     unconditional renderForms() call below would throw on such a page and
     halt this entire script — including everything after it (buildBundles,
     applyTaskDefaults, etc.). */
  if(!grid) return;
  const q=(document.getElementById('formSearch')?.value||'').toLowerCase().trim();
  const base=USE_LOCAL?'/forms/':'https://parivahan.gov.in/sites/default/files/DownloadForm/cmvr/';
  const dir='https://parivahan.gov.in/en/forms-all';
  const list=FORMS.filter(f=>{
    const catOk = curCat==='all'||f.cat===curCat;
    const qOk = !q || f.num.toLowerCase().includes(q) || f.name.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q);
    return catOk && qOk;
  });
  if(!list.length){
    grid.innerHTML='<p style="grid-column:1/-1;color:var(--txt-2);font-size:14px;padding:20px 0">No forms match your search. Try a form number (e.g. 26) or a word like "duplicate", "renewal", "NOC".</p>';
    return;
  }
  grid.innerHTML=list.map((f,idx)=>{
    const links=(f.pdfs&&f.pdfs.length)
      ? f.pdfs.map(p=>`<a class="pdf-link" href="${base+p}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Official blank PDF">${p.replace('FORM-','').replace(/\.pdf/i,'')} PDF \u2193</a>`).join('')
      : `<a class="pdf-link" href="${dir}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Official site \u2197</a>`;
    const i=FORMS.indexOf(f);
    let click, status, liveCls;
    if(f.fill){ click=`fillNow(${i})`; status='\u25CF Fill online'; liveCls='is-live'; }
    else { click=`openOfficial(${i})`; status='Official format \u2014 PDF'; liveCls=''; }
    return `
    <div class="fcard ${liveCls}" onclick="${click}">
      <span class="fcard-tab">FORM ${f.num}</span>
      <div class="fcard-body">
        <div class="fcard-name">${f.name}</div>
        <div class="fcard-desc">${f.desc}</div>
      </div>
      <div class="fcard-foot">
        <span class="fcard-status">${status}</span>
        <span class="fcard-links">${links}</span>
      </div>
    </div>`;
  }).join('');
}

function fillNow(i){
  const f=FORMS[i];
  const ids=[].concat(f.fill);
  PICKS.forEach(p=>{ CHECKED[p.id]=ids.includes(p.id); });
  /* switch to the type of the first selected pick */
  const firstPick=PICKS.find(p=>ids.includes(p.id));
  if(firstPick) ACTIVE_TYPE=firstPick.type||'rto';
  buildPicks();
  updateSections();
  document.getElementById('tool').scrollIntoView({behavior:'smooth'});
}

function openOfficial(i){
  const f=FORMS[i];
  const base=USE_LOCAL?'/forms/':'https://parivahan.gov.in/sites/default/files/DownloadForm/cmvr/';
  const url=(f.pdfs&&f.pdfs.length)?base+f.pdfs[0]:'https://parivahan.gov.in/en/forms-all';
  window.open(url,'_blank');
}
function filterCat(cat,btn){
  curCat=cat;
  document.querySelectorAll('.cat-tab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  renderForms();
}

renderForms();

/* Reads a field's current value out of VALS (forms-data.js) — used by
   generatePDF() below to build the data object each PICKS[i].gen() draws from. */
function g(id){return (VALS[id]||'').trim();}
function showRestoreNotice(){
  const el=document.getElementById('restoreNotice');
  if(!el) return;
  el.innerHTML=`<div class="restore-notice"><span class="rn-msg">Aapka pichla data restore kar diya.</span><button class="rn-clear" onclick="dismissRestoreNotice(true)">Clear karo</button><button class="rn-dismiss" onclick="dismissRestoreNotice(false)" aria-label="Dismiss">&times;</button></div>`;
}
function dismissRestoreNotice(clear){
  if(clear){
    VALS={adv_at:'Jamshedpur',s_state:'Jharkhand'};
    clearSavedVals();
    updateSections();
  }
  const el=document.getElementById('restoreNotice');
  if(el) el.innerHTML='';
}

/* Build task-bundle buttons */
function buildBundles(){
  const wrap=document.getElementById('bundleWrap');
  if(!wrap) return;
  wrap.innerHTML = BUNDLES.map(b=>
    `<button class="bundle-btn" onclick="applyBundle('${b.id}')"><span class="bundle-ico">${b.icon}</span>${b.label}</button>`
  ).join('');
  /* On a task page, highlight the button matching what's already loaded —
     confirms "yes, this is what you're looking at", same highlight a user
     clicking it themselves would get (applyBundle()). Runs here (after the
     buttons exist) rather than in applyTaskDefaults() (which runs before
     buildBundles(), while #bundleWrap is still empty). No-op when
     window.TASK is unset — e.g. the root index.html. */
  if(typeof window!=='undefined' && window.TASK && TASK_BUNDLE_MAP[window.TASK]){
    const idx=BUNDLES.findIndex(x=>x.id===TASK_BUNDLE_MAP[window.TASK]);
    const btns=wrap.querySelectorAll('.bundle-btn');
    if(btns[idx]) btns[idx].classList.add('on');
  }
}

/* Core of applying a bundle: check exactly its picks, uncheck everything
   else, and switch to the type tab of its first pick so the checked items
   are visible once the picker is shown. Shared by applyBundle() (a user
   clicking a "Quick start" button) and applyTaskDefaults() (a task page
   like /vehicle-transfer pre-selecting its forms on load, before the user
   does anything at all) — same effect, different trigger, no duplicated
   logic between them. Returns false (and does nothing) for an unknown
   bundle id. */
function applyBundlePicks(bundleId){
  const b=BUNDLES.find(x=>x.id===bundleId);
  if(!b) return false;
  PICKS.forEach(p=>{ CHECKED[p.id]=b.picks.includes(p.id); });
  const firstPick=PICKS.find(p=>p.id===b.picks[0]);
  if(firstPick) ACTIVE_TYPE=firstPick.type||'rto';
  return true;
}

/* Apply a bundle from a "Quick start" button click: applyBundlePicks()
   plus the button-highlight/scroll/re-render side effects specific to a
   live user click (task-page bootstrap doesn't want any of those — there's
   no button to highlight yet, and scrolling to #tool on page load would
   just be jarring). */
function applyBundle(bid){
  if(!applyBundlePicks(bid)) return;
  document.querySelectorAll('.bundle-btn').forEach(btn=>btn.classList.remove('on'));
  const idx=BUNDLES.findIndex(x=>x.id===bid);
  const btns=document.querySelectorAll('.bundle-btn');
  if(btns[idx]) btns[idx].classList.add('on');
  buildPicks();
  updateSections();
  document.getElementById('tool').scrollIntoView({behavior:'smooth'});
}

/* ── Task pages (e.g. /vehicle-transfer/index.html) ──
   A task page sets window.TASK in an inline <script> BEFORE loading this
   file (see that page's <head>) — this table maps a task id onto an
   existing BUNDLES entry, so "this page is about vehicle transfer" is
   just "start with the transfer bundle already applied", reusing
   applyBundlePicks() rather than a second, task-specific data table that
   could drift from BUNDLES. Add one entry here per new task page. */
const TASK_BUNDLE_MAP={
  'vehicle-transfer': 'b_transfer',
  'rc-renewal':       'b_rcrenew',
  'duplicate-rc':     'b_duprc',
  'hp-removal':       'b_hpremove',
  'address-change':   'b_address',
};

/* Runs once at bootstrap (see the bottom of this file). No-ops completely
   when window.TASK is unset or unrecognized — e.g. the root index.html —
   so this can never change that page's behavior. On a real task page: (1)
   pre-checks that task's forms (buyer/owner sections then show themselves
   automatically via updateSections()'s existing need-based rendering — no
   separate "which sections to show" logic needed), and (2) collapses the
   full type-tabs+picks selector behind a "Saare 31 forms dekho" toggle
   (#pickerToggleLine/#fullFormPicker, see toggleFullPicker()) — a task
   page is meant to read as "here are this task's forms", not the entire
   31-form catalog, while staying exactly one click away from it. */
function applyTaskDefaults(){
  if(typeof window==='undefined' || !window.TASK) return;
  const bundleId=TASK_BUNDLE_MAP[window.TASK];
  if(!bundleId) return;
  applyBundlePicks(bundleId);
  const block=document.getElementById('fullFormPicker');
  const toggleLine=document.getElementById('pickerToggleLine');
  if(block) block.style.display='none';
  if(toggleLine) toggleLine.style.display='';
}

/* The "Saare 31 forms dekho" / "Forms list chhupao" toggle itself — plain
   show/hide, no re-render needed since #fullFormPicker's contents
   (type tabs, picks list) are already kept up to date by buildPicks()
   regardless of whether the block is visible. */
function toggleFullPicker(){
  const block=document.getElementById('fullFormPicker');
  const toggleLine=document.getElementById('pickerToggleLine');
  if(!block || !toggleLine) return;
  const show=block.style.display==='none';
  block.style.display=show?'':'none';
  toggleLine.textContent=show?'Forms list chhupao ↑':'Saare 31 forms dekho ↓';
}

/* Build the picks list grouped by active type, with type sub-tabs */
function buildPicks(){
  const tabsWrap=document.getElementById('typeTabs');
  if(tabsWrap){
    tabsWrap.innerHTML = DOC_TYPES.map(t=>{
      const count = PICKS.filter(p=>(p.type||'rto')===t.id).length;
      if(count===0 && t.id!=='rto') return '';
      const checkedInType = PICKS.filter(p=>(p.type||'rto')===t.id && CHECKED[p.id]).length;
      const badge = checkedInType>0 ? `<span class="tt-sel">${checkedInType}</span>` : `<span class="tt-count">${count}</span>`;
      return `<button class="type-tab${t.id===ACTIVE_TYPE?' on':''}" onclick="switchType('${t.id}')">${t.label} ${badge}</button>`;
    }).join('');
  }
  renderPicksList();
}

function switchType(tid){
  ACTIVE_TYPE=tid;
  buildPicks();
}

function renderPicksList(){
  const wrap=document.getElementById('picksWrap');
  const inType = PICKS.filter(p=>(p.type||'rto')===ACTIVE_TYPE);
  const suggest = computeSuggestPickIds();
  wrap.innerHTML = inType.map(p=>{
    const isSug = suggest.includes(p.id) && !CHECKED[p.id];
    return `<label class="pick${isSug?' pick-suggest':''}"><input type="checkbox" id="${p.id}"${CHECKED[p.id]?' checked':''} onchange="toggleCheck('${p.id}',this)"> ${p.label}${isSug?'<span class="sug-tag">suggested</span>':''}</label>`;
  }).join('') || '<p style="color:var(--txt-3);font-size:13px;padding:8px 0">No documents in this category yet.</p>';
}

function toggleCheck(id, el){
  CHECKED[id]=el.checked;
  buildPicks();  /* refresh tab badges */
  updateSections();
}

/* ── "Add more forms" — cross-type suggestions, derived live from whichever
   BUNDLES the current CHECKED selection overlaps, not a one-time snapshot
   from clicking a bundle button. This way it stays correct even if the user
   builds up a selection by hand (no bundle click at all) or edits it after
   applying a bundle — see PICKS/BUNDLES in forms-data.js for the source data. ── */
function computeSuggestPickIds(){
  const checkedIds=new Set(PICKS.filter(p=>CHECKED[p.id]).map(p=>p.id));
  if(!checkedIds.size) return [];
  const suggested=new Set();
  BUNDLES.forEach(b=>{
    if(b.picks.some(id=>checkedIds.has(id))){
      (b.suggest||[]).forEach(id=>suggested.add(id));
    }
  });
  return [...suggested];
}

/* Renders the dedicated "Add more forms" panel (index.html #addMoreFset) —
   unlike the inline .pick-suggest tag in renderPicksList() (only visible
   within the currently active type tab), this shows every suggestion
   regardless of which tab it belongs to, e.g. a receipt suggested alongside
   a transfer package even while the RTO Forms tab is showing. `need` is the
   field set already computed by updateSections(), reused here so "+N new
   fields" reflects what adding this pick would actually add on top of the
   currently selected forms — not its total field count. */
function renderSuggestions(need){
  const wrap=document.getElementById('addMoreFset');
  const listEl=document.getElementById('suggestList');
  if(!wrap || !listEl) return;
  const ids=computeSuggestPickIds();
  if(!ids.length){ wrap.style.display='none'; listEl.innerHTML=''; return; }
  wrap.style.display='';
  listEl.innerHTML=ids.map(id=>{
    const p=PICKS.find(x=>x.id===id);
    if(!p) return '';
    const isChecked=!!CHECKED[id];
    const newCount=(p.fields||[]).filter(f=>!need.has(f)).length;
    const delta=isChecked ? 'Added ✓' : (newCount===0 ? 'No new fields' : ('+'+newCount+' new field'+(newCount===1?'':'s')));
    const note=isChecked ? 'Included in your PDF' : (newCount===0 ? 'No extra fields needed' : 'Same details, no extra charge');
    return `<div class="suggest-row${isChecked?' added':''}" onclick="toggleSuggest('${id}')">
      <div class="suggest-row-main">
        <div class="suggest-row-label">${p.label}</div>
        <div class="suggest-row-note">${note}</div>
      </div>
      <span class="suggest-row-delta">${delta}</span>
      <span class="suggest-row-btn">${isChecked?'✕ Remove':'+ Add'}</span>
    </div>`;
  }).join('');
}

function toggleSuggest(id){
  CHECKED[id]=!CHECKED[id];
  buildPicks();
  updateSections();
}

/* ── PDF font style ── jsPDF's three built-in "standard 14" families
   (Helvetica, Times, Courier) render without embedding any font file — no
   extra network/asset cost, works the same in every PDF viewer. Every
   drawing function in pdf-generate.js hardcodes 'helvetica' directly (there
   are 40+ call sites, several inside per-form local closures like addForm20's
   own `F` constant) — rather than touch all of them, generatePDF() below
   monkey-patches doc.setFont() once, the same way it already wraps doc.text()
   defensively, so whatever family a drawing function asks for is substituted
   with the user's actual choice. */
let PDF_FONT='helvetica';
try{
  const saved=localStorage.getItem('rtoPdfFont');
  if(saved==='helvetica'||saved==='times'||saved==='courier') PDF_FONT=saved;
}catch(e){}
function setPdfFont(v){
  PDF_FONT=v;
  try{ localStorage.setItem('rtoPdfFont', v); }catch(e){}
}
(function initPdfFontRadio(){
  const id = PDF_FONT==='times' ? 'pdfFontTimes' : PDF_FONT==='courier' ? 'pdfFontCourier' : 'pdfFontHelvetica';
  const el=document.getElementById(id);
  if(el) el.checked=true;
})();

/* ── Settings modal — "what should already be selected when I open this
   site" preferences, saved per-browser in localStorage. Two independent
   knobs:
     defaultBundle  — '' (site default, i.e. leave PICKS[i].def from
                      forms-data.js alone), 'none' (start with nothing
                      checked), or a BUNDLES id to auto-apply that bundle.
     alwaysInclude  — pick ids that get checked in addition to whichever of
                      the above applies (e.g. "I always want a Money
                      Receipt too", regardless of which package I start
                      with).
   Deliberately NOT applied retroactively to the current session when
   changed from the modal — these are "next time I open the site" prefs,
   not a live action (that's what the picks list / Add-more-forms section
   are for) — see applyUserPrefs(), called once at bootstrap below. */
let USER_PREFS={defaultBundle:'', alwaysInclude:[]};
try{
  const raw=localStorage.getItem('rtoUserPrefs');
  if(raw){
    const parsed=JSON.parse(raw);
    if(parsed && typeof parsed==='object'){
      USER_PREFS.defaultBundle = typeof parsed.defaultBundle==='string' ? parsed.defaultBundle : '';
      USER_PREFS.alwaysInclude = Array.isArray(parsed.alwaysInclude) ? parsed.alwaysInclude.filter(id=>PICKS.some(p=>p.id===id)) : [];
    }
  }
}catch(e){}

function saveUserPrefs(){
  try{ localStorage.setItem('rtoUserPrefs', JSON.stringify(USER_PREFS)); }catch(e){}
}

function applyUserPrefs(){
  /* A task page's own selection (applyTaskDefaults(), run before this —
     see the bootstrap order at the bottom of this file) is more specific
     than a generic saved "default bundle" preference — landing on
     /vehicle-transfer should show the transfer forms even if this
     browser's Settings say "default to RC Renewal" elsewhere. The
     alwaysInclude layer still applies on top regardless — "always add
     Money Receipt" should hold everywhere, task page or not. */
  const hasTaskDefault=typeof window!=='undefined' && window.TASK && TASK_BUNDLE_MAP[window.TASK];
  if(!hasTaskDefault){
    if(USER_PREFS.defaultBundle==='none'){
      PICKS.forEach(p=>{ CHECKED[p.id]=false; });
    } else if(USER_PREFS.defaultBundle){
      const b=BUNDLES.find(x=>x.id===USER_PREFS.defaultBundle);
      if(b){
        PICKS.forEach(p=>{ CHECKED[p.id]=b.picks.includes(p.id); });
        const firstPick=PICKS.find(p=>p.id===b.picks[0]);
        if(firstPick) ACTIVE_TYPE=firstPick.type||'rto';
      }
    }
    /* '' = site default — forms-data.js's PICKS[i].def-based CHECKED already stands */
  }
  USER_PREFS.alwaysInclude.forEach(id=>{ if(id in CHECKED) CHECKED[id]=true; });
}

function setDefaultBundlePref(v){
  USER_PREFS.defaultBundle=v;
  saveUserPrefs();
}

function toggleAlwaysInclude(id, checked){
  const set=new Set(USER_PREFS.alwaysInclude);
  if(checked) set.add(id); else set.delete(id);
  USER_PREFS.alwaysInclude=[...set];
  saveUserPrefs();
}

function resetUserPrefs(){
  USER_PREFS={defaultBundle:'', alwaysInclude:[]};
  saveUserPrefs();
  setPdfFont('helvetica');
  const helvEl=document.getElementById('pdfFontHelvetica');
  if(helvEl) helvEl.checked=true;
  renderSettingsModal();
}

function renderDefaultBundleOptions(){
  const wrap=document.getElementById('settingsDefaultBundle');
  if(!wrap) return;
  const cur=USER_PREFS.defaultBundle||'';
  const opts=[
    {v:'', label:'Site default — Transfer package (Form 29/30 + affidavits)'},
    {v:'none', label:'Start empty — I’ll choose every time'},
    ...BUNDLES.map(b=>({v:b.id, label:b.icon+' '+b.label}))
  ];
  wrap.innerHTML=opts.map(o=>
    `<label class="pro-radio"><input type="radio" name="defaultBundlePref" value="${o.v}"${cur===o.v?' checked':''} onchange="setDefaultBundlePref(this.value)"> ${o.label}</label>`
  ).join('');
}

function renderAlwaysIncludeList(){
  const wrap=document.getElementById('settingsAlwaysInclude');
  if(!wrap) return;
  const saved=new Set(USER_PREFS.alwaysInclude);
  wrap.innerHTML=DOC_TYPES.map(t=>{
    const items=PICKS.filter(p=>(p.type||'rto')===t.id);
    if(!items.length) return '';
    return `<div class="settings-group">
      <div class="settings-group-lbl">${t.label}</div>
      <div class="picks">${items.map(p=>`<label class="pick"><input type="checkbox"${saved.has(p.id)?' checked':''} onchange="toggleAlwaysInclude('${p.id}',this.checked)"> ${p.label}</label>`).join('')}</div>
    </div>`;
  }).join('');
}

function renderSettingsModal(){
  renderDefaultBundleOptions();
  renderAlwaysIncludeList();
}

function openSettingsModal(){
  renderSettingsModal();
  document.getElementById('settingsModal').style.display='flex';
}
function closeSettingsModal(){
  document.getElementById('settingsModal').style.display='none';
}

/* Which document a field's value came from, for the conflict notice's
   wording — e.g. "RC aur Aadhaar ka data alag hai". */
const DOC_LABEL_UI={rc:'RC', aadhaar:'Aadhaar', pan:'PAN'};

function fieldHTML(id){
  const f=FIELDS[id];
  const v=(VALS[id]||'').replace(/"/g,'&quot;');
  const maxl=f.maxlen?`maxlength="${f.maxlen}"`:'';
  const imode=f.inputmode?`inputmode="${f.inputmode}"`:'';
  const hint=f.hint?`<span class="fld-hint">${f.hint}</span>`:'';
  const counter=(f.maxlen&&f.type!=='date')?`<span class="fld-counter" id="cnt_${id}"></span>`:'';
  const dateTab=f.type==='date'?`onkeydown="dateTabFix(event,this)"`:'';
  const isAi=AI_FILLED_FIELDS.has(id);
  const isVerified=VERIFIED_FIELDS.has(id);
  const aiBadge=isAi?'<span class="fld-ai-badge">AI</span>':'';
  const verifiedBadge=isVerified?'<span class="fld-verified-badge">✓</span>':'';
  const conflict=PENDING_CONFLICTS[id];
  const conflictNote=conflict
    ? `<div class="fld-conflict-note" id="conflict_${id}">${DOC_LABEL_UI[conflict.winner.docType]||conflict.winner.docType} aur ${DOC_LABEL_UI[conflict.loser.docType]||conflict.loser.docType} ka data alag hai — ${DOC_LABEL_UI[conflict.winner.docType]||conflict.winner.docType} wala bhara gaya. <button type="button" onclick="switchFieldConflict('${id}')">${DOC_LABEL_UI[conflict.loser.docType]||conflict.loser.docType} wala use karo</button><button type="button" class="fld-conflict-dismiss" onclick="dismissFieldConflict('${id}')" aria-label="Dismiss">&times;</button></div>`
    : '';
  return `<div class="fld ${f.full?'full':''}${isAi?' fld-ai':''}${isVerified?' fld-verified':''}" id="fldwrap_${id}"><label><span>${f.label}${aiBadge}${verifiedBadge}</span>${counter}</label><input type="${f.type||'text'}" id="${id}" placeholder="${f.ph||''}" value="${v}" ${maxl} ${imode} ${dateTab} oninput="handleInput('${id}',this)">${hint}${conflictNote}</div>`;
}

/* Tab on a date field should move to the next input, not the calendar picker */
function dateTabFix(e, el){
  if(e.key==='Tab' && !e.shiftKey){
    const inputs=Array.from(document.querySelectorAll('#dynFields input, #dynFields select'));
    const idx=inputs.indexOf(el);
    if(idx>-1 && idx<inputs.length-1){
      e.preventDefault();
      inputs[idx+1].focus();
    }
  }
}

function handleInput(id, el){
  const f=FIELDS[id];
  let v=el.value;
  /* Auto-uppercase all text fields except email and date */
  if(f.type!=='email' && f.type!=='date') v=v.toUpperCase();
  if(f.pat) v=v.replace(f.pat,'');
  if(f.maxlen && v.length>f.maxlen) v=v.slice(0,f.maxlen);
  /* preserve caret position for a smooth typing experience */
  const caret=el.selectionStart;
  if(el.value!==v){ el.value=v; try{ el.setSelectionRange(caret,caret); }catch(e){} }
  VALS[id]=v;
  scheduleSaveVals();
  /* Editing an AI-filled field is exactly the review this field needed —
     drop the amber "please check this" state and mark it verified (green)
     instead, without a full re-render (which would lose focus/caret
     mid-typing). A field that was never AI-filled doesn't get this
     treatment — there was no AI guess to review in the first place. */
  if(AI_FILLED_FIELDS.has(id)){
    AI_FILLED_FIELDS.delete(id);
    VERIFIED_FIELDS.add(id);
    const wrap=document.getElementById('fldwrap_'+id);
    if(wrap){
      wrap.classList.remove('fld-ai');
      wrap.classList.add('fld-verified');
      const badge=wrap.querySelector('.fld-ai-badge');
      if(badge) badge.remove();
      const label=wrap.querySelector('label span');
      if(label && !label.querySelector('.fld-verified-badge')){
        const check=document.createElement('span');
        check.className='fld-verified-badge';
        check.textContent='✓';
        label.appendChild(check);
      }
    }
  }
  /* A manual edit supersedes whatever document(s) supplied this field —
     there's no longer an AI "source" to arbitrate future extractions
     against (the next AI value for this field, from anywhere, is treated
     as fresh — see mergeExtractedFields's "nothing here yet" branch), and
     any pending conflict notice for it is now moot. */
  if(id in FIELD_SOURCE) delete FIELD_SOURCE[id];
  if(id in PENDING_CONFLICTS){
    delete PENDING_CONFLICTS[id];
    const note=document.getElementById('conflict_'+id);
    if(note) note.remove();
  }
  const cnt=document.getElementById('cnt_'+id);
  if(cnt && f.maxlen && f.type!=='date'){
    cnt.textContent = v.length>0 ? ` ${v.length}/${f.maxlen}` : '';
    cnt.style.color = (f.maxlen-v.length)<=2 ? 'var(--stamp)' : 'var(--txt-3)';
  }
  if(id==='mobile'){
    el.style.borderColor = v.length>0&&v.length<10 ? 'var(--stamp)' : v.length===10 ? 'var(--approve)' : '';
  } else if(id==='reg_no' && v.length>0){
    el.style.borderColor = v.length>=5 ? 'var(--approve)' : '';
  } else {
    el.style.borderColor='';
  }
  updateProContext(new Set(PICKS.filter(p=>CHECKED[p.id]).flatMap(p=>p.fields||[])));
}

/* Tells the PRO panel either (a) how many still-amber, AI-filled-and-
   unreviewed fields exist right now, naming which document(s) supplied
   them — "14 fields RC aur Aadhaar se bhare — please check the
   highlighted boxes." — or, when nothing needs review, (b) the plainer
   "Is package mein 22 fields hain, 9 abhi khali hain." (a) takes priority
   whenever it applies: an unverified AI guess (e.g. a misread chassis
   digit) is a more urgent thing to flag than an empty field the user
   hasn't gotten to yet. Recalculates on every keystroke (handleInput())
   and section rebuild, so it naturally clears field-by-field as the user
   reviews (edits) each one — see VERIFIED_FIELDS (forms-data.js). Hidden
   entirely when no forms are selected yet. */
function updateProContext(need){
  const el=document.getElementById('proContext');
  if(!el) return;
  if(!need || !need.size){ el.classList.remove('show'); el.textContent=''; return; }

  const unverified=[...need].filter(f=>AI_FILLED_FIELDS.has(f));
  if(unverified.length){
    const docTypes=[...new Set(unverified.map(f=>FIELD_SOURCE[f]).filter(Boolean))];
    const docLabels=docTypes.map(t=>DOC_LABEL_UI[t]||t);
    const docText=docLabels.length<=1 ? (docLabels[0]||'AI')
      : docLabels.slice(0,-1).join(', ')+' aur '+docLabels[docLabels.length-1];
    el.textContent=unverified.length+' field'+(unverified.length>1?'s':'')+' '+docText+' se bhare — please check the highlighted boxes.';
    el.classList.add('show');
    return;
  }

  const total=need.size;
  const empty=[...need].filter(f=>!(VALS[f]||'').trim()).length;
  el.textContent='Is package mein '+total+' field'+(total>1?'s':'')+' hain, '+empty+' abhi khali '+(empty===1?'hai':'hain')+'.';
  el.classList.add('show');
}

/* Which target field ids a given AI_FIELD_MAP[docType] can ever write —
   derived from its own source (regex over out.xxx=/out[p+'xxx'] patterns)
   instead of a separately hand-maintained list, so this can't drift out of
   sync with field-mapping.js the way the Worker/frontend contract once did.
   The out[p+'xxx'] patterns are role-prefixed (s_/b_) — which prefixes are
   actually reachable is governed by DOC_RULES (field-mapping.js): a
   'fixed'-role doc type (e.g. rc, always seller) can only ever write its
   one prefix, never both, so reporting both here would make the RC upload
   slot appear "relevant" for a buyer-only field it can never actually fill. */
function docTypeOutputFields(docType){
  const src=AI_FIELD_MAP[docType].toString();
  const fields=new Set();
  for(const m of src.matchAll(/out\.(\w+)\s*=/g)) fields.add(m[1]);
  const rule=DOC_RULES[docType];
  const prefixes = (rule && rule.role==='fixed') ? [rule.defaultRole==='buyer'?'b_':'s_'] : ['s_','b_'];
  for(const m of src.matchAll(/out\[p\+'(\w+)'\]/g)){
    prefixes.forEach(pre=>fields.add(pre+m[1]));
  }
  return fields;
}

/* Only show the document-upload slots that could actually fill a field the
   currently-selected forms need — e.g. no RC slot if nothing needs vehicle
   fields. Face Photo is a plain attachment, not tied to AI extraction, so
   it's excluded from this and always stays visible.
   anyB mirrors updateSections()'s own "do any selected forms need a buyer"
   check (PICKS[i].needB) — reused here to show/hide each slot's per-document
   role selector (see DOC_RULES): no buyer-needing form selected means there
   is no buyer to fill in, so the choice is pointless and just confusing
   (e.g. RC renewal / duplicate RC, which never involve a buyer at all). */
const DOC_SLOT_TYPES=['aadhaar','pan','rc'];
function updateDocSlotVisibility(need, anyB){
  const grid=document.getElementById('docSlotGrid');
  let anyVisible=false;
  DOC_SLOT_TYPES.forEach(docType=>{
    const slot=document.getElementById('docSlot-'+docType);
    if(!slot) return;
    const relevant=need && need.size && [...docTypeOutputFields(docType)].some(f=>need.has(f));
    slot.style.display=relevant?'':'none';
    if(relevant) anyVisible=true;

    const roleRow=document.getElementById('docRole-'+docType);
    if(roleRow){
      const rule=DOC_RULES[docType];
      roleRow.style.display=(relevant && anyB && rule && rule.role==='choice') ? '' : 'none';
    }
  });
  const emptyNote=document.getElementById('docSlotEmptyNote');
  if(emptyNote) emptyNote.style.display=anyVisible?'none':'';
}

/* Small Individual/Firm toggle shown above the Seller section's fields —
   reflects SELLER_OWNER_TYPE (forms-data.js), which a fresh RC extraction
   sets automatically (see runExtraction(), pro-wallet.js) and this toggle
   lets the user correct or set manually, with or without ever using AI
   extraction. Always shown when the Seller section itself is showing —
   there's no "only relevant sometimes" case here, unlike the per-document
   AI role selectors, since every seller either is or isn't a firm. */
function ownerTypeToggleHTML(){
  const isFirm=SELLER_OWNER_TYPE==='firm';
  return `<div class="owner-type-row">
    <span class="doc-role-lbl">Owner type</span>
    <label class="doc-role-opt"><input type="radio" name="sellerOwnerType" value="individual"${!isFirm?' checked':''} onchange="setSellerOwnerType(this.value)"> Individual</label>
    <label class="doc-role-opt"><input type="radio" name="sellerOwnerType" value="firm"${isFirm?' checked':''} onchange="setSellerOwnerType(this.value)"> Firm / Company</label>
  </div>`;
}

/* Build the input sections from the union of selected forms' fields */
function updateSections(){
  const chosen=PICKS.filter(p=>CHECKED[p.id]);
  const need=new Set();
  chosen.forEach(p=>(p.fields||[]).forEach(f=>need.add(f)));
  const anyB=chosen.some(p=>p.needB);
  updateProContext(need);
  updateDocSlotVisibility(need, anyB);
  renderSuggestions(need);

  /* Update dynamic page count note */
  const pcEl=document.getElementById('pageCountNote');
  if(pcEl){
    if(!chosen.length){
      pcEl.textContent='select forms above';
    } else {
      const totalPages=chosen.reduce((s,p)=>s+(p.pages||1),0);
      const formNames=chosen.map(p=>p.label.split('—')[0].trim()).join(', ');
      pcEl.textContent=totalPages+' page'+(totalPages>1?'s':'')+' · A4 · print-ready';
      const genNote=document.getElementById('genNote');
      if(genNote) genNote.title=formNames;
    }
  }

  /* Update generate button text */
  const genBtn=document.getElementById('genBtn');
  if(genBtn && chosen.length){
    genBtn.textContent='Generate '+chosen.length+' form'+(chosen.length>1?'s':'')+' — Download PDF';
  } else if(genBtn){
    genBtn.textContent='Generate selected forms — Download PDF';
  }

  let html=''; let n=1;
  const fieldOrder=Object.keys(FIELDS);
  SECTIONS.forEach(s=>{
    const isOwnerSection=s.id==='owner';
    let ids=fieldOrder.filter(k=>FIELDS[k].sec===s.id && need.has(k));
    /* A firm/company doesn't have a "father's name" — see SELLER_OWNER_TYPE
       (forms-data.js) and generatePDF() below, which also blanks it on the
       printed PDF regardless of any stray leftover value in VALS.s_father. */
    if(isOwnerSection && SELLER_OWNER_TYPE==='firm') ids=ids.filter(k=>k!=='s_father');
    if(!ids.length) return;
    const title=(s.id==='owner') ? (anyB?'Seller (transferor)':'Owner / Applicant details') : s.title;
    const ownerTypeRow=isOwnerSection ? ownerTypeToggleHTML() : '';
    html+=`<div class="fset"><div class="fset-label"><span class="fset-num">${n++}</span><h4>${title}</h4></div>${ownerTypeRow}<div class="grid2">${ids.map(fieldHTML).join('')}</div></div>`;
  });
  document.getElementById('dynFields').innerHTML = html ||
    '<p style="color:var(--txt-2);font-size:13.5px;padding:6px 0 14px">Select at least one form above to see its fields.</p>';

  /* Mobile FAB visibility */
  const fab=document.getElementById('mobileFab');
  if(fab) fab.classList.toggle('show', chosen.length>0);
}

applyTaskDefaults();
applyUserPrefs();
buildBundles();
buildPicks();
updateSections();
if(_valsRestored) showRestoreNotice();

/* ════════ JHARKHAND REGISTRATION COST CALCULATOR ════════ */
/* ─────────────────────────────────────────────────────────
   EDIT THESE RATES AFTER VERIFYING WITH YOUR DTO / RTO.
   All values are based on publicly available 2026 estimates
   and MUST be confirmed before relying on them.
   ───────────────────────────────────────────────────────── */
const JH_RATES = {
  /* Road tax — % of ex-showroom price (GST-exclusive), by price slab */
  car: [
    {upTo:600000,   pct:6},    /* under 6 lakh  → 6%  */
    {upTo:1500000,  pct:8},    /* 6–15 lakh     → 8%  */
    {upTo:Infinity, pct:10}    /* above 15 lakh → 10% */
  ],
  bike: [
    {upTo:Infinity, pct:6}     /* two-wheeler flat 6% (verify) */
  ],
  evRebatePct: 25,        /* EV gets 25% rebate on road tax */
  cngRebatePct: 0,        /* set if CNG concession applies */
  usedExtraPct: 3,        /* pre-owned car: +3% */
  companyExtraPct: 0,     /* set if company owners pay extra */
  gstPct: 28,             /* to back-calculate ex-showroom-without-GST */
  /* Fixed fees (₹) */
  regFee:     {car:600,  bike:300},   /* CMV registration fee */
  smartCard:  200,                     /* RC smart card */
  hpFee:      1500,                    /* hypothecation endorsement */
  hsrpPlate:  {car:600,  bike:300},   /* HSRP number plate (approx) */
  postalFee:  50                       /* postage / misc */
};

function fmtINR(n){
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function calcEstimate(){
  const priceRaw = parseFloat((document.getElementById('calcPrice').value||'').replace(/[^0-9.]/g,''));
  const result = document.getElementById('calcResult');
  if(!priceRaw || priceRaw < 1000){
    result.innerHTML = '<p class="calc-placeholder">Ex-showroom price daalo — estimate yahan dikhega.</p>';
    return;
  }
  const type  = document.getElementById('calcType').value;
  const fuel  = document.getElementById('calcFuel').value;
  const owner = document.getElementById('calcOwner').value;
  const cond  = document.getElementById('calcCond').value;
  const hp    = document.getElementById('calcHP').value;

  /* Road tax is on GST-exclusive price. If user enters on-road/GST-incl price,
     we approximate the taxable (ex-showroom pre-GST) base. */
  const taxableBase = priceRaw / (1 + JH_RATES.gstPct/100);

  /* Find slab % */
  const slabs = JH_RATES[type] || JH_RATES.car;
  let pct = slabs[slabs.length-1].pct;
  for(const s of slabs){ if(taxableBase <= s.upTo){ pct = s.pct; break; } }

  /* Pre-owned extra */
  if(cond==='used' && type==='car') pct += JH_RATES.usedExtraPct;
  /* Company extra */
  if(owner==='company') pct += JH_RATES.companyExtraPct;

  let roadTax = taxableBase * pct/100;
  let rebate = 0;
  if(fuel==='ev'){ rebate = roadTax * JH_RATES.evRebatePct/100; }
  else if(fuel==='cng'){ rebate = roadTax * JH_RATES.cngRebatePct/100; }
  const roadTaxFinal = roadTax - rebate;

  const regFee   = JH_RATES.regFee[type];
  const smart    = JH_RATES.smartCard;
  const hsrp     = JH_RATES.hsrpPlate[type];
  const postal   = JH_RATES.postalFee;
  const hpFee    = (hp==='yes') ? JH_RATES.hpFee : 0;

  const total = roadTaxFinal + regFee + smart + hsrp + postal + hpFee;

  let rows = '';
  rows += `<div class="calc-row"><span class="lbl">Taxable base (approx, ex-GST)</span><span class="val">${fmtINR(taxableBase)}</span></div>`;
  rows += `<div class="calc-row"><span class="lbl">Road tax @ ${pct}%</span><span class="val">${fmtINR(roadTax)}</span></div>`;
  if(rebate>0){
    rows += `<div class="calc-row"><span class="lbl">${fuel==='ev'?'EV':'CNG'} rebate (${fuel==='ev'?JH_RATES.evRebatePct:JH_RATES.cngRebatePct}%)</span><span class="val">− ${fmtINR(rebate)}</span></div>`;
  }
  rows += `<div class="calc-row"><span class="lbl">Registration fee</span><span class="val">${fmtINR(regFee)}</span></div>`;
  rows += `<div class="calc-row"><span class="lbl">Smart card (RC)</span><span class="val">${fmtINR(smart)}</span></div>`;
  rows += `<div class="calc-row"><span class="lbl">HSRP number plate</span><span class="val">${fmtINR(hsrp)}</span></div>`;
  if(hpFee>0){
    rows += `<div class="calc-row"><span class="lbl">HP endorsement (loan)</span><span class="val">${fmtINR(hpFee)}</span></div>`;
  }
  rows += `<div class="calc-row muted"><span class="lbl">Postage / misc</span><span class="val">${fmtINR(postal)}</span></div>`;
  rows += `<div class="calc-row total"><span class="lbl">Estimated total</span><span class="val">${fmtINR(total)}</span></div>`;

  result.innerHTML = rows;
}


function generatePDF(blank){
  const st=document.getElementById('statusMsg');
  const btn=document.getElementById('genBtn');
  const bbtn=document.getElementById('blankBtn');

  const chosen=PICKS.filter(p=>CHECKED[p.id]);
  if(!chosen.length){
    st.textContent='Select at least one form to include.';
    st.className='status err';
    return;
  }

  const need=new Set();
  chosen.forEach(p=>(p.fields||[]).forEach(f=>need.add(f)));

  let d={};
  const allIds=Object.keys(FIELDS);
  if(blank){
    allIds.forEach(k=>d[k]='');
  } else {
    const needsReg=need.has('reg_no');
    const needsBuyer=chosen.some(p=>p.needB);
    const highlightErr=(fieldId,msg)=>{
      st.textContent=msg; st.className='status err';
      const inp=document.getElementById(fieldId);
      if(inp){
        inp.classList.add('fld-blink');
        inp.scrollIntoView({behavior:'smooth',block:'center'});
        inp.focus();
        setTimeout(()=>{inp.classList.remove('fld-blink');},2200);
      }
    };
    if(need.has('s_name') && !g('s_name')){highlightErr('s_name','Owner / Seller name is required.'); return;}
    if(needsReg && !g('reg_no')){highlightErr('reg_no','Registration No. is required for the selected forms.'); return;}
    if(needsBuyer && !g('b_name')){highlightErr('b_name','Purchaser name is required for the selected transfer / sale forms.'); return;}
    /* Mobile is compulsory only for forms that actually include a mobile
       number field — checked separately for seller ('mobile') and buyer
       ('b_mobile') since a pick can require either, both, or neither
       (e.g. Form 30 needs both; most single-party forms need only
       'mobile'). Both checks must run — this used to only check 'mobile',
       which let a PDF generate with a required buyer mobile left blank. */
    if(need.has('mobile')){
      const mob=g('mobile');
      if(!mob){highlightErr('mobile','Mobile number is compulsory — please enter it before generating the PDF.'); return;}
      if(mob.length!==10){highlightErr('mobile','Mobile number must be exactly 10 digits.'); return;}
    }
    if(need.has('b_mobile')){
      const bmob=g('b_mobile');
      if(!bmob){highlightErr('b_mobile','Purchaser mobile number is compulsory — please enter it before generating the PDF.'); return;}
      if(bmob.length!==10){highlightErr('b_mobile','Purchaser mobile number must be exactly 10 digits.'); return;}
    }
    allIds.forEach(k=>d[k]=g(k));
    d.veh_type=d.veh_type||'Motor Vehicle';
    d.rto=d.rto||'District Transport Office, Jamshedpur';
    /* Only the seller's state gets a default — defaulting the buyer's too
       would silently repeat the exact bug being fixed here (assuming the
       buyer is in the same state as the seller/site). An unset b_state
       just prints blank via addrJoin() (pdf-generate.js), not a wrong
       state. */
    d.s_state=d.s_state||'Jharkhand';
    d.adv_at=d.adv_at||'Jamshedpur';
    /* A firm/company has no father's name — blank it on the printed PDF
       (the dotted "S/o" line still draws, just with nothing written on
       it) regardless of whatever happens to be sitting in VALS.s_father
       (e.g. leftover from an earlier Individual selection, or a stray AI
       extraction) — see SELLER_OWNER_TYPE (forms-data.js). */
    if(SELLER_OWNER_TYPE==='firm') d.s_father='';
  }

  btn.disabled=true; if(bbtn) bbtn.disabled=true;
  st.textContent=''; st.className='status';

  setTimeout(()=>{
    try{
      const { jsPDF } = window.jspdf;
      const doc=new jsPDF({unit:'mm',format:'a4'});
      /* Defensive: ensure any value passed to doc.text is a string (prevents crashes on numbers/null) */
      const _origText=doc.text.bind(doc);
      doc.text=function(txt,...rest){
        if(txt==null) txt='';
        else if(typeof txt!=='string' && !Array.isArray(txt)) txt=String(txt);
        return _origText(txt,...rest);
      };
      /* Substitute the user's chosen PDF font for whatever family the drawing
         functions ask for (always 'helvetica' literally, in every PICKS[i].gen)
         — see setPdfFont() above for why this is done here rather than in
         pdf-generate.js itself. Style (normal/bold/etc.) passes through unchanged. */
      const _origSetFont=doc.setFont.bind(doc);
      doc.setFont=function(family,style,...rest){
        return _origSetFont(PDF_FONT,style,...rest);
      };
      doc.setFont('helvetica','normal');
      chosen.forEach((p,i)=>{
        if(i>0) doc.addPage();
        doc.setFont('helvetica','normal');
        p.gen(doc,d);
      });

      /* PRO: attach uploaded Aadhaar/PAN/RC copies + face photo as extra pages */
      const attachChk=document.getElementById('attachDocsChk');
      if(!blank && attachChk && attachChk.checked && typeof PRO!=='undefined'){
        ['aadhaar','pan','rc','photo'].forEach(key=>{
          const up=PRO.uploads && PRO.uploads[key];
          if(!up) return;
          doc.addPage();
          doc.setFont('helvetica','bold'); doc.setFontSize(12);
          doc.text('Attachment: '+key.toUpperCase(), 15, 15);
          doc.setFont('helvetica','normal');
          const maxW=180, maxH=245;
          const scale=Math.min(maxW/up.w, maxH/up.h, 1);
          const w=up.w*scale, h=up.h*scale;
          const x=(210-w)/2, y=25;
          try{ doc.addImage(up.dataUrl,'JPEG',x,y,w,h); }catch(e){}
        });
      }

      const formNums=chosen.map(p=>p.label.split('—')[0].replace('Form ','').trim()).join('_');
      const fname = blank
        ? 'RTO_Blank_Forms_'+formNums+'.pdf'
        : 'Form_'+formNums+'_'+(d.reg_no||d.s_name||'set').replace(/\s+/g,'_')+'.pdf';
      doc.save(fname);
      st.textContent = blank
        ? 'Blank forms downloaded \u2014 '+chosen.length+' empty form(s) ready to print and fill by hand.'
        : 'PDF downloaded \u2014 '+chosen.length+' filled form(s) ready. Print, stamp and submit.';
      st.className='status ok';
    }catch(e){
      st.textContent='Error: '+e.message;
      st.className='status err';
    }
    btn.disabled=false; if(bbtn) bbtn.disabled=false;
  },80);
}
