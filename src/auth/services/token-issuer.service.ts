import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { PublicUser } from '@users/dto/public-user.dto';
import type { AccessTokenDto } from '../dto/access-token.dto';

/** The only place that knows the access token payload shape. */
@Injectable()
export class TokenIssuerService {
  constructor(private readonly jwtService: JwtService) {}

  async issue({
    id,
    role,
  }: Pick<PublicUser, 'id' | 'role'>): Promise<AccessTokenDto> {
    const accessToken = await this.jwtService.signAsync({ sub: id, role });
    return { accessToken };
  }
}
