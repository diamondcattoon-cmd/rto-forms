const test = require('node:test');
const assert = require('node:assert/strict');
const { AI_FIELD_MAP, DOC_RULES, resolveDocRole } = require('../field-mapping.js');

/* Sample payloads below mirror the exact JSON shape each PROMPTS.<docType>
   in worker/src/index.js tells Gemini to return — see
   test/worker-frontend-contract.test.js for the automated check that keeps
   these two in sync. */

test('AI_FIELD_MAP.aadhaar maps a full sample response to seller fields', () => {
  const sample = {
    name: 'RAMESH KUMAR SHARMA',
    aadhaar_number: '234567890123',
    dob: '15/08/1985',
    gender: 'Male',
    address_line: 'H.No. 45, Station Road',
    town: 'Jamshedpur',
    district: 'East Singhbhum',
    state: 'Jharkhand',
    pincode: '831001',
    father_or_husband_name: 'Shri Mohan Lal Sharma',
  };
  assert.deepEqual(AI_FIELD_MAP.aadhaar(sample, 'seller'), {
    s_name: 'RAMESH KUMAR SHARMA',
    s_father: 'Shri Mohan Lal Sharma',
    s_addr: 'H.No. 45, Station Road',
    s_town: 'Jamshedpur',
    s_dist: 'East Singhbhum',
    s_state: 'Jharkhand',
  });
});

test('AI_FIELD_MAP.aadhaar writes state through the b_ prefix too, when role is buyer', () => {
  /* Bug fix: state used to be one shared, unprefixed field regardless of
     role — a buyer's Aadhaar state could only ever land in that one
     global slot, indistinguishable from the seller's. */
  const out = AI_FIELD_MAP.aadhaar({ name: 'SURESH YADAV', state: 'Odisha' }, 'buyer');
  assert.deepEqual(out, { b_name: 'SURESH YADAV', b_state: 'Odisha' });
});

test('AI_FIELD_MAP.aadhaar uses the b_ prefix when role is buyer', () => {
  const out = AI_FIELD_MAP.aadhaar({ name: 'SURESH YADAV', address_line: 'Village Rampur' }, 'buyer');
  assert.deepEqual(out, { b_name: 'SURESH YADAV', b_addr: 'Village Rampur' });
});

test('AI_FIELD_MAP.aadhaar omits keys Gemini left empty, instead of writing blanks', () => {
  const out = AI_FIELD_MAP.aadhaar({ name: '', town: 'Jamshedpur' }, 'seller');
  assert.deepEqual(out, { s_town: 'Jamshedpur' });
});

test('AI_FIELD_MAP.pan maps name and father_name only (pan_number/dob are extracted but not autofilled)', () => {
  const sample = {
    name: 'RAMESH KUMAR SHARMA',
    pan_number: 'ABCDE1234F',
    father_name: 'Mohan Lal Sharma',
    dob: '15/08/1985',
  };
  assert.deepEqual(AI_FIELD_MAP.pan(sample, 'seller'), {
    s_name: 'RAMESH KUMAR SHARMA',
    s_father: 'Mohan Lal Sharma',
  });
});

test('AI_FIELD_MAP.pan uses the b_ prefix when role is buyer', () => {
  assert.deepEqual(AI_FIELD_MAP.pan({ name: 'SURESH YADAV' }, 'buyer'), { b_name: 'SURESH YADAV' });
});

test('AI_FIELD_MAP.rc maps a full sample response: vehicle fields plus role-prefixed owner fields', () => {
  const sample = {
    owner_name: 'RAMESH KUMAR SHARMA',
    registration_number: 'JH05AB1234',
    chassis_number: 'MA3FJEB1S00123456',
    engine_number: 'K12M1234567',
    vehicle_class: 'Motor Car',
    maker: 'Maruti Suzuki',
    model: 'Swift VXi',
    colour: 'Pearl White',
    rto_office: 'District Transport Office, Jamshedpur',
    registration_date: '10/06/2018',
    expiry_date: '09/06/2033',
    registered_as: 'New',
    body_type: 'Hatchback',
    cylinders: '4',
    cubic_capacity: '1197 cc',
    seating_capacity: '5',
    standing_capacity: '',
    sleeper_capacity: '',
    unladen_weight: '920',
    fuel_type: 'Petrol',
    address_line: 'H.No. 45, Station Road',
    town: 'Jamshedpur',
    district: 'East Singhbhum',
    state: 'Jharkhand',
    pincode: '831001',
  };
  assert.deepEqual(AI_FIELD_MAP.rc(sample, 'seller'), {
    reg_no: 'JH05AB1234',
    ch_no: 'MA3FJEB1S00123456',
    eng_no: 'K12M1234567',
    veh_type: 'Motor Car',
    make: 'Maruti Suzuki',
    model: 'Swift VXi',
    colour: 'Pearl White',
    rto: 'District Transport Office, Jamshedpur',
    date_issue: '2018-06-10',
    date_expiry: '2033-06-09',
    reg_as: 'New',
    body_type: 'Hatchback',
    cylinders: '4',
    cubic_cap: '1197 cc',
    seating: '5',
    unladen: '920',
    fuel: 'Petrol',
    s_name: 'RAMESH KUMAR SHARMA',
    s_addr: 'H.No. 45, Station Road',
    s_town: 'Jamshedpur',
    s_dist: 'East Singhbhum',
    s_state: 'Jharkhand',
  });
});

test('AI_FIELD_MAP.rc always writes owner_name/address/state to s_ fields, even when role is "buyer" — RC\'s state can never end up as b_state', () => {
  /* Bug fix: an RC (registration certificate) is only ever held by the
     vehicle's current registered owner — the seller/transferor in a
     transfer. A buyer cannot possess the seller's RC before the transfer
     completes, so RC data — INCLUDING its state, which used to be one
     shared unprefixed field that any document could clobber regardless of
     whose data it actually was — must never land in b_ fields regardless
     of which role toggle happens to be selected elsewhere in the UI. See
     DOC_RULES.rc in field-mapping.js (role: 'fixed'). */
  const out = AI_FIELD_MAP.rc({ owner_name: 'SURESH YADAV', town: 'Baharagora', state: 'Odisha' }, 'buyer');
  assert.deepEqual(out, { s_name: 'SURESH YADAV', s_town: 'Baharagora', s_state: 'Odisha' });
  assert.equal(out.b_state, undefined, "RC's state must never be written to b_state, no matter the role passed in");
});

test('AI_FIELD_MAP.rc ignores an explicit "seller" role too — same fixed outcome either way', () => {
  const out = AI_FIELD_MAP.rc({ owner_name: 'SURESH YADAV', town: 'Baharagora' }, 'seller');
  assert.deepEqual(out, { s_name: 'SURESH YADAV', s_town: 'Baharagora' });
});

test('AI_FIELD_MAP.rc converts dates through toISODate and drops unparsable ones', () => {
  const out = AI_FIELD_MAP.rc({ registration_date: 'not-a-date', expiry_date: '01/01/2030' }, 'seller');
  assert.deepEqual(out, { date_expiry: '2030-01-01' });
});

test('AI_FIELD_MAP.rc omits empty/zero-length fields entirely', () => {
  const out = AI_FIELD_MAP.rc({ registration_number: 'JH05AB1234', cylinders: '' }, 'seller');
  assert.deepEqual(out, { reg_no: 'JH05AB1234' });
});

/* ── DOC_RULES / resolveDocRole ── */

test('DOC_RULES declares rc as fixed-to-seller, aadhaar and pan as either-party choice', () => {
  assert.deepEqual(DOC_RULES.rc, { role: 'fixed', defaultRole: 'seller' });
  assert.equal(DOC_RULES.aadhaar.role, 'choice');
  assert.equal(DOC_RULES.pan.role, 'choice');
});

test('resolveDocRole: a fixed-role doc type always returns its defaultRole, ignoring the passed role', () => {
  assert.equal(resolveDocRole('rc', 'buyer'), 'seller');
  assert.equal(resolveDocRole('rc', 'seller'), 'seller');
  assert.equal(resolveDocRole('rc', undefined), 'seller');
});

test('resolveDocRole: a choice-role doc type passes through a valid role, and falls back to defaultRole otherwise', () => {
  assert.equal(resolveDocRole('aadhaar', 'buyer'), 'buyer');
  assert.equal(resolveDocRole('aadhaar', 'seller'), 'seller');
  assert.equal(resolveDocRole('aadhaar', undefined), 'seller');
  assert.equal(resolveDocRole('pan', 'buyer'), 'buyer');
});
