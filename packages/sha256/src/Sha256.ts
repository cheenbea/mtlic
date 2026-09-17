import { BLOCK_SIZE } from './constants';
import { RawSha256, type StateOverride } from './RawSha256';

export type SourceData = string | ArrayBufferView | ArrayBuffer;

export interface Sha256Options {
  state?: ArrayLike<number>;
  k?: ArrayLike<number>;
  secret?: SourceData;
}

// TextEncoder is stateless — share one instance instead of allocating a new one on every update().
const textEncoder = new TextEncoder();

function toBytes(data: SourceData): Uint8Array {
  if (typeof data === 'string') {
    return textEncoder.encode(data);
  }
  if (data instanceof Uint8Array) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data);
}

// RFC 2104 section 2: keys longer than one block are shortened by hashing; shorter keys are used
// as-is and implicitly zero-padded to the block size.
function normalizeHmacKey(
  secret: Uint8Array,
  state?: ArrayLike<number>,
  k?: ArrayLike<number>,
): Uint8Array {
  const key = new Uint8Array(BLOCK_SIZE);
  if (secret.length <= BLOCK_SIZE) {
    key.set(secret);
    return key;
  }
  const shortened = new RawSha256(state, k);
  shortened.update(secret);
  key.set(shortened.digest());
  return key;
}

// RFC 2104 section 2: ipad is 0x36 repeated, opad is 0x5c repeated, XORed with the key.
function xorPad(key: Uint8Array, pad: number): Uint8Array {
  const out = new Uint8Array(key.length);
  for (let i = 0; i < key.length; i++) {
    out[i] = key[i] ^ pad;
  }
  return out;
}

/**
 * SHA-256 with swappable state (H0-H7) and round constants (K) — see ../docs/DESIGN.md for why
 * no production crypto library exposes this. Pass `secret` for HMAC (RFC 2104); everything else
 * behaves like a standard incremental hash.
 */
export class Sha256 {
  private readonly inner: RawSha256;
  // Only allocated for HMAC: RFC 2104 needs two independent compressions (inner and outer), so
  // this wraps a second, separately-buffered RawSha256 rather than reusing `inner`.
  private readonly outer?: RawSha256;

  constructor(options: Sha256Options = {}) {
    this.inner = new RawSha256(options.state, options.k);

    if (options.secret !== undefined) {
      this.outer = new RawSha256(options.state, options.k);

      const key = normalizeHmacKey(toBytes(options.secret), options.state, options.k);
      this.inner.update(xorPad(key, 0x36));
      this.outer.update(xorPad(key, 0x5c));
      key.fill(0); // don't leave key material sitting in memory longer than necessary
    }
  }

  private assertNoSecret(method: string): void {
    if (this.outer) {
      throw new Error(`${method}() is not supported together with secret (HMAC mode)`);
    }
  }

  /** Replace the running state at a block boundary. Throws with `secret` — see ../docs/DESIGN.md. */
  setState(override: StateOverride): this {
    this.assertNoSecret('setState');
    this.inner.setState(override);
    return this;
  }

  /** Replace the round constants (K) at a block boundary. Throws with `secret`. */
  setK(k: ArrayLike<number>): this {
    this.assertNoSecret('setK');
    this.inner.setK(k);
    return this;
  }

  /** Read `{ state, bytesHashed }` back out, to resume elsewhere via `setState()`. Throws with `secret`. */
  getCheckpoint(): StateOverride {
    this.assertNoSecret('getCheckpoint');
    return this.inner.getCheckpoint();
  }

  update(data: SourceData): this {
    this.inner.update(toBytes(data));
    return this;
  }

  digest(): Uint8Array {
    if (this.outer) {
      if (!this.outer.finished) {
        this.outer.update(this.inner.digest());
      }
      return this.outer.digest();
    }
    return this.inner.digest();
  }

  hexDigest(): string {
    return Array.from(this.digest(), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
