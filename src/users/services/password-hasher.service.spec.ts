import { Test } from '@nestjs/testing';
import { generateMockPassword } from '@test/mock/auth.mock';
import { generateRandomString } from '@test/mock/common.mock';
import { PasswordHasherService } from './password-hasher.service';

describe('PasswordHasherService', () => {
  let hasher: PasswordHasherService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PasswordHasherService],
    }).compile();

    hasher = moduleRef.get(PasswordHasherService);
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

  describe('when the dummy hash cannot be built', () => {
    let failure: Error;
    let brokenHasher: PasswordHasherService;

    beforeEach(() => {
      failure = new Error(generateRandomString());
      // Spies on the prototype (shared by every instance), so restore it below.
      jest
        .spyOn(PasswordHasherService.prototype, 'hash')
        .mockRejectedValueOnce(failure);
      brokenHasher = new PasswordHasherService();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should not throw at construction', () => {
      expect(brokenHasher).toBeInstanceOf(PasswordHasherService);
    });

    it('should make onModuleInit reject so the application refuses to start', async () => {
      await expect(brokenHasher.onModuleInit()).rejects.toBe(failure);
    });

    it('should make verifyDummy reject rather than skip the verification', async () => {
      await expect(
        brokenHasher.verifyDummy(generateMockPassword()),
      ).rejects.toBe(failure);
    });
  });

  describe('onModuleInit', () => {
    it('should resolve once the dummy hash is built', async () => {
      await expect(hasher.onModuleInit()).resolves.toBeUndefined();
    });
  });
});
