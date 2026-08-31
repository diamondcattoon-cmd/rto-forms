/* Aadhaar/PAN extraction was removed for Aadhaar Act compliance — an
   Aadhaar card carries a photo and a government ID number the Act treats
   as sensitive personal data, so sending it to a third-party API (Gemini)
   carries real compliance risk a vehicle Registration Certificate does
   not. Removing the upload option from the frontend alone isn't a real
   guarantee — anyone can call /extract-package directly — so this test
   hits the actual route handler (not a copy) and confirms the docType
   allowlist rejects anything but 'rc', exactly the way a direct API
   caller would experience it. See the PROMPTS comment and the
   /extract-package docType check in worker/src/index.js. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const WORKER_URL = require('node:url').pathToFileURL(
  path.join(__dirname, '..', 'worker', 'src', 'index.js')
);

/* GEMINI_API_KEY only needs to be present (truthy) — the docType
   allowlist rejects the request before any Gemini/KV call is ever made,
   so no other env binding is needed for these cases. */
const FAKE_ENV = { GEMINI_API_KEY: 'test-key' };

function extractRequest(docs) {
  return new Request('https://worker.test/extract-package', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'wallet-abc', taskId: 'default', docs }),
  });
}

test('/extract-package rejects docType "aadhaar" with a 400 and a clear error', async () => {
  const worker = (await import(WORKER_URL)).default;
  const res = await worker.fetch(
    extractRequest([{ docType: 'aadhaar', images: [{ data: 'x', mimeType: 'image/jpeg' }] }]),
    FAKE_ENV
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /docType must be 'rc'/);
});

test('/extract-package rejects docType "pan" with a 400 and a clear error', async () => {
  const worker = (await import(WORKER_URL)).default;
  const res = await worker.fetch(
    extractRequest([{ docType: 'pan', images: [{ data: 'x', mimeType: 'image/jpeg' }] }]),
    FAKE_ENV
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /docType must be 'rc'/);
});

test('/extract-package rejects a missing docType the same way', async () => {
  const worker = (await import(WORKER_URL)).default;
  const res = await worker.fetch(
    extractRequest([{ images: [{ data: 'x', mimeType: 'image/jpeg' }] }]),
    FAKE_ENV
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /docType must be 'rc'/);
});

test('/extract-package rejects a 2-document package outright, even before looking at docType', () => {
  return (async () => {
    const worker = (await import(WORKER_URL)).default;
    const res = await worker.fetch(
      extractRequest([
        { docType: 'rc', images: [{ data: 'x', mimeType: 'image/jpeg' }] },
        { docType: 'rc', images: [{ data: 'y', mimeType: 'image/jpeg' }] },
      ]),
      FAKE_ENV
    );
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Maximum 1 document per package/);
  })();
});
