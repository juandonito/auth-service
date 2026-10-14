import { generateMockIssuedRefreshToken } from '@test/mock/refresh-token.mock';
import { generateRandomId } from '@test/mock/common.mock';

export type MockRefreshTokenIssuerService = ReturnType<
  typeof generateMockRefreshTokenIssuerService
>;

/** RefreshTokenIssuerService double whose methods resolve to random data by default. */
export function generateMockRefreshTokenIssuerService() {
  return {
    issue: jest.fn().mockResolvedValue(generateMockIssuedRefreshToken()),
    verify: jest
      .fn()
      .mockResolvedValue({ sub: generateRandomId(), jti: generateRandomId() }),
  };
}
