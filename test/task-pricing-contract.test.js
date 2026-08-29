/* task-pricing.js (frontend LABEL) and worker/src/index.js's TASK_PRICING
   (the copy that actually decides what to charge) are two separate literals
   — the Worker is a separate deployable and can't <script src> a frontend
   file. This test parses both at test time and diffs them, so a price
   changed on one side and not the other fails a test instead of silently
   showing the wrong price to a user (same pattern as
   worker-frontend-contract.test.js for PROMPTS vs AI_FIELD_MAP). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { TASK_PRICING: FRONTEND_PRICING } = require('../task-pricing.js');

const WORKER_PATH = path.join(__dirname, '..', 'worker', 'src', 'index.js');
const workerSource = fs.readFileSync(WORKER_PATH, 'utf8');
const match = /const TASK_PRICING = (\{[\s\S]*?\n\});/.exec(workerSource);
assert.ok(match, `Could not find "const TASK_PRICING = {...}" in ${WORKER_PATH} — did it get renamed or restructured?`);
// eslint-disable-next-line no-eval
const WORKER_PRICING = eval('(' + match[1] + ')');

test('task-pricing-contract: frontend and Worker agree on every taskId', () => {
  assert.deepEqual(
    Object.keys(FRONTEND_PRICING).sort(),
    Object.keys(WORKER_PRICING).sort(),
    'task-pricing.js and worker/src/index.js declare a different set of taskIds'
  );
});

test('task-pricing-contract: frontend and Worker agree on every price (paise)', () => {
  for (const taskId of Object.keys(WORKER_PRICING)) {
    assert.equal(
      FRONTEND_PRICING[taskId],
      WORKER_PRICING[taskId],
      `${taskId}: frontend says ₹${FRONTEND_PRICING[taskId] / 100}, Worker says ₹${WORKER_PRICING[taskId] / 100} — the button would show the wrong price`
    );
  }
});

test('task-pricing-contract: has a "default" entry for the root page\'s unmatched selections', () => {
  assert.ok('default' in FRONTEND_PRICING, 'task-pricing.js needs a default entry');
  assert.ok('default' in WORKER_PRICING, 'worker/src/index.js needs a default entry');
});

test('task-pricing-contract: BUNDLES (forms-data.js) has no bundle missing from TASK_PRICING', () => {
  const formsDataSource = fs.readFileSync(path.join(__dirname, '..', 'forms-data.js'), 'utf8');
  const bundleIds = [...formsDataSource.matchAll(/\{id:'(b_\w+)'/g)].map((m) => m[1]);
  assert.ok(bundleIds.length > 0, 'Could not find any BUNDLES ids in forms-data.js — did it get restructured?');
  for (const id of bundleIds) {
    assert.ok(id in FRONTEND_PRICING, `BUNDLES has "${id}" but task-pricing.js has no price for it`);
  }
});
