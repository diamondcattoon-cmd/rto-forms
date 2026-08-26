/* Regression coverage for two Razorpay-integration bugs found during a
   manual audit against Razorpay's standard integration guide:

   1. buildReceipt() — Razorpay's order `receipt` field has a hard 40-char
      limit and must be unique per order. The original code used the raw
      64-char walletId (randomToken()) plus a timestamp, well over the
      limit, so every single /order call would have been rejected by
      Razorpay's API. This test pins the 40-char ceiling so a future change
      can't silently reintroduce it.
   2. constantTimeEqual() — signature comparison must not leak timing info
      via early-exit string comparison.

   worker/src/index.js is an ES module (Cloudflare Workers requires
   "export default {...}" module-worker format) — worker/package.json's
   {"type":"module"} lets Node's dynamic import() below load it directly,
   so these tests run against the real implementation, not a copy. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const WORKER_URL = require('node:url').pathToFileURL(
  path.join(__dirname, '..', 'worker', 'src', 'index.js')
);

test('buildReceipt: stays within Razorpay\'s 40-character receipt limit for a real 64-char walletId', async () => {
  const { buildReceipt } = await import(WORKER_URL);
  // 64 hex chars — matches randomToken()'s actual output length in worker/src/index.js
  const walletId = 'a'.repeat(64);
  const receipt = buildReceipt(walletId);
  assert.ok(
    receipt.length <= 40,
    `receipt "${receipt}" is ${receipt.length} chars — Razorpay rejects receipts over 40 characters`
  );
});

test('buildReceipt: stays within the limit even for a short walletId', async () => {
  const { buildReceipt } = await import(WORKER_URL);
  const receipt = buildReceipt('short-id');
  assert.ok(receipt.length <= 40, `receipt "${receipt}" is ${receipt.length} chars`);
});

test('buildReceipt: two orders for the same wallet at different times get different receipts', async (t) => {
  const { buildReceipt } = await import(WORKER_URL);
  const walletId = 'b'.repeat(64);

  t.mock.method(Date, 'now', () => 1_700_000_000_000);
  const first = buildReceipt(walletId);

  t.mock.method(Date, 'now', () => 1_700_000_000_001);
  const second = buildReceipt(walletId);

  assert.notEqual(first, second, 'receipts for the same wallet must differ across orders (Razorpay requires unique receipts)');
});

test('constantTimeEqual: matches equal strings and rejects unequal/mismatched-length ones', async () => {
  const { constantTimeEqual } = await import(WORKER_URL);
  assert.equal(constantTimeEqual('abc123', 'abc123'), true);
  assert.equal(constantTimeEqual('abc123', 'abc124'), false);
  assert.equal(constantTimeEqual('abc123', 'abc12'), false);
  assert.equal(constantTimeEqual('', ''), true);
});
