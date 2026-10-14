import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AccessTokenDto } from './dto/access-token.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginUserUseCase } from './usecases/login-user.usecase';
import { RegisterUserUseCase } from './usecases/register-user.usecase';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AccessTokenDto> {
    return this.registerUserUseCase.execute(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AccessTokenDto> {
    return this.loginUserUseCase.execute(dto);
  }
}
