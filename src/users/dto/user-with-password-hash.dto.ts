import type { User } from '@generated/prisma/client';

export type UserWithPasswordHash = Pick<
  User,
  'id' | 'email' | 'role' | 'passwordHash'
>;
