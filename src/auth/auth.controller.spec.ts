import { Test } from '@nestjs/testing';
import { generateMockRegisterDto } from '../../test/mock/auth.mock';
import { generateMockAccessToken } from '../../test/mock/jwt-service.mock';
import {
  generateMockRegisterUseCase,
  type MockRegisterUseCase,
} from '../../test/mock/register-usecase.mock';
import { EmailAlreadyExistsError } from '../users/errors/email-already-exists.error';
import { AuthController } from './auth.controller';
import { RegisterUseCase } from './usecases/register.usecase';

describe('AuthController', () => {
  let controller: AuthController;
  let registerUseCase: MockRegisterUseCase;

  beforeEach(async () => {
    registerUseCase = generateMockRegisterUseCase();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: RegisterUseCase, useValue: registerUseCase }],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  describe('register', () => {
    it('should pass the request body to the register use case', async () => {
      const dto = generateMockRegisterDto();

      await controller.register(dto);

      expect(registerUseCase.execute).toHaveBeenCalledWith(dto);
    });

    it('should return the access token from the register use case', async () => {
      const result = { accessToken: generateMockAccessToken() };
      registerUseCase.execute.mockResolvedValue(result);

      await expect(
        controller.register(generateMockRegisterDto()),
      ).resolves.toEqual(result);
    });

    it('should propagate EmailAlreadyExistsError to the exception filter', async () => {
      registerUseCase.execute.mockRejectedValue(new EmailAlreadyExistsError());

      await expect(
        controller.register(generateMockRegisterDto()),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
    });
  });
});
