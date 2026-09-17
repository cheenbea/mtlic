import { describe, expect, it } from 'vitest';
import { BLOCK_SIZE, Sha256 } from '../src/index';

describe('Sha256 customization', () => {
  it('produces a different, deterministic digest with custom state and K', () => {
    const customState = [1, 2, 3, 4, 5, 6, 7, 8];
    const customK = Array.from({ length: 64 }, (_, i) => i + 1);

    const a = new Sha256({ state: customState, k: customK });
    a.update('same input');
    const b = new Sha256({ state: customState, k: customK });
    b.update('same input');
    expect(a.hexDigest()).toBe(b.hexDigest());

    const standard = new Sha256();
    standard.update('same input');
    expect(a.hexDigest()).not.toBe(standard.hexDigest());
  });

  it('rejects a state array that is not exactly 8 words', () => {
    expect(() => new Sha256({ state: [1, 2, 3] })).toThrow(RangeError);
  });

  it('rejects a K array that is not exactly 64 words', () => {
    expect(() => new Sha256({ k: [1, 2, 3] })).toThrow(RangeError);
  });

  it('rejects setState() once bytes are buffered mid-block', () => {
    const hash = new Sha256();
    hash.update('a'.repeat(10));
    expect(() => hash.setState({ state: [0, 0, 0, 0, 0, 0, 0, 0], bytesHashed: 0 })).toThrow();
  });

  it('rejects setState()/setK() after digest() has finalized', () => {
    const hash = new Sha256();
    hash.update('data');
    hash.digest();
    expect(() => hash.setState({ state: [0, 0, 0, 0, 0, 0, 0, 0], bytesHashed: 0 })).toThrow();
    expect(() => hash.setK(new Array(64).fill(0))).toThrow();
  });

  it('rejects combining secret with setState()/setK()/getCheckpoint()', () => {
    const hash = new Sha256({ secret: 'key' });
    expect(() => hash.setState({ state: [0, 0, 0, 0, 0, 0, 0, 0], bytesHashed: 0 })).toThrow();
    expect(() => hash.setK(new Array(64).fill(0))).toThrow();
    expect(() => hash.getCheckpoint()).toThrow();
  });

  it('does not let setK() on one instance affect another instance', () => {
    const untouched = new Sha256();
    untouched.update('same input');

    const mutated = new Sha256();
    mutated.setK(new Array(64).fill(0));
    mutated.update('irrelevant');
    mutated.digest();

    const control = new Sha256();
    control.update('same input');

    expect(untouched.hexDigest()).toBe(control.hexDigest());
  });

  it('setState() resumes hashing from a checkpoint taken at a block boundary', () => {
    const prefix = 'x'.repeat(BLOCK_SIZE);
    const suffix = 'the rest of the message';

    const direct = new Sha256();
    direct.update(prefix + suffix);

    const upToPrefix = new Sha256();
    upToPrefix.update(prefix);
    const checkpoint = upToPrefix.getCheckpoint();

    const resumed = new Sha256();
    resumed.setState(checkpoint);
    resumed.update(suffix);

    expect(resumed.hexDigest()).toBe(direct.hexDigest());
  });
});
