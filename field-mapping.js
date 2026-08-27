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

/* ── Field source priority (order-independent merge) ──
   When more than one uploaded document could supply the same target
   field, which one should win? Keyed by the field's ROLE-STRIPPED
   concept (e.g. both s_name and b_name are the 'name' concept, both
   s_addr and b_addr are 'addr', etc.) so the same priority order applies
   whichever side — seller or buyer — the field belongs to; DOC_RULES
   above already governs which document types can ever reach which side
   (rc is seller-only, so it can never actually compete for a b_ field in
   practice, but the table doesn't need to know that).

   Rationale (from the RTO-forms domain, not a generic assumption):
   - name: RC's registered owner is the authoritative transferor identity
     for a transfer — Aadhaar/PAN are the fallback when no RC was supplied.
   - addr/town/dist/state: Aadhaar wins over RC — an Aadhaar address is far
     more likely to be current; an RC's printed address commonly lags
     years behind a house move. Each of s_state/b_state is its own field
     (NOT a single shared 'state' — that used to be one global field fed
     by whichever document happened to extract it last, which meant a
     seller's RC could silently overwrite the buyer's state on a printed
     form; see AI_FIELD_MAP below, which now always writes state through
     the same s_/b_ role prefix as every other address part).
   - father: only Aadhaar/PAN ever carry this (RC's prompt has no such
     field at all — see PROMPTS.rc in worker/src/index.js) — Aadhaar is
     preferred simply as the more complete/authoritative ID of the two
     when both are present (this ordering wasn't specified as load-bearing
     by the product requirement; either order would satisfy it — Aadhaar
     first is the codebase's existing default-role convention carried
     through consistently).
   Field ids with no entry here (all the RC-only vehicle/registration
   fields: reg_no, ch_no, eng_no, veh_type, make, model, colour, rto,
   date_issue, date_expiry, reg_as, body_type, cylinders, cubic_cap,
   seating, standing, sleeper, unladen, fuel) have exactly one possible
   source, so there is nothing to arbitrate — fieldConceptFor() returns
   null for them and mergeExtractedFields() just writes the value. */
const FIELD_SOURCE_PRIORITY={
  name:   ['rc','aadhaar','pan'],
  addr:   ['aadhaar','rc'],
  town:   ['aadhaar','rc'],
  dist:   ['aadhaar','rc'],
  state:  ['aadhaar','rc'],
  father: ['aadhaar','pan'],
};

/* Strips the s_/b_ role prefix to get the field's priority "concept" —
   returns null for fields that only ever have one possible source (no
   conflict is possible, so no concept to look up). */
function fieldConceptFor(fieldId){
  const m=/^[sb]_(name|addr|town|dist|state|father)$/.exec(fieldId);
  return m ? m[1] : null;
}

/* Merges one document's freshly-extracted field->value map into a target
   VALS-shaped object, honoring FIELD_SOURCE_PRIORITY instead of simple
   last-write-wins — the whole point being that the OUTCOME (which value
   ends up applied, and which fields get flagged as disagreeing) is the
   same no matter what order documents are extracted in.
     docType         — which document this batch of values came from
     mapped           — AI_FIELD_MAP[docType](...)'s output for this call
     ctx.vals         — target object to write into (mutated in place,
                         e.g. VALS in forms-data.js)
     ctx.fieldSource  — { fieldId: docType } tracking who currently owns
                         each field's applied value (mutated in place,
                         e.g. FIELD_SOURCE in forms-data.js)
     ctx.pendingConflicts — { fieldId: {winner:{docType,value},
                         loser:{docType,value}} } for fields where two
                         DIFFERENT document types disagreed (mutated in
                         place, e.g. PENDING_CONFLICTS in forms-data.js) —
                         the UI uses this to show "X and Y disagree,
                         showing X's value" with a button to switch to Y's.
   A conflict is recorded (or refreshed) whenever a field ends up with two
   different non-empty values from two different document types, REGARDLESS
   of which one ends up applied and regardless of extraction order — see
   the doc comment on FIELD_SOURCE_PRIORITY for why the applied value alone
   isn't enough; the notice needs to exist either way. */
function mergeExtractedFields(docType, mapped, ctx){
  const vals=ctx.vals, fieldSource=ctx.fieldSource, pendingConflicts=ctx.pendingConflicts||{};
  Object.keys(mapped).forEach(fieldId=>{
    const newVal=mapped[fieldId];
    if(newVal==null || newVal==='') return;

    const concept=fieldConceptFor(fieldId);
    if(!concept){
      /* Single possible source — nothing to arbitrate. */
      vals[fieldId]=newVal;
      fieldSource[fieldId]=docType;
      return;
    }

    const existingSource=fieldSource[fieldId];
    const existingVal=vals[fieldId];

    if(!existingSource || existingVal==null || existingVal===''){
      /* Nothing here yet from any source — just take it. */
      vals[fieldId]=newVal;
      fieldSource[fieldId]=docType;
      return;
    }

    if(existingSource===docType){
      /* Same document type re-extracted (e.g. a Retry) — not a source
         conflict, just fresher data from the same place. If this field
         happens to be the "winner" side of a pending conflict, keep that
         conflict's winner value in sync with the refreshed extraction. */
      vals[fieldId]=newVal;
      if(pendingConflicts[fieldId] && pendingConflicts[fieldId].winner.docType===docType){
        pendingConflicts[fieldId].winner.value=newVal;
      }
      return;
    }

    if(existingVal===newVal){
      /* Two different documents agree — nothing to flag, but let the
         higher-priority one own the field's source going forward. */
      const order=FIELD_SOURCE_PRIORITY[concept]||[];
      if(order.indexOf(docType)!==-1 && (order.indexOf(docType)<order.indexOf(existingSource) || order.indexOf(existingSource)===-1)){
        fieldSource[fieldId]=docType;
      }
      return;
    }

    /* Two different documents genuinely disagree — resolve by priority,
       and record the loser either way so the UI can offer a switch. */
    const order=FIELD_SOURCE_PRIORITY[concept]||[docType, existingSource];
    const newRank=order.indexOf(docType); const newEff=newRank===-1?order.length:newRank;
    const existingRank=order.indexOf(existingSource); const existingEff=existingRank===-1?order.length:existingRank;

    if(newEff<existingEff){
      pendingConflicts[fieldId]={ winner:{docType,value:newVal}, loser:{docType:existingSource,value:existingVal} };
      vals[fieldId]=newVal;
      fieldSource[fieldId]=docType;
    }else{
      pendingConflicts[fieldId]={ winner:{docType:existingSource,value:existingVal}, loser:{docType,value:newVal} };
      /* existing value stays applied — higher (or equal, arbitrary-tie) priority */
    }
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
  aadhaar:(data,role)=>{
    const p=resolveDocRole('aadhaar',role)==='buyer'?'b_':'s_'; const out={};
    if(data.name) out[p+'name']=data.name;
    if(data.father_or_husband_name) out[p+'father']=data.father_or_husband_name;
    if(data.address_line) out[p+'addr']=data.address_line;
    if(data.town) out[p+'town']=data.town;
    if(data.district) out[p+'dist']=data.district;
    if(data.state) out[p+'state']=data.state;
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
    if(data.state) out[p+'state']=data.state;
    return out;
  }
};

if(typeof module!=='undefined' && module.exports){
  module.exports={ toISODate, AI_FIELD_MAP, DOC_RULES, resolveDocRole, FIELD_SOURCE_PRIORITY, fieldConceptFor, mergeExtractedFields, resolveOwnerType };
}
