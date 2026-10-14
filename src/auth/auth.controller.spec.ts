import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import {
  generateMockLoginDto,
  generateMockRegisterDto,
} from '@test/mock/auth.mock';
import { generateMockAccessToken } from '@test/mock/jwt-service.mock';
import {
  generateMockLoginUserUseCase,
  type MockLoginUserUseCase,
} from './usecases/login-user.usecase.mock';
import {
  generateMockRegisterUserUseCase,
  type MockRegisterUserUseCase,
} from './usecases/register-user.usecase.mock';
import { EmailAlreadyExistsError } from '@users/errors/email-already-exists.error';
import { AuthController } from './auth.controller';
import { InvalidCredentialsError } from './errors/invalid-credentials.error';
import { LoginUserUseCase } from './usecases/login-user.usecase';
import { RegisterUserUseCase } from './usecases/register-user.usecase';

describe('AuthController', () => {
  let controller: AuthController;
  let registerUserUseCase: MockRegisterUserUseCase;
  let loginUserUseCase: MockLoginUserUseCase;

  beforeEach(async () => {
    registerUserUseCase = generateMockRegisterUserUseCase();
    loginUserUseCase = generateMockLoginUserUseCase();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: RegisterUserUseCase, useValue: registerUserUseCase },
        { provide: LoginUserUseCase, useValue: loginUserUseCase },
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

  describe('login', () => {
    it('should pass the request body to the login use case', async () => {
      const dto = generateMockLoginDto();

      await controller.login(dto);

      expect(loginUserUseCase.execute).toHaveBeenCalledWith(dto);
    });

    it('should return the access token from the login use case', async () => {
      const result = { accessToken: generateMockAccessToken() };
      loginUserUseCase.execute.mockResolvedValue(result);

      await expect(controller.login(generateMockLoginDto())).resolves.toEqual(
        result,
      );
    });

    it('should propagate InvalidCredentialsError to the exception filter', async () => {
      loginUserUseCase.execute.mockRejectedValue(new InvalidCredentialsError());

      await expect(
        controller.login(generateMockLoginDto()),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it('should respond 200 rather than the POST default of 201', () => {
      const { value: handler } = Object.getOwnPropertyDescriptor(
        AuthController.prototype,
        'login',
      ) as PropertyDescriptor;

      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(
        HttpStatus.OK,
      );
    });
  });
});
