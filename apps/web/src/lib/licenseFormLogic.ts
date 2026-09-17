// Pure, framework-agnostic logic for the license form: types, defaults, formatting, and
// validation rules. Nothing in this file touches React or a TanStack Form field object - anything
// that does (change-handler factories, JSX field renderers) lives in
// ../components/license-form/ instead. That split is deliberate: everything here is a plain
// function of its inputs, so it's straightforward to unit-test in isolation from the form/DOM.
import { TRIAL_DEFAULT_DAYS, SUBSCRIPTION_DEFAULT_DAYS, type LicenseType } from '@mtlic/license';

export type IdMode = 'systemId' | 'softwareId';

export interface LevelOption {
  value: number;
  label: string;
}

export interface FormValues {
  privateKey: string;
  systemId: string;
  licenseType: LicenseType;
  days: number;
  level: number;
  features: number;
}

export type CopyStatus = 'idle' | 'copied' | 'failed';

// UI-only sentinel for the `days` FORM FIELD when licenseType is "permanent" (so the days input
// can show something meaningful and validateDays/daysForLicenseType have a value to key
// off) - distinct from LicenseDeadline.ts's LICENSE_DEADLINE_PERMANENT, which is the actual
// 0xFFFFFFFF value baked into the generated license bytes. Don't confuse the two.
export const PERMANENT_DAYS_SENTINEL = -1;
export const MIN_SUBSCRIPTION_DAYS = 60;

// Hex convention: uppercase for display. This is Telegram user @asaki_vip's own private key,
// provided directly by them - it is NOT the "elseif" patch private key this constant previously
// held. That old key's provenance notes (public key, byte-order, and the external research
// document they referenced) were specific to that old value and do not carry over to this one;
// none of that is re-documented here because none of it is actually true of this key.
// No independently-verified public key or byte-order cross-check exists yet for this value - if
// one becomes available, record it here. bytesToIntLE() reads this hex string directly as
// little-endian bytes with no reversal, so a byte-order-swapped form of this same scalar would
// silently decode to a different, untrusted keypair - the exact mechanism that caused a real bug
// with the old key - so don't substitute an alternate representation of this value without
// confirming its byte order first.
export const DEFAULT_PRIVATE_KEY_HEX =
  '9DBC845E9018537810FDAE62824322EEE1B12BAD81FCA28EC295FB397C61CE0B';

// Level's valid values and labels depend on which ID mode is active - the two option sets don't
// overlap, so switching idMode must also reset the `level` form field (see
// createIdModeSelectHandler) or a stale value from one mode's set could linger as an invalid
// selection under the other mode's rendered options.
//
// System-ID's byte values: `P-Unlimited = 3` is confirmed against real hardware (the real,
// user-verified `eJq8zK/UrhN` p-unlimited CHR license sample - see
// cases/system-id/user_valid_ejq8_material_1074_419a/ and
// 04_SystemID真实样本与案例索引.md §4 - decodes to `level = 03`). `P1 = 1` and `P10 = 2` are
// user-confirmed (matching CHR's own tier names from RouterOS's REST API - see
// help.mikrotik.com's Cloud Hosted Router docs). `Free = 0` is the one remaining inference (no
// direct sample; RouterOS's REST API just omits the `level` field entirely for an unregistered/
// free CHR rather than confirming it's byte value 0) - all four replace a previous, entirely
// unverified `{0: P-Unlimited, 1: P1, 2: P10}` guess (a real bug found this way: 0 was never
// confirmed to mean P-Unlimited - it's actually Free).
export const SYSTEM_ID_LEVEL_OPTIONS: LevelOption[] = [
  { value: 0, label: 'Free' },
  { value: 1, label: 'P1' },
  { value: 2, label: 'P10' },
  { value: 3, label: 'P-Unlimited' },
];
export const SOFTWARE_ID_LEVEL_OPTIONS: LevelOption[] = [
  { value: 3, label: 'P3' },
  { value: 4, label: 'P4' },
  { value: 5, label: 'P5' },
  { value: 6, label: 'P6' },
];

export function levelOptionsForMode(idMode: IdMode): LevelOption[] {
  return idMode === 'softwareId' ? SOFTWARE_ID_LEVEL_OPTIONS : SYSTEM_ID_LEVEL_OPTIONS;
}

export function defaultLevelForMode(idMode: IdMode): number {
  // Both modes default to their highest/most-capable tier rather than the first option in the
  // dropdown list: Software ID defaults to P6, System ID defaults to P-Unlimited (matching
  // licenseBySystemId.py's own `--level 3` CLI default) - not the dropdown's first entry, which
  // is Free/P3 respectively.
  if (idMode === 'softwareId') {
    return SOFTWARE_ID_LEVEL_OPTIONS[SOFTWARE_ID_LEVEL_OPTIONS.length - 1].value;
  }
  return SYSTEM_ID_LEVEL_OPTIONS[SYSTEM_ID_LEVEL_OPTIONS.length - 1].value;
}

// Software-ID's `license[7]` byte (see licenseBySoftwareId.py's `software_groups_byte()` /
// @mtlic/license's `softwareGroupsByte()`) packs two independent 4-bit
// natural-number fields: `level` (shared dropdown above, low nibble) and `groups` (high nibble).
// The reference generator names the *whole packed byte* "features"; this `features` FIELD is only
// the second, previously-hardcoded-to-1 nibble, surfaced under that same name so the UI has one
// control per nibble instead of hiding `groups` entirely - `level` and `features` combine
// (`softwareGroupsByte(level, features)`) to produce that one packed byte.
export const SOFTWARE_ID_FEATURES_DEFAULT = 1;
export const SOFTWARE_ID_FEATURES_MIN = 0;
export const SOFTWARE_ID_FEATURES_MAX = 0x0f;

export const SYSTEM_ID_LENGTH = 11;
export const SYSTEM_ID_PATTERN = /^[0-9a-zA-Z+/]+$/;
export const SOFTWARE_ID_PATTERN = /^[0-9A-Z]{4}-[0-9A-Z]{4}$/;
export const SOFTWARE_ID_GROUP_LENGTH = 4;
export const SOFTWARE_ID_RAW_LENGTH = SOFTWARE_ID_GROUP_LENGTH * 2;

// Shareable-URL query params - one key per pre-fillable field, parsed by the route's
// `validateSearch` (see routes/index.tsx) and passed in as `initialSearch`. Every field is
// optional and falls back to this component's own normal default the moment it's missing OR
// fails its own validation (out-of-range level/features, unrecognized `type`, etc.) - a malformed
// or partial query string degrades to "as if that param weren't given" rather than throwing or
// producing a form the user can't see was silently coerced.
export interface LicenseGeneratorSearch {
  privateKey?: string;
  level?: number;
  softwareId?: string;
  features?: number;
  systemId?: string;
  type?: string;
  days?: number;
}

// `softwareId` and `systemId` are mutually exclusive mode selectors as well as value carriers -
// whichever one is present in the query string picks the initial idMode (matching the same field
// name the rest of the form already renders for that mode). Neither present keeps this app's
// existing default (Software ID, matching the `idMode` useState's own default in
// LicenseGenerator.tsx).
export function initialIdModeFromSearch(search: LicenseGeneratorSearch): IdMode {
  if (search.softwareId !== undefined) return 'softwareId';
  if (search.systemId !== undefined) return 'systemId';
  return 'softwareId';
}

function parseLicenseTypeParam(value: string | undefined): LicenseType | undefined {
  return value === 'permanent' || value === 'subscription' || value === 'trial' ? value : undefined;
}

export function clampIntOr(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isInteger(value) || value < min || value > max) {
    return fallback;
  }
  return value;
}

export function daysForLicenseType(licenseType: LicenseType): number {
  if (licenseType === 'trial') return TRIAL_DEFAULT_DAYS;
  if (licenseType === 'permanent') return PERMANENT_DAYS_SENTINEL;
  return SUBSCRIPTION_DEFAULT_DAYS;
}

export function initialFormValuesFromSearch(
  search: LicenseGeneratorSearch,
  idMode: IdMode,
): FormValues {
  const licenseType = parseLicenseTypeParam(search.type) ?? 'permanent';
  const idValue = idMode === 'softwareId' ? search.softwareId : search.systemId;
  const levelOptions = levelOptionsForMode(idMode);
  const levelFallback = defaultLevelForMode(idMode);
  const level =
    search.level !== undefined && levelOptions.some((option) => option.value === search.level)
      ? search.level
      : levelFallback;
  return {
    privateKey: (search.privateKey?.trim() || DEFAULT_PRIVATE_KEY_HEX).toUpperCase(),
    systemId: idValue ?? '',
    licenseType,
    days: clampIntOr(
      search.days,
      Number.MIN_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      daysForLicenseType(licenseType),
    ),
    level,
    features: clampIntOr(
      search.features,
      SOFTWARE_ID_FEATURES_MIN,
      SOFTWARE_ID_FEATURES_MAX,
      SOFTWARE_ID_FEATURES_DEFAULT,
    ),
  };
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length === 0 || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error('Private key must be a hex string with an even number of digits');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function validatePrivateKeyHex({ value }: { value: string }): string | undefined {
  if (!value.trim()) return 'Private key is required';
  try {
    const bytes = hexToBytes(value);
    if (bytes.length !== 32) {
      return `Private key must be 32 bytes (64 hex chars), got ${bytes.length} bytes`;
    }
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  return undefined;
}

// Hex convention used throughout the Python reference tooling: uppercase for
// display, case-insensitive on input. Uppercasing as the user types (rather than only at submit
// time) keeps what's on screen consistent with every generated/copied license's hex the moment
// it's typed, instead of showing the user's own mixed/lowercase keystrokes until they submit.
// Also strips non-hex characters, matching the reference generator's own private-key input
// handler (`replace(/[^a-fA-F0-9]/g, '').toUpperCase()`) - pasting a key with stray whitespace or
// separators cleans up automatically instead of tripping validatePrivateKeyHex()'s format check.
export function formatPrivateKeyInput(raw: string): string {
  return raw.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

export function createIdValidator(idMode: IdMode) {
  return function validateId({ value }: { value: string }): string | undefined {
    const trimmed = value.trim();
    if (idMode === 'softwareId') {
      if (!trimmed) return 'Software ID is required';
      return SOFTWARE_ID_PATTERN.test(trimmed)
        ? undefined
        : 'Software ID must match XXXX-XXXX (uppercase letters and digits)';
    }
    if (!trimmed) return 'System ID is required';
    if (trimmed.length !== SYSTEM_ID_LENGTH) {
      return `System ID must be ${SYSTEM_ID_LENGTH} characters, got ${trimmed.length}`;
    }
    return SYSTEM_ID_PATTERN.test(trimmed)
      ? undefined
      : 'System ID must contain only letters, digits, + or /';
  };
}

// Auto-inserts the '-' at the XXXX-XXXX midpoint as the user types, matching the reference
// generator's Software ID field behavior: typing a 5th alphanumeric character pushes the dash in
// ahead of it rather than requiring the user to type it themselves. Re-derived from the raw
// alphanumeric characters (stripping any dash the user typed or that a previous render already
// inserted) on every keystroke, rather than trying to patch the previous string in place - that
// makes pasting a full "XXXX-XXXX" or an undashed "XXXXXXXX" behave identically, and keeps this
// idempotent (formatting an already-formatted value is a no-op) instead of accumulating drift.
export function formatSoftwareIdInput(raw: string): string {
  const alnum = raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, SOFTWARE_ID_RAW_LENGTH);
  if (alnum.length <= SOFTWARE_ID_GROUP_LENGTH) return alnum;
  return `${alnum.slice(0, SOFTWARE_ID_GROUP_LENGTH)}-${alnum.slice(SOFTWARE_ID_GROUP_LENGTH)}`;
}

// Reads `licenseType` live from the form store via `fieldApi.form.getFieldValue(...)` at
// validation time, rather than taking it as a curried parameter captured from a render-time
// closure. That distinction matters: `handleLicenseTypeChange` calls `setFieldValue("licenseType",
// nextType)` immediately followed by `setFieldValue("days", ...)` in the same event handler,
// before React re-renders - a curried `createDaysValidator(field.state.value)` would still be
// bound to the OLD licenseType at that point (this render hasn't happened yet), so switching
// subscription -> permanent would validate the new `days: -1` sentinel against the stale "must be
// a subscription" branch and wrongly report "Days must be at least 60" - a real bug found this
// way. Reading the form store directly sidesteps the render-order dependency entirely.
export function validateDays({
  value,
  fieldApi,
}: {
  value: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fieldApi: { form: { getFieldValue: (name: string) => any } };
}): string | undefined {
  const licenseType = fieldApi.form.getFieldValue('licenseType') as LicenseType;
  if (licenseType !== 'subscription') return undefined;
  return value < MIN_SUBSCRIPTION_DAYS
    ? `Days must be at least ${MIN_SUBSCRIPTION_DAYS} for a subscription license`
    : undefined;
}

export function validateFeatures({ value }: { value: number }): string | undefined {
  if (
    !Number.isInteger(value) ||
    value < SOFTWARE_ID_FEATURES_MIN ||
    value > SOFTWARE_ID_FEATURES_MAX
  ) {
    return `Features must be an integer between ${SOFTWARE_ID_FEATURES_MIN} and ${SOFTWARE_ID_FEATURES_MAX}`;
  }
  return undefined;
}
