import type { IssuedRefreshToken } from '@auth/dto/issued-refresh-token.dto';
import {
  generateRandomDate,
  generateRandomId,
  generateRandomInt,
  generateRandomString,
} from './common.mock';

/** Claims of a verified refresh token JWT. */
export function generateMockRefreshTokenPayload(
  overrides: Partial<{
    sub: string;
    jti: string;
    iat: number;
    exp: number;
  }> = {},
) {
  const iat = Math.floor(Date.now() / 1000);
  return {
    sub: generateRandomId(),
    jti: generateRandomId(),
    iat,
    exp: iat + generateRandomInt(60, 7 * 24 * 60 * 60),
    ...overrides,
  };
}

/** A freshly issued refresh token, with the hash and expiry of its row. */
export function generateMockIssuedRefreshToken(
  overrides: Partial<IssuedRefreshToken> = {},
): IssuedRefreshToken {
  return {
    id: generateRandomId(),
    familyId: generateRandomId(),
    token: generateMockRefreshTokenJwt(),
    tokenHash: generateRandomString(64, '0123456789abcdef'),
    expiresAt: generateRandomDate(
      new Date(Date.now() + 60_000),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ),
    ...overrides,
  };
}

/** A refresh token as the client holds it: same three-part shape as any JWT. */
export function generateMockRefreshTokenJwt(): string {
  return [36, 64, 43].map((length) => generateRandomString(length)).join('.');
}
