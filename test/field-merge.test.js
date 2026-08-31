/* Coverage for mergeExtractedFields and the RC owner_type resolver
   (resolveOwnerType) in field-mapping.js.

   mergeExtractedFields used to arbitrate between competing document types
   via a FIELD_SOURCE_PRIORITY table (e.g. "Aadhaar's address beats RC's").
   That table — and the cross-document conflict detection built on it — was
   removed when Aadhaar/PAN extraction was removed for Aadhaar Act
   compliance (see the PROMPTS comment in worker/src/index.js): RC is now
   the only extraction source, so no field ever has two competing sources
   to arbitrate between. What's left is plain last-write-wins with source
   tracking, tested here. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { AI_FIELD_MAP, mergeExtractedFields, resolveOwnerType } = require('../field-mapping.js');

function freshCtx(){
  return { vals:{}, fieldSource:{} };
}

/* Sample payload mirrors the exact JSON shape PROMPTS.rc in
   worker/src/index.js tells Gemini to return. */
const RC_SAMPLE = {
  owner_name: 'RAMESH KUMAR SHARMA',
  owner_type: 'individual',
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
  address_line: 'OLD HOUSE, RC ADDRESS ROAD',
  town: 'RC-TOWN',
  district: 'RC-DISTRICT',
  state: 'RC-STATE',
  pincode: '831001',
};

test('RC fills seller name + full address + full vehicle details', () => {
  const ctx = freshCtx();
  mergeExtractedFields('rc', AI_FIELD_MAP.rc(RC_SAMPLE, 'seller'), ctx);

  assert.equal(ctx.vals.s_name, 'RAMESH KUMAR SHARMA');
  assert.equal(ctx.vals.s_addr, 'OLD HOUSE, RC ADDRESS ROAD');
  assert.equal(ctx.vals.s_town, 'RC-TOWN');
  assert.equal(ctx.vals.s_dist, 'RC-DISTRICT');
  assert.equal(ctx.vals.s_state, 'RC-STATE');
  assert.equal(ctx.vals.reg_no, 'JH05AB1234');
  assert.equal(ctx.vals.ch_no, 'MA3FJEB1S00123456');
  assert.equal(ctx.vals.eng_no, 'K12M1234567');
  assert.equal(ctx.vals.make, 'Maruti Suzuki');
  assert.equal(ctx.vals.model, 'Swift VXi');
  assert.equal(ctx.vals.fuel, 'Petrol');
  assert.equal(ctx.fieldSource.s_name, 'rc');
});

test('a re-extraction of the same docType (Retry) refreshes the value instead of being skipped', () => {
  const ctx = freshCtx();
  mergeExtractedFields('rc', AI_FIELD_MAP.rc(RC_SAMPLE, 'seller'), ctx);
  const retryData = { ...RC_SAMPLE, owner_name: 'RAMESH K SHARMA (CORRECTED)' };
  mergeExtractedFields('rc', AI_FIELD_MAP.rc(retryData, 'seller'), ctx);

  assert.equal(ctx.vals.s_name, 'RAMESH K SHARMA (CORRECTED)');
  assert.equal(ctx.fieldSource.s_name, 'rc');
});

test('empty/blank values from an extraction never overwrite an existing value', () => {
  const ctx = freshCtx();
  mergeExtractedFields('rc', AI_FIELD_MAP.rc(RC_SAMPLE, 'seller'), ctx);
  mergeExtractedFields('rc', { s_name: '' }, ctx);

  assert.equal(ctx.vals.s_name, 'RAMESH KUMAR SHARMA');
});

/* ── firm-owned RC ── */
test('resolveOwnerType returns "firm" only for an exact "firm" value', () => {
  assert.equal(resolveOwnerType({ owner_type: 'firm' }), 'firm');
  assert.equal(resolveOwnerType({ owner_type: 'individual' }), 'individual');
  assert.equal(resolveOwnerType({ owner_type: '' }), 'individual');
  assert.equal(resolveOwnerType({}), 'individual');
  assert.equal(resolveOwnerType(null), 'individual');
  assert.equal(resolveOwnerType({ owner_type: 'FIRM' }), 'individual', 'case-sensitive on purpose — the prompt is instructed to return the exact lowercase literal');
});

test('a firm-owned RC never populates s_father — AI_FIELD_MAP.rc has no concept of a father field at all', () => {
  const firmRc = { ...RC_SAMPLE, owner_name: 'M/S MANGALAM HOMES', owner_type: 'firm' };
  const ctx = freshCtx();
  mergeExtractedFields('rc', AI_FIELD_MAP.rc(firmRc, 'seller'), ctx);

  assert.equal(ctx.vals.s_name, 'M/S MANGALAM HOMES');
  assert.equal(ctx.vals.s_father, undefined, 'RC has no father field in its prompt shape — this can never be set by RC, firm or not');
  assert.equal(resolveOwnerType(firmRc), 'firm');
});
