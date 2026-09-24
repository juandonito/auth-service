import { generateRandomString } from './common.mock';

export type MockJwtService = ReturnType<typeof generateMockJwtService>;

export function generateMockAccessToken(): string {
  return [36, 64, 43].map((length) => generateRandomString(length)).join('.');
}

/** JwtService double whose methods resolve to random data by default. */
export function generateMockJwtService() {
  return {
    signAsync: jest.fn().mockResolvedValue(generateMockAccessToken()),
  };
}
