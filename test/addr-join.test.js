/* Regression coverage for addrJoin() (pdf-generate.js) — every place a PDF
   joins address-like parts (house/street, town, district, state) into one
   printed line goes through this instead of a hand-rolled ternary chain.

   The bug: `d.addr+(d.town?', '+d.town:'')+(d.dist?', '+d.dist:'')` only
   guards the parts AFTER the first one. If address_line itself came back
   empty from AI extraction (a very real case — Gemini couldn't read it,
   or a document simply doesn't carry it) while town/district didn't, the
   printed result started with a bare ", " — e.g. the reported
   ", AADHAAR-TOWN, AADHAAR-DISTRICT". addrJoin() filters empty/missing
   parts BEFORE joining, so a missing part just isn't there, wherever in
   the sequence it falls. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { addrJoin } = require('../pdf-generate.js');

test('addrJoin: all parts present joins cleanly with ", "', () => {
  assert.equal(addrJoin('H.No. 45, Station Road', 'Jamshedpur', 'East Singhbhum'), 'H.No. 45, Station Road, Jamshedpur, East Singhbhum');
});

test('addrJoin: a blank FIRST part (the reported bug) does not leave a leading comma', () => {
  assert.equal(addrJoin('', 'AADHAAR-TOWN', 'AADHAAR-DISTRICT'), 'AADHAAR-TOWN, AADHAAR-DISTRICT');
});

test('addrJoin: a blank middle part does not leave a double comma', () => {
  assert.equal(addrJoin('H.No. 45', '', 'East Singhbhum'), 'H.No. 45, East Singhbhum');
});

test('addrJoin: a blank LAST part does not leave a trailing comma', () => {
  assert.equal(addrJoin('H.No. 45', 'Jamshedpur', ''), 'H.No. 45, Jamshedpur');
});

test('addrJoin: undefined and null parts are treated the same as empty string', () => {
  assert.equal(addrJoin(undefined, 'Jamshedpur', null), 'Jamshedpur');
});

test('addrJoin: whitespace-only parts are treated as empty', () => {
  assert.equal(addrJoin('   ', 'Jamshedpur', 'East Singhbhum'), 'Jamshedpur, East Singhbhum');
});

test('addrJoin: all parts empty returns an empty string, not a bare comma', () => {
  assert.equal(addrJoin('', '', ''), '');
  assert.equal(addrJoin(), '');
});

test('addrJoin: a single non-empty part returns just that part, no comma at all', () => {
  assert.equal(addrJoin('', 'Jamshedpur', ''), 'Jamshedpur');
});

test('addrJoin: works for the "Dist. X" labeled-part pattern used in several forms', () => {
  const dist = 'East Singhbhum';
  assert.equal(addrJoin('H.No. 45', 'Jamshedpur', dist && ('Dist. '+dist)), 'H.No. 45, Jamshedpur, Dist. East Singhbhum');
  assert.equal(addrJoin('H.No. 45', 'Jamshedpur', '' && ('Dist. '+'')), 'H.No. 45, Jamshedpur');
});

test('addrJoin: works for name+address pairs (not just address sub-parts)', () => {
  assert.equal(addrJoin('RAMESH KUMAR SHARMA', ''), 'RAMESH KUMAR SHARMA', 'no trailing comma when the address is blank');
  assert.equal(addrJoin('', 'H.No. 45, Station Road'), 'H.No. 45, Station Road', 'no leading comma when the name is blank');
});
