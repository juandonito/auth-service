import { Test } from '@nestjs/testing';
import { generateMockLoginDto } from '@test/mock/auth.mock';
import { generateMockAccessToken } from '@test/mock/jwt-service.mock';
import { generateMockUser } from '@test/mock/user.mock';
import { UserRepository } from '@users/repositories/user.repository';
import {
  generateMockUserRepository,
  type MockUserRepository,
} from '@users/repositories/user.repository.mock';
import { PasswordHasher } from '@users/services/password-hasher.service';
import {
  generateMockPasswordHasher,
  type MockPasswordHasher,
} from '@users/services/password-hasher.service.mock';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import { TokenIssuer } from '../services/token-issuer.service';
import {
  generateMockTokenIssuer,
  type MockTokenIssuer,
} from '../services/token-issuer.service.mock';
import { LoginUserUseCase } from './login-user.usecase';

describe('LoginUserUseCase', () => {
  let useCase: LoginUserUseCase;
  let userRepository: MockUserRepository;
  let passwordHasher: MockPasswordHasher;
  let tokenIssuer: MockTokenIssuer;

  beforeEach(async () => {
    userRepository = generateMockUserRepository();
    passwordHasher = generateMockPasswordHasher();
    tokenIssuer = generateMockTokenIssuer();
    const moduleRef = await Test.createTestingModule({
      providers: [
        LoginUserUseCase,
        { provide: UserRepository, useValue: userRepository },
        { provide: PasswordHasher, useValue: passwordHasher },
        { provide: TokenIssuer, useValue: tokenIssuer },
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
});
