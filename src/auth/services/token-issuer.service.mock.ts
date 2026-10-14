import { generateMockAccessToken } from '@test/mock/jwt-service.mock';

export type MockTokenIssuerService = ReturnType<
  typeof generateMockTokenIssuerService
>;

/** TokenIssuerService double whose methods resolve to random data by default. */
export function generateMockTokenIssuerService() {
  return {
    issue: jest
      .fn()
      .mockResolvedValue({ accessToken: generateMockAccessToken() }),
  };
}
