const test = require('node:test');
const assert = require('node:assert/strict');
const { toISODate } = require('../field-mapping.js');

test('toISODate: converts a valid DD/MM/YYYY date to YYYY-MM-DD', () => {
  assert.equal(toISODate('05/03/2026'), '2026-03-05');
});

test('toISODate: pads single-digit day and month', () => {
  assert.equal(toISODate('5/3/2026'), '2026-03-05');
  assert.equal(toISODate('9/12/1999'), '1999-12-09');
});

test('toISODate: trims surrounding whitespace before parsing', () => {
  assert.equal(toISODate('  05/03/2026  '), '2026-03-05');
});

test('toISODate: returns empty string for empty/missing input', () => {
  assert.equal(toISODate(''), '');
  assert.equal(toISODate(undefined), '');
  assert.equal(toISODate(null), '');
});

test('toISODate: returns empty string for malformed input instead of guessing', () => {
  assert.equal(toISODate('not a date'), '');
  assert.equal(toISODate('2026-03-05'), '');   // already ISO — wrong direction
  assert.equal(toISODate('05-03-2026'), '');   // wrong separator
  assert.equal(toISODate('05/03/26'), '');     // 2-digit year not accepted
  assert.equal(toISODate('05/03/2026 extra'), '');
});
