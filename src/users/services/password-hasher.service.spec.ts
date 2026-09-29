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

  describe('verifyDummy', () => {
    it('should run an argon2 verification against an argon2id hash', async () => {
      const verify = jest.spyOn(hasher, 'verify');
      const password = generateMockPassword();

      await hasher.verifyDummy(password);

      expect(verify).toHaveBeenCalledWith(
        expect.stringMatching(/^\$argon2id\$/),
        password,
      );
    });

    it('should never leak whether the password matched', async () => {
      await expect(
        hasher.verifyDummy(generateMockPassword()),
      ).resolves.toBeUndefined();
    });

    it('should verify against the same dummy hash on every call', async () => {
      const verify = jest.spyOn(hasher, 'verify');

      await hasher.verifyDummy(generateMockPassword());
      await hasher.verifyDummy(generateMockPassword());

      expect(verify.mock.calls[0][0]).toBe(verify.mock.calls[1][0]);
    });
  });
});
