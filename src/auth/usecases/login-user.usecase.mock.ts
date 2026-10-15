import { generateMockAccessToken } from '@test/mock/jwt-service.mock';
import { generateMockRefreshTokenJwt } from '@test/mock/refresh-token.mock';

export type MockLoginUserUseCase = ReturnType<
  typeof generateMockLoginUserUseCase
>;

/** LoginUserUseCase double whose methods resolve to random data by default. */
export function generateMockLoginUserUseCase() {
  return {
    execute: jest.fn().mockResolvedValue({
      accessToken: generateMockAccessToken(),
      refreshToken: generateMockRefreshTokenJwt(),
    }),
  };
}
