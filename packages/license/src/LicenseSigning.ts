import { encode as encodeLicensePayload } from './LicenseCipher';
import { mikrotikKcdsaSign } from './Kcdsa';
import { base64Encode } from './Base64';
import { wrapLicenseText } from './LicenseFormat';

/**
 * Shared tail of both license-generation pathways (System-ID and Software-ID): sign the 16-byte
 * plaintext payload, encrypt it with MikroTik's license cipher, concatenate ciphertext + signature,
 * base64-encode (MikroTik's custom little-endian alphabet, WITH padding — matches Python's
 * `base64Encode(raw, True)` call in both `licenseBySystemId()` and `licenseGeneratorBySoftwareId()`),
 * and wrap the result in the BEGIN/END markers.
 *
 * Extracted here because `LicenseFromSystemId.ts` and `LicenseFromSoftwareId.ts` previously
 * duplicated this exact five-step sequence byte-for-byte — the only thing that ever differs between
 * the two pathways is how the 16-byte plaintext `payload` itself gets built.
 *
 * `fixedNonceSecret` is a test-only escape hatch forwarded straight to `mikrotikKcdsaSign` — see
 * that function's own docstring. Never pass this in production code.
 */
export function signAndPackageLicense(
  payload: Uint8Array,
  privateKey: Uint8Array,
  fixedNonceSecret?: bigint,
): string {
  const sig = mikrotikKcdsaSign(payload, privateKey, fixedNonceSecret);
  const ciphertext = encodeLicensePayload(payload);

  const blob = new Uint8Array(ciphertext.length + sig.length);
  blob.set(ciphertext, 0);
  blob.set(sig, ciphertext.length);

  const base64 = base64Encode(blob, true);
  return wrapLicenseText(base64);
}
