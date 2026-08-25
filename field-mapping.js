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

/* Maps Gemini's extracted fields (worker/src/index.js PROMPTS output shape)
   onto the site's existing FIELDS ids (s_/b_ prefix by role) */
const AI_FIELD_MAP={
  aadhaar:(data,role)=>{
    const p=role==='buyer'?'b_':'s_'; const out={};
    if(data.name) out[p+'name']=data.name;
    if(data.father_or_husband_name) out[p+'father']=data.father_or_husband_name;
    if(data.address_line) out[p+'addr']=data.address_line;
    if(data.town) out[p+'town']=data.town;
    if(data.district) out[p+'dist']=data.district;
    if(data.state) out.state=data.state;
    return out;
  },
  pan:(data,role)=>{
    const p=role==='buyer'?'b_':'s_'; const out={};
    if(data.name) out[p+'name']=data.name;
    if(data.father_name) out[p+'father']=data.father_name;
    return out;
  },
  rc:(data,role)=>{
    const p=role==='buyer'?'b_':'s_'; const out={};
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
  module.exports={ toISODate, AI_FIELD_MAP };
}
