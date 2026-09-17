import { intToBytesLE } from './Kcdsa';
import { systemIdDecode } from './SystemId';
import { signAndPackageLicense } from './LicenseSigning';

// Faithful port of the Python `cloud(systemId, private_key)` license generator, named
// `generateLicenseFromSystemId` here — not `cloud`, and not `cloudFromSystemId` (an earlier name
// that carried the Python source's internal jargon straight into the public API without explaining
// it) — because what this function actually does, unambiguously, is build, sign, and text-encode
// one MikroTik CHR license from a System-ID. Sits alongside its sibling pathway
// `generateLicenseFromSoftwareId` (LicenseFromSoftwareId.ts). Accepts systemId already decoded
// (bigint) or as the human-typed string form (decoded via the already-ported `systemIdDecode`),
// matching the Python function's dual `str`/`int` acceptance.
//
// `fixedNonceSecret` is a test-only escape hatch forwarded straight to `mikrotikKcdsaSign` (via
// `signAndPackageLicense`) — see that function's own docstring. Never pass this in production code.
export function generateLicenseFromSystemId(
  systemId: string | bigint,
  privateKey: Uint8Array,
  deadline: bigint,
  level: number,
  fixedNonceSecret?: bigint,
): string {
  const id = typeof systemId === 'string' ? systemIdDecode(systemId) : systemId;

  const payload = new Uint8Array(16);
  payload.set(intToBytesLE(id, 8), 0);
  payload.set(intToBytesLE(deadline, 4), 8);
  payload[12] = level;
  // payload[13..15] left at 0 — matches the Python `+= b'\0'*3` padding.

  return signAndPackageLicense(payload, privateKey, fixedNonceSecret);
}
