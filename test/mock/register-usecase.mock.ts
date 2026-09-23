import { generateMockAccessToken } from './jwt-service.mock';

export type MockRegisterUseCase = ReturnType<
  typeof generateMockRegisterUseCase
>;

/** RegisterUseCase double whose methods resolve to random data by default. */
export function generateMockRegisterUseCase() {
  return {
    execute: jest
      .fn()
      .mockResolvedValue({ accessToken: generateMockAccessToken() }),
  };
}
