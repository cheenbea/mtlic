import { BLOCK_SIZE, DEFAULT_INIT, DEFAULT_KEY, DIGEST_LENGTH } from './constants';

export interface StateOverride {
  state: ArrayLike<number>;
  bytesHashed: number;
}

function toUint32Array(
  words: ArrayLike<number>,
  expectedLength: number,
  label: string,
): Uint32Array {
  if (words.length !== expectedLength) {
    throw new RangeError(`${label} must have exactly ${expectedLength} words, got ${words.length}`);
  }
  const out = new Uint32Array(expectedLength);
  for (let i = 0; i < expectedLength; i++) {
    const value = words[i];
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
      throw new RangeError(`${label}[${i}] must be an unsigned 32-bit integer, got ${value}`);
    }
    out[i] = value;
  }
  return out;
}

function rrot(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function writeUint64BE(target: Uint8Array, offset: number, value: number): void {
  // value can exceed 2^32 (message length in bits); split into high/low 32-bit halves explicitly
  // rather than a bitwise shift, which in JS operates on 32-bit ints and would silently truncate it.
  const view = new DataView(target.buffer, target.byteOffset, target.byteLength);
  view.setUint32(offset, Math.floor(value / 0x100000000), false);
  view.setUint32(offset + 4, value >>> 0, false);
}

/**
 * Low-level SHA-256 compression engine (FIPS 180-4 section 6.2). Owns the running state and round
 * constants as per-instance data — see ../docs/DESIGN.md for why that matters. `Sha256` is the
 * public wrapper; use this directly only if you need the raw engine without HMAC.
 */
export class RawSha256 {
  private state: Int32Array;
  private k: Uint32Array;
  private readonly temp = new Int32Array(64); // message schedule, W[0..63] in the spec
  private readonly buffer = new Uint8Array(BLOCK_SIZE);
  private bufferLength = 0;
  private bytesHashed = 0;
  finished = false;

  constructor(state?: ArrayLike<number>, k?: ArrayLike<number>) {
    this.state = Int32Array.from(state ? toUint32Array(state, 8, 'state') : DEFAULT_INIT);
    this.k = k ? toUint32Array(k, 64, 'k') : Uint32Array.from(DEFAULT_KEY);
  }

  private assertBlockBoundary(method: string): void {
    if (this.bufferLength !== 0) {
      throw new Error(
        `${method}() requires a block boundary: ${this.bufferLength} bytes are still buffered under the previous constants`,
      );
    }
    if (this.finished) {
      throw new Error(`${method}() cannot be called after digest()`);
    }
  }

  /**
   * Replace the running state and the logical byte count `digest()` uses for padding. See
   * ../docs/DESIGN.md for why `bytesHashed` is bundled in here instead of a separate setter.
   */
  setState(override: StateOverride): void {
    this.assertBlockBoundary('setState');
    if (!Number.isInteger(override.bytesHashed) || override.bytesHashed < 0) {
      throw new RangeError(
        `bytesHashed must be a non-negative integer, got ${override.bytesHashed}`,
      );
    }
    this.state = Int32Array.from(toUint32Array(override.state, 8, 'state'));
    this.bytesHashed = override.bytesHashed;
  }

  /** Replace the round constants (K). Same block-boundary restriction as `setState()`. */
  setK(k: ArrayLike<number>): void {
    this.assertBlockBoundary('setK');
    this.k = toUint32Array(k, 64, 'k');
  }

  /** Read the current state and byte count back out, to resume elsewhere via `setState()`. */
  getCheckpoint(): StateOverride {
    if (this.bufferLength !== 0) {
      throw new Error(
        'getCheckpoint() requires a block boundary: buffered bytes are not yet reflected in state',
      );
    }
    return { state: Array.from(this.state, (x) => x >>> 0), bytesHashed: this.bytesHashed };
  }

  update(data: Uint8Array): void {
    if (this.finished) {
      throw new Error('update() cannot be called after digest()');
    }
    if (data.length === 0) return;

    this.bytesHashed += data.length;

    // Top up any partial block left over from the previous update() call before touching new data.
    if (this.bufferLength > 0) {
      const needed = BLOCK_SIZE - this.bufferLength;
      const toCopy = Math.min(needed, data.length);
      this.buffer.set(data.subarray(0, toCopy), this.bufferLength);
      this.bufferLength += toCopy;
      data = data.subarray(toCopy);
      if (this.bufferLength < BLOCK_SIZE) return;
      this.hashBuffer(this.buffer);
      this.bufferLength = 0;
    }

    while (data.length >= BLOCK_SIZE) {
      this.hashBuffer(data.subarray(0, BLOCK_SIZE));
      data = data.subarray(BLOCK_SIZE);
    }

    if (data.length > 0) {
      this.buffer.set(data);
      this.bufferLength = data.length;
    }
  }

  // FIPS 180-4 section 6.2.2: message schedule (step 1) and the 64-round compression (step 3).
  private hashBuffer(block: Uint8Array): void {
    const { state, k, temp } = this;
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength);

    // Step 1: W[0..15] are the block's 16 big-endian 32-bit words as-is.
    for (let i = 0; i < 16; i++) {
      temp[i] = view.getUint32(i * 4, false);
    }
    // W[16..63]: sigma0/sigma1 (FIPS 180-4 section 4.1.2) extend the schedule from the first 16 words.
    for (let i = 16; i < 64; i++) {
      const w15 = temp[i - 15];
      const w2 = temp[i - 2];
      const s0 = rrot(w15, 7) ^ rrot(w15, 18) ^ (w15 >>> 3);
      const s1 = rrot(w2, 17) ^ rrot(w2, 19) ^ (w2 >>> 10);
      temp[i] = (temp[i - 16] + s0 + temp[i - 7] + s1) | 0;
    }

    let a = state[0],
      b = state[1],
      c = state[2],
      d = state[3];
    let e = state[4],
      f = state[5],
      g = state[6],
      h = state[7];

    // Step 3: 64 rounds of Ch/Maj/Sigma0/Sigma1 (FIPS 180-4 section 4.1.2) mixing in K[i] and W[i].
    // `| 0` after each sum forces the wraparound the spec requires (addition mod 2^32); plain JS
    // number addition without it would silently drift once a sum exceeds 2^31.
    for (let i = 0; i < 64; i++) {
      const S1 = rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + k[i] + temp[i]) | 0;
      const S0 = rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }

    // Step 4: feed the compressed block back into the running state.
    state[0] = (state[0] + a) | 0;
    state[1] = (state[1] + b) | 0;
    state[2] = (state[2] + c) | 0;
    state[3] = (state[3] + d) | 0;
    state[4] = (state[4] + e) | 0;
    state[5] = (state[5] + f) | 0;
    state[6] = (state[6] + g) | 0;
    state[7] = (state[7] + h) | 0;
  }

  digest(): Uint8Array {
    if (!this.finished) {
      const bitLength = this.bytesHashed * 8;
      this.buffer[this.bufferLength] = 0x80; // FIPS 180-4 section 5.1.1: mandatory trailing 1 bit.

      // The 8-byte length has to fit after the 0x80 byte in this block; if there isn't room (more
      // than 55 bytes already buffered), pad this block with zeros and hash it with no length yet,
      // then emit a second, otherwise-empty block carrying just the length.
      if (this.bufferLength <= 55) {
        this.buffer.fill(0, this.bufferLength + 1, 56);
        writeUint64BE(this.buffer, 56, bitLength);
        this.hashBuffer(this.buffer);
      } else {
        this.buffer.fill(0, this.bufferLength + 1, BLOCK_SIZE);
        this.hashBuffer(this.buffer);
        const secondBlock = new Uint8Array(BLOCK_SIZE);
        writeUint64BE(secondBlock, 56, bitLength);
        this.hashBuffer(secondBlock);
      }

      this.finished = true;
    }

    const out = new Uint8Array(DIGEST_LENGTH);
    const view = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) {
      view.setUint32(i * 4, this.state[i] >>> 0, false);
    }
    return out;
  }
}
