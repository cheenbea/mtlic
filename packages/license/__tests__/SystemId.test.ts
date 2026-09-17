import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { systemIdDecode, systemIdEncode, SYSTEM_ID_LENGTH } from '../src/SystemId';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Every vector here is exactly 11 characters - regenerated directly from the real Python
// `systemIdDecode()`/`systemIdEncode()` (tools/scripts/licenseBySystemId.py), which is the only
// length the real system ever produces or accepts. An earlier version of this fixture file used
// arbitrary lengths (0, 1, 2, 5, 10, 20, 40) to test the raw base-64 arithmetic in isolation - that
// tested a superset of what the real decode function does, since the real one rejects every one of
// those lengths outright, so it silently never exercised the length check at all.
const vectors = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/system-id-vectors.json'), 'utf-8'),
) as { system_id: string; expected_decimal_string: string }[];

describe('systemIdDecode matches Python systemIdDecode (11-char vectors only)', () => {
  it('every fixture vector is exactly 11 characters (the only length the real system accepts)', () => {
    for (const { system_id } of vectors) {
      expect(system_id.length).toBe(SYSTEM_ID_LENGTH);
    }
  });

  for (const { system_id, expected_decimal_string } of vectors) {
    it(`decodes ${JSON.stringify(system_id)} to match Python`, () => {
      expect(systemIdDecode(system_id).toString()).toBe(expected_decimal_string);
    });
  }

  it('exceeds Number.MAX_SAFE_INTEGER for a real-length id (proves BigInt is required)', () => {
    // Any full-width 11-char id can already exceed 2**53-1 - no need for an out-of-format length
    // to prove this, unlike the previous version of this test.
    const bigCase = vectors.find(
      (v) => BigInt(v.expected_decimal_string) > BigInt(Number.MAX_SAFE_INTEGER),
    );
    expect(bigCase).toBeDefined();
    const result = systemIdDecode(bigCase!.system_id);
    expect(result > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(result.toString()).toBe(bigCase!.expected_decimal_string);
  });

  it('throws on a character outside BASE64_ALPHABET, matching Python raising ValueError', () => {
    expect(() => systemIdDecode('A B'.padEnd(SYSTEM_ID_LENGTH, 'A'))).toThrow(RangeError);
    expect(() => systemIdDecode('café'.padEnd(SYSTEM_ID_LENGTH, 'A'))).toThrow(RangeError);
    expect(() => systemIdDecode('A\t'.padEnd(SYSTEM_ID_LENGTH, 'A'))).toThrow(RangeError);
  });

  // The real System-ID format is a fixed 11 characters (8 bytes -> 10 full 6-bit digits + one
  // 4-bit digit); the real Python `systemIdDecode()` raises ValueError for every other length
  // instead of accepting it, so these must be rejected here too rather than silently decoded.
  it.each([0, 1, 2, 5, 10, 12, 20, 40])(
    'throws RangeError for a %i-character string (real System-IDs are always exactly 11 chars)',
    (length) => {
      const input = 'A'.repeat(length);
      expect(() => systemIdDecode(input)).toThrow(RangeError);
    },
  );

  // 2**64 - the value is only reachable when the 11th (most-significant) character's table index
  // is >= 16 - matches Python's `ret >= 1 << 64` check on the same construction.
  it('throws RangeError when the last character pushes the value to or past 2**64', () => {
    expect(() => systemIdDecode('AAAAAAAAAAQ')).toThrow(RangeError); // 'Q' has index 16
    expect(() => systemIdDecode('AAAAAAAAAAP')).not.toThrow(); // 'P' has index 15, still < 16
  });
});

describe('systemIdEncode is the exact inverse of systemIdDecode', () => {
  it('round-trips every fixture vector: encode(decode(id)) === id', () => {
    for (const { system_id } of vectors) {
      const decoded = systemIdDecode(system_id);
      expect(systemIdEncode(decoded)).toBe(system_id);
    }
  });

  it('round-trips every fixture vector the other way: decode(encode(value)) === value', () => {
    for (const { expected_decimal_string } of vectors) {
      const value = BigInt(expected_decimal_string);
      expect(systemIdDecode(systemIdEncode(value))).toBe(value);
    }
  });

  it('encodes the 0 and 2**64-1 boundary values', () => {
    expect(systemIdEncode(0n)).toBe('AAAAAAAAAAA');
    expect(systemIdEncode((1n << 64n) - 1n)).toBe('//////////P');
  });

  it('throws RangeError outside [0, 2**64)', () => {
    expect(() => systemIdEncode(-1n)).toThrow(RangeError);
    expect(() => systemIdEncode(1n << 64n)).toThrow(RangeError);
  });
});
