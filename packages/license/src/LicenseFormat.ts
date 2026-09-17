// Shared between both license-generation pathways (System-ID and Software-ID) - ported from
// `tools/mikrotik_license/constants.py`, which is the single source both Python generators
// (`licenseBySystemId.py`, `licenseBySoftwareId.py`) import these from. Kept in one place here too
// rather than duplicated per pathway, for the same reason: if these markers were ever wrong, both
// pathways must be wrong identically rather than risk drifting apart via two transcriptions.
// Byte-for-byte confirmed against the Python constants (44 characters each, including dash counts).
export const LICENSE_HEADER = '-----BEGIN MIKROTIK SOFTWARE KEY------------';
export const LICENSE_FOOTER = '-----END MIKROTIK SOFTWARE KEY--------------';

// Wraps an already-base64-encoded license blob in the header/footer markers, splitting the base64
// payload across two lines at its midpoint - faithful port of the tail shared identically by both
// Python generators: `LICENSE_HEADER + '\n' + lic[:len(lic)//2] + '\n' + lic[len(lic)//2:] + '\n' +
// LICENSE_FOOTER`. `lic[:n]+lic[n:] == lic` for any split point, so this is just "insert a newline
// at the midpoint", not a meaningful transformation of the payload itself.
export function wrapLicenseText(base64Payload: string): string {
  const half = Math.floor(base64Payload.length / 2);
  const partA = base64Payload.slice(0, half);
  const partB = base64Payload.slice(half);
  return `${LICENSE_HEADER}\n${partA}\n${partB}\n${LICENSE_FOOTER}\n`;
}
