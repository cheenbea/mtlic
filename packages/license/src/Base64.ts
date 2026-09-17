import { BASE64_ALPHABET } from './constants';

// Faithful port of `tools/mikrotik_license/b64.py::base64Encode()`. This is NOT standard base64:
// the real keygen packs bits in a little-endian order that happens to share the same 64-character
// alphabet as standard base64 (see constants/base64Alphabet.ts), but produces different output for the same
// bytes because the bit-grouping order differs. Using `Buffer.toString('base64')` here (as this
// project originally did before this file existed) produces syntactically plausible but WRONG
// output that a real RouterOS instance would reject - this was a confirmed bug in the Python port
// too, documented in b64.py's own module docstring, before this exact algorithm was recovered.
export function base64Encode(data: Uint8Array, pad = false): string {
  let encoded = '';
  let left = 0;
  for (let i = 0; i < data.length; i++) {
    if (left === 0) {
      encoded += BASE64_ALPHABET[data[i] & 0x3f];
      left = 2;
    } else if (left === 6) {
      encoded += BASE64_ALPHABET[data[i - 1] >> 2];
      encoded += BASE64_ALPHABET[data[i] & 0x3f];
      left = 2;
    } else {
      const index1 = data[i - 1] >> (8 - left);
      const index2 = data[i] << left;
      encoded += BASE64_ALPHABET[(index1 | index2) & 0x3f];
      left += 2;
    }
  }

  if (left !== 0) {
    encoded += BASE64_ALPHABET[data[data.length - 1] >> (8 - left)];
  }

  if (pad) {
    const padLength = (4 - (encoded.length % 4)) % 4;
    encoded += '='.repeat(padLength);
  }

  return encoded;
}

// Faithful port of `tools/mikrotik_license/b64.py::custom_b64decode()` - the inverse of
// `base64Encode()` above. Not currently called anywhere in production code (license *generation*
// only ever encodes), but kept alongside its encoder as the exact counterpart so a future decode
// path (e.g. re-deriving hdr+signature bytes from a pasted license, mirroring
// `verify_license.py`'s use of it on the Python side) doesn't have to re-derive the bit-unpacking
// order from scratch, and so this file's own round-trip tests can validate the encoder against
// something other than itself.
export function customBase64Decode(s: string): Uint8Array {
  const trimmed = s.trim().replace(/=+$/, '');
  let val = 0n;
  let bits = 0n;
  const out: number[] = [];
  for (const ch of trimmed) {
    const v = BASE64_ALPHABET.indexOf(ch);
    if (v === -1) {
      throw new RangeError(
        `customBase64Decode: character ${JSON.stringify(ch)} is not in BASE64_ALPHABET`,
      );
    }
    val |= BigInt(v) << bits;
    bits += 6n;
    while (bits >= 8n) {
      out.push(Number(val & 0xffn));
      val >>= 8n;
      bits -= 8n;
    }
  }
  return new Uint8Array(out);
}
