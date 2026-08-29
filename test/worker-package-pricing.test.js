/* Package-based AI extraction pricing (worker/src/index.js's /extract-package):
   one flat price per TASK, charged ONCE, and ONLY if every document in the
   package succeeded — a partial failure charges nothing at all, so there's
   no "charge then refund" path to test for correctness, just "did we
   decide to charge, and how much". decidePackageCharge()/hasEnoughBalance()
   are the entire decision, pulled out of the route handler specifically so
   they're testable here without mocking Gemini or a KV-backed wallet — see
   worker/src/index.js's own comment above them.

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

test('decidePackageCharge: full package success charges the flat task price once', async () => {
  const { decidePackageCharge } = await import(WORKER_URL);
  const results = [
    { docType: 'rc', ok: true, data: { reg_no: 'DL01AB1234' } },
    { docType: 'aadhaar', ok: true, data: { name: 'TEST NAME' } },
  ];
  const decision = decidePackageCharge(500, results);
  assert.deepEqual(decision, { charge: true, amountPaise: 500 });
});

test('decidePackageCharge: a single-document package still charges the flat price on success', async () => {
  const { decidePackageCharge } = await import(WORKER_URL);
  const decision = decidePackageCharge(300, [{ docType: 'rc', ok: true, data: {} }]);
  assert.deepEqual(decision, { charge: true, amountPaise: 300 });
});

test('decidePackageCharge: one failed document in the package charges NOTHING, even if others succeeded', async () => {
  const { decidePackageCharge } = await import(WORKER_URL);
  const results = [
    { docType: 'rc', ok: true, data: { reg_no: 'DL01AB1234' } },
    { docType: 'aadhaar', ok: false, error: 'Gemini did not return valid JSON' },
  ];
  const decision = decidePackageCharge(500, results);
  assert.equal(decision.charge, false);
  assert.deepEqual(decision.failed, ['aadhaar']);
});

test('decidePackageCharge: every document failing charges nothing and lists every one of them', async () => {
  const { decidePackageCharge } = await import(WORKER_URL);
  const results = [
    { docType: 'rc', ok: false, error: 'Gemini API error' },
    { docType: 'aadhaar', ok: false, error: 'Gemini request failed' },
  ];
  const decision = decidePackageCharge(500, results);
  assert.equal(decision.charge, false);
  assert.deepEqual(decision.failed, ['rc', 'aadhaar']);
});

test('decidePackageCharge: order of documents in "failed" matches the order they were given, not alphabetical/success-first', async () => {
  const { decidePackageCharge } = await import(WORKER_URL);
  const results = [
    { docType: 'aadhaar', ok: false, error: 'x' },
    { docType: 'rc', ok: true, data: {} },
    { docType: 'pan', ok: false, error: 'y' },
  ];
  const decision = decidePackageCharge(500, results);
  assert.deepEqual(decision.failed, ['aadhaar', 'pan']);
});

test('hasEnoughBalance: exactly enough balance passes (>=, not >)', async () => {
  const { hasEnoughBalance } = await import(WORKER_URL);
  assert.equal(hasEnoughBalance(500, 500), true);
});

test('hasEnoughBalance: one paisa short fails', async () => {
  const { hasEnoughBalance } = await import(WORKER_URL);
  assert.equal(hasEnoughBalance(499, 500), false);
});

test('hasEnoughBalance: zero balance fails against any positive price', async () => {
  const { hasEnoughBalance } = await import(WORKER_URL);
  assert.equal(hasEnoughBalance(0, 300), false);
});

test('TASK_PRICING: b_transfer (2 extractions — RC + buyer Aadhaar) is priced higher than every 1-extraction task', async () => {
  const worker = await import(WORKER_URL);
  const source = require('node:fs').readFileSync(path.join(__dirname, '..', 'worker', 'src', 'index.js'), 'utf8');
  const match = /const TASK_PRICING = (\{[\s\S]*?\n\});/.exec(source);
  assert.ok(match, 'Could not find "const TASK_PRICING = {...}" in worker/src/index.js — did it get renamed?');
  // eslint-disable-next-line no-eval
  const TASK_PRICING = eval('(' + match[1] + ')');
  assert.equal(TASK_PRICING.b_transfer, 500);
  for (const [taskId, price] of Object.entries(TASK_PRICING)) {
    if (taskId === 'b_transfer') continue;
    assert.ok(price < TASK_PRICING.b_transfer, `${taskId} (₹${price / 100}) should be cheaper than b_transfer`);
  }
});
