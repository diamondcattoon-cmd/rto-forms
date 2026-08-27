/* Coverage for the order-independent, priority-based field merge engine
   (mergeExtractedFields, FIELD_SOURCE_PRIORITY, fieldConceptFor) and the
   RC owner_type resolver (resolveOwnerType) in field-mapping.js.

   Scenarios pinned here mirror the product requirement directly:
     1. RC only            -> seller name + address + full vehicle details
     2. Aadhaar only        -> name + address + father, vehicle left empty
     3. RC + Aadhaar, agree -> vehicle from RC, address from Aadhaar, name from RC
     4. RC + Aadhaar, differ on address -> Aadhaar's value applied, RC's
        value recorded as a pending conflict (in EITHER extraction order)
     5. Firm-owned RC       -> owner_type resolves to 'firm'; s_father is
        never populated by RC (it has no father field to begin with)
   Plus a dedicated reverse-order test: merging the same two documents in
   both possible orders must produce byte-identical results. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { AI_FIELD_MAP, mergeExtractedFields, resolveOwnerType } = require('../field-mapping.js');

function freshCtx(){
  return { vals:{}, fieldSource:{}, pendingConflicts:{} };
}

/* Sample payloads mirror the exact JSON shape PROMPTS.<docType> in
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

const AADHAAR_SAMPLE = {
  name: 'RAMESH KUMAR SHARMA',
  aadhaar_number: '234567890123',
  dob: '15/08/1985',
  gender: 'Male',
  address_line: 'NEW HOUSE, AADHAAR ADDRESS ROAD',
  town: 'AADHAAR-TOWN',
  district: 'AADHAAR-DISTRICT',
  state: 'AADHAAR-STATE',
  pincode: '831002',
  father_or_husband_name: 'Shri Mohan Lal Sharma',
};

/* ── Scenario 1: RC only ── */
test('scenario 1: RC only fills seller name + full address + full vehicle details', () => {
  const ctx = freshCtx();
  mergeExtractedFields('rc', AI_FIELD_MAP.rc(RC_SAMPLE, 'seller'), ctx);

  assert.equal(ctx.vals.s_name, 'RAMESH KUMAR SHARMA');
  assert.equal(ctx.vals.s_addr, 'OLD HOUSE, RC ADDRESS ROAD');
  assert.equal(ctx.vals.s_town, 'RC-TOWN');
  assert.equal(ctx.vals.s_dist, 'RC-DISTRICT');
  assert.equal(ctx.vals.state, 'RC-STATE');
  assert.equal(ctx.vals.reg_no, 'JH05AB1234');
  assert.equal(ctx.vals.ch_no, 'MA3FJEB1S00123456');
  assert.equal(ctx.vals.eng_no, 'K12M1234567');
  assert.equal(ctx.vals.make, 'Maruti Suzuki');
  assert.equal(ctx.vals.model, 'Swift VXi');
  assert.equal(ctx.vals.fuel, 'Petrol');
  assert.deepEqual(ctx.pendingConflicts, {}, 'a single document can never conflict with itself');
});

/* ── Scenario 2: Aadhaar only ── */
test('scenario 2: Aadhaar only fills name + address + father, leaves vehicle fields untouched', () => {
  const ctx = freshCtx();
  mergeExtractedFields('aadhaar', AI_FIELD_MAP.aadhaar(AADHAAR_SAMPLE, 'seller'), ctx);

  assert.equal(ctx.vals.s_name, 'RAMESH KUMAR SHARMA');
  assert.equal(ctx.vals.s_father, 'Shri Mohan Lal Sharma');
  assert.equal(ctx.vals.s_addr, 'NEW HOUSE, AADHAAR ADDRESS ROAD');
  assert.equal(ctx.vals.reg_no, undefined, 'Aadhaar never supplies vehicle fields');
  assert.equal(ctx.vals.ch_no, undefined);
  assert.equal(ctx.vals.make, undefined);
});

/* ── Scenario 3: RC + Aadhaar, addresses AGREE — vehicle from RC, name from RC, address from Aadhaar ── */
function scenario3Data(){
  const rc = { ...RC_SAMPLE, address_line: 'SAME ADDRESS', town: 'SAME TOWN', district: 'SAME DIST', state: 'SAME STATE' };
  const aadhaar = { ...AADHAAR_SAMPLE, address_line: 'SAME ADDRESS', town: 'SAME TOWN', district: 'SAME DIST', state: 'SAME STATE' };
  return { rc, aadhaar };
}

test('scenario 3: RC + Aadhaar (RC first) — vehicle from RC, name from RC, address from Aadhaar (source), no conflicts', () => {
  const { rc, aadhaar } = scenario3Data();
  const ctx = freshCtx();
  mergeExtractedFields('rc', AI_FIELD_MAP.rc(rc, 'seller'), ctx);
  mergeExtractedFields('aadhaar', AI_FIELD_MAP.aadhaar(aadhaar, 'seller'), ctx);

  assert.equal(ctx.vals.s_name, 'RAMESH KUMAR SHARMA'); // RC wins name
  assert.equal(ctx.vals.reg_no, 'JH05AB1234'); // only RC has this
  assert.equal(ctx.vals.s_addr, 'SAME ADDRESS');
  assert.equal(ctx.fieldSource.s_addr, 'aadhaar', 'Aadhaar owns the address field even though the values happened to match');
  assert.equal(ctx.fieldSource.s_name, 'rc');
  assert.deepEqual(ctx.pendingConflicts, {});
});

test('scenario 3: RC + Aadhaar (Aadhaar first) — same outcome as RC-first', () => {
  const { rc, aadhaar } = scenario3Data();
  const ctx = freshCtx();
  mergeExtractedFields('aadhaar', AI_FIELD_MAP.aadhaar(aadhaar, 'seller'), ctx);
  mergeExtractedFields('rc', AI_FIELD_MAP.rc(rc, 'seller'), ctx);

  assert.equal(ctx.vals.s_name, 'RAMESH KUMAR SHARMA');
  assert.equal(ctx.vals.reg_no, 'JH05AB1234');
  assert.equal(ctx.vals.s_addr, 'SAME ADDRESS');
  assert.equal(ctx.fieldSource.s_addr, 'aadhaar');
  assert.equal(ctx.fieldSource.s_name, 'rc');
  assert.deepEqual(ctx.pendingConflicts, {});
});

/* ── Scenario 4: RC + Aadhaar, addresses DIFFER — Aadhaar applied, RC recorded as a pending conflict ── */
test('scenario 4: differing address — Aadhaar\'s value is applied, RC\'s is offered as a switchable conflict (RC extracted first)', () => {
  const ctx = freshCtx();
  mergeExtractedFields('rc', AI_FIELD_MAP.rc(RC_SAMPLE, 'seller'), ctx);
  mergeExtractedFields('aadhaar', AI_FIELD_MAP.aadhaar(AADHAAR_SAMPLE, 'seller'), ctx);

  /* Every piece of the address block (address_line/town/district/state)
     independently disagrees between the two samples — all four must
     resolve the same way: Aadhaar applied, RC offered as the switch. */
  assert.equal(ctx.vals.s_addr, 'NEW HOUSE, AADHAAR ADDRESS ROAD', "Aadhaar's address wins per FIELD_SOURCE_PRIORITY");
  assert.equal(ctx.vals.s_town, 'AADHAAR-TOWN');
  assert.equal(ctx.vals.s_dist, 'AADHAAR-DISTRICT');
  assert.equal(ctx.vals.state, 'AADHAAR-STATE');
  assert.deepEqual(ctx.pendingConflicts.s_addr, {
    winner: { docType: 'aadhaar', value: 'NEW HOUSE, AADHAAR ADDRESS ROAD' },
    loser: { docType: 'rc', value: 'OLD HOUSE, RC ADDRESS ROAD' },
  });
  assert.deepEqual(ctx.pendingConflicts.s_town, { winner: { docType: 'aadhaar', value: 'AADHAAR-TOWN' }, loser: { docType: 'rc', value: 'RC-TOWN' } });
  assert.deepEqual(ctx.pendingConflicts.s_dist, { winner: { docType: 'aadhaar', value: 'AADHAAR-DISTRICT' }, loser: { docType: 'rc', value: 'RC-DISTRICT' } });
  assert.deepEqual(ctx.pendingConflicts.state, { winner: { docType: 'aadhaar', value: 'AADHAAR-STATE' }, loser: { docType: 'rc', value: 'RC-STATE' } });
  // name never conflicts here — Aadhaar and RC happen to agree on it in this sample
  assert.equal(ctx.pendingConflicts.s_name, undefined);
});

test('scenario 4: differing address — same outcome when Aadhaar is extracted first instead', () => {
  const ctx = freshCtx();
  mergeExtractedFields('aadhaar', AI_FIELD_MAP.aadhaar(AADHAAR_SAMPLE, 'seller'), ctx);
  mergeExtractedFields('rc', AI_FIELD_MAP.rc(RC_SAMPLE, 'seller'), ctx);

  assert.equal(ctx.vals.s_addr, 'NEW HOUSE, AADHAAR ADDRESS ROAD');
  assert.deepEqual(ctx.pendingConflicts.s_addr, {
    winner: { docType: 'aadhaar', value: 'NEW HOUSE, AADHAAR ADDRESS ROAD' },
    loser: { docType: 'rc', value: 'OLD HOUSE, RC ADDRESS ROAD' },
  });
});

/* ── Dedicated reverse-order test: identical documents, both orders, byte-identical result ── */
test('reverse-order merge: RC+Aadhaar merged in either order produce an identical final state', () => {
  const forward = freshCtx();
  mergeExtractedFields('rc', AI_FIELD_MAP.rc(RC_SAMPLE, 'seller'), forward);
  mergeExtractedFields('aadhaar', AI_FIELD_MAP.aadhaar(AADHAAR_SAMPLE, 'seller'), forward);

  const reverse = freshCtx();
  mergeExtractedFields('aadhaar', AI_FIELD_MAP.aadhaar(AADHAAR_SAMPLE, 'seller'), reverse);
  mergeExtractedFields('rc', AI_FIELD_MAP.rc(RC_SAMPLE, 'seller'), reverse);

  assert.deepEqual(forward.vals, reverse.vals, 'applied values must not depend on extraction order');
  assert.deepEqual(forward.fieldSource, reverse.fieldSource, 'field ownership must not depend on extraction order');
  assert.deepEqual(forward.pendingConflicts, reverse.pendingConflicts, 'conflict notices must not depend on extraction order');
});

/* ── Scenario 5: firm-owned RC ── */
test('scenario 5: resolveOwnerType returns "firm" only for an exact "firm" value', () => {
  assert.equal(resolveOwnerType({ owner_type: 'firm' }), 'firm');
  assert.equal(resolveOwnerType({ owner_type: 'individual' }), 'individual');
  assert.equal(resolveOwnerType({ owner_type: '' }), 'individual');
  assert.equal(resolveOwnerType({}), 'individual');
  assert.equal(resolveOwnerType(null), 'individual');
  assert.equal(resolveOwnerType({ owner_type: 'FIRM' }), 'individual', 'case-sensitive on purpose — the prompt is instructed to return the exact lowercase literal');
});

test('scenario 5: a firm-owned RC never populates s_father — AI_FIELD_MAP.rc has no concept of a father field at all', () => {
  const firmRc = { ...RC_SAMPLE, owner_name: 'M/S MANGALAM HOMES', owner_type: 'firm' };
  const ctx = freshCtx();
  mergeExtractedFields('rc', AI_FIELD_MAP.rc(firmRc, 'seller'), ctx);

  assert.equal(ctx.vals.s_name, 'M/S MANGALAM HOMES');
  assert.equal(ctx.vals.s_father, undefined, 'RC has no father field in its prompt shape — this can never be set by RC, firm or not');
  assert.equal(resolveOwnerType(firmRc), 'firm');
});
