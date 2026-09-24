import type { User } from '../../generated/prisma/client';

export type PublicUser = Pick<User, 'id' | 'email' | 'role'>;
