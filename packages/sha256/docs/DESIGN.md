# Design Notes

This package is not a general-purpose crypto library — it's a customizable SHA-256 engine for
experimentation, implemented directly from the FIPS 180-4 (hashing) and RFC 2104 (HMAC)
specifications after surveying what `@aws-crypto/sha256-js`, `hashlib`, and `pifkoin`'s
`sha256.py` do and don't support. None of them let you replace the initial state (H0-H7) or the
round constants (K); this one does, and the design exists to make that safe to use correctly
rather than just possible.

## Why `state`/`k` are per-instance, never module-level

`@aws-crypto/sha256-js`'s `RawSha256.hashBuffer()` reads its round constants from a module-level
import, not an instance field — fine for a library that never mutates them, but a real hazard for
one that does: an in-place mutation would silently change every instance in the same process,
including ones that never touched a setter. `state` and `k` are copied into per-instance typed
arrays at construction time specifically to rule this out.

## Why `setState()`/`setK()` require a block boundary

SHA-256's state is only meaningful after a complete 64-byte block has been compressed. If either
setter could run while partial-block bytes are sitting in the buffer, those bytes would be hashed
against whichever constants happen to apply when the buffer finally fills — silently, with no
error. Both setters throw instead of guessing.

## Why `bytesHashed` is bundled into `setState()`, not a separate setter

`bytesHashed` drives the padding length at `digest()` time. Setting `state` and `bytesHashed` as
two separate calls would let them be inconsistent for a moment (or forever, if the caller forgets
the second call). Bundling them into one `{ state, bytesHashed }` argument makes that inconsistent
state unrepresentable.

## Why `secret` (HMAC) and `setState()`/`setK()`/`getCheckpoint()` don't mix

HMAC exists specifically to make length-extension attacks irrelevant — the outer hash absorbs the
inner digest, so leaking the outer state doesn't let you forge a continuation the way it would for
a bare Merkle–Damgård hash. Combining `secret` with mid-stream state injection has no coherent
cryptographic meaning for that use case, so it's rejected outright rather than silently allowed.

## `getCheckpoint()` / `setState()` round-trip

The intended use is: hash up to a block boundary, call `getCheckpoint()` to read `{ state,
bytesHashed }`, hand that to a fresh instance's `setState()`, and continue with `update()` — the
result is identical to having hashed the whole thing in one instance. `__tests__/customization.test.ts`
verifies this directly.

## Why MIT, not Apache-2.0

`RawSha256.ts` is an independent implementation of the public FIPS 180-4 spec, verified against
`pifkoin`'s MIT-licensed `sha256.py` and against `node:crypto`'s output — it never had a real
Apache-2.0 dependency. The HMAC composition in `Sha256.ts` (`normalizeHmacKey`/`xorPad`) was
written directly from RFC 2104 rather than mirroring `@aws-crypto/sha256-js`'s specific structure,
specifically so the whole package can honestly carry one license instead of quietly owing
Apache-2.0 terms for one function.

## Why we didn't port js-sha256's optimizations

`js-sha256` is meaningfully faster for the common case, but its biggest win — precomputing round 0
as hardcoded constants — only works because it assumes the fixed, standard initial state; with a
runtime-configurable `state`, those constants aren't constant anymore, so the technique doesn't
transfer at all. Its `sharedMemory` option (reusing one buffer across hash instances) is safe there
because it's only used for stateless one-shot calls that never overlap — it would reintroduce
exactly the cross-instance corruption bug `state`/`k` being per-instance was designed to prevent,
given `setState()`/`setK()`/`getCheckpoint()` mean instances here _are_ long-lived and mutable. The
two pieces that would transfer safely (a plain array instead of a typed array for the block
buffer, and unrolling the round loop) were left alone until a benchmark shows they're worth the
loss of being able to read `hashBuffer()` straight off FIPS 180-4 line by line.

## `MikroTikSha256` lives in `packages/license`, not here

It's a fixed preset of `Sha256` with MikroTik's own non-standard `state`/`k` baked in. This
package is meant to stay a generic, potentially-reusable engine, so company-specific constants
belong in a MikroTik-specific package (`packages/license/src/Sha256Preset.ts`), not in the shared
engine itself — otherwise extracting or reusing this package elsewhere would drag MikroTik's
proprietary constants along with it. See `packages/license/docs/DESIGN.md` for why that package is
allowed to hold those secrets directly.
