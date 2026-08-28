/* Regression coverage for ordinalSuffix()/fmtDate() (pdf-generate.js).

   The bug: `n===1?'st':n===2?'nd':n===3?'rd':'th'` ignored the 11-13
   "teens" exception entirely, so 11th/12th/13th/21st/22nd/23rd/31st all
   printed with a bare "th" glued onto them instead — a real form was
   found printing "22th day of June, 2015". The correct rule: 11, 12, 13
   are always "th" regardless of their last digit; otherwise go by the
   last digit (1→st, 2→nd, 3→rd, else th). This test exhaustively checks
   every day of a month (1-31), not just the bug's reported cases, so any
   future regression on any single day is caught. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { ordinalSuffix, fmtDate } = require('../pdf-generate.js');

const EXPECTED = {
  1:'st', 2:'nd', 3:'rd', 4:'th', 5:'th', 6:'th', 7:'th', 8:'th', 9:'th', 10:'th',
  11:'th', 12:'th', 13:'th', 14:'th', 15:'th', 16:'th', 17:'th', 18:'th', 19:'th', 20:'th',
  21:'st', 22:'nd', 23:'rd', 24:'th', 25:'th', 26:'th', 27:'th', 28:'th', 29:'th', 30:'th', 31:'st',
};

test('ordinalSuffix: every day 1-31 gets the correct suffix', () => {
  for (let n = 1; n <= 31; n++) {
    assert.equal(ordinalSuffix(n), EXPECTED[n], `day ${n} should be ${n}${EXPECTED[n]}`);
  }
});

test('ordinalSuffix: the reported bug — 11th/12th/13th/22nd stay "th"/"nd", not a blind last-digit rule', () => {
  assert.equal(ordinalSuffix(11), 'th');
  assert.equal(ordinalSuffix(12), 'th');
  assert.equal(ordinalSuffix(13), 'th');
  assert.equal(ordinalSuffix(21), 'st');
  assert.equal(ordinalSuffix(22), 'nd');
  assert.equal(ordinalSuffix(23), 'rd');
});

test('fmtDate: reproduces the exact reported bug case — 22 June 2015 now prints "22nd", not "22th"', () => {
  assert.equal(fmtDate('2015-06-22'), '22nd day of June, 2015');
});

test('fmtDate: 11th/12th/13th print correctly end to end', () => {
  assert.equal(fmtDate('2024-01-11'), '11th day of January, 2024');
  assert.equal(fmtDate('2024-01-12'), '12th day of January, 2024');
  assert.equal(fmtDate('2024-01-13'), '13th day of January, 2024');
});

test('fmtDate: 1st/2nd/3rd/31st print correctly end to end', () => {
  assert.equal(fmtDate('2024-03-01'), '1st day of March, 2024');
  assert.equal(fmtDate('2024-03-02'), '2nd day of March, 2024');
  assert.equal(fmtDate('2024-03-03'), '3rd day of March, 2024');
  assert.equal(fmtDate('2024-03-31'), '31st day of March, 2024');
});

test('fmtDate: empty/missing input returns the blank-line placeholder, not "Invalid Date"', () => {
  assert.equal(fmtDate(''), '_______________');
  assert.equal(fmtDate(undefined), '_______________');
});
