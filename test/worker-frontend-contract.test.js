/* This is the check for the failure mode that has bitten this project twice:
   worker/src/index.js (Gemini prompt output shape) and field-mapping.js
   (AI_FIELD_MAP, which reads that output) drifting apart — e.g. a field
   renamed on one side and not the other, so extracted data silently goes
   missing. Instead of hand-copying the Worker's field list into a second
   fixture that itself could drift, this test parses the real
   worker/src/index.js source at test time and diffs it against the real
   AI_FIELD_MAP source. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AI_FIELD_MAP } = require('../field-mapping.js');

const WORKER_PATH = path.join(__dirname, '..', 'worker', 'src', 'index.js');
const workerSource = fs.readFileSync(WORKER_PATH, 'utf8');

const promptsBlockMatch = /const PROMPTS\s*=\s*\{([\s\S]*?)\n\};/.exec(workerSource);
assert.ok(promptsBlockMatch, `Could not find "const PROMPTS = {...}" in ${WORKER_PATH} — did it get renamed or restructured?`);
const promptsBlock = promptsBlockMatch[1];

/* Each PROMPTS.<docType> entry declares its JSON output shape in the prompt
   text itself, as "...in this exact shape:\n{ ... }\nRules:". Pull the keys
   out of that literal JSON block. */
function workerOutputFields(docType) {
  const keyPattern = new RegExp('\\n\\s*' + docType + ':\\s*`');
  const startMatch = keyPattern.exec(promptsBlock);
  assert.ok(startMatch, `PROMPTS.${docType} not found in worker/src/index.js — did the prompt key get renamed?`);
  const bodyStart = startMatch.index + startMatch[0].length;
  const bodyEnd = promptsBlock.indexOf('`', bodyStart);
  assert.ok(bodyEnd !== -1, `Unterminated template literal for PROMPTS.${docType}`);
  const body = promptsBlock.slice(bodyStart, bodyEnd);

  const shapeMatch = /exact shape:\s*(\{[\s\S]*?\n\})\s*\r?\n\s*Rules:/.exec(body);
  assert.ok(shapeMatch, `Could not find the declared JSON output shape ("...exact shape:\\n{...}\\nRules:") inside PROMPTS.${docType}`);
  return Object.keys(JSON.parse(shapeMatch[1]));
}

/* What field names does AI_FIELD_MAP[docType] actually read off the response? */
function frontendReadFields(docType) {
  const src = AI_FIELD_MAP[docType].toString();
  const fields = new Set();
  for (const m of src.matchAll(/data\.([A-Za-z_][A-Za-z0-9_]*)/g)) fields.add(m[1]);
  return [...fields];
}

test('worker/frontend contract: PROMPTS and AI_FIELD_MAP cover the same document types', () => {
  const promptDocTypes = [...promptsBlock.matchAll(/\n\s*(\w+):\s*`/g)].map((m) => m[1]).sort();
  assert.deepEqual(promptDocTypes, Object.keys(AI_FIELD_MAP).sort());
});

for (const docType of ['aadhaar', 'pan', 'rc']) {
  test(`worker/frontend contract: AI_FIELD_MAP.${docType} only reads fields the Worker actually declares`, () => {
    const workerFields = workerOutputFields(docType);
    const readFields = frontendReadFields(docType);
    const unknown = readFields.filter((f) => !workerFields.includes(f));
    assert.deepEqual(
      unknown,
      [],
      `AI_FIELD_MAP.${docType} reads [${unknown.join(', ')}] but PROMPTS.${docType} in worker/src/index.js only declares [${workerFields.join(', ')}] — Worker and frontend have drifted apart.`
    );
  });
}
