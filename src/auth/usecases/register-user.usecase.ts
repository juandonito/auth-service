import { Injectable } from '@nestjs/common';
import { CreateUserUseCase } from '@users/usecases/create-user.usecase';
import type { AccessTokenDto } from '../dto/access-token.dto';
import type { RegisterDto } from '../dto/register.dto';
import { TokenIssuer } from '../services/token-issuer.service';

@Injectable()
export class RegisterUserUseCase {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute({ email, password }: RegisterDto): Promise<AccessTokenDto> {
    const user = await this.createUserUseCase.execute({ email, password });
    return this.tokenIssuer.issue(user);
  }
}
