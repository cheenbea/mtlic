import { MikroTikSha256 } from './Sha256Preset';

// Curve25519 (Bernstein 2006), Montgomery form y^2 = x^3 + a*x^2 + x (b=1, so all "/b" terms in the
// textbook group-law formulas are omitted below — dividing/multiplying by 1 is a no-op).
// Confirmed against toyecc's actual CurveDB.py registry entry for "Curve25519" — these are the
// standard published parameters, not a MikroTik-specific variant.
const P = 2n ** 255n - 19n;
const CURVE_A = 486662n;
const CURVE_N = 2n ** 252n + 27742317777372353535851937790883648493n;
const GX = 9n;
const GY = 0x5f51e65e475f794b1fe122d388b72eb36dc2b28192839e4dd6163a5d81312c14n;

type AffinePoint = { x: bigint; y: bigint };
// `null` is the point at infinity (neutral element).
type CurvePoint = AffinePoint | null;

const G: CurvePoint = { x: GX, y: GY };

// Python's `%` always returns a non-negative result when the modulus is positive; JS/TS `%` keeps
// the sign of the dividend, so `-5n % 7n` is `-5n`, not `2n`. Every reduction in this file must go
// through this helper instead of the raw `%` operator, or results silently diverge from Python
// once a subtraction goes negative (which happens routinely in the signature equation below).
function mod(a: bigint, m: bigint): bigint {
  const r = a % m;
  return r < 0n ? r + m : r;
}

// Extended Euclidean algorithm. The RESULT of a modular inverse mod a prime is unique regardless of
// method, so this doesn't need to match toyecc's algorithm (also EEA) step-for-step, only its output.
function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [mod(a, m), m];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  return mod(oldS, m);
}

function feNeg(x: bigint): bigint {
  return mod(-x, P);
}

function pointsEqual(p: CurvePoint, q: CurvePoint): boolean {
  if (p === null || q === null) return p === q;
  return p.x === q.x && p.y === q.y;
}

// Deliberately does NOT null-check `p`: toyecc's own `point_conjugate` crashes on `int(None)` if
// given the point at infinity, and that gap is preserved here on purpose (see `pointAdd`) rather
// than silently handled — it is never reached in practice given G's large prime order.
function negatePoint(p: CurvePoint): CurvePoint {
  return { x: p!.x, y: feNeg(p!.y) };
}

function pointDouble(p: AffinePoint): AffinePoint {
  const t = mod(3n * p.x * p.x + 2n * CURVE_A * p.x + 1n, P);
  const newX = mod(-2n * p.x - CURVE_A + t * t * modInverse(mod(4n * p.y * p.y, P), P), P);
  const newY = mod(
    -p.y +
      t * (3n * p.x + CURVE_A) * modInverse(mod(2n * p.y, P), P) -
      t * t * t * modInverse(mod(8n * p.y * p.y * p.y, P), P),
    P,
  );
  return { x: newX, y: newY };
}

function pointAddGeneral(p: AffinePoint, q: AffinePoint): AffinePoint {
  const dx = mod(p.x - q.x, P);
  const dy = mod(p.y - q.y, P);
  const invDx = modInverse(dx, P);
  const newX = mod(-p.x - q.x - CURVE_A + dy * dy * modInverse(mod(dx * dx, P), P), P);
  const newY = mod(
    (2n * p.x + q.x + CURVE_A) * dy * invDx -
      p.y -
      dy * dy * dy * modInverse(mod(dx * dx * dx, P), P),
    P,
  );
  return { x: newX, y: newY };
}

// Mirrors toyecc's `MontgomeryCurve.point_addition` branch order exactly, including that only
// "P is neutral" is special-cased (not "Q is neutral") — see `negatePoint`'s comment.
function pointAdd(p: CurvePoint, q: CurvePoint): CurvePoint {
  if (p === null) return q;
  if (pointsEqual(p, negatePoint(q))) return null;
  if (pointsEqual(p, q)) return pointDouble(p);
  // Non-null assertion, not a runtime guard: `q` being neutral here is the same unhandled gap
  // documented on `negatePoint` (Python crashes on it too) — deliberately not papered over.
  return pointAddGeneral(p, q!);
}

// LSB-first double-and-add, matching toyecc's `AffineCurvePoint.__mul__` exactly. NOT constant-time
// (loop structure depends on the scalar's bits) — that's a property of the original, not introduced
// here; see the conversation notes on toyecc being an explicitly non-hardened "toy" library.
function scalarMul(scalar: bigint, p: CurvePoint): CurvePoint {
  let result: CurvePoint = null;
  let n = p;
  let s = scalar;
  while (s > 0n) {
    if (s & 1n) result = pointAdd(result, n);
    n = pointAdd(n, n);
    s >>= 1n;
  }
  return result;
}

// toyecc's Tools.bytestoint_le: arbitrary length in, arbitrary-precision (here BigInt) int out.
export function bytesToIntLE(data: Uint8Array): bigint {
  let result = 0n;
  for (let i = data.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(data[i]);
  }
  return result;
}

// toyecc's Tools.inttobytes_le: fixed-length out. Silently truncates high bits if `value` doesn't
// fit, silently zero-pads if it's smaller — matching Python exactly, not "fixed" to be safer.
export function intToBytesLE(value: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let v = value;
  for (let i = 0; i < length; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

// Uniform random BigInt in [min, max], via rejection sampling against the global WebCrypto RNG
// (available natively in both Node and browsers) — a plain modulo would bias the distribution.
function randomBigIntInRange(min: bigint, max: bigint): bigint {
  const range = max - min + 1n;
  const bitLength = range.toString(2).length;
  const byteLength = Math.ceil(bitLength / 8);
  const mask = (1n << BigInt(bitLength)) - 1n;
  const bytes = new Uint8Array(byteLength);
  for (;;) {
    crypto.getRandomValues(bytes);
    let value = 0n;
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8n) | BigInt(bytes[i]);
    }
    value &= mask;
    if (value < range) return min + value;
  }
}

function mtSha256(data: Uint8Array): Uint8Array {
  return new MikroTikSha256().update(data).digest();
}

// Faithful port of `mikrotik_kcdsa_sign` (EC-KCDSA-flavored signing over Curve25519). The private key
// scalar is used exactly as given (little-endian bytes -> int) with NO X25519/Ed25519-style
// clamping — clamping in this scheme only ever applies to the challenge hash below, not the key.
//
// `fixedNonceSecret` is a test-only escape hatch mirroring Python's `kcdsaSign(..., fixed_nonce_secret=)`
// (`tools/mikrotik_license/signature.py`) — it lets a cross-language test pin the one source of
// genuine randomness in this function so every other step becomes byte-for-byte comparable against
// a captured Python run. Passing it also disables the retry loop, exactly like the Python side
// ("用固定w重放时不重试"): a real production call must never pass this, since forcing a fixed nonce
// across multiple signatures of different data would leak the private key (see the "never reuses
// the same nonce" test below), and Python's version simply gives up (returns None) rather than
// silently retrying with a different nonce, which would defeat the purpose of pinning it.
export function mikrotikKcdsaSign(
  data: Uint8Array,
  privateKey: Uint8Array,
  fixedNonceSecret?: bigint,
): Uint8Array {
  const scalar = bytesToIntLE(privateKey);
  const publicKeyPoint = scalarMul(scalar, G);
  const scalarInverse = modInverse(scalar, CURVE_N);

  for (;;) {
    const nonceSecret = fixedNonceSecret ?? randomBigIntInRange(1n, CURVE_N - 1n);
    const noncePoint = scalarMul(nonceSecret, G) as AffinePoint; // never neutral: nonceSecret in [1,n-1], G has prime order n
    // Confirmed against the Python original (`signature.py`'s own docstring and code): the nonce is
    // the RAW Montgomery-u/X field coordinate (already reduced mod p by the point arithmetic above,
    // nothing more) - NOT reduced mod n. An earlier version of this file reduced it mod CURVE_N
    // here, which was a bug: it changed both the retry-loop's acceptance rate and the final
    // signature bytes relative to the real keygen for the exact same nonce secret.
    const nonce = noncePoint.x;
    const nonceHash = mtSha256(intToBytesLE(nonce, 32));

    const dataHashBytes = mtSha256(data).slice();
    for (let i = 0; i < 16; i++) {
      dataHashBytes[8 + i] ^= nonceHash[i];
    }
    dataHashBytes[0] &= 0xf8;
    dataHashBytes[31] &= 0x7f;
    dataHashBytes[31] |= 0x40;
    const e = bytesToIntLE(dataHashBytes);

    const signature = mod(scalarInverse * mod(nonceSecret - e, CURVE_N), CURVE_N);

    const checkPoint = pointAdd(scalarMul(signature, publicKeyPoint), scalarMul(e, G));
    // Both sides are RAW field x-coordinates (mod p only) — no asymmetry, matching Python's
    // `int(check.x) == nonce` exactly now that `nonce` above is no longer wrongly mod-n reduced.
    // Since p = 8n (cofactor 8), this only accepts when the raw x-coordinate happens to already
    // land under n (~1/8 of attempts), so the retry loop runs ~8x on average — a property of the
    // real algorithm, not a bug to "fix" by reducing both sides mod n.
    if (checkPoint !== null && checkPoint.x === nonce) {
      const out = new Uint8Array(48);
      out.set(nonceHash.slice(0, 16), 0);
      out.set(intToBytesLE(signature, 32), 16);
      return out;
    }
    if (fixedNonceSecret !== undefined) {
      throw new Error(
        'mikrotikKcdsaSign: fixedNonceSecret did not satisfy the acceptance check on the first attempt ' +
          '(matches Python returning None rather than retrying when fixed_nonce_secret is given)',
      );
    }
  }
}

// Originally derived (not copy-ported) by reversing `mikrotikKcdsaSign`'s own internal acceptance
// check, since no Python verify function had been located yet at the time. Since confirmed against
// the real one that does exist - `tools/scripts/verify_license.py::verify_with_point()`, which the
// module's own docstring says has been validated against real captured CHR license samples (not
// just self-consistency) - see the cross-check test in MikroTikKcdsa.test.ts using a fixture
// generated by calling `verify_with_point()` directly. Same algorithm: check_point = pub*s + G*e,
// nonce = RAW check_point.x (no % n), nonce_hash = sha256(nonce as 32 LE bytes), compare its first
// 16 bytes against the signature's r.
export function mikrotikKcdsaVerify(
  data: Uint8Array,
  signature: Uint8Array,
  publicKey: AffinePoint,
): boolean {
  if (signature.length !== 48) return false;
  const nonceHashPrefix = signature.slice(0, 16);
  const sigScalar = bytesToIntLE(signature.slice(16, 48));

  const dataHashBytes = mtSha256(data).slice();
  for (let i = 0; i < 16; i++) {
    dataHashBytes[8 + i] ^= nonceHashPrefix[i];
  }
  dataHashBytes[0] &= 0xf8;
  dataHashBytes[31] &= 0x7f;
  dataHashBytes[31] |= 0x40;
  const e = bytesToIntLE(dataHashBytes);

  const checkPoint = pointAdd(scalarMul(sigScalar, publicKey), scalarMul(e, G));
  if (checkPoint === null) return false;
  // Same RAW-field-coordinate rule as mikrotikKcdsaSign's `nonce` above - no `% CURVE_N` here either.
  const recomputedHash = mtSha256(intToBytesLE(checkPoint.x, 32));
  for (let i = 0; i < 16; i++) {
    if (recomputedHash[i] !== nonceHashPrefix[i]) return false;
  }
  return true;
}

export function mikrotikKcdsaPublicKey(privateKey: Uint8Array): AffinePoint {
  return scalarMul(bytesToIntLE(privateKey), G) as AffinePoint;
}

export const __internal = { P, CURVE_A, CURVE_N, G, scalarMul, pointAdd, mod };
