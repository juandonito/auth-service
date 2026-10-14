import type { CreateRefreshTokenDto } from '@auth/dto/create-refresh-token.dto';
import type { IssuedRefreshToken } from '@auth/dto/issued-refresh-token.dto';
import type { RefreshToken } from '@generated/prisma/client';
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

/** A `RefreshToken` row, unused and not yet expired by default. */
export function generateMockRefreshToken(
  overrides: Partial<RefreshToken> = {},
): RefreshToken {
  return {
    id: generateRandomId(),
    familyId: generateRandomId(),
    userId: generateRandomId(),
    tokenHash: generateRandomString(64, '0123456789abcdef'),
    expiresAt: generateRandomDate(
      new Date(Date.now() + 60_000),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ),
    revokedAt: null,
    replacedBy: null,
    createdAt: generateRandomDate(),
    ...overrides,
  };
}

/** The data persisted when a refresh token is created. */
export function generateMockCreateRefreshTokenDto(
  overrides: Partial<CreateRefreshTokenDto> = {},
): CreateRefreshTokenDto {
  const { id, familyId, userId, tokenHash, expiresAt } =
    generateMockRefreshToken();
  return { id, familyId, userId, tokenHash, expiresAt, ...overrides };
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
