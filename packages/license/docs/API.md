# API Reference

Public surface exported from `@mtlic/license`'s `src/index.ts`. Everything else in `src/` (the
KCDSA primitive, the license cipher, the secret constants, `Sha256Preset.ts`) is intentionally not
re-exported here — see [DESIGN.md](./DESIGN.md) for why.

## License generation

```ts
generateLicenseFromSystemId(
  systemId: string | bigint,
  privateKey: Uint8Array,
  deadline: bigint,
  level: number,
  fixedNonceSecret?: bigint,
): string
```

Builds, signs, and text-encodes one full RouterOS/RouterOS CHR license from a System-ID. `systemId` accepts either
the human-typed 11-character string form or an already-decoded `bigint`. `deadline` is a 32-bit
Unix timestamp, or `LICENSE_DEADLINE_PERMANENT` for a permanent license — see `computeDeadline()`
below to derive it from a `LicenseType`. `fixedNonceSecret` is a test-only escape hatch; never pass
it in production code.

```ts
generateLicenseFromSoftwareId(
  softwareId: string | bigint,
  privateKey: Uint8Array,
  options?: LicenseFromSoftwareIdOptions,
): string
```

Sibling pathway keyed on a Software-ID instead. `softwareId` accepts either the human-typed
`XXXX-XXXX` string form or an already-decoded `bigint`.

```ts
interface LicenseFromSoftwareIdOptions {
  major?: number; // default 7
  level?: number; // default 6, must fit in 4 bits (0-15)
  groups?: number; // default 1, must fit in 4 bits (0-15)
  fixedNonceSecret?: bigint; // test-only, never use in production
}
```

```ts
softwareIdDecode(softwareId: string): bigint
softwareIdEncode(value: bigint): string
softwareGroupsByte(level?: number, groups?: number): number
```

Lower-level Software-ID helpers, exposed in case a caller needs the codec or the packed byte
without building a full license.

## License type / deadline

```ts
type LicenseType = "permanent" | "subscription" | "trial";

computeDeadline(licenseType: LicenseType, days?: number, now?: Date): bigint

const LICENSE_DEADLINE_PERMANENT: bigint; // 0xFFFFFFFFn
const TRIAL_DEFAULT_DAYS: number;         // 60
const SUBSCRIPTION_DEFAULT_DAYS: number;  // 180
```

Computes the 4-byte `deadline` value for one of the three official license types. See
[DESIGN.md](./DESIGN.md#the-three-license-types) for the exact per-type formulas (subscription in
particular is not simple `now + days`).

## License text framing

```ts
const LICENSE_HEADER: string; // '-----BEGIN MIKROTIK SOFTWARE KEY------------'
const LICENSE_FOOTER: string; // '-----END MIKROTIK SOFTWARE KEY--------------'
```

The literal marker lines every generated license is wrapped in (see `generateLicenseFrom*`'s
output). Exposed mainly so callers/tests can recognize or strip them without hardcoding the exact
strings a second time.

## System-ID codec

```ts
const SYSTEM_ID_LENGTH: number; // 11

systemIdDecode(systemId: string): bigint
systemIdEncode(value: bigint): string
```

Encodes/decodes the 11-character System-ID string form to/from its underlying 64-bit integer.
Throws `RangeError` on malformed input (wrong length, out-of-alphabet character, or out-of-range
value).
