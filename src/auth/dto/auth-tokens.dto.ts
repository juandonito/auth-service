import type { AccessTokenDto } from './access-token.dto';

export interface AuthTokensDto extends AccessTokenDto {
  /** The raw refresh token, returned once and never stored. */
  refreshToken: string;
}
