/* ════════ Gemini extraction → form field mapping ════════ */
/* Shared between index.html (loaded as a plain <script>, so it must not use
   import/export) and the Node test suite (loaded via require()). Keep this
   file's expected input shape in sync with the PROMPTS in worker/src/index.js
   — this is the exact contract that has broken twice before. */

/* HTML date inputs need YYYY-MM-DD; Gemini returns DD/MM/YYYY */
function toISODate(d){
  if(!d) return '';
  const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(d).trim());
  if(!m) return '';
  const [,dd,mm,yyyy]=m;
  return yyyy+'-'+mm.padStart(2,'0')+'-'+dd.padStart(2,'0');
}

/* ── Document → role rules ──
   Which "side" (seller/transferor vs buyer/transferee) a document's
   extracted data should be written to. Mirrors the PICKS[i].needB pattern
   in forms-data.js — one declarative table instead of scattered
   role-toggle logic, so adding a new document type is a single entry
   here, and every AI_FIELD_MAP.<docType> below derives its prefix from
   this table rather than trusting the caller-supplied role directly.
     role: 'fixed'  — always the same side, the caller's role is ignored
           'choice' — either side is possible, caller's role decides
     defaultRole: the side to use when role is 'fixed', or as a fallback
                  for 'choice' if the caller passes something unexpected. */
const DOC_RULES={
  aadhaar:{ role:'choice', defaultRole:'seller' }, // could belong to either party
  pan:     { role:'choice', defaultRole:'seller' }, // could belong to either party
  rc:      { role:'fixed',  defaultRole:'seller' }, // RC owner IS the seller/transferor — a buyer can never hold the seller's RC
};

/* Resolves DOC_RULES[docType] against a caller-supplied role: 'fixed'
   rules always win (ignoring whatever role was passed in), 'choice'
   rules use the passed role if it's a recognized value, else fall back
   to defaultRole. */
function resolveDocRole(docType, role){
  const rule=DOC_RULES[docType];
  if(!rule) return role==='buyer'?'buyer':'seller';
  if(rule.role==='fixed') return rule.defaultRole;
  return (role==='buyer'||role==='seller') ? role : rule.defaultRole;
}

/* Maps Gemini's extracted fields (worker/src/index.js PROMPTS output shape)
   onto the site's existing FIELDS ids (s_/b_ prefix by role) */
const AI_FIELD_MAP={
  aadhaar:(data,role)=>{
    const p=resolveDocRole('aadhaar',role)==='buyer'?'b_':'s_'; const out={};
    if(data.name) out[p+'name']=data.name;
    if(data.father_or_husband_name) out[p+'father']=data.father_or_husband_name;
    if(data.address_line) out[p+'addr']=data.address_line;
    if(data.town) out[p+'town']=data.town;
    if(data.district) out[p+'dist']=data.district;
    if(data.state) out.state=data.state;
    return out;
  },
  pan:(data,role)=>{
    const p=resolveDocRole('pan',role)==='buyer'?'b_':'s_'; const out={};
    if(data.name) out[p+'name']=data.name;
    if(data.father_name) out[p+'father']=data.father_name;
    return out;
  },
  rc:(data,role)=>{
    /* role is intentionally ignored here — resolveDocRole('rc', role) always
       returns DOC_RULES.rc.defaultRole ('seller') because DOC_RULES.rc.role
       is 'fixed'. An RC (registration certificate) is only ever held by the
       vehicle's current registered owner, i.e. the seller/transferor in a
       transfer — a buyer cannot legally possess the seller's RC before the
       transfer completes, so there is no real-world case where this should
       write to b_ fields. */
    const p=resolveDocRole('rc',role)==='buyer'?'b_':'s_'; const out={};
    if(data.registration_number) out.reg_no=data.registration_number;
    if(data.chassis_number) out.ch_no=data.chassis_number;
    if(data.engine_number) out.eng_no=data.engine_number;
    if(data.vehicle_class) out.veh_type=data.vehicle_class;
    if(data.maker) out.make=data.maker;
    if(data.model) out.model=data.model;
    if(data.colour) out.colour=data.colour;
    if(data.rto_office) out.rto=data.rto_office;
    if(data.registration_date){ const iso=toISODate(data.registration_date); if(iso) out.date_issue=iso; }
    if(data.expiry_date){ const iso=toISODate(data.expiry_date); if(iso) out.date_expiry=iso; }
    if(data.registered_as) out.reg_as=data.registered_as;
    if(data.body_type) out.body_type=data.body_type;
    if(data.cylinders) out.cylinders=data.cylinders;
    if(data.cubic_capacity) out.cubic_cap=data.cubic_capacity;
    if(data.seating_capacity) out.seating=data.seating_capacity;
    if(data.standing_capacity) out.standing=data.standing_capacity;
    if(data.sleeper_capacity) out.sleeper=data.sleeper_capacity;
    if(data.unladen_weight) out.unladen=data.unladen_weight;
    if(data.fuel_type) out.fuel=data.fuel_type;
    if(data.owner_name) out[p+'name']=data.owner_name;
    if(data.address_line) out[p+'addr']=data.address_line;
    if(data.town) out[p+'town']=data.town;
    if(data.district) out[p+'dist']=data.district;
    if(data.state) out.state=data.state;
    return out;
  }
};

if(typeof module!=='undefined' && module.exports){
  module.exports={ toISODate, AI_FIELD_MAP, DOC_RULES, resolveDocRole };
}
