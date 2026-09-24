import { generateMockAccessToken } from '../../../test/mock/jwt-service.mock';

export type MockRegisterUserUseCase = ReturnType<
  typeof generateMockRegisterUserUseCase
>;

/** RegisterUserUseCase double whose methods resolve to random data by default. */
export function generateMockRegisterUserUseCase() {
  return {
    execute: jest
      .fn()
      .mockResolvedValue({ accessToken: generateMockAccessToken() }),
  };
}
