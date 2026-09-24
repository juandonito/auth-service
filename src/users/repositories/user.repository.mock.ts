import { generateMockPublicUser } from '../../../test/mock/user.mock';

export type MockUserRepository = ReturnType<typeof generateMockUserRepository>;

/** UserRepository double whose methods resolve to random data by default. */
export function generateMockUserRepository() {
  return {
    create: jest.fn().mockResolvedValue(generateMockPublicUser()),
  };
}
