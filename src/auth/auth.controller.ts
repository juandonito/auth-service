import { Body, Controller, Post } from '@nestjs/common';
import type { AccessTokenDto } from './dto/access-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterUserUseCase } from './usecases/register-user.usecase';

@Controller('auth')
export class AuthController {
  constructor(private readonly registerUserUseCase: RegisterUserUseCase) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AccessTokenDto> {
    return this.registerUserUseCase.execute(dto);
  }
}
