import { Body, Controller, Post } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { RegisterResult, RegisterUseCase } from './usecases/register.usecase';

@Controller('auth')
export class AuthController {
  constructor(private readonly registerUseCase: RegisterUseCase) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<RegisterResult> {
    return this.registerUseCase.execute(dto);
  }
}
