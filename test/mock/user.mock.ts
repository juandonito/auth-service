import { Role, type User } from '../../src/generated/prisma/client';
import type { PublicUser } from '../../src/users/repositories/user.repository';
import {
  generateRandomDate,
  generateRandomEmail,
  generateRandomId,
  generateRandomString,
  pickRandom,
} from './common.mock';

export function generateMockUser(overrides: Partial<User> = {}): User {
  const createdAt = generateRandomDate();
  return {
    id: generateRandomId(),
    email: generateRandomEmail(),
    passwordHash: `$argon2id$v=19$m=65536,t=3,p=4$${generateRandomString(22)}$${generateRandomString(43)}`,
    role: pickRandom(Object.values(Role)),
    createdAt,
    updatedAt: generateRandomDate(createdAt),
    ...overrides,
  };
}

export function generateMockPublicUser(
  overrides: Partial<PublicUser> = {},
): PublicUser {
  const { id, email, role } = generateMockUser();
  return { id, email, role, ...overrides };
}

export function generateMockUsersList(
  count: number,
  overrides: Partial<User> = {},
): User[] {
  return Array.from({ length: count }, () => generateMockUser(overrides));
}
