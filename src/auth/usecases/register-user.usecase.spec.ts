import { Test } from '@nestjs/testing';
import { generateMockRegisterDto } from '@test/mock/auth.mock';
import { generateMockAccessToken } from '@test/mock/jwt-service.mock';
import { generateMockPublicUser } from '@test/mock/user.mock';
import { EmailAlreadyExistsError } from '@users/errors/email-already-exists.error';
import { CreateUserUseCase } from '@users/usecases/create-user.usecase';
import { TokenIssuerService } from '../services/token-issuer.service';
import {
  generateMockTokenIssuerService,
  type MockTokenIssuerService,
} from '../services/token-issuer.service.mock';
import { RegisterUserUseCase } from './register-user.usecase';

describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCase;
  let createUserUseCase: { execute: jest.Mock };
  let tokenIssuer: MockTokenIssuerService;

  beforeEach(async () => {
    createUserUseCase = {
      execute: jest.fn().mockResolvedValue(generateMockPublicUser()),
    };
    tokenIssuer = generateMockTokenIssuerService();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RegisterUserUseCase,
        { provide: CreateUserUseCase, useValue: createUserUseCase },
        { provide: TokenIssuerService, useValue: tokenIssuer },
      ],
    }).compile();

    useCase = moduleRef.get(RegisterUserUseCase);
  });

  describe('execute', () => {
    it('should delegate user creation to CreateUserUseCase with the register email and password', async () => {
      const dto = generateMockRegisterDto();

      await useCase.execute(dto);

      expect(createUserUseCase.execute).toHaveBeenCalledWith({
        email: dto.email,
        password: dto.password,
      });
    });

    it('should issue the access token for the created user', async () => {
      const user = generateMockPublicUser();
      createUserUseCase.execute.mockResolvedValue(user);

      await useCase.execute(generateMockRegisterDto());

      expect(tokenIssuer.issue).toHaveBeenCalledWith(user);
    });

    it('should return the issued access token', async () => {
      const result = { accessToken: generateMockAccessToken() };
      tokenIssuer.issue.mockResolvedValue(result);

      await expect(useCase.execute(generateMockRegisterDto())).resolves.toEqual(
        result,
      );
    });

    it('should propagate EmailAlreadyExistsError without issuing a token', async () => {
      createUserUseCase.execute.mockRejectedValue(
        new EmailAlreadyExistsError(),
      );

      await expect(
        useCase.execute(generateMockRegisterDto()),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
      expect(tokenIssuer.issue).not.toHaveBeenCalled();
    });
  });
});
