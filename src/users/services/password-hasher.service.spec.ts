import { Test } from '@nestjs/testing';
import { generateMockPassword } from '@test/mock/auth.mock';
import { PasswordHasher } from './password-hasher.service';

describe('PasswordHasher', () => {
  let hasher: PasswordHasher;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PasswordHasher],
    }).compile();

    hasher = moduleRef.get(PasswordHasher);
  });

  describe('hash', () => {
    it('should hash the password with argon2id', async () => {
      const password = generateMockPassword();

      const hash = await hasher.hash(password);

      expect(hash).toMatch(/^\$argon2id\$/);
      expect(hash).not.toContain(password);
    });

    it('should produce a different hash for the same password each time', async () => {
      const password = generateMockPassword();

      const [first, second] = await Promise.all([
        hasher.hash(password),
        hasher.hash(password),
      ]);

      expect(first).not.toBe(second);
    });
  });

  describe('verify', () => {
    it('should accept the password the hash was made from', async () => {
      const password = generateMockPassword();
      const hash = await hasher.hash(password);

      await expect(hasher.verify(hash, password)).resolves.toBe(true);
    });

    it('should reject a different password', async () => {
      const hash = await hasher.hash(generateMockPassword());

      await expect(hasher.verify(hash, generateMockPassword())).resolves.toBe(
        false,
      );
    });
  });
});
