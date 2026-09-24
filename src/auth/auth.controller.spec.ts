import { Test } from '@nestjs/testing';
import { generateMockRegisterDto } from '@test/mock/auth.mock';
import { generateMockAccessToken } from '@test/mock/jwt-service.mock';
import {
  generateMockRegisterUserUseCase,
  type MockRegisterUserUseCase,
} from './usecases/register-user.usecase.mock';
import { EmailAlreadyExistsError } from '@users/errors/email-already-exists.error';
import { AuthController } from './auth.controller';
import { RegisterUserUseCase } from './usecases/register-user.usecase';

describe('AuthController', () => {
  let controller: AuthController;
  let registerUserUseCase: MockRegisterUserUseCase;

  beforeEach(async () => {
    registerUserUseCase = generateMockRegisterUserUseCase();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: RegisterUserUseCase, useValue: registerUserUseCase },
      ],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  describe('register', () => {
    it('should pass the request body to the register use case', async () => {
      const dto = generateMockRegisterDto();

      await controller.register(dto);

      expect(registerUserUseCase.execute).toHaveBeenCalledWith(dto);
    });

    it('should return the access token from the register use case', async () => {
      const result = { accessToken: generateMockAccessToken() };
      registerUserUseCase.execute.mockResolvedValue(result);

      await expect(
        controller.register(generateMockRegisterDto()),
      ).resolves.toEqual(result);
    });

    it('should propagate EmailAlreadyExistsError to the exception filter', async () => {
      registerUserUseCase.execute.mockRejectedValue(
        new EmailAlreadyExistsError(),
      );

      await expect(
        controller.register(generateMockRegisterDto()),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
    });
  });
});
