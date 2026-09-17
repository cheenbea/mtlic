// Public surface of @mtlic/license. Deliberately NOT a blanket `export *` across every source
// file: this only re-exports what a consumer (apps/web today) actually needs to build/sign a
// license and interpret the license-type/deadline rules. Low-level crypto internals (Kcdsa's curve
// arithmetic, LicenseCipher's block-cipher round functions, the raw secret constants) stay
// import-by-path within this package (and its own __tests__), not part of the package's public API
// - see each source file for the deliberate reasons those stay unexported here.
export { generateLicenseFromSystemId } from './LicenseFromSystemId';
export {
  generateLicenseFromSoftwareId,
  softwareIdDecode,
  softwareIdEncode,
  softwareGroupsByte,
  type LicenseFromSoftwareIdOptions,
} from './LicenseFromSoftwareId';
export {
  computeDeadline,
  LICENSE_DEADLINE_PERMANENT,
  TRIAL_DEFAULT_DAYS,
  SUBSCRIPTION_DEFAULT_DAYS,
  type LicenseType,
} from './LicenseDeadline';
export { LICENSE_HEADER, LICENSE_FOOTER } from './LicenseFormat';
export { systemIdDecode, systemIdEncode, SYSTEM_ID_LENGTH } from './SystemId';
