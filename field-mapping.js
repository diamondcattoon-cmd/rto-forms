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
   extracted data should be written to. RC is the only extraction source
   (Aadhaar/PAN extraction was removed for Aadhaar Act compliance — see
   worker/src/index.js's PROMPTS comment — they're attach-only now and
   never reach AI_FIELD_MAP), so this table has exactly one entry, kept as
   a table rather than inlined so resolveDocRole()'s "ignore the caller's
   role" behavior stays documented and testable in one place.
     role: 'fixed'  — always the same side, the caller's role is ignored
     defaultRole: the side to use since role is always 'fixed' below. */
const DOC_RULES={
  rc: { role:'fixed', defaultRole:'seller' }, // RC owner IS the seller/transferor — a buyer can never hold the seller's RC
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

/* Merges one document's freshly-extracted field->value map into a target
   VALS-shaped object. This used to arbitrate between competing document
   types via a FIELD_SOURCE_PRIORITY table (e.g. "Aadhaar's address beats
   RC's, since RC's printed address commonly lags years behind a house
   move") — that table and its conflict-detection machinery were removed
   when Aadhaar/PAN extraction was removed for Aadhaar Act compliance (see
   worker/src/index.js's PROMPTS comment): RC is now the only extraction
   source, so no field ever has two competing sources to arbitrate between,
   and cross-document conflicts are structurally impossible, not just rare.
   What's left is plain last-write-wins with source tracking — the only
   real-world case that still exercises the "already has a value" path is
   the same docType being re-extracted (e.g. a Retry), which correctly just
   refreshes the value.
     docType   — which document this batch of values came from (always
                 'rc' in practice — see above)
     mapped    — AI_FIELD_MAP[docType](...)'s output for this call
     ctx.vals  — target object to write into (mutated in place, e.g. VALS
                 in forms-data.js)
     ctx.fieldSource — { fieldId: docType } tracking who supplied each
                 field's applied value (mutated in place, e.g.
                 FIELD_SOURCE in forms-data.js) */
function mergeExtractedFields(docType, mapped, ctx){
  const vals=ctx.vals, fieldSource=ctx.fieldSource;
  Object.keys(mapped).forEach(fieldId=>{
    const newVal=mapped[fieldId];
    if(newVal==null || newVal==='') return;
    vals[fieldId]=newVal;
    fieldSource[fieldId]=docType;
  });
}

/* Whether an RC's registered owner is an individual or a firm/company —
   see PROMPTS.rc's "owner_type" field and its Gemini-facing heuristics in
   worker/src/index.js. Deliberately conservative: anything other than the
   literal string "firm" (missing, malformed, or genuinely uncertain) is
   treated as "individual" — matching the prompt's own instruction to
   default to individual rather than guess "firm". */
function resolveOwnerType(data){
  return (data && data.owner_type==='firm') ? 'firm' : 'individual';
}

/* Maps Gemini's extracted fields (worker/src/index.js PROMPTS output shape)
   onto the site's existing FIELDS ids (s_/b_ prefix by role) */
const AI_FIELD_MAP={
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
    /* Month/year of manufacture (RC's own "Mfg Dt." field) — a separate
       concept from both the model name (out.model, above) and the
       registration date (out.date_issue, below). Kept as plain MM/YYYY
       text rather than run through toISODate(), which expects a full
       DD/MM/YYYY date and would silently drop a month-only value. */
    if(data.manufacture_date) out.mfg_date=data.manufacture_date;
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
    if(data.state) out[p+'state']=data.state;
    return out;
  }
};

if(typeof module!=='undefined' && module.exports){
  module.exports={ toISODate, AI_FIELD_MAP, DOC_RULES, resolveDocRole, mergeExtractedFields, resolveOwnerType };
}
