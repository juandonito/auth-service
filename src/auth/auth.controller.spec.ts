import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import {
  generateMockLoginDto,
  generateMockRefreshDto,
  generateMockRegisterDto,
} from '@test/mock/auth.mock';
import { generateMockAccessToken } from '@test/mock/jwt-service.mock';
import { generateMockRefreshTokenJwt } from '@test/mock/refresh-token.mock';
import {
  generateMockLoginUserUseCase,
  type MockLoginUserUseCase,
} from './usecases/login-user.usecase.mock';
import {
  generateMockRotateRefreshTokenUseCase,
  type MockRotateRefreshTokenUseCase,
} from './usecases/rotate-refresh-token.usecase.mock';
import {
  generateMockRegisterUserUseCase,
  type MockRegisterUserUseCase,
} from './usecases/register-user.usecase.mock';
import { EmailAlreadyExistsError } from '@users/errors/email-already-exists.error';
import { AuthController } from './auth.controller';
import { InvalidCredentialsError } from './errors/invalid-credentials.error';
import { InvalidRefreshTokenError } from './errors/invalid-refresh-token.error';
import { LoginUserUseCase } from './usecases/login-user.usecase';
import { RegisterUserUseCase } from './usecases/register-user.usecase';
import { RotateRefreshTokenUseCase } from './usecases/rotate-refresh-token.usecase';

describe('AuthController', () => {
  let controller: AuthController;
  let registerUserUseCase: MockRegisterUserUseCase;
  let loginUserUseCase: MockLoginUserUseCase;
  let rotateRefreshTokenUseCase: MockRotateRefreshTokenUseCase;

  beforeEach(async () => {
    registerUserUseCase = generateMockRegisterUserUseCase();
    loginUserUseCase = generateMockLoginUserUseCase();
    rotateRefreshTokenUseCase = generateMockRotateRefreshTokenUseCase();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: RegisterUserUseCase, useValue: registerUserUseCase },
        { provide: LoginUserUseCase, useValue: loginUserUseCase },
        {
          provide: RotateRefreshTokenUseCase,
          useValue: rotateRefreshTokenUseCase,
        },
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

    it('should return the access and refresh tokens from the login use case', async () => {
      const result = {
        accessToken: generateMockAccessToken(),
        refreshToken: generateMockRefreshTokenJwt(),
      };
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

  describe('refresh', () => {
    it('should pass the refresh token of the body to the rotate use case', async () => {
      const dto = generateMockRefreshDto();

      await controller.refresh(dto);

      expect(rotateRefreshTokenUseCase.execute).toHaveBeenCalledWith(
        dto.refreshToken,
      );
    });

    it('should return the new access and refresh tokens', async () => {
      const result = {
        accessToken: generateMockAccessToken(),
        refreshToken: generateMockRefreshTokenJwt(),
      };
      rotateRefreshTokenUseCase.execute.mockResolvedValue(result);

      await expect(
        controller.refresh(generateMockRefreshDto()),
      ).resolves.toEqual(result);
    });

    it('should propagate InvalidRefreshTokenError to the exception filter', async () => {
      rotateRefreshTokenUseCase.execute.mockRejectedValue(
        new InvalidRefreshTokenError(),
      );

      await expect(
        controller.refresh(generateMockRefreshDto()),
      ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    });

    it('should respond 200 rather than the POST default of 201', () => {
      const { value: handler } = Object.getOwnPropertyDescriptor(
        AuthController.prototype,
        'refresh',
      ) as PropertyDescriptor;

      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(
        HttpStatus.OK,
      );
    });
  });
});
