/* Money-related error/status states (pro-wallet.js) — payment failed,
   payment received but unconfirmed, connection lost, balance too low,
   partial extraction, loading. Spec: money status stated plainly, no
   Razorpay/HTTP technical text, no Hinglish (real money is involved).

   i18n.js can't be require()'d directly — it has top-level DOM/localStorage
   side effects (document.addEventListener, localStorage.getItem) meant for
   a browser, which throw in Node. Same approach as
   task-pricing-contract.test.js: parse the literal object out of the
   source text instead of executing the file. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const I18N_PATH = path.join(__dirname, '..', 'i18n.js');
const source = fs.readFileSync(I18N_PATH, 'utf8');
const match = /const I18N_STRINGS = (\{[\s\S]*?\n\});/.exec(source);
assert.ok(match, 'Could not find "const I18N_STRINGS = {...}" in i18n.js — did it get renamed or restructured?');
// eslint-disable-next-line no-eval
const I18N_STRINGS = eval('(' + match[1] + ')');

const MONEY_KEYS = [
  'pay.failed', 'pay.tryAgain', 'pay.receivedNotConfirmed', 'pay.balanceWillUpdate',
  'pay.refreshBalance', 'pay.balanceRefreshed', 'pay.couldNotStart', 'err.connectionLost',
  'status.readingDoc', 'status.onlyChargedIfSuccess', 'status.filledAndMissed',
  'status.paymentStarting', 'status.paymentConfirming', 'status.amountAdded',
  'ai.balanceTooLow', 'ai.fillWithAi', 'ai.retryBtn', 'ai.extractFailed', 'ai.addMoneyBtn',
  'ai.title', 'ai.subtitle',
];

test('error-states: every money-related key exists in both en and hi', () => {
  for (const key of MONEY_KEYS) {
    assert.ok(key in I18N_STRINGS.en, `en.${key} is missing`);
    assert.ok(key in I18N_STRINGS.hi, `hi.${key} is missing`);
  }
});

test('error-states: every money-related key is IDENTICAL in en and hi — no Hinglish for real-money text', () => {
  for (const key of MONEY_KEYS) {
    assert.equal(I18N_STRINGS.hi[key], I18N_STRINGS.en[key], `hi.${key} differs from en.${key} — this text touches money and must stay English-only`);
  }
});

test('error-states: payment failed leads with the money fact, never Razorpay\'s raw decline reason', () => {
  const s = I18N_STRINGS.en['pay.failed'];
  assert.equal(s, 'Payment failed. You were not charged.');
  assert.doesNotMatch(s, /\{reason\}|\{extra\}|\{msg\}/, 'must not interpolate a raw error/reason string');
});

test('error-states: payment received but unconfirmed makes clear the money is not lost', () => {
  assert.equal(I18N_STRINGS.en['pay.receivedNotConfirmed'], 'Payment received but not confirmed yet.');
  assert.equal(I18N_STRINGS.en['pay.balanceWillUpdate'], 'Your balance will update in a few minutes.');
  assert.doesNotMatch(I18N_STRINGS.en['pay.receivedNotConfirmed'], /\{msg\}/);
});

test('error-states: connection-lost during upload/extraction states no charge happened', () => {
  assert.equal(I18N_STRINGS.en['err.connectionLost'], 'Connection lost. You were not charged.');
});

test('error-states: balance-too-low names the exact price needed, via a placeholder not a raw error', () => {
  assert.equal(I18N_STRINGS.en['ai.balanceTooLow'], 'Balance too low. You need ₹{price}.');
});

test('error-states: loading state reassures about charging before any charge decision is made', () => {
  assert.equal(I18N_STRINGS.en['status.readingDoc'], 'Reading your document...');
  assert.equal(I18N_STRINGS.en['status.onlyChargedIfSuccess'], "You'll only be charged if this succeeds.");
});

test('error-states: partial-extraction summary names both what was filled and what was not', () => {
  const s = I18N_STRINGS.en['status.filledAndMissed'];
  assert.match(s, /\{filled\}/);
  assert.match(s, /\{missed\}/);
  assert.match(s, /could not be read/);
});

test('error-states: none of the money-related strings contain HTTP/stack-trace-shaped technical text', () => {
  const technical = /\b[45]\d{2}\b|stack trace|TypeError|NetworkError|at Object\.|\.js:\d+/i;
  for (const key of MONEY_KEYS) {
    assert.doesNotMatch(I18N_STRINGS.en[key], technical, `en.${key} looks like it leaks technical error text`);
  }
});
