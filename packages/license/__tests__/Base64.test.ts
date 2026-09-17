import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { base64Encode, customBase64Decode } from '../src/Base64';

// Generated straight from the Python reference (`tools/mikrotik_license/b64.py::base64Encode`)
// via `tools/venv/bin/python3`, covering lengths 0..8, 15..17, and 32/48/63/64/65 bytes with both
// pad=true and pad=false, using a seeded PRNG for reproducibility. Not hand-typed - see the
// generation script's own comment trail in this session for the exact command used.
const vectorsPath = new URL('./fixtures/base64-vectors.json', import.meta.url);
const VECTORS: { hex: string; pad: boolean; b64: string }[] = JSON.parse(
  readFileSync(vectorsPath, 'utf8'),
);

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

describe('base64Encode matches the Python reference byte-for-byte', () => {
  it('loaded a non-trivial vector set covering both pad=true and pad=false', () => {
    expect(VECTORS.length).toBeGreaterThan(10);
    expect(VECTORS.some((v) => v.pad)).toBe(true);
    expect(VECTORS.some((v) => !v.pad)).toBe(true);
  });

  for (const { hex, pad, b64 } of VECTORS) {
    it(`encodes ${JSON.stringify(hex)} (pad=${pad}) as ${JSON.stringify(b64)}`, () => {
      expect(base64Encode(hexToBytes(hex), pad)).toBe(b64);
    });
  }
});

describe('customBase64Decode is the exact inverse of base64Encode', () => {
  for (const { hex, b64 } of VECTORS) {
    it(`round-trips ${JSON.stringify(hex)} through encode(pad) -> decode`, () => {
      expect(Array.from(customBase64Decode(b64))).toEqual(Array.from(hexToBytes(hex)));
    });
  }

  it('rejects a character outside the alphabet', () => {
    expect(() => customBase64Decode('!!!!')).toThrow(RangeError);
  });
});

describe('custom base64 differs from standard base64 (this is the whole point of the port)', () => {
  it('produces different output than Buffer.toString("base64") for the same non-trivial bytes', () => {
    const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    const custom = base64Encode(bytes);
    const standard = Buffer.from(bytes).toString('base64').replace(/=+$/, '');
    expect(custom).not.toBe(standard);
  });
});
