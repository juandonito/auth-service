import type { User } from '../../generated/prisma/client';

export type CreateUserDto = Pick<User, 'email' | 'passwordHash'>;
