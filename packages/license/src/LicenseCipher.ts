import { MIKROTIK_KEY } from './constants';

// JS's `&` converts both operands via ToInt32 and returns a signed result, so `x & 0xFFFFFFFF` turns
// values >= 2^31 negative — unlike Python's arbitrary-precision `&`, which stays non-negative. `>>> 0`
// (ToUint32) is the correct equivalent; using `&` here would diverge from the Python implementation
// and throw once a word is written out as an unsigned 32-bit value.
export function to32bits(x: number): number {
  return x >>> 0;
}

export function rotl(x: number, n: number): number {
  x = x >>> 0;
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

/**
 * Port of MikroTik's Python license-payload cipher. Faithful line-for-line translation, including the
 * in-place word mutation order within each round — later sub-steps in the same round read words
 * already updated by earlier sub-steps in that same round, so reordering or "purifying" this into a
 * pure round function breaks compatibility with licenses issued by the Python implementation.
 */
export function encode(input: Uint8Array): Uint8Array {
  // Matches Python's exact `len(data) != 16` check, not just "a multiple of 4": every round below
  // indexes with `% 4`, so this only ever touches 4 words regardless of how many were passed in -
  // a looser "multiple of 4" check would accept e.g. 32 bytes, silently leave words 4+ untouched,
  // and return a result that looks plausible but is simply wrong for anything but exactly 16 bytes.
  if (input.byteLength !== 16) {
    throw new RangeError(`encode: input length must be exactly 16 bytes, got ${input.byteLength}`);
  }

  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const wordCount = input.byteLength / 4;
  const s: number[] = new Array(wordCount);
  for (let w = 0; w < wordCount; w++) {
    s[w] = view.getUint32(w * 4, false);
  }

  for (let i = 15; i >= 0; i--) {
    s[(i + 0) % 4] = to32bits(
      rotl(s[(i + 3) % 4], MIKROTIK_KEY[i * 4 + 3] & 0x0f) ^
        to32bits(s[(i + 0) % 4] - s[(i + 3) % 4]),
    );
    s[(i + 3) % 4] = to32bits(s[(i + 3) % 4] + s[(i + 1) % 4] + MIKROTIK_KEY[i * 4 + 3]);

    s[(i + 1) % 4] = to32bits(
      rotl(s[(i + 2) % 4], MIKROTIK_KEY[i * 4 + 2] & 0x0f) ^
        to32bits(s[(i + 1) % 4] - s[(i + 2) % 4]),
    );
    s[(i + 0) % 4] = to32bits(s[(i + 0) % 4] + s[(i + 2) % 4] + MIKROTIK_KEY[i * 4 + 2]);

    s[(i + 2) % 4] = to32bits(
      rotl(s[(i + 1) % 4], MIKROTIK_KEY[i * 4 + 1] & 0x0f) ^
        to32bits(s[(i + 2) % 4] - s[(i + 1) % 4]),
    );
    s[(i + 1) % 4] = to32bits(s[(i + 1) % 4] + s[(i + 3) % 4] + MIKROTIK_KEY[i * 4 + 1]);

    s[(i + 3) % 4] = to32bits(
      rotl(s[(i + 0) % 4], MIKROTIK_KEY[i * 4 + 0] & 0x0f) ^
        to32bits(s[(i + 3) % 4] - s[(i + 0) % 4]),
    );
    s[(i + 2) % 4] = to32bits(s[(i + 2) % 4] + s[(i + 0) % 4] + MIKROTIK_KEY[i * 4 + 0]);
  }

  const output = new Uint8Array(s.length * 4);
  const outView = new DataView(output.buffer);
  for (let w = 0; w < s.length; w++) {
    outView.setUint32(w * 4, s[w], false);
  }
  return output;
}

/**
 * The exact inverse of `encode()` (Python's `decode()`). Lets `verify_license.py`-equivalent code
 * recover the real 16-byte plaintext payload directly from a captured license's `hdr` bytes,
 * without needing to know or guess the System-ID/Software-ID that produced it. Derived
 * algebraically from `encode()` (see cipher.py's own docstring: validated against real CHR test
 * vectors plus 2000+ random 16-byte round-trip vectors on the Python side).
 */
export function decode(input: Uint8Array): Uint8Array {
  if (input.byteLength !== 16) {
    throw new RangeError(`decode: input length must be exactly 16 bytes, got ${input.byteLength}`);
  }

  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const s: number[] = [
    view.getUint32(0, false),
    view.getUint32(4, false),
    view.getUint32(8, false),
    view.getUint32(12, false),
  ];

  for (let i = 0; i < 16; i++) {
    const a = i % 4;
    const b = (i + 1) % 4;
    const c = (i + 2) % 4;
    const d = (i + 3) % 4;
    const k0 = MIKROTIK_KEY[i * 4 + 0];
    const k1 = MIKROTIK_KEY[i * 4 + 1];
    const k2 = MIKROTIK_KEY[i * 4 + 2];
    const k3 = MIKROTIK_KEY[i * 4 + 3];
    const a2 = s[a];
    const b2 = s[b];
    const c2 = s[c];
    const d2 = s[d];

    const c1 = to32bits(c2 - a2 - k0);
    const d1 = to32bits(a2 + (rotl(a2, k0 & 0x0f) ^ d2));

    const b1 = to32bits(b2 - d1 - k1);
    const c0 = to32bits(b1 + (rotl(b1, k1 & 0x0f) ^ c1));

    const a1 = to32bits(a2 - c0 - k2);
    const b0 = to32bits(c0 + (rotl(c0, k2 & 0x0f) ^ b1));

    const d0 = to32bits(d1 - b0 - k3);
    const a0 = to32bits(d0 + (rotl(d0, k3 & 0x0f) ^ a1));

    s[a] = a0;
    s[b] = b0;
    s[c] = c0;
    s[d] = d0;
  }

  const output = new Uint8Array(16);
  const outView = new DataView(output.buffer);
  outView.setUint32(0, s[0], false);
  outView.setUint32(4, s[1], false);
  outView.setUint32(8, s[2], false);
  outView.setUint32(12, s[3], false);
  return output;
}
