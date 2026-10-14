import { generateMockUser } from '@test/mock/user.mock';

export type MockPasswordHasherService = ReturnType<
  typeof generateMockPasswordHasherService
>;

/** PasswordHasherService double whose methods resolve to random data by default. */
export function generateMockPasswordHasherService() {
  return {
    hash: jest.fn().mockResolvedValue(generateMockUser().passwordHash),
    verify: jest.fn().mockResolvedValue(true),
    verifyDummy: jest.fn().mockResolvedValue(undefined),
  };
}
