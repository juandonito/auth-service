import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { generateMockRegisterDto } from '../../../test/mock/auth.mock';
import {
  generateMockAccessToken,
  generateMockJwtService,
  type MockJwtService,
} from '../../../test/mock/jwt-service.mock';
import { generateMockPublicUser } from '../../../test/mock/user.mock';
import { EmailAlreadyExistsError } from '../../users/errors/email-already-exists.error';
import { CreateUserUseCase } from '../../users/usecases/create-user.usecase';
import { RegisterUserUseCase } from './register-user.usecase';

describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCase;
  let createUserUseCase: { execute: jest.Mock };
  let jwtService: MockJwtService;

  beforeEach(async () => {
    createUserUseCase = {
      execute: jest.fn().mockResolvedValue(generateMockPublicUser()),
    };
    jwtService = generateMockJwtService();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RegisterUserUseCase,
        { provide: CreateUserUseCase, useValue: createUserUseCase },
        { provide: JwtService, useValue: jwtService },
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

    it('should sign the access token with the created user id and role', async () => {
      const user = generateMockPublicUser();
      createUserUseCase.execute.mockResolvedValue(user);

      await useCase.execute(generateMockRegisterDto());

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        role: user.role,
      });
    });

    it('should return only the signed access token', async () => {
      const accessToken = generateMockAccessToken();
      jwtService.signAsync.mockResolvedValue(accessToken);

      const result = await useCase.execute(generateMockRegisterDto());

      expect(result).toEqual({ accessToken });
    });

    it('should propagate EmailAlreadyExistsError without signing a token', async () => {
      createUserUseCase.execute.mockRejectedValue(
        new EmailAlreadyExistsError(),
      );

      await expect(
        useCase.execute(generateMockRegisterDto()),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });
});
