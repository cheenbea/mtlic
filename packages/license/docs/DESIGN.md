# Design Notes

This package holds MikroTik's own license building/signing logic: the KCDSA-flavored signature
primitive, the license-payload cipher, the System-ID/Software-ID codecs, and the two high-level
`generateLicenseFrom*` entry points that tie them together into a full, signed RouterOS/RouterOS
CHR license text.
Unlike `packages/sha256`, this package is inherently MikroTik-specific — it has no purpose outside
this product.

## Why this is its own workspace package, not `apps/web/src/mikrotik/`

This domain logic was originally organized as a plain folder inside `apps/web/src/`. It moved out
into its own workspace package, mirroring `packages/sha256`, because it's genuinely pure (no React,
no TanStack Start, no app-specific UI concerns — the only non-`packages/sha256` dependency it has is
`node:crypto`'s `Uint8Array`/`crypto.getRandomValues`, which is standard runtime API, not a UI
framework import) and because a real package boundary (its own `package.json`, its own
independently-runnable `test`/`build` scripts, an intentional `index.ts` public surface) enforces
the UI/domain-logic separation with actual tooling instead of just folder-naming convention. It also
means this logic could be consumed by something other than `apps/web` later (a CLI, a server-only
script) without dragging in Vite/React at all.

Unlike `packages/sha256`, this package is allowed to hold MikroTik's proprietary secret constants
directly (see the next section) — the risk `packages/sha256` avoids by keeping those constants out
of itself is that _that specific package_ is a generic, otherwise-reusable engine someone might
extract or reuse on its own. This package has no such generic, reusable core to protect, so keeping
its own secrets inside it doesn't create the same risk.

## `MikroTikSha256` lives here, not `packages/sha256`

It's a fixed preset of `packages/sha256`'s `Sha256` with MikroTik's own non-standard `state`/`k`
baked in. `packages/sha256` is meant to stay a generic engine, so this company-specific preset
lives here instead (`src/Sha256Preset.ts`). Note that once this repo is cloned or shared anywhere
outside the company, those constants stop being a secret — `MikroTikSha256` is exactly as secret as
the repository it lives in, nothing more.

`MIKROTIK_STATE` and `MIKROTIK_KEY` themselves live in `src/constants/mikrotikSecrets.ts` (split
out from MikroTik's other, non-secret lookup tables — see `src/constants/index.ts`'s own comment
for why), not inline in this file, because the same `MIKROTIK_KEY` table is also the round-constant
source for MikroTik's license-payload cipher (`src/LicenseCipher.ts`) — a separate, non-SHA-256
algorithm that happens to reuse it. Both consume the constants from that one shared module rather
than one depending on the other. Note that despite the name, `MIKROTIK_KEY` is secret key material
for the license cipher, not a public round-constant table the way SHA-256's `K` is —
`MIKROTIK_STATE`'s sibling here is named `KEY`, not `K`, specifically to not imply the
"safe to publish" connotation SHA-256's `K` carries.

## Why `MIKROTIK_STATE`/`MIKROTIK_KEY` are written in hex, not decimal

Every value in `MIKROTIK_STATE` and `MIKROTIK_KEY` is a bit pattern, not a quantity — they're never
summed or compared for magnitude, only XORed, rotated, and masked (`MIKROTIK_KEY[i] & 0x0F` in the
license cipher's rotation amount, big-endian byte splitting via `DataView` elsewhere). Hex maps 1:1
onto that usage — one hex digit is a nibble, two are a byte — so the boundaries this code actually
operates on are visible directly in the literal. Decimal would hide them behind mental arithmetic
and imply a numeric-magnitude meaning neither table has.

Hex also matches how the Python reference represents these same constants and how FIPS 180-4 and
RFC 7748 (both cited below) publish round constants and IVs — so the byte-for-byte verification
against the Python original is a direct visual comparison, not a base conversion first. It has the
side benefit of fixed width: every 32-bit value is exactly 8 hex characters, so the tables stay
visually aligned in source; decimal equivalents run 1-10 digits and would produce a ragged column
that hides a transcription typo instead of exposing one.

## Why `generateLicenseFromSystemId`/`generateLicenseFromSoftwareId`, not `cloud`/`cloudFromSystemId`

The Python `cloud(systemId, private_key)` license generator was first ported here as
`cloudFromSystemId` (and its later-added Software-ID sibling as `cloudFromSoftwareId`) — not as a
generic `cloud`, because the real system has two distinct license-generation pathways keyed on
different identifier shapes ("System ID" vs. "Software ID"), and one generic name can't cover both.
`cloudFromSystemId` / `cloudFromSoftwareId` stuck around for a while, but "cloud" is Python-source
jargon (referring to MikroTik's Cloud Hosted Router product) that leaked into the public API name
without explaining itself — it describes what the license is _for_, not what the function _does_
(build, sign, and text-encode one license). Both were renamed to `generateLicenseFromSystemId` /
`generateLicenseFromSoftwareId` (`src/LicenseFromSystemId.ts` / `src/LicenseFromSoftwareId.ts`) to
name the actual behavior instead, while keeping the `FromSystemId`/`FromSoftwareId` suffix that _is_
meaningful (it's the one real distinction between the two pathways).

## The license payload's byte layout

`generateLicenseFromSystemId()` (`src/LicenseFromSystemId.ts`) assembles a 16-byte plaintext
payload before handing it to the shared `signAndPackageLicense()` helper (`src/LicenseSigning.ts`),
which runs it through `src/LicenseCipher.ts`'s `encode()`: bytes 0-7 are `systemId`
(little-endian), bytes 8-11 are `deadline` (little-endian), byte 12 is `level`, and bytes 13-15 are
zero padding. That total isn't arbitrary — 16 bytes is exactly the block size `encode()` operates
on (4 32-bit words), so the payload is sized to fill exactly one cipher block.
`generateLicenseFromSoftwareId()` (`src/LicenseFromSoftwareId.ts`) builds its own differently-laid-out
16-byte payload the same way, then calls the same shared `signAndPackageLicense()` helper — sign,
encrypt, concatenate, base64-encode, and wrap are identical between the two pathways; only the
payload layout itself differs, which is why that tail sequence was extracted into one shared
function instead of being duplicated in both files.

`deadline` is a little-endian 32-bit Unix timestamp (seconds since epoch), with one sentinel: all
bits set (`0xFFFFFFFF`, exported as `LICENSE_DEADLINE_PERMANENT` from `src/LicenseDeadline.ts`)
means a permanent license with no expiry, not a literal date far in the future. It's a required
parameter of `generateLicenseFromSystemId()`, not computed internally — the caller decides what
value to pass in.

`level`'s CHR tier values are now confirmed (see `apps/web`'s `LicenseGenerator.tsx` /
`SYSTEM_ID_LEVEL_OPTIONS`; the underlying evidence trail is the user's own external research notes,
not a file in this repository): `0` = Free (inferred, no direct sample), `1` = P1 and `2` = P10
(user-confirmed), `3` = P-Unlimited (confirmed against the real, user-verified `eJq8zK/UrhN` CHR
license sample). A previous, never-verified `{0: P-Unlimited, 1: P1, 2: P10}` guess — with no
`Free` entry at all, and `0` wrongly assigned to P-Unlimited instead of Free — shipped in the UI
for a while before this correction; `generateLicenseFromSystemId()` itself never validated or
interpreted `level` beyond writing the raw byte, so no signing/encoding logic was ever wrong, only
the dropdown's own labels and default.

## The three license types

`deadline` (from the payload byte layout above) also encodes which of three product license types
a given license is. A permanent license sets `deadline` to the `0xFFFFFFFF` no-expiry sentinel
already described above. A subscription license sets `deadline` to generation time plus 180 days —
but a subscription is not one license valid for 180 days; the system re-issues a brand-new license
(a fresh `generateLicenseFromSystemId()` call and a fresh signature) every 180 days for subscribed
customers, so any given license's `deadline` is only ever ~180 days out from when that specific
license was issued, not from the subscription's original start date. A trial license sets
`deadline` to generation time plus 60 days and is generated once, with no recurring re-issuance.

This is a confirmed product rule from the user, not something reflected in code yet — no
implementation of the 180-/60-day computation or the subscription's recurring regeneration exists
in this codebase so far.

## Why `mikrotikKcdsaSign` runs in the browser despite taking a raw private key

`mikrotikKcdsaSign` (the EC-KCDSA-flavored signing scheme over Curve25519, hashed with
`MikroTikSha256`) is being ported to run in both Node and the browser, not server-only, because the
tool it backs is internal-only rather than customer- or public-facing. The function takes a raw
private key as input, so running it in the browser puts that key in the browser bundle/runtime
instead of confined to a trusted server process — a real deviation from conventional signing-key
hygiene, where private keys stay server-side and are never shipped to a client.

This is accepted specifically because the tool is internal-only. If this tool or its bundle is ever
exposed outside the trusted internal environment, the signing capability becomes extractable — the
same class of exposure `MikroTikSha256` already has: exactly as secret as the environment it runs
in, nothing more.

## Why `checkPoint.x === nonce` in `mikrotikKcdsaSign` is asymmetric on purpose

`nonce` is reduced mod the curve order `n` where it's defined, but `checkPoint.x` in the retry
loop's acceptance check is compared raw — mod the field prime `p`, not mod `n` — matching the Python
original exactly, which has no `% curve.n` on that side either. Since `p` is `n` times the curve's
cofactor (8), a raw `checkPoint.x` only lands under `n`, and therefore only matches `nonce`, on
roughly 1 in 8 attempts, so the retry loop runs about 8 times per signature on average, matching the
original's real behavior.

"Fixing" this into a symmetric comparison (reducing `checkPoint.x` mod `n` too, since that looks
like the obviously-equivalent cleanup) would be wrong: both forms are cryptographically valid, but
the symmetric version accepts on essentially the first try — a different, non-equivalent algorithm
from the one actually being ported, not a bug fix.

## Verifying curve arithmetic against RFC 7748

`scalarMul`/`pointAdd`'s field arithmetic is checked against an independent Python re-derivation of
toyecc's formulas (checks the formulas themselves, not just self-consistency), and separately
against RFC 7748 section 6.1's published Diffie-Hellman example (Alice/Bob key generation) as an
external, independent standard. Section 6.1 was used rather than section 5.2's own `X25519()` test
vectors because 5.2's vectors use arbitrary, non-base-point input coordinates, while this codebase
only ever multiplies by the base point `G` — 6.1's Alice/Bob example is scalar × `G`, matching actual
usage.

The RFC text for those vectors was fetched with raw `curl`, not a summarizing fetch tool: an
LLM-mediated summarization was found to corrupt exact hex constants earlier this session — an
observed failure, not a hypothetical one — so anything requiring exact hex constants goes through
unsummarized source text.

## Test fixtures for local development

A fixed test private key and three test systemId strings are used throughout manual/local testing
of the license and signing code. Private key (32 bytes, hex):
`0bad10f55d25b46d50738ed9227342a0222800bcc15d9ef9f30d8fbfbaf4c735`. The three systemId strings, with
their `systemIdDecode()` output verified against the real implementation rather than hand-computed:
`mRRnGN+JnEM` → `13918137030507566182`, `eJq8zK/UrhN` → `15594650436566688350`, `wR1YW+0sScI` →
`9733038899107943536`.
