/* Coverage for aadhaar-qr.js — the client-side-only Aadhaar Secure QR
   decoder. Builds a synthetic Secure QR payload the same way UIDAI's real
   generator does (fields joined with 0xFF, gzip-compressed, read back as a
   base-10 integer) so decodeAadhaarSecureQr() is exercised end to end, not
   just against hand-picked byte arrays. */

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const {
  AADHAAR_QR_FIELD_ORDER,
  aadhaarQrIsOldFormat,
  aadhaarQrLooksLikeSecureNumeric,
  aadhaarQrBigIntStringToBytes,
  aadhaarQrSplitFields,
  aadhaarQrBytesToText,
  aadhaarQrParseFields,
  aadhaarQrMapToBuyerFields,
  decodeAadhaarSecureQr
} = require('../aadhaar-qr.js');

/* Builds a real Secure-QR-shaped numeric string from a {fieldName: value}
   object (defaults every field in AADHAAR_QR_FIELD_ORDER to '' unless
   given) — the exact inverse of what decodeAadhaarSecureQr() reads. `versionPrefix`
   (e.g. 'V3') optionally prepends a version field, matching what some real
   cards do. */
function buildSecureQrText(fieldValues, versionPrefix){
  const parts=(versionPrefix ? [versionPrefix] : []).concat(
    AADHAAR_QR_FIELD_ORDER.map(name=>fieldValues[name]||'')
  );
  const byteParts=parts.map(s=>Buffer.from(s,'latin1'));
  const delimiter=Buffer.from([255]);
  const bytes=Buffer.concat(byteParts.flatMap((b,i)=>i===0?[b]:[delimiter,b]));
  const gzipped=zlib.gzipSync(bytes);
  return BigInt('0x'+gzipped.toString('hex')).toString(10);
}

const SAMPLE_FIELDS={
  referenceid:'1234202108261212',
  name:'SURESH KUMAR YADAV',
  dob:'15-08-1990',
  gender:'M',
  careof:'S/O Ram Prasad Yadav',
  district:'East Singhbhum',
  landmark:'Near Shiv Mandir',
  house:'H.No. 12',
  location:'Sakchi',
  pincode:'831001',
  postoffice:'Sakchi',
  state:'Jharkhand',
  street:'Main Road',
  subdistrict:'Jamshedpur',
  vtc:'Jamshedpur'
};

test('decodeAadhaarSecureQr: a well-formed Secure QR decodes and maps to buyer fields', async () => {
  const qrText=buildSecureQrText(SAMPLE_FIELDS);
  const result=await decodeAadhaarSecureQr(qrText);
  assert.equal(result.ok, true);
  assert.equal(result.fields.name, 'SURESH KUMAR YADAV');
  assert.deepEqual(result.mapped, {
    b_name:'SURESH KUMAR YADAV',
    b_addr:'H.No. 12, Main Road, Near Shiv Mandir',
    b_town:'Jamshedpur',
    b_dist:'East Singhbhum',
    b_state:'Jharkhand'
  });
});

test('decodeAadhaarSecureQr: a version-prefixed (V3) Secure QR still parses the same fields', async () => {
  const qrText=buildSecureQrText(SAMPLE_FIELDS, 'V3');
  const result=await decodeAadhaarSecureQr(qrText);
  assert.equal(result.ok, true);
  assert.equal(result.mapped.b_name, 'SURESH KUMAR YADAV');
  assert.equal(result.mapped.b_dist, 'East Singhbhum');
});

test('decodeAadhaarSecureQr: b_town falls back to postoffice when vtc is blank', async () => {
  const qrText=buildSecureQrText(Object.assign({}, SAMPLE_FIELDS, {vtc:''}));
  const result=await decodeAadhaarSecureQr(qrText);
  assert.equal(result.mapped.b_town, 'Sakchi');
});

test('decodeAadhaarSecureQr: address parts skip blanks without stray commas', async () => {
  const qrText=buildSecureQrText(Object.assign({}, SAMPLE_FIELDS, {landmark:''}));
  const result=await decodeAadhaarSecureQr(qrText);
  assert.equal(result.mapped.b_addr, 'H.No. 12, Main Road');
});

test('decodeAadhaarSecureQr: rejects the old XML-based QR format without extracting anything', async () => {
  const oldQr='<?xml version="1.0" encoding="UTF-8"?><PrintLetterBarcodeData uid="234567890123" name="Suresh Kumar Yadav" gender="M" />';
  const result=await decodeAadhaarSecureQr(oldQr);
  assert.deepEqual(result, {ok:false, reason:'old-format'});
});

test('decodeAadhaarSecureQr: rejects non-numeric, non-XML junk as decode-error', async () => {
  const result=await decodeAadhaarSecureQr('not-a-qr-at-all');
  assert.deepEqual(result, {ok:false, reason:'decode-error'});
});

test('decodeAadhaarSecureQr: rejects a numeric string that is not a valid gzip stream', async () => {
  const result=await decodeAadhaarSecureQr('123456789012345678901234567890');
  assert.deepEqual(result, {ok:false, reason:'decode-error'});
});

test('decodeAadhaarSecureQr: rejects a valid gzip stream with too few fields (not a Secure QR)', async () => {
  const gzipped=zlib.gzipSync(Buffer.from('just one field, no delimiters at all','latin1'));
  const qrText=BigInt('0x'+gzipped.toString('hex')).toString(10);
  const result=await decodeAadhaarSecureQr(qrText);
  assert.deepEqual(result, {ok:false, reason:'decode-error'});
});

test('aadhaarQrIsOldFormat: detects the pre-2018 XML QR shape', () => {
  assert.equal(aadhaarQrIsOldFormat('<?xml version="1.0"?><PrintLetterBarcodeData uid="123456789012"/>'), true);
  assert.equal(aadhaarQrIsOldFormat('<PrintLetterBarcodeData uid="123456789012"/>'), true);
  assert.equal(aadhaarQrIsOldFormat('208412345678901234567890'), false);
  assert.equal(aadhaarQrIsOldFormat(''), false);
});

test('aadhaarQrLooksLikeSecureNumeric: purely-digit strings only', () => {
  assert.equal(aadhaarQrLooksLikeSecureNumeric('12345'), true);
  assert.equal(aadhaarQrLooksLikeSecureNumeric('  12345  '), true);
  assert.equal(aadhaarQrLooksLikeSecureNumeric('123a45'), false);
  assert.equal(aadhaarQrLooksLikeSecureNumeric('<xml/>'), false);
  assert.equal(aadhaarQrLooksLikeSecureNumeric(''), false);
});

test('aadhaarQrBigIntStringToBytes: minimal big-endian bytes, no sign padding', () => {
  assert.deepEqual([...aadhaarQrBigIntStringToBytes('0')], [0]);
  assert.deepEqual([...aadhaarQrBigIntStringToBytes('255')], [255]);
  assert.deepEqual([...aadhaarQrBigIntStringToBytes('256')], [1,0]);
  assert.deepEqual([...aadhaarQrBigIntStringToBytes('65535')], [255,255]);
});

test('aadhaarQrSplitFields: splits on byte 255, including empty leading/trailing segments', () => {
  const bytes=new Uint8Array([65,66,255,255,67]); // "AB" | "" | "C"
  const segments=aadhaarQrSplitFields(bytes).map(aadhaarQrBytesToText);
  assert.deepEqual(segments, ['AB','','C']);
});

test('aadhaarQrParseFields: throws when there are fewer segments than the field list needs', () => {
  const bytes=new Uint8Array([65,255,66]); // only 2 fields
  assert.throws(() => aadhaarQrParseFields(bytes));
});

test('aadhaarQrMapToBuyerFields: omits fields with no data rather than writing empty strings', () => {
  const mapped=aadhaarQrMapToBuyerFields({name:'', house:'', street:'', landmark:'', vtc:'', postoffice:'', district:'', state:'Jharkhand'});
  assert.deepEqual(mapped, {b_state:'Jharkhand'});
});
