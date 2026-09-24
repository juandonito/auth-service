import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreateUserUseCase } from '@users/usecases/create-user.usecase';
import type { AccessTokenDto } from '../dto/access-token.dto';
import type { RegisterDto } from '../dto/register.dto';

@Injectable()
export class RegisterUserUseCase {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly jwtService: JwtService,
  ) {}

  async execute({ email, password }: RegisterDto): Promise<AccessTokenDto> {
    const user = await this.createUserUseCase.execute({ email, password });
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });
    return { accessToken };
  }
}
