const test = require('node:test');
const assert = require('node:assert/strict');
const { AI_FIELD_MAP } = require('../field-mapping.js');

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
    state: 'Jharkhand',
  });
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
    state: 'Jharkhand',
  });
});

test('AI_FIELD_MAP.rc uses the b_ prefix for owner_name/address when role is buyer', () => {
  const out = AI_FIELD_MAP.rc({ owner_name: 'SURESH YADAV', town: 'Baharagora' }, 'buyer');
  assert.deepEqual(out, { b_name: 'SURESH YADAV', b_town: 'Baharagora' });
});

test('AI_FIELD_MAP.rc converts dates through toISODate and drops unparsable ones', () => {
  const out = AI_FIELD_MAP.rc({ registration_date: 'not-a-date', expiry_date: '01/01/2030' }, 'seller');
  assert.deepEqual(out, { date_expiry: '2030-01-01' });
});

test('AI_FIELD_MAP.rc omits empty/zero-length fields entirely', () => {
  const out = AI_FIELD_MAP.rc({ registration_number: 'JH05AB1234', cylinders: '' }, 'seller');
  assert.deepEqual(out, { reg_no: 'JH05AB1234' });
});
