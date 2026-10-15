import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  generateRandomDate,
  generateRandomString,
} from '@test/mock/common.mock';
import { generateMockAccessToken } from '@test/mock/jwt-service.mock';
import {
  generateMockIssuedRefreshToken,
  generateMockRefreshToken,
  generateMockRefreshTokenJwt,
  generateMockRefreshTokenPayload,
} from '@test/mock/refresh-token.mock';
import { generateMockPublicUser } from '@test/mock/user.mock';
import { UserRepository } from '@users/repositories/user.repository';
import {
  generateMockUserRepository,
  type MockUserRepository,
} from '@users/repositories/user.repository.mock';
import { InvalidRefreshTokenError } from '../errors/invalid-refresh-token.error';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import {
  generateMockRefreshTokenRepository,
  type MockRefreshTokenRepository,
} from '../repositories/refresh-token.repository.mock';
import { RefreshTokenIssuerService } from '../services/refresh-token-issuer.service';
import {
  generateMockRefreshTokenIssuerService,
  type MockRefreshTokenIssuerService,
} from '../services/refresh-token-issuer.service.mock';
import { TokenHasherService } from '../services/token-hasher.service';
import {
  generateMockTokenHasherService,
  type MockTokenHasherService,
} from '../services/token-hasher.service.mock';
import { TokenIssuerService } from '../services/token-issuer.service';
import {
  generateMockTokenIssuerService,
  type MockTokenIssuerService,
} from '../services/token-issuer.service.mock';
import { RotateRefreshTokenUseCase } from './rotate-refresh-token.usecase';

describe('RotateRefreshTokenUseCase', () => {
  let useCase: RotateRefreshTokenUseCase;
  let refreshTokenIssuer: MockRefreshTokenIssuerService;
  let refreshTokenRepository: MockRefreshTokenRepository;
  let tokenHasher: MockTokenHasherService;
  let tokenIssuer: MockTokenIssuerService;
  let userRepository: MockUserRepository;
  let logError: jest.SpyInstance;

  beforeEach(async () => {
    refreshTokenIssuer = generateMockRefreshTokenIssuerService();
    refreshTokenRepository = generateMockRefreshTokenRepository();
    tokenHasher = generateMockTokenHasherService();
    tokenIssuer = generateMockTokenIssuerService();
    userRepository = generateMockUserRepository();
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RotateRefreshTokenUseCase,
        { provide: RefreshTokenIssuerService, useValue: refreshTokenIssuer },
        { provide: RefreshTokenRepository, useValue: refreshTokenRepository },
        { provide: TokenHasherService, useValue: tokenHasher },
        { provide: TokenIssuerService, useValue: tokenIssuer },
        { provide: UserRepository, useValue: userRepository },
      ],
    }).compile();

    useCase = moduleRef.get(RotateRefreshTokenUseCase);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Makes every lookup consistent: the token verifies to a stored, usable row of an existing user. */
  function givenValidSession() {
    const user = generateMockPublicUser();
    const payload = generateMockRefreshTokenPayload({ sub: user.id });
    const row = generateMockRefreshToken({ id: payload.jti, userId: user.id });
    refreshTokenIssuer.verify.mockResolvedValue(payload);
    refreshTokenRepository.findByIdWithTokenHash.mockResolvedValue(row);
    userRepository.findById.mockResolvedValue(user);
    return { user, payload, row };
  }

  function expectNothingRotated() {
    expect(refreshTokenIssuer.issue).not.toHaveBeenCalled();
    expect(tokenIssuer.issue).not.toHaveBeenCalled();
    expect(refreshTokenRepository.rotate).not.toHaveBeenCalled();
  }

  describe('execute', () => {
    describe('when the token is valid', () => {
      it('should verify the token and load the row of its jti', async () => {
        const token = generateMockRefreshTokenJwt();
        const { payload } = givenValidSession();

        await useCase.execute(token);

        expect(refreshTokenIssuer.verify).toHaveBeenCalledWith(token);
        expect(
          refreshTokenRepository.findByIdWithTokenHash,
        ).toHaveBeenCalledWith(payload.jti);
      });

      it('should issue the access token with the current role of the user', async () => {
        const { user } = givenValidSession();

        await useCase.execute(generateMockRefreshTokenJwt());

        expect(tokenIssuer.issue).toHaveBeenCalledWith(user);
      });

      it('should rotate the old row into a new one of the same family', async () => {
        const { user, row } = givenValidSession();
        const issued = generateMockIssuedRefreshToken({
          familyId: row.familyId,
        });
        refreshTokenIssuer.issue.mockResolvedValue(issued);

        await useCase.execute(generateMockRefreshTokenJwt());

        expect(refreshTokenIssuer.issue).toHaveBeenCalledWith(
          user.id,
          row.familyId,
        );
        expect(refreshTokenRepository.rotate).toHaveBeenCalledWith(row.id, {
          id: issued.id,
          familyId: row.familyId,
          userId: user.id,
          tokenHash: issued.tokenHash,
          expiresAt: issued.expiresAt,
        });
      });

      it('should sign both new tokens before touching the database', async () => {
        givenValidSession();

        await useCase.execute(generateMockRefreshTokenJwt());

        const [rotateOrder] = refreshTokenRepository.rotate.mock
          .invocationCallOrder as [number];
        expect(
          refreshTokenIssuer.issue.mock.invocationCallOrder[0],
        ).toBeLessThan(rotateOrder);
        expect(tokenIssuer.issue.mock.invocationCallOrder[0]).toBeLessThan(
          rotateOrder,
        );
      });

      it('should return the new access token and the raw new refresh token', async () => {
        const accessToken = generateMockAccessToken();
        const issued = generateMockIssuedRefreshToken();
        givenValidSession();
        tokenIssuer.issue.mockResolvedValue({ accessToken });
        refreshTokenIssuer.issue.mockResolvedValue(issued);

        await expect(
          useCase.execute(generateMockRefreshTokenJwt()),
        ).resolves.toEqual({ accessToken, refreshToken: issued.token });
      });
    });

    describe('when the token cannot be exchanged', () => {
      it('should rethrow the verification failure', async () => {
        const failure = new InvalidRefreshTokenError();
        refreshTokenIssuer.verify.mockRejectedValue(failure);

        await expect(
          useCase.execute(generateMockRefreshTokenJwt()),
        ).rejects.toBe(failure);
        expectNothingRotated();
      });

      it('should throw InvalidRefreshTokenError for an unknown jti', async () => {
        givenValidSession();
        refreshTokenRepository.findByIdWithTokenHash.mockResolvedValue(null);

        await expect(
          useCase.execute(generateMockRefreshTokenJwt()),
        ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
        expectNothingRotated();
      });

      it('should throw InvalidRefreshTokenError when the hash does not match', async () => {
        givenValidSession();
        tokenHasher.matches.mockReturnValue(false);

        await expect(
          useCase.execute(generateMockRefreshTokenJwt()),
        ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
        expectNothingRotated();
      });

      it('should throw InvalidRefreshTokenError for a token that was already used', async () => {
        const { row } = givenValidSession();
        refreshTokenRepository.findByIdWithTokenHash.mockResolvedValue({
          ...row,
          revokedAt: generateRandomDate(),
          replacedBy: generateRandomString(),
        });

        await expect(
          useCase.execute(generateMockRefreshTokenJwt()),
        ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
        expectNothingRotated();
      });

      it('should throw InvalidRefreshTokenError when the row has expired', async () => {
        const { row } = givenValidSession();
        refreshTokenRepository.findByIdWithTokenHash.mockResolvedValue({
          ...row,
          expiresAt: generateRandomDate(new Date(0), new Date(Date.now() - 1)),
        });

        await expect(
          useCase.execute(generateMockRefreshTokenJwt()),
        ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
        expectNothingRotated();
      });

      it('should throw InvalidRefreshTokenError when the user no longer exists', async () => {
        givenValidSession();
        userRepository.findById.mockResolvedValue(null);

        await expect(
          useCase.execute(generateMockRefreshTokenJwt()),
        ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
        expectNothingRotated();
      });

      it('should throw InvalidRefreshTokenError when another request wins the race', async () => {
        givenValidSession();
        refreshTokenRepository.rotate.mockResolvedValue(false);

        await expect(
          useCase.execute(generateMockRefreshTokenJwt()),
        ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
      });
    });

    it('should log the jti, but never the token or the stored hash, when a validly signed token does not match its hash', async () => {
      const token = generateMockRefreshTokenJwt();
      const { payload, row } = givenValidSession();
      tokenHasher.matches.mockReturnValue(false);

      await useCase.execute(token).catch(() => undefined);

      const logged = JSON.stringify(logError.mock.calls);
      expect(logError).toHaveBeenCalledTimes(1);
      expect(logged).toContain(payload.jti);
      expect(logged).not.toContain(token);
      expect(logged).not.toContain(row.tokenHash);
    });
  });
});
