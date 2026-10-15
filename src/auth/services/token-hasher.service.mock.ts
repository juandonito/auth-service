import { generateRandomString } from '@test/mock/common.mock';

export type MockTokenHasherService = ReturnType<
  typeof generateMockTokenHasherService
>;

/** TokenHasherService double whose methods return random data by default. */
export function generateMockTokenHasherService() {
  return {
    hash: jest
      .fn()
      .mockReturnValue(generateRandomString(64, '0123456789abcdef')),
    matches: jest.fn().mockReturnValue(true),
  };
}
