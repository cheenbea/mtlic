import { intToBytesLE } from './Kcdsa';
import { SID_TABLE } from './constants';
import { signAndPackageLicense } from './LicenseSigning';

// Faithful port of `licenseBySoftwareId.py::softwareIdDecode()` / `mikrotik_license/software_id.py`.
// Strips the dash separator, then decodes the remaining 8 characters as a base-35 positional
// number using MikroTik's proprietary `SID_TABLE` order (NOT the base64 alphabet, and NOT standard
// base36). The FIRST character is the lowest-order digit (35^0); the LAST character is the
// highest-order digit (35^7) - confirmed against a real-hardware-confirmed signature (see
// `constants/base35Alphabet.ts`'s doc comment for the exact vector: `VI8Q-E90F` -> `0x11DD8870BF6`).
export function softwareIdDecode(softwareId: string): bigint {
  const stripped = softwareId.replace(/-/g, '');
  const base = BigInt(SID_TABLE.length); // 35
  let ret = 0n;

  for (let i = stripped.length - 1; i >= 0; i--) {
    const index = SID_TABLE.indexOf(stripped[i]);
    if (index === -1) {
      throw new RangeError(
        `softwareIdDecode: character ${JSON.stringify(stripped[i])} at position ${i} is not in SID_TABLE`,
      );
    }
    ret = ret * base + BigInt(index);
  }

  return ret;
}

// Faithful port of `mikrotik_license/software_id.py::softwareIdEncode()` - the inverse of
// `softwareIdDecode` above. Only the low ~41 bits (8 base-35 digits) survive; higher bits are
// implicitly discarded by the loop, matching the real algorithm's behavior (0 encodes as
// `TTTT-TTTT`).
export function softwareIdEncode(val: bigint): string {
  const base = BigInt(SID_TABLE.length);
  let v = val;
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += SID_TABLE[Number(v % base)];
    v /= base;
    if (i === 3) out += '-';
  }
  return out;
}

// Faithful port of `licenseBySoftwareId.py::software_groups_byte()`. `level`/`groups` keep their
// natural-number semantics for callers (matching the Python docstring's own framing: "用户参数保持
// 自然数语义... 内部编码细节由工具负责") - only this function knows the low/high nibble packing.
export function softwareGroupsByte(level = 6, groups = 1): number {
  if (!(Number.isInteger(level) && level >= 0 && level <= 0x0f)) {
    throw new RangeError('softwareGroupsByte: level must fit in 4 bits (0..15)');
  }
  if (!(Number.isInteger(groups) && groups >= 0 && groups <= 0x0f)) {
    throw new RangeError('softwareGroupsByte: groups must fit in 4 bits (0..15)');
  }
  return (groups << 4) | level;
}

const SOFTWARE_ID_BYTE_LENGTH = 6;
const SOFTWARE_ID_UPPER_BOUND = 1n << BigInt(SOFTWARE_ID_BYTE_LENGTH * 8);

export interface LicenseFromSoftwareIdOptions {
  major?: number;
  level?: number;
  groups?: number;
  // Test-only escape hatch forwarded straight to `mikrotikKcdsaSign` (via `signAndPackageLicense`)
  // — see that function's own docstring. Never pass this in production code.
  fixedNonceSecret?: bigint;
}

// Faithful port of `licenseBySoftwareId.py::licenseGeneratorBySoftwareId()`, named
// `generateLicenseFromSoftwareId` here — sibling of `generateLicenseFromSystemId`
// (LicenseFromSystemId.ts). See that file's own top-of-file comment for why "cloud" was dropped
// from both names. Accepts softwareId already decoded (bigint) or as the human-typed `XXXX-XXXX`
// string form (decoded via `softwareIdDecode` above), matching the Python function's dual
// `str`/`int` acceptance. `major`/`level`/`groups` default to the same values as the Python CLI
// (`--major 7 --level 6 --groups 1`).
export function generateLicenseFromSoftwareId(
  softwareId: string | bigint,
  privateKey: Uint8Array,
  options: LicenseFromSoftwareIdOptions = {},
): string {
  const { major = 7, level = 6, groups = 1, fixedNonceSecret } = options;

  const id = typeof softwareId === 'string' ? softwareIdDecode(softwareId) : softwareId;
  if (id < 0n || id >= SOFTWARE_ID_UPPER_BOUND) {
    throw new RangeError(
      `generateLicenseFromSoftwareId: decoded Software-ID ${id} does not fit in ${SOFTWARE_ID_BYTE_LENGTH} bytes ` +
        `(matches Python's implicit OverflowError from int.to_bytes(${SOFTWARE_ID_BYTE_LENGTH}, 'little'))`,
    );
  }
  if (!(Number.isInteger(major) && major >= 0 && major <= 0xff)) {
    throw new RangeError('generateLicenseFromSoftwareId: major must fit in a uint8 (0..255)');
  }

  const payload = new Uint8Array(16);
  payload.set(intToBytesLE(id, SOFTWARE_ID_BYTE_LENGTH), 0);
  payload[6] = major;
  payload[7] = softwareGroupsByte(level, groups);
  // payload[8..15] left at 0 - matches the Python `+= b'\0' * 8` padding.

  return signAndPackageLicense(payload, privateKey, fixedNonceSecret);
}
