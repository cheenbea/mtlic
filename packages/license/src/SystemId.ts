import { BASE64_ALPHABET } from './constants';

// A real System-ID is always exactly 11 characters: it encodes a 64-bit integer as eleven
// base-64-ish digits (10 full 6-bit digits + one digit that only ever uses its low 4 bits, since
// 10*6 + 4 = 64). This is not a UI-level nicety - it's a hard property of the format itself
// (confirmed against the real Python `systemIdDecode()`, which raises `ValueError` for any other
// length), so both `systemIdDecode()` and `systemIdEncode()` enforce it rather than silently
// accepting arbitrary-length strings the real system could never produce or parse.
export const SYSTEM_ID_LENGTH = 11;
// 2**64, exclusive upper bound - the real system's counterpart check is `ret >= 1 << 64` in
// Python, which is the same bound expressed the other way around (`ret < UPPER_BOUND`).
const SYSTEM_ID_UPPER_BOUND = 1n << 64n;

export function systemIdDecode(systemId: string): bigint {
  if (systemId.length !== SYSTEM_ID_LENGTH) {
    throw new RangeError(
      `systemIdDecode: System ID must be exactly ${SYSTEM_ID_LENGTH} characters, got ${systemId.length}`,
    );
  }

  const base = BigInt(BASE64_ALPHABET.length);
  let ret = 0n;

  for (let i = systemId.length - 1; i >= 0; i--) {
    const index = BASE64_ALPHABET.indexOf(systemId[i]);

    if (index === -1) {
      throw new RangeError(
        `systemIdDecode: character ${JSON.stringify(systemId[i])} at position ${i} is not in BASE64_ALPHABET`,
      );
    }

    ret = ret * base + BigInt(index);
  }

  // Only reachable via the last (most significant) character carrying a value >= 16 - the real
  // system's decode loop has no way to produce a result >= 2**64 for any OTHER reason once the
  // length check above holds, since 10 full 6-bit digits already account for 60 of the 64 bits.
  if (ret >= SYSTEM_ID_UPPER_BOUND) {
    throw new RangeError(
      `systemIdDecode: value ${ret} exceeds the 64-bit range (the last character's index must be < 16)`,
    );
  }

  return ret;
}

// Inverse of systemIdDecode(): re-encodes a 64-bit integer back into its 11-character System-ID
// form. Faithful port of the Python `systemIdEncode()` companion function - the first 10
// characters each carry a full 6-bit digit (least-significant first, matching systemIdDecode()'s
// own little-endian character order), and the 11th/last character carries only the remaining top
// 4 bits, which is exactly why systemIdDecode() must reject any decoded value >= 2**64 above.
export function systemIdEncode(value: bigint): string {
  if (value < 0n || value >= SYSTEM_ID_UPPER_BOUND) {
    throw new RangeError(`systemIdEncode: value must be in [0, 2**64), got ${value}`);
  }

  let chars = '';
  let v = value;
  for (let i = 0; i < 10; i++) {
    chars += BASE64_ALPHABET[Number(v & 0x3fn)];
    v >>= 6n;
  }
  chars += BASE64_ALPHABET[Number(v & 0x0fn)];
  return chars;
}
