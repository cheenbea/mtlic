import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Sha256 } from '../src/index';

function nativeSha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

describe('Sha256 default parameters match the platform SHA-256', () => {
  const lengths = [0, 1, 3, 55, 56, 63, 64, 65, 1000];

  for (const length of lengths) {
    it(`matches node:crypto for input length ${length}`, () => {
      const input = 'a'.repeat(length);
      const hash = new Sha256();
      hash.update(input);
      expect(hash.hexDigest()).toBe(nativeSha256Hex(input));
    });
  }

  it('matches node:crypto across multiple update() calls', () => {
    const hash = new Sha256();
    hash.update('hello, ');
    hash.update('world');
    expect(hash.hexDigest()).toBe(nativeSha256Hex('hello, world'));
  });

  it('matches node:crypto HMAC-SHA256 when secret is provided', () => {
    const hash = new Sha256({ secret: 'my-secret-key' });
    hash.update('message body');
    const expected = createHmac('sha256', 'my-secret-key').update('message body').digest('hex');
    expect(hash.hexDigest()).toBe(expected);
  });

  it('matches node:crypto HMAC-SHA256 with a secret longer than one block', () => {
    const longSecret = 'k'.repeat(100);
    const hash = new Sha256({ secret: longSecret });
    hash.update('message body');
    const expected = createHmac('sha256', longSecret).update('message body').digest('hex');
    expect(hash.hexDigest()).toBe(expected);
  });
});
