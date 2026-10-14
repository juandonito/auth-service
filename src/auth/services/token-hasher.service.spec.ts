import { generateRandomString } from '@test/mock/common.mock';
import { createHash } from 'node:crypto';
import { TokenHasherService } from './token-hasher.service';

describe('TokenHasherService', () => {
  const hasher = new TokenHasherService();

  describe('hash', () => {
    it('should return the SHA-256 digest of the token as 64 lowercase hex characters', () => {
      const token = generateRandomString(64);

      const hash = hasher.hash(token);

      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
    });

    it('should never contain the token itself', () => {
      const token = generateRandomString(64);

      expect(hasher.hash(token)).not.toContain(token);
    });

    it('should produce the same hash for the same token', () => {
      const token = generateRandomString(64);

      expect(hasher.hash(token)).toBe(hasher.hash(token));
    });

    it('should produce a different hash for a different token', () => {
      expect(hasher.hash(generateRandomString(64))).not.toBe(
        hasher.hash(generateRandomString(64)),
      );
    });
  });

  describe('matches', () => {
    it('should accept the token the hash was made from', () => {
      const token = generateRandomString(64);

      expect(hasher.matches(token, hasher.hash(token))).toBe(true);
    });

    it('should reject a different token', () => {
      const storedHash = hasher.hash(generateRandomString(64));

      expect(hasher.matches(generateRandomString(64), storedHash)).toBe(false);
    });

    it.each([
      ['empty', () => ''],
      ['too short', () => hasher.hash(generateRandomString(64)).slice(0, 62)],
      ['too long', () => hasher.hash(generateRandomString(64)) + 'ab'],
      ['not hexadecimal', () => 'z'.repeat(64)],
    ])(
      'should reject a stored hash that is %s without throwing',
      (_label, makeStoredHash) => {
        const token = generateRandomString(64);
        const storedHash = makeStoredHash();

        expect(() => hasher.matches(token, storedHash)).not.toThrow();
        expect(hasher.matches(token, storedHash)).toBe(false);
      },
    );
  });
});
