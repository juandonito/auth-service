import { generateMockRefreshToken } from '@test/mock/refresh-token.mock';

export type MockRefreshTokenRepository = ReturnType<
  typeof generateMockRefreshTokenRepository
>;

/** RefreshTokenRepository double whose methods resolve to random data by default. */
export function generateMockRefreshTokenRepository() {
  return {
    create: jest.fn().mockResolvedValue(undefined),
    findByIdWithTokenHash: jest
      .fn()
      .mockResolvedValue(generateMockRefreshToken()),
    rotate: jest.fn().mockResolvedValue(true),
  };
}
