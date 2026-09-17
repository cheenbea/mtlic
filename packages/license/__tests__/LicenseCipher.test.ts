import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { encode, rotl, to32bits } from '../src/LicenseCipher';

interface Vector {
  input_hex: string;
  output_hex: string;
}

const vectorsPath = new URL('./fixtures/mikrotik-license-vectors.json', import.meta.url);
const vectors: Vector[] = JSON.parse(readFileSync(vectorsPath, 'utf8'));

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('LicenseCipher.encode matches the Python reference implementation', () => {
  it(`loaded a non-trivial vector set`, () => {
    expect(vectors.length).toBeGreaterThan(1000);
  });

  it(`matches all ${vectors.length} Python-generated vectors byte-for-byte`, () => {
    const failures: string[] = [];
    for (const vector of vectors) {
      const output = bytesToHex(encode(hexToBytes(vector.input_hex)));
      if (output !== vector.output_hex) {
        failures.push(`input ${vector.input_hex}: expected ${vector.output_hex}, got ${output}`);
      }
    }
    expect(
      failures.slice(0, 10),
      `${failures.length}/${vectors.length} vectors mismatched`,
    ).toEqual([]);
  });

  it('matches the all-zero edge case', () => {
    const allZeroHex = bytesToHex(new Uint8Array(16));
    const vector = vectors.find((v) => v.input_hex === allZeroHex);
    expect(vector).toBeDefined();
    expect(bytesToHex(encode(hexToBytes(vector!.input_hex)))).toBe(vector!.output_hex);
  });

  it('matches the all-0xFF edge case', () => {
    const allFFHex = bytesToHex(new Uint8Array(16).fill(0xff));
    const vector = vectors.find((v) => v.input_hex === allFFHex);
    expect(vector).toBeDefined();
    expect(bytesToHex(encode(hexToBytes(vector!.input_hex)))).toBe(vector!.output_hex);
  });

  it('rejects input whose length is not a multiple of 4 bytes', () => {
    expect(() => encode(new Uint8Array(15))).toThrow(RangeError);
  });
});

describe('to32bits', () => {
  it('wraps values >= 2^32 down to an unsigned 32-bit range', () => {
    expect(to32bits(0x1_0000_0005)).toBe(5);
  });

  it('never returns a negative number for values >= 2^31', () => {
    expect(to32bits(0xffffffff)).toBe(0xffffffff);
    expect(Object.is(to32bits(0xffffffff), -1)).toBe(false);
  });

  it("wraps a negative subtraction result the same way Python's `& 0xFFFFFFFF` does", () => {
    expect(to32bits(5 - 10)).toBe(0xfffffffb);
  });
});

describe('rotl', () => {
  it('rotate by 0 is the identity', () => {
    expect(rotl(0x12345678, 0)).toBe(0x12345678);
  });

  it('rotates bits left and wraps the overflow into the low bits', () => {
    expect(rotl(0x80000001, 1)).toBe(0x00000003);
  });

  it('matches the standard rotl for a mid-range shift', () => {
    expect(rotl(0x12345678, 8)).toBe(0x34567812);
  });
});
