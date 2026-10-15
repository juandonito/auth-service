import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  generateRandomDate,
  generateRandomId,
  generateRandomString,
  pickRandom,
} from '@test/mock/common.mock';
import {
  generateMockConfigService,
  type MockConfigService,
} from '@test/mock/config-service.mock';
import {
  generateMockJwtService,
  type MockJwtService,
} from '@test/mock/jwt-service.mock';
import {
  generateMockRefreshTokenJwt,
  generateMockRefreshTokenPayload,
} from '@test/mock/refresh-token.mock';
import { InvalidRefreshTokenError } from '../errors/invalid-refresh-token.error';
import { RefreshTokenIssuerService } from './refresh-token-issuer.service';
import {
  generateMockTokenHasherService,
  type MockTokenHasherService,
} from './token-hasher.service.mock';
import { TokenHasherService } from './token-hasher.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('RefreshTokenIssuerService', () => {
  let issuer: RefreshTokenIssuerService;
  let jwtService: MockJwtService;
  let config: MockConfigService;
  let tokenHasher: MockTokenHasherService;
  let secret: string;
  let ttl: string;

  const compile = () =>
    Test.createTestingModule({
      providers: [
        RefreshTokenIssuerService,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
        { provide: TokenHasherService, useValue: tokenHasher },
      ],
    }).compile();

  beforeEach(async () => {
    jwtService = generateMockJwtService();
    config = generateMockConfigService();
    tokenHasher = generateMockTokenHasherService();
    secret = generateRandomString(32);
    ttl = pickRandom(['1h', '7d', '30d']);
    config.getOrThrow.mockImplementation((key: string) =>
      key === 'JWT_REFRESH_SECRET' ? secret : ttl,
    );

    issuer = (await compile()).get(RefreshTokenIssuerService);
  });

  describe('configuration', () => {
    it('should read the refresh secret with getOrThrow', () => {
      expect(config.getOrThrow).toHaveBeenCalledWith('JWT_REFRESH_SECRET');
    });

    it('should read the refresh lifetime with getOrThrow, without a default', () => {
      expect(config.getOrThrow).toHaveBeenCalledWith('JWT_REFRESH_EXPIRES_IN');
    });

    it.each(['JWT_REFRESH_SECRET', 'JWT_REFRESH_EXPIRES_IN'])(
      'should refuse to start when %s is missing',
      async (missingKey) => {
        const failure = new Error(generateRandomString());
        config.getOrThrow.mockImplementation((key: string) => {
          if (key === missingKey) {
            throw failure;
          }
          return generateRandomString();
        });

        await expect(compile()).rejects.toBe(failure);
      },
    );
  });

  describe('issue', () => {
    it('should sign the user id as sub with the refresh secret, HS256, the lifetime and the new id as jti', async () => {
      const userId = generateRandomId();

      const issued = await issuer.issue(userId);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: userId },
        {
          secret,
          algorithm: 'HS256',
          expiresIn: ttl,
          jwtid: issued.id,
        },
      );
    });

    it('should generate a new uuid id on every call', async () => {
      const first = await issuer.issue(generateRandomId());
      const second = await issuer.issue(generateRandomId());

      expect(first.id).toMatch(UUID);
      expect(second.id).toMatch(UUID);
      expect(first.id).not.toBe(second.id);
    });

    it('should return the signed token', async () => {
      const token = generateMockRefreshTokenJwt();
      jwtService.signAsync.mockResolvedValue(token);

      const issued = await issuer.issue(generateRandomId());

      expect(issued.token).toBe(token);
    });

    it('should return the hash of the signed token and never store the token as the hash', async () => {
      const token = generateMockRefreshTokenJwt();
      jwtService.signAsync.mockResolvedValue(token);

      const issued = await issuer.issue(generateRandomId());

      expect(tokenHasher.hash).toHaveBeenCalledWith(token);
      expect(issued.tokenHash).toBe(tokenHasher.hash.mock.results[0].value);
      expect(issued.tokenHash).not.toBe(token);
    });

    it('should set expiresAt to the exp claim of the signed token', async () => {
      const token = generateMockRefreshTokenJwt();
      const { exp } = generateMockRefreshTokenPayload();
      jwtService.signAsync.mockResolvedValue(token);
      jwtService.decode.mockReturnValue({ exp });

      const issued = await issuer.issue(generateRandomId());

      expect(jwtService.decode).toHaveBeenCalledWith(token);
      expect(issued.expiresAt).toEqual(new Date(exp * 1000));
    });

    it.each([
      ['null', () => null],
      ['a string', () => generateRandomString()],
      ['an object without exp', () => ({ sub: generateRandomId() })],
    ])(
      'should throw when the signed token decodes to %s',
      async (_label, makeDecoded) => {
        jwtService.decode.mockReturnValue(makeDecoded());

        await expect(issuer.issue(generateRandomId())).rejects.toThrow(
          'refresh token has no exp claim',
        );
      },
    );

    it('should start a new family when none is given', async () => {
      const first = await issuer.issue(generateRandomId());
      const second = await issuer.issue(generateRandomId());

      expect(first.familyId).toMatch(UUID);
      expect(first.familyId).not.toBe(second.familyId);
    });

    it('should keep the given family', async () => {
      const familyId = generateRandomId();

      const issued = await issuer.issue(generateRandomId(), familyId);

      expect(issued.familyId).toBe(familyId);
    });
  });

  describe('verify', () => {
    let logError: jest.SpyInstance;

    beforeEach(() => {
      logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should verify with the refresh secret and only accept HS256', async () => {
      const token = generateMockRefreshTokenJwt();

      await issuer.verify(token);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(token, {
        secret,
        algorithms: ['HS256'],
      });
    });

    it('should return only the sub and jti of a valid token', async () => {
      const payload = generateMockRefreshTokenPayload();
      jwtService.verifyAsync.mockResolvedValue(payload);

      await expect(
        issuer.verify(generateMockRefreshTokenJwt()),
      ).resolves.toEqual({ sub: payload.sub, jti: payload.jti });
    });

    it.each([
      [
        'a JsonWebTokenError',
        () => new JsonWebTokenError(generateRandomString()),
      ],
      [
        'a TokenExpiredError',
        () =>
          new TokenExpiredError(generateRandomString(), generateRandomDate()),
      ],
      ['an unexpected error', () => new Error(generateRandomString())],
    ])(
      'should reject with InvalidRefreshTokenError when the verification fails with %s',
      async (_label, makeError) => {
        jwtService.verifyAsync.mockRejectedValue(makeError());

        await expect(
          issuer.verify(generateMockRefreshTokenJwt()),
        ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
      },
    );

    it.each([
      [
        'a JsonWebTokenError',
        () => new JsonWebTokenError(generateRandomString()),
      ],
      [
        'a TokenExpiredError',
        () =>
          new TokenExpiredError(generateRandomString(), generateRandomDate()),
      ],
    ])('should not log a routine rejection (%s)', async (_label, makeError) => {
      jwtService.verifyAsync.mockRejectedValue(makeError());

      await expect(
        issuer.verify(generateMockRefreshTokenJwt()),
      ).rejects.toBeInstanceOf(InvalidRefreshTokenError);

      expect(logError).not.toHaveBeenCalled();
    });

    it('should log the stack of an unexpected verification error', async () => {
      const failure = new Error(generateRandomString());
      jwtService.verifyAsync.mockRejectedValue(failure);

      await expect(
        issuer.verify(generateMockRefreshTokenJwt()),
      ).rejects.toBeInstanceOf(InvalidRefreshTokenError);

      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith(expect.any(String), failure.stack);
    });

    it('should never log the token', async () => {
      const token = generateMockRefreshTokenJwt();
      jwtService.verifyAsync.mockRejectedValue(
        new Error(generateRandomString()),
      );

      await expect(issuer.verify(token)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );

      expect(JSON.stringify(logError.mock.calls)).not.toContain(token);
    });

    it.each([
      ['a missing sub', () => ({ jti: generateRandomId() })],
      ['a missing jti', () => ({ sub: generateRandomId() })],
      ['an empty sub', () => ({ sub: '', jti: generateRandomId() })],
      ['an empty jti', () => ({ sub: generateRandomId(), jti: '' })],
      ['a non-string sub', () => ({ sub: 42, jti: generateRandomId() })],
      ['a non-string jti', () => ({ sub: generateRandomId(), jti: 42 })],
      ['a payload that is not an object', () => generateRandomString()],
    ])(
      'should reject a validly signed token with %s',
      async (_label, makePayload) => {
        jwtService.verifyAsync.mockResolvedValue(makePayload());

        await expect(
          issuer.verify(generateMockRefreshTokenJwt()),
        ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
      },
    );
  });
});
