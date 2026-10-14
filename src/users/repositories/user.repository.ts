import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { Prisma } from '@generated/prisma/client';
import type { CreateUserDto } from '../dto/create-user.dto';
import type { PublicUser } from '../dto/public-user.dto';
import type { UserWithPasswordHash } from '../dto/user-with-password-hash.dto';
import { EmailAlreadyExistsError } from '../errors/email-already-exists.error';

const PUBLIC_USER_SELECT = { id: true, email: true, role: true } as const;
const USER_WITH_PASSWORD_HASH_SELECT = {
  ...PUBLIC_USER_SELECT,
  passwordHash: true,
} as const;

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserDto): Promise<PublicUser> {
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

  findByEmailWithPasswordHash(
    email: string,
  ): Promise<UserWithPasswordHash | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: USER_WITH_PASSWORD_HASH_SELECT,
    });
  }
}
