/* ════════ LANDING PAGE (index.html top section only) ════════
   Renders the package cards, the 41-form catalog grid + category pills,
   and the hero search box — the "browse and pick a form" experience
   above the fill-tool (#tool, ui.js/forms-data.js — untouched by this
   file). Everything here reads from the site's real data (FORMS/BUNDLES,
   forms-data.js) and hands off clicks to the site's real actions
   (fillNow/openOfficial/applyBundle, ui.js) — nothing here owns any data
   or state of its own. Only loaded on index.html, never on a task page.

   Visual design ported from design/design-landing-v3.html (an iLovePDF-
   style reference mockup) — its own hardcoded 41-row `forms`/`packages`
   arrays and per-code icon guesses were NOT kept; only the layout, the
   SVG icon set, and the category-color system came from it. See
   FORM_ICON (forms-data.js) for the num→icon mapping this file uses,
   ported 1:1 from that mockup's per-code assignments (every code in it
   matches a real FORMS[i].num exactly). */

const ICONS = {
  transfer:'<path d="M7 7h11l-3-3M17 17H6l3 3M18 7l-3 3M6 17l3-3"/>',
  renew:'<path d="M19 8V4m0 0h-4m4 0-5 5a7 7 0 1 0 2 7"/>',
  copy:'<rect x="8" y="8" width="10" height="11" rx="1"/><path d="M6 16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1"/>',
  bank:'<path d="M3 20h18M5 20V10l7-5 7 5v10M9 20v-5h6v5"/>',
  pin:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  doc:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5"/>',
  card:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  wheel:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  route:'<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h.5"/>',
  file:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 13h6M9 17h4"/>',
};
function svg(name){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[name]||ICONS.file)+'</svg>';
}

/* Our FORMS[i].cat values → the design's 5 category-tint classes
   (style.css). 'misc' maps to the design's catch-all "Other" tint. */
const CAT_CLASS={registration:'i-reg', transfer:'i-trn', licence:'i-lic', permit:'i-per', misc:'i-oth'};

/* Which task page (if any) a landing package card navigates to — same
   tab, per spec. b_death has no dedicated task page (only 5 exist), so
   it's applied in-page instead (see packageClick() below), same as any
   "Quick start" bundle button inside the fill-tool itself. */
const PACKAGE_HREF={
  b_transfer:'/vehicle-transfer', b_rcrenew:'/rc-renewal', b_duprc:'/duplicate-rc',
  b_hpremove:'/hp-removal', b_address:'/address-change',
};
const LANDING_PACKAGE_IDS=['b_transfer','b_rcrenew','b_duprc','b_hpremove','b_address','b_death'];

function buildCard({cls, icon, title, desc, foot, footClass, onClick}){
  const a=document.createElement('a');
  a.className='card';
  a.href='#';
  a.innerHTML=
    '<span class="card-icon '+cls+'">'+svg(icon)+'</span>'+
    '<h3>'+title+'</h3>'+
    '<p>'+desc+'</p>'+
    (foot ? '<span class="card-foot '+(footClass||'')+'">'+foot+'</span>' : '');
  a.addEventListener('click', e=>{ e.preventDefault(); onClick(); });
  return a;
}

function packageClick(bundleId){
  const href=PACKAGE_HREF[bundleId];
  if(href){ location.href=href; return; }
  applyBundle(bundleId);
}

function renderPackages(){
  const grid=document.getElementById('package-grid');
  if(!grid) return;
  grid.replaceChildren();
  LANDING_PACKAGE_IDS.forEach(id=>{
    const b=BUNDLES.find(x=>x.id===id);
    if(!b) return;
    grid.appendChild(buildCard({
      cls:b.cls, icon:b.svgIcon in ICONS ? b.svgIcon : 'file',
      title:b.label, desc:t('landing.pkg.'+id),
      foot:t('landing.formCount',{n:b.picks.length,s:b.picks.length===1?'':'s'}),
      onClick:()=>packageClick(id),
    }));
  });
}

function formCardFor(f){
  const idx=FORMS.indexOf(f);
  const online=!!f.fill;
  return buildCard({
    cls:CAT_CLASS[f.cat]||'i-oth', icon:FORM_ICON[f.num]||'file',
    title:'Form '+f.num+' — '+f.name, desc:f.desc,
    foot:online?t('landing.fillOnline'):t('landing.downloadBlank'),
    footClass:online?'online':'blank',
    onClick:()=>{ if(online) fillNow(idx); else openOfficial(idx); },
  });
}

/* ── Category pills ── */
const PILL_CATS=['all','registration','transfer','licence','permit','misc'];
let landingCat='all';

function renderPills(){
  const row=document.getElementById('pill-row');
  if(!row) return;
  row.replaceChildren();
  PILL_CATS.forEach(cat=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='pill'+(cat===landingCat?' active':'');
    b.textContent = cat==='all' ? t('landing.allCount',{n:FORMS.length}) : t('landing.cat.'+cat);
    b.addEventListener('click', ()=>{
      landingCat=cat;
      [...row.children].forEach(x=>x.classList.toggle('active', x===b));
      renderFormsGrid();
    });
    row.appendChild(b);
  });
}

function renderFormsGrid(){
  const grid=document.getElementById('forms-grid');
  if(!grid) return;
  grid.replaceChildren();
  FORMS.filter(f=>landingCat==='all'||f.cat===landingCat).forEach(f=>grid.appendChild(formCardFor(f)));
}

/* ── Hero search — a live results dropdown, separate from the pill-
   filtered grid above (matches design/design-landing-v3.html: typing
   here doesn't touch the grid at all, it lists direct hits instead). ── */
function initLandingSearch(){
  const input=document.getElementById('form-search');
  const resultsEl=document.getElementById('search-results');
  const noResultsEl=document.getElementById('no-results');
  const noResultsTitle=document.getElementById('no-results-title');
  if(!input) return;

  input.addEventListener('input', e=>{
    const q=e.target.value.trim().toLowerCase();
    resultsEl.replaceChildren();
    if(!q){ resultsEl.classList.add('hidden'); noResultsEl.classList.add('hidden'); return; }

    const hits=FORMS.filter(f=>(f.num+' '+f.name+' '+f.desc+' '+f.cat).toLowerCase().includes(q));
    if(!hits.length){
      resultsEl.classList.add('hidden');
      noResultsEl.classList.remove('hidden');
      noResultsTitle.textContent=t('landing.noResultsFor',{q:e.target.value.trim()});
      return;
    }
    noResultsEl.classList.add('hidden');
    resultsEl.classList.remove('hidden');
    hits.forEach(f=>{
      const idx=FORMS.indexOf(f);
      const online=!!f.fill;
      const row=document.createElement('a');
      row.className='result-row';
      row.href='#';
      row.innerHTML=
        '<span class="card-icon '+(CAT_CLASS[f.cat]||'i-oth')+'" style="width:38px;height:38px;margin:0;border-radius:7px">'+svg(FORM_ICON[f.num]||'file')+'</span>'+
        '<span style="flex:1"><span class="result-name">Form '+f.num+' — '+f.name+'</span><span class="result-description">'+f.desc+'</span></span>'+
        '<span class="card-foot '+(online?'online':'blank')+'" style="margin:0;padding:0">'+(online?t('landing.fillOnline'):t('landing.downloadBlank'))+'</span>';
      row.addEventListener('click', ev=>{
        ev.preventDefault();
        if(online) fillNow(idx); else openOfficial(idx);
      });
      resultsEl.appendChild(row);
    });
  });
}

/* ── Mobile header menu ── */
function initMobileMenu(){
  const menuBtn=document.getElementById('menu-btn');
  const mobileNav=document.getElementById('mobile-nav');
  if(!menuBtn || !mobileNav) return;
  menuBtn.addEventListener('click', ()=>{
    const open=!mobileNav.classList.contains('hidden');
    mobileNav.classList.toggle('hidden', open);
    menuBtn.setAttribute('aria-expanded', String(!open));
  });
  mobileNav.querySelectorAll('a').forEach(a=>a.addEventListener('click', ()=>{
    mobileNav.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded','false');
  }));
}

const allFormsTitleEl=document.getElementById('allFormsTitle');
if(allFormsTitleEl) allFormsTitleEl.textContent=t('landing.allFormsTitle',{n:FORMS.length});

renderPackages();
renderPills();
renderFormsGrid();
initLandingSearch();
initMobileMenu();
