import { generateMockAccessToken } from '@test/mock/jwt-service.mock';
import { generateMockRefreshTokenJwt } from '@test/mock/refresh-token.mock';

export type MockRotateRefreshTokenUseCase = ReturnType<
  typeof generateMockRotateRefreshTokenUseCase
>;

/** RotateRefreshTokenUseCase double whose methods resolve to random data by default. */
export function generateMockRotateRefreshTokenUseCase() {
  return {
    execute: jest.fn().mockResolvedValue({
      accessToken: generateMockAccessToken(),
      refreshToken: generateMockRefreshTokenJwt(),
    }),
  };
}
