import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { Prisma, type User } from '../../generated/prisma/client';
import { EmailAlreadyExistsError } from '../errors/email-already-exists.error';

export type PublicUser = Pick<User, 'id' | 'email' | 'role'>;

const PUBLIC_USER_SELECT = { id: true, email: true, role: true } as const;

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Pick<User, 'email' | 'passwordHash'>,
  ): Promise<PublicUser> {
    try {
      return await this.prisma.user.create({
        data,
        select: PUBLIC_USER_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new EmailAlreadyExistsError();
      }
      throw error;
    }
  }
}
