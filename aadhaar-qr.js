/* ════════ Aadhaar Secure QR — decode + field mapping (client-side only) ════════
   Shared between the browser (plain <script>, no import/export) and the Node
   test suite (require()'d directly) — same convention as field-mapping.js.

   This reads UIDAI's own "Secure QR Code" (the one printed on e-Aadhaar,
   PVC cards and shown in the mAadhaar app since ~2018): name, DOB, gender
   and a fully structured address, plus only the LAST 4 DIGITS of the
   Aadhaar number — the full 12-digit number is never present in this QR at
   all, which is what makes reading it (unlike OCR on the card photo, or the
   older QR below) compatible with the Aadhaar Act. Nothing here ever calls
   a server: BigInt/DecompressionStream/jsQR all run on-device.

   Format (per UIDAI's spec, cross-checked against public decoders — see
   aadhaarQrParseFields()'s comment for the field order): the QR's payload
   is one giant base-10 integer. Read as a byte array, it's a gzip stream;
   decompressed, it's a set of fields separated by the byte value 255.

   Older Aadhaar letters (pre-2018) carry a DIFFERENT QR: a plain XML string
   (`<PrintLetterBarcodeData uid="123456789012" .../>`) with the FULL
   12-digit Aadhaar number sitting in the `uid` attribute in the clear.
   aadhaarQrIsOldFormat() below detects that shape and decodeAadhaarSecureQr()
   refuses to touch it — see the caller-facing 'old-format' reason. */

/* Base field order inside a Secure QR's decompressed byte stream, delimited
   by 0xFF (255). Some cards prefix this with a short "V2"/"V3"/"V5" version
   marker as its own leading field (see aadhaarQrParseFields()) — when
   present, every index below just shifts by one; the marker doesn't change
   which named field holds what. The photo (JPEG2000) and signature bytes
   that follow `vtc` are ignored entirely — this app never needs them. */
const AADHAAR_QR_FIELD_ORDER=[
  'email_mobile_status','referenceid','name','dob','gender','careof',
  'district','landmark','house','location','pincode','postoffice',
  'state','street','subdistrict','vtc'
];

/* Pre-2018 Aadhaar QR: plain XML with the full 12-digit UID in the clear.
   Never decode this — see the file header comment. */
function aadhaarQrIsOldFormat(qrText){
  return /^\s*<\??\s*(xml|PrintLetterBarcodeData)/i.test(String(qrText||''));
}

/* Secure QR payloads are one big base-10 integer with nothing else in the
   string — anything else (including the old XML format) fails this check
   and is never handed to BigInt(). */
function aadhaarQrLooksLikeSecureNumeric(qrText){
  return /^\d+$/.test(String(qrText||'').trim());
}

/* Mirrors Java's `new BigInteger(str,10).toByteArray()` for a non-negative
   input: minimal big-endian bytes, no leading zero padding. A gzip stream's
   first byte is always 0x1f (bit 7 clear), so the sign-padding byte
   BigInteger sometimes adds to disambiguate a would-be-negative leading
   byte never actually applies to real Aadhaar QR data — this simpler
   version produces byte-identical output for every real input. */
function aadhaarQrBigIntStringToBytes(str){
  let n=BigInt(str);
  if(n<0n) throw new Error('aadhaarQrBigIntStringToBytes: negative input');
  if(n===0n) return new Uint8Array([0]);
  const out=[];
  while(n>0n){ out.unshift(Number(n & 0xffn)); n >>= 8n; }
  return new Uint8Array(out);
}

/* gzip-inflate via the browser/Node-native DecompressionStream — no bundled
   library needed (this repo has no build step). Available in every
   evergreen browser and in Node 18+ (this suite's `npm test` included). */
async function aadhaarQrGunzip(bytes){
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buf=await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/* Splits on the byte value 255, same semantics as String.split but at the
   byte level (the data isn't necessarily valid UTF-8 before this point). */
function aadhaarQrSplitFields(bytes){
  const segments=[];
  let start=0;
  for(let i=0;i<bytes.length;i++){
    if(bytes[i]===255){ segments.push(bytes.subarray(start,i)); start=i+1; }
  }
  segments.push(bytes.subarray(start));
  return segments;
}

/* Aadhaar's Secure QR text fields are plain Latin-1 (ISO-8859-1) — a direct
   byte→codepoint mapping, not UTF-8 — matching every public decoder
   implementation checked against. */
function aadhaarQrBytesToText(bytes){
  let s='';
  for(let i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]);
  return s;
}

/* Turns the decompressed byte stream into a {fieldName: text} object, per
   AADHAAR_QR_FIELD_ORDER. Detects and skips a leading "V2"/"V3"/"V5"-style
   version marker (a short field matching /^V\d/) some cards prefix the base
   16-field layout with — everything after it lines up with
   AADHAAR_QR_FIELD_ORDER unchanged either way. Throws if there aren't
   enough delimited segments to cover the full field list — a real Aadhaar
   Secure QR always has at least this many (plus photo/signature bytes
   after), so too few means this wasn't actually one. */
function aadhaarQrParseFields(decompressedBytes){
  const segments=aadhaarQrSplitFields(decompressedBytes);
  let base=0;
  if(segments.length){
    const first=aadhaarQrBytesToText(segments[0]);
    if(first.length<=4 && /^V\d/.test(first)) base=1;
  }
  if(segments.length < base+AADHAAR_QR_FIELD_ORDER.length){
    throw new Error('aadhaarQrParseFields: too few fields for a Secure QR');
  }
  const out={};
  AADHAAR_QR_FIELD_ORDER.forEach((name,i)=>{ out[name]=aadhaarQrBytesToText(segments[base+i]); });
  return out;
}

/* Joins non-empty parts with ", " — deliberately a local one-liner rather
   than requiring pdf-generate.js's addrJoin(): this file has no other
   dependency on load order (it's require()'d standalone by the test suite,
   same as field-mapping.js), and it isn't worth a cross-file coupling for
   one line of logic. */
function aadhaarQrJoin(parts){
  return parts.filter(p=>p && String(p).trim()).map(p=>String(p).trim()).join(', ');
}

/* Maps parsed Secure QR fields onto this site's buyer (b_) field ids. The
   address is already structured on the card, so there's no free-text
   parsing to do — just which parts go where:
     house + street + landmark → b_addr
     vtc, falling back to postoffice if vtc is blank → b_town
     district → b_dist
     state → b_state
   Always writes to the BUYER's fields regardless of whose Aadhaar was
   scanned — mirrors DOC_RULES.rc's fixed 'seller' role in field-mapping.js
   (an RC can only ever belong to the seller); here it's the buyer's side
   that RC can't supply, which is what a scanned Aadhaar QR is for. Only
   non-empty values are included, same convention as AI_FIELD_MAP. */
function aadhaarQrMapToBuyerFields(fields){
  const out={};
  if(fields.name && fields.name.trim()) out.b_name=fields.name.trim();
  const addr=aadhaarQrJoin([fields.house, fields.street, fields.landmark]);
  if(addr) out.b_addr=addr;
  const town=(fields.vtc && fields.vtc.trim()) || (fields.postoffice && fields.postoffice.trim()) || '';
  if(town) out.b_town=town;
  if(fields.district && fields.district.trim()) out.b_dist=fields.district.trim();
  if(fields.state && fields.state.trim()) out.b_state=fields.state.trim();
  return out;
}

/* Top-level entry point: raw text decoded from a QR image → either
     {ok:true, fields, mapped}
   or
     {ok:false, reason:'old-format'|'decode-error'}
   'old-format' — a real, correctly-read QR, just the pre-2018 kind that
   carries the full Aadhaar number; never extracted, see the file header.
   'decode-error' — the scanned QR isn't a Secure QR at all (not numeric,
   or numeric but not a valid gzip stream / not enough fields — e.g. the
   user scanned an unrelated QR code). Callers are expected to also handle
   a third case, 'not-found' (no QR pattern in the frame/photo at all) —
   that's detected before this function is ever called (see
   aadhaar-qr-scan.js), since it has nothing to do with what the QR *says*. */
async function decodeAadhaarSecureQr(qrText){
  const text=String(qrText||'').trim();
  if(aadhaarQrIsOldFormat(text)) return {ok:false, reason:'old-format'};
  if(!aadhaarQrLooksLikeSecureNumeric(text)) return {ok:false, reason:'decode-error'};
  let fields;
  try{
    const bytes=aadhaarQrBigIntStringToBytes(text);
    const decompressed=await aadhaarQrGunzip(bytes);
    fields=aadhaarQrParseFields(decompressed);
  }catch(e){
    return {ok:false, reason:'decode-error'};
  }
  return {ok:true, fields, mapped:aadhaarQrMapToBuyerFields(fields)};
}

if(typeof module!=='undefined' && module.exports){
  module.exports={
    AADHAAR_QR_FIELD_ORDER,
    aadhaarQrIsOldFormat,
    aadhaarQrLooksLikeSecureNumeric,
    aadhaarQrBigIntStringToBytes,
    aadhaarQrGunzip,
    aadhaarQrSplitFields,
    aadhaarQrBytesToText,
    aadhaarQrParseFields,
    aadhaarQrMapToBuyerFields,
    decodeAadhaarSecureQr
  };
}
