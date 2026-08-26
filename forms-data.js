/* ════════ FORMS / FIELDS / PICKS DATA ════════
   Pure data + minimal state — the form catalog (FORMS), the shared field
   registry (SECTIONS, FIELDS), in-progress field values (VALS, persisted to
   localStorage), and the fillable-form registry (PICKS, DOC_TYPES, BUNDLES,
   CHECKED). This file must load after pdf-generate.js — PICKS references
   its gen functions (addForm29 etc.) by name — and before ui.js, whose
   startup calls (buildBundles/buildPicks/updateSections) need PICKS/FIELDS/
   CHECKED to already exist. */

const FORMS=[
 {num:'1',name:'Application-cum-Declaration of Physical Fitness',desc:'Self-declaration of medical fitness for learner\'s licence — Rule 5(1)',cat:'licence',fill:'pk1',pdfs:['FORM-1.pdf']},
 {num:'1A',name:'Medical Certificate',desc:'Fitness certificate filled by a registered medical practitioner — Rule 5(2)',cat:'licence',fmt:true,pdfs:['FORM-1A.pdf']},
 {num:'2',name:'Learner\'s Licence / DL Application',desc:'Common application for LL, DL, new class or renewal — Rules 10, 14, 17, 18',cat:'licence',fill:'pk2',pdfs:['FORM-2.pdf']},
 {num:'3',name:'Learner\'s Licence',desc:'Form of the learner\'s licence issued by the authority — Rule 11',cat:'licence',fmt:true,pdfs:['FORM-3.pdf']},
 {num:'4A',name:'International Driving Permit',desc:'IDP application for driving abroad — Rule 15A',cat:'licence',fill:'pk4A',pdfs:['FORM-4A.pdf']},
 {num:'5',name:'Driving Certificate',desc:'Training certificate issued by driving school — Rule 14(e)',cat:'licence',fmt:true,pdfs:['FORM-5.pdf']},
 {num:'6',name:'Form of Driving Licence',desc:'DL booklet form issued by registering authority — Rule 16(1)',cat:'licence',fmt:true,pdfs:['FORM-6.pdf']},
 {num:'7',name:'Driving Licence Card',desc:'Laminated card-type driving licence — Rule 16(2)',cat:'licence',fmt:true,pdfs:['FORM-7.pdf']},
 {num:'8',name:'Addition of New Vehicle Class',desc:'Add a vehicle class to an existing DL — Rule 17(1)',cat:'licence',fill:'pk8',pdfs:['FORM-8.pdf']},
 {num:'9',name:'Renewal of Driving Licence',desc:'DL renewal application — Rule 18(1)',cat:'licence',fill:'pk9',pdfs:['FORM-9.pdf']},
 {num:'LLD',name:'Duplicate Learner\'s / Driving Licence',desc:'Replacement of lost, destroyed or torn licence',cat:'licence',fill:'pkLLD',pdfs:['FORM-LLD.pdf']},
 {num:'14',name:'Register of Driving School Trainees',desc:'Enrolment register kept by driving school — Rule 27',cat:'misc',fmt:true,pdfs:['FORM-14.pdf']},
 {num:'15',name:'Register of Driving Hours',desc:'Daily instruction register of driving school — Rule 27',cat:'misc',fmt:true,pdfs:['FORM-15.pdf']},
 {num:'16',name:'Trade Certificate Application',desc:'Dealer / manufacturer trade certificate — Rule 34',cat:'misc',fill:'pk16',pdfs:['FORM-16.pdf']},
 {num:'17',name:'Trade Certificate',desc:'Form of trade certificate issued to dealer — Rule 35',cat:'misc',fmt:true,pdfs:['FORM-17.pdf']},
 {num:'20',name:'Registration of Motor Vehicle',desc:'Register / temporarily register a vehicle — Rules 47, 53A (official 4-page format)',cat:'registration',fill:'pk20',pdfs:['FORM-20.pdf']},
 {num:'21',name:'Sale Certificate',desc:'By dealer / manufacturer — Rule 47(a),(d) (official Parts I\u2013IV)',cat:'registration',fill:'pk21',pdfs:['FORM-21.pdf']},
 {num:'22',name:'Roadworthiness Certificate',desc:'Emission & noise compliance by manufacturer — Rule 47(1)(g) (official format)',cat:'registration',fill:'pk22',pdfs:['FORM-22.PDF']},
 {num:'23',name:'Certificate of Registration',desc:'RC book form issued by authority — Rule 48',cat:'registration',fmt:true,pdfs:['FORM-23.pdf']},
 {num:'24',name:'Register of Motor Vehicles',desc:'Vehicle register maintained by RA — Rule 49',cat:'registration',fmt:true,pdfs:['FORM-24.pdf']},
 {num:'25',name:'Renewal of Registration',desc:'Renew RC of non-transport vehicle — Rule 52 (full 2-page format)',cat:'registration',fill:'pk25',pdfs:['FORM-25.pdf']},
 {num:'26',name:'Duplicate RC',desc:'Lost / torn / mutilated RC — Rule 53 (official 2-page format)',cat:'registration',fill:'pk26',pdfs:['FORM-26.pdf']},
 {num:'27',name:'New Registration Mark',desc:'New mark on migration to another state — Rule 54 (official 2-page format)',cat:'registration',fill:'pk27',pdfs:['FORM-27.pdf']},
 {num:'27A',name:'New Registration Mark — BH-Series',desc:'BH-Series assignment for eligible owners — Rule 51B(4) (official format)',cat:'registration',fill:'pk27A',pdfs:[]},
 {num:'28',name:'No Objection Certificate',desc:'NOC — Rules 54, 58 (official 3-part format with financier consent)',cat:'transfer',fill:'pk28',pdfs:['FORM-28.pdf']},
 {num:'29 + 30',name:'Vehicle Transfer Package',desc:'Form 29 + Form 30 (official formats) + both affidavits — one PDF',cat:'transfer',fill:['pk29','pk30','pkAS','pkAP'],pdfs:['FORM-29.pdf','FORM-30.pdf']},
 {num:'31',name:'Transfer on Death of Owner',desc:'To nominee / successor — Rule 56(3) (official 2-page format)',cat:'transfer',fill:'pk31',pdfs:['FORM-31.pdf']},
 {num:'32',name:'Transfer — Public Auction',desc:'Transfer of vehicle bought in public auction — Rule 57',cat:'transfer',fill:'pk32',pdfs:['FORM-32.pdf']},
 {num:'33',name:'Change of Address',desc:'Address change in RC & Form 24 — Rule 59 (official 2-page format)',cat:'registration',fill:'pk33',pdfs:['FORM-33.pdf']},
 {num:'34',name:'Hire-Purchase Endorsement',desc:'HP / lease / hypothecation entry — Rule 60 (official format)',cat:'transfer',fill:'pk34',pdfs:['FORM-34.pdf']},
 {num:'35',name:'Termination of Hire-Purchase',desc:'Cancel HP entry — Rule 61(1) (official format)',cat:'transfer',fill:'pk35',pdfs:['FORM-35.pdf']},
 {num:'36',name:'Fresh RC by Financier',desc:'When financier takes possession of vehicle — Rule 61(2)',cat:'transfer',fill:'pk36',pdfs:['FORM-36.pdf']},
 {num:'38',name:'Certificate of Fitness',desc:'Fitness certificate for transport vehicle — Rule 62',cat:'permit',fmt:true,pdfs:['FORM-38.pdf']},
 {num:'45',name:'Tourist Permit Application',desc:'Permit for tourist vehicle — Rule 82',cat:'permit',fill:'pk45',pdfs:['FORM-45.pdf']},
 {num:'46',name:'National Permit Application',desc:'Goods carriage national permit — Rule 86',cat:'permit',fill:'pk46',pdfs:['FORM-46.pdf']},
 {num:'47',name:'National Permit Authorisation',desc:'Authorisation certificate for national permit — Rule 87',cat:'permit',fmt:true,pdfs:['FORM-47.pdf']},
 {num:'48',name:'Tourist Permit Authorisation',desc:'Authorisation application for tourist permit — Rule 83',cat:'permit',fill:'pk48',pdfs:['FORM-48.pdf']},
 {num:'51',name:'Certificate of Insurance',desc:'Motor insurance COI format — Rule 141',cat:'misc',fmt:true,pdfs:['FORM-51.pdf']},
 {num:'54',name:'Accident Information Report',desc:'Police accident report format — Rule 150',cat:'misc',fmt:true,pdfs:['FORM-54.pdf']},
 {num:'DN',name:'Motor Vehicle Delivery Note',desc:'Delivery confirmation with documents checklist — used at vehicle handover',cat:'transfer',fill:'pkDN'},
 {num:'MR',name:'Motor Vehicle Money Receipt',desc:'Payment receipt for vehicle sale — seller to purchaser',cat:'transfer',fill:'pkMR'},
];

const SECTIONS=[
 {id:'vehicle', title:'Vehicle details'},
 {id:'owner',   title:'Owner / Applicant details'},
 {id:'buyer',   title:'Purchaser (transferee)'},
 {id:'extra',   title:'Form-specific details'},
 {id:'receipt', title:'Receipt / Delivery details'},
 {id:'advocate',title:'Advocate / notary'},
];

const FIELDS={
 reg_no:   {sec:'vehicle',label:'Registration No. *',ph:'JH05AB1234',maxlen:13,upper:true,pat:/[^A-Z0-9]/g,hint:'Letters & numbers only'},
 veh_type: {sec:'vehicle',label:'Vehicle type',ph:'Motor Car / Motor Cycle'},
 make:     {sec:'vehicle',label:'Make',ph:'Maruti / Honda / Tata'},
 model:    {sec:'vehicle',label:'Model & year',ph:'Swift 2018'},
 eng_no:   {sec:'vehicle',label:'Engine No.',ph:'K12M1234567',maxlen:17,upper:true,pat:/[^A-Z0-9]/g},
 ch_no:    {sec:'vehicle',label:'Chassis No.',ph:'MA3FJEB1S00123456',maxlen:17,upper:true,pat:/[^A-Z0-9]/g,hint:'VIN — 17 chars max'},
 sale_date:{sec:'vehicle',label:'Date of sale',type:'date'},
 colour:   {sec:'vehicle',label:'Vehicle colour',ph:'Pearl White'},
 rto:      {sec:'vehicle',label:'RTO / DTO office',ph:'District Transport Office, Jamshedpur'},

 s_name:   {sec:'owner',label:'Full name *',ph:'Ramesh Kumar Sharma'},
 s_father: {sec:'owner',label:"S/o — father's name",ph:'Shri Mohan Lal Sharma'},
 s_addr:   {sec:'owner',label:'Address (house / street)',ph:'H.No. 45, Station Road',full:true},
 s_town:   {sec:'owner',label:'Town',ph:'Jamshedpur'},
 s_dist:   {sec:'owner',label:'District',ph:'East Singhbhum'},
 mobile:   {sec:'owner',label:'Mobile number',ph:'98XXXXXXXX',maxlen:10,type:'tel',inputmode:'numeric',pat:/[^0-9]/g,hint:'10 digits only'},

 b_name:   {sec:'buyer',label:'Full name *',ph:'Suresh Kumar Yadav'},
 b_father: {sec:'buyer',label:"S/o — father's name",ph:'Shri Ram Prasad Yadav'},
 b_addr:   {sec:'buyer',label:'Address (house / street)',ph:'Village Rampur, NH-33',full:true},
 b_town:   {sec:'buyer',label:'Town',ph:'Baharagora'},
 b_dist:   {sec:'buyer',label:'District',ph:'East Singhbhum'},
 b_mobile: {sec:'buyer',label:'Purchaser mobile number',ph:'98XXXXXXXX',maxlen:10,type:'tel',inputmode:'numeric',pat:/[^0-9]/g,hint:'10 digits only'},

 deceased:  {sec:'extra',label:'Deceased owner name — Form 31',ph:'Late Shri ...'},
 relation:  {sec:'extra',label:'Relationship with deceased — Form 31',ph:'Son / Wife / Daughter'},
 succession:{sec:'extra',label:'Proof of nomination / succession — Form 31',ph:'Succession certificate / Nomination in RC'},
 new_addr:  {sec:'extra',label:'New address — Form 33',ph:'Full new address with district',full:true},
 fin_name:  {sec:'extra',label:'Financier name & address — Form 33/34',ph:'HDFC Bank Ltd., Main Branch, Jamshedpur',full:true},
 loan_no:   {sec:'extra',label:'Agreement / loan account No. — Form 34',ph:'LN-000123',maxlen:20,upper:true},
 dest_rto:  {sec:'extra',label:'Destination RTO — Form 28',ph:'RTO Ranchi'},
 dest_state:{sec:'extra',label:'Destination state — Form 28',ph:'Jharkhand'},
 prev_state:{sec:'extra',label:'Previously registered in state — Form 27',ph:'Bihar'},
 email:     {sec:'extra',label:'Email — Form 27A',ph:'name@example.com',type:'email',maxlen:60},
 date_issue:{sec:'extra',label:'RC date of issue — Form 25',type:'date'},
 date_expiry:{sec:'extra',label:'RC date of expiry — Form 25',type:'date'},
 reg_as:    {sec:'extra',label:'Registered as — Form 25',ph:'New / Ex-army / Imported'},
 body_type: {sec:'extra',label:'Type of body — Form 25',ph:'Saloon / Sedan / Two-wheeler'},
 cylinders: {sec:'extra',label:'Number of cylinders — Form 25',ph:'4',maxlen:2,inputmode:'numeric',pat:/[^0-9]/g},
 cubic_cap: {sec:'extra',label:'Cubic capacity / HP — Form 25',ph:'1197 cc'},
 maker_class:{sec:'extra',label:"Maker's classification — Form 25",ph:'LXi / VXi'},
 seating:   {sec:'extra',label:'Seating capacity (incl. driver) — Form 25',ph:'5',maxlen:3,inputmode:'numeric',pat:/[^0-9]/g},
 standing:  {sec:'extra',label:'Standing capacity — Form 25',ph:'0'},
 sleeper:   {sec:'extra',label:'Sleeper capacity — Form 25',ph:'0'},
 unladen:   {sec:'extra',label:'Unladen weight (kg) — Form 25',ph:'1050'},
 fuel:      {sec:'extra',label:'Fuel used — Form 25',ph:'Petrol / Diesel / CNG / Electric'},

 /* Receipt / Delivery Note fields */
 amount_rs: {sec:'receipt',label:'Sale amount (₹) — Receipt',ph:'250000',maxlen:12,inputmode:'numeric',pat:/[^0-9]/g},
 amount_words:{sec:'receipt',label:'Amount in words — Receipt',ph:'Two Lakh Fifty Thousand Only',full:true,maxlen:80},
 pay_mode:  {sec:'receipt',label:'Payment mode / Cheque-NEFT No. — Receipt',ph:'Cash / NEFT 123456'},
 pay_date:  {sec:'receipt',label:'Payment date — Receipt',type:'date'},
 veh_class: {sec:'receipt',label:'Class of vehicle — Receipt',ph:'Motor Car / Motorcycle'},
 del_place: {sec:'receipt',label:'Delivery place — Delivery Note',ph:'Jamshedpur'},
 del_through:{sec:'receipt',label:'Through (agent/dealer) — Delivery Note',ph:'ABC Motors'},
 tax_valid: {sec:'receipt',label:'Tax token valid up to — Delivery Note',ph:'March 2025'},
 policy_no: {sec:'receipt',label:'Insurance policy No. — Delivery Note',ph:'3101/2024/123456'},
 wit1_name: {sec:'receipt',label:'Witness 1 name',ph:'Witness full name'},
 wit1_addr: {sec:'receipt',label:'Witness 1 address',ph:'Address',full:true},
 wit2_name: {sec:'receipt',label:'Witness 2 name',ph:'Witness full name'},
 wit2_addr: {sec:'receipt',label:'Witness 2 address',ph:'Address',full:true},

 adv_at: {sec:'advocate',label:'Advocate at'},
 state:  {sec:'advocate',label:'State'},
};

let VALS={adv_at:'Jamshedpur',state:'Jharkhand'};

/* Field ids whose current VALS entry came from AI extraction, not typing —
   drives the amber "AI"-badge highlight in fieldHTML() (ui.js). A field
   drops out of this set the moment the user edits it (see handleInput()),
   so the highlight always reflects "AI-sourced and still untouched". Not
   persisted to localStorage — a page reload restores the values but not
   which ones were AI-sourced, which is fine since it's a review aid, not
   data the app depends on. */
const AI_FILLED_FIELDS=new Set();

/* ── Persist in-progress field values across accidental refresh/tab-close ──
   Only field VALUES go into localStorage (debounced, not on every keystroke).
   Uploaded document images (PRO.uploads) are kept in memory only — they'd
   blow past localStorage's size limit and aren't needed to resume typing. */
const VALS_STORAGE_KEY='rtoFormVals';
let _valsRestored=false;
(function restoreVals(){
  try{
    const raw=localStorage.getItem(VALS_STORAGE_KEY);
    if(!raw) return;
    const saved=JSON.parse(raw);
    if(saved && typeof saved==='object' && Object.keys(saved).length){
      VALS=Object.assign({}, VALS, saved);
      _valsRestored=true;
    }
  }catch(e){}
})();

let _saveValsTimer=null;
function scheduleSaveVals(){
  clearTimeout(_saveValsTimer);
  _saveValsTimer=setTimeout(()=>{
    try{ localStorage.setItem(VALS_STORAGE_KEY, JSON.stringify(VALS)); }catch(e){}
  }, 600);
}
function clearSavedVals(){
  try{ localStorage.removeItem(VALS_STORAGE_KEY); }catch(e){}
}

const VEH=['reg_no','veh_type','make','model','eng_no','ch_no','rto'];
const OWN=['s_name','s_father','s_addr','s_town','s_dist'];
const BUY=['b_name','b_father','b_addr','b_town','b_dist'];

const PICKS=[
 {id:'pk29', type:'rto', pages:1, gen:addForm29, label:'Form 29 \u2014 Transfer notice', def:true, needB:true,
  fields:[...VEH,'sale_date',...OWN,...BUY,'state']},
 {id:'pk30', type:'rto', pages:2, gen:addForm30, label:'Form 30 \u2014 Transfer report', def:true, needB:true,
  fields:[...VEH,'sale_date',...OWN,...BUY,'mobile','b_mobile']},
 {id:'pkAS', type:'affidavit', pages:1, gen:(doc,d)=>addAffidavit(doc,d,'SELLER'), label:'Affidavit \u2014 Seller', def:true, needB:true, adv:true,
  fields:['reg_no','veh_type',...OWN,...BUY,'adv_at']},
 {id:'pkAP', type:'affidavit', pages:1, gen:(doc,d)=>addAffidavit(doc,d,'PURCHASER'), label:'Affidavit \u2014 Purchaser', def:true, needB:true, adv:true,
  fields:['reg_no','veh_type',...OWN,...BUY,'adv_at']},
 {id:'pk28', type:'rto', pages:2, gen:addForm28, label:'Form 28 \u2014 NOC',
  fields:[...VEH,...OWN,'mobile','b_name','dest_rto','dest_state']},
 {id:'pk25', type:'rto', pages:2, gen:addForm25, label:'Form 25 \u2014 RC renewal',
  fields:['reg_no','date_issue','date_expiry','rto','veh_type','reg_as','body_type','make','model','cylinders','cubic_cap','maker_class','ch_no','eng_no','seating','standing','sleeper','unladen','fuel',...OWN,'mobile']},
 {id:'pk26', type:'rto', pages:2, gen:addForm26, label:'Form 26 \u2014 Duplicate RC',
  fields:['reg_no','rto',...OWN,'mobile']},
 {id:'pk20', type:'rto', pages:4, gen:addForm20, label:'Form 20 \u2014 New registration',
  fields:[...VEH,'colour',...OWN,'mobile']},
 {id:'pk21', type:'rto', pages:1, gen:addForm21, label:'Form 21 \u2014 Sale certificate', needB:true,
  fields:[...VEH,...BUY,'s_name']},
 {id:'pk22', type:'rto', pages:1, gen:addForm22, label:'Form 22 \u2014 Roadworthiness',
  fields:['make','model','ch_no','eng_no']},
 {id:'pk23B', type:'rto', pages:1,gen:addForm23B,label:'Form 23B \u2014 Temporary RC',
  fields:[...VEH,'colour',...OWN,'mobile']},
 {id:'pk27', type:'rto', pages:2, gen:addForm27, label:'Form 27 \u2014 New regn. mark',
  fields:[...VEH,'s_name','s_father','mobile','prev_state']},
 {id:'pk27A', type:'rto', pages:1,gen:addForm27A,label:'Form 27A \u2014 BH-Series',
  fields:[...VEH,'s_name','s_father','mobile','email']},
 {id:'pk31', type:'rto', pages:2, gen:addForm31, label:'Form 31 \u2014 Transfer on death',
  fields:[...VEH,...OWN,'mobile','deceased','relation','succession']},
 {id:'pk32', type:'rto', pages:1, gen:G('f32'), label:'Form 32 \u2014 Auction transfer',
  fields:[...VEH,...OWN]},
 {id:'pk33', type:'rto', pages:2, gen:addForm33, label:'Form 33 \u2014 Change of address',
  fields:['reg_no','rto',...OWN,'mobile','new_addr','fin_name']},
 {id:'pk34', type:'rto', pages:1, gen:addForm34, label:'Form 34 \u2014 HP endorsement',
  fields:['reg_no','rto','s_name','mobile','fin_name','loan_no']},
 {id:'pk35', type:'rto', pages:1, gen:addForm35, label:'Form 35 \u2014 HP termination',
  fields:['reg_no','rto','mobile']},
 {id:'pk36', type:'rto', pages:1, gen:G('f36'), label:'Form 36 \u2014 Fresh RC (financier)',
  fields:[...VEH,...OWN,'fin_name']},
 {id:'pk1', type:'rto', pages:1,  gen:G('f1'),  label:'Form 1 \u2014 Fitness declaration',
  fields:['rto',...OWN]},
 {id:'pk2', type:'rto', pages:1,  gen:G('f2'),  label:'Form 2 \u2014 LL / DL application',
  fields:['rto',...OWN]},
 {id:'pk4A', type:'rto', pages:1, gen:G('f4A'), label:'Form 4A \u2014 IDP',
  fields:['rto',...OWN]},
 {id:'pk8', type:'rto', pages:1,  gen:G('f8'),  label:'Form 8 \u2014 Add vehicle class',
  fields:['rto',...OWN]},
 {id:'pk9', type:'rto', pages:1,  gen:G('f9'),  label:'Form 9 \u2014 DL renewal',
  fields:['rto',...OWN]},
 {id:'pkLLD', type:'rto', pages:1,gen:G('fLLD'),label:'Form LLD \u2014 Duplicate licence',
  fields:['rto',...OWN]},
 {id:'pk16', type:'rto', pages:1, gen:G('f16'), label:'Form 16 \u2014 Trade certificate',
  fields:['rto',...OWN]},
 {id:'pk45', type:'rto', pages:1, gen:G('f45'), label:'Form 45 \u2014 Tourist permit',
  fields:[...VEH,...OWN]},
 {id:'pk46', type:'rto', pages:1, gen:G('f46'), label:'Form 46 \u2014 National permit',
  fields:[...VEH,...OWN]},
 {id:'pk48', type:'rto', pages:1, gen:G('f48'), label:'Form 48 \u2014 Tourist authorisation',
  fields:[...VEH,...OWN]},

 {id:'pkDN', type:'receipt', pages:1, gen:addDeliveryNote, label:'Delivery Note', needB:true,
  fields:['reg_no','ch_no','eng_no','model','s_name','s_addr','s_town','s_dist','del_through','del_place','tax_valid','policy_no','wit1_name','wit2_name']},
 {id:'pkMR', type:'receipt', pages:1, gen:addMoneyReceipt, label:'Money Receipt', needB:true,
  fields:['s_name','s_father','s_addr','s_town','s_dist','amount_rs','amount_words','pay_mode','pay_date','b_name','b_father','b_addr','b_town','b_dist','reg_no','eng_no','ch_no','veh_class','wit1_name','wit1_addr','wit2_name','wit2_addr']},
];

/* ── Document TYPES (Level 1) — extensible: add new types here (e.g. application) ── */
const DOC_TYPES=[
  {id:'rto',       label:'RTO Forms'},
  {id:'affidavit', label:'Affidavits'},
  {id:'receipt',   label:'Receipts & Notes'},
  /* future: {id:'application', label:'Applications'} */
];

/* ── TASK BUNDLES — one click selects a set of related documents ── */
const BUNDLES=[
  {id:'b_transfer', label:'Vehicle Transfer', icon:'🚗',
   picks:['pk29','pk30','pkAS','pkAP'],
   suggest:['pk28','pk26','pkDN','pkMR']},
  {id:'b_rcrenew', label:'RC Renewal', icon:'🔄',
   picks:['pk25'], suggest:['pk33']},
  {id:'b_duprc', label:'Duplicate RC', icon:'📋',
   picks:['pk26'], suggest:['pkAS']},
  {id:'b_death', label:'Transfer on Death', icon:'📜',
   picks:['pk31'], suggest:['pkAS','pk26']},
  {id:'b_hp', label:'HP / Loan', icon:'🏦',
   picks:['pk34'], suggest:['pk35','pk33']},
  {id:'b_address', label:'Address Change', icon:'📍',
   picks:['pk33'], suggest:['pk26']},
  {id:'b_newreg', label:'New Registration', icon:'🆕',
   picks:['pk20','pk21','pk22'], suggest:['pk28']},
];

let ACTIVE_TYPE='rto';
const CHECKED={};  /* pick id -> true/false, persists across type switches */
PICKS.forEach(p=>{ CHECKED[p.id]=!!p.def; });
