import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generateMockLoginDto } from '@test/mock/auth.mock';
import { generateRandomString } from '@test/mock/common.mock';
import { generateMockAccessToken } from '@test/mock/jwt-service.mock';
import { generateMockUser } from '@test/mock/user.mock';
import { UserRepository } from '@users/repositories/user.repository';
import {
  generateMockUserRepository,
  type MockUserRepository,
} from '@users/repositories/user.repository.mock';
import { PasswordHasherService } from '@users/services/password-hasher.service';
import {
  generateMockPasswordHasherService,
  type MockPasswordHasherService,
} from '@users/services/password-hasher.service.mock';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import { TokenIssuerService } from '../services/token-issuer.service';
import {
  generateMockTokenIssuerService,
  type MockTokenIssuerService,
} from '../services/token-issuer.service.mock';
import { LoginUserUseCase } from './login-user.usecase';

const silenceLoggerError = () =>
  jest.spyOn(Logger.prototype, 'error').mockImplementation();

describe('LoginUserUseCase', () => {
  let useCase: LoginUserUseCase;
  let userRepository: MockUserRepository;
  let passwordHasher: MockPasswordHasherService;
  let tokenIssuer: MockTokenIssuerService;

  beforeEach(async () => {
    userRepository = generateMockUserRepository();
    passwordHasher = generateMockPasswordHasherService();
    tokenIssuer = generateMockTokenIssuerService();
    const moduleRef = await Test.createTestingModule({
      providers: [
        LoginUserUseCase,
        { provide: UserRepository, useValue: userRepository },
        { provide: PasswordHasherService, useValue: passwordHasher },
        { provide: TokenIssuerService, useValue: tokenIssuer },
      ],
    }).compile();

    useCase = moduleRef.get(LoginUserUseCase);
  });

  describe('execute', () => {
    it('should look the user up by the login email', async () => {
      const dto = generateMockLoginDto();

      await useCase.execute(dto);

      expect(userRepository.findByEmailWithPasswordHash).toHaveBeenCalledWith(
        dto.email,
      );
    });

    it('should verify the password against the stored hash of the user found', async () => {
      const user = generateMockUser();
      const dto = generateMockLoginDto({ email: user.email });
      userRepository.findByEmailWithPasswordHash.mockResolvedValue(user);

      await useCase.execute(dto);

      expect(passwordHasher.verify).toHaveBeenCalledWith(
        user.passwordHash,
        dto.password,
      );
    });

    it('should not run the dummy verification for a known email', async () => {
      await useCase.execute(generateMockLoginDto());

      expect(passwordHasher.verifyDummy).not.toHaveBeenCalled();
    });

    it('should issue the access token for the authenticated user', async () => {
      const user = generateMockUser();
      userRepository.findByEmailWithPasswordHash.mockResolvedValue(user);

      await useCase.execute(generateMockLoginDto({ email: user.email }));

      expect(tokenIssuer.issue).toHaveBeenCalledWith(user);
    });

    it('should return the issued access token', async () => {
      const result = { accessToken: generateMockAccessToken() };
      tokenIssuer.issue.mockResolvedValue(result);

      await expect(useCase.execute(generateMockLoginDto())).resolves.toEqual(
        result,
      );
    });

    it('should throw InvalidCredentialsError for a wrong password without issuing a token', async () => {
      passwordHasher.verify.mockResolvedValue(false);

      await expect(
        useCase.execute(generateMockLoginDto()),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
      expect(tokenIssuer.issue).not.toHaveBeenCalled();
    });

    it('should throw InvalidCredentialsError for an unknown email without issuing a token', async () => {
      userRepository.findByEmailWithPasswordHash.mockResolvedValue(null);

      await expect(
        useCase.execute(generateMockLoginDto()),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
      expect(tokenIssuer.issue).not.toHaveBeenCalled();
    });

    it('should run the dummy verification with the login password for an unknown email', async () => {
      const dto = generateMockLoginDto();
      userRepository.findByEmailWithPasswordHash.mockResolvedValue(null);

      await useCase.execute(dto).catch(() => undefined);

      expect(passwordHasher.verifyDummy).toHaveBeenCalledWith(dto.password);
    });

    it('should not verify against any stored hash for an unknown email', async () => {
      userRepository.findByEmailWithPasswordHash.mockResolvedValue(null);

      await useCase.execute(generateMockLoginDto()).catch(() => undefined);

      expect(passwordHasher.verify).not.toHaveBeenCalled();
    });
  });

  describe('when the stored hash cannot be verified', () => {
    let logError: ReturnType<typeof silenceLoggerError>;

    beforeEach(() => {
      passwordHasher.verify.mockRejectedValue(
        new Error(generateRandomString()),
      );
      logError = silenceLoggerError();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should throw InvalidCredentialsError instead of the verification failure', async () => {
      await expect(
        useCase.execute(generateMockLoginDto()),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it('should not issue a token', async () => {
      await useCase.execute(generateMockLoginDto()).catch(() => undefined);

      expect(tokenIssuer.issue).not.toHaveBeenCalled();
    });

    it('should run the dummy verification so it costs the same as an unknown email', async () => {
      const dto = generateMockLoginDto();

      await useCase.execute(dto).catch(() => undefined);

      expect(passwordHasher.verifyDummy).toHaveBeenCalledWith(dto.password);
    });

    it('should log the failure with the user id but neither the password nor the hash', async () => {
      const user = generateMockUser();
      const dto = generateMockLoginDto({ email: user.email });
      userRepository.findByEmailWithPasswordHash.mockResolvedValue(user);

      await useCase.execute(dto).catch(() => undefined);

      const logged = JSON.stringify(logError.mock.calls);
      expect(logError).toHaveBeenCalledTimes(1);
      expect(logged).toContain(user.id);
      expect(logged).not.toContain(dto.password);
      expect(logged).not.toContain(user.passwordHash);
    });

    it('should also handle a rejection that is not an Error', async () => {
      passwordHasher.verify.mockRejectedValue(generateRandomString());

      await expect(
        useCase.execute(generateMockLoginDto()),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });
  });
});
