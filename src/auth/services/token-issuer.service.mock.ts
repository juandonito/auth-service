import { generateMockAccessToken } from '@test/mock/jwt-service.mock';

export type MockTokenIssuer = ReturnType<typeof generateMockTokenIssuer>;

/** TokenIssuer double whose methods resolve to random data by default. */
export function generateMockTokenIssuer() {
  return {
    issue: jest
      .fn()
      .mockResolvedValue({ accessToken: generateMockAccessToken() }),
  };
}
