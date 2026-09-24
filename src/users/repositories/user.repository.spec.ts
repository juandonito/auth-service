import { Test } from '@nestjs/testing';
import {
  generateMockPrismaKnownError,
  PRISMA_UNIQUE_CONSTRAINT_CODE,
} from '@test/mock/prisma-error.mock';
import {
  generateMockPrismaService,
  type MockPrismaService,
} from '@common/database/prisma.service.mock';
import { generateMockPublicUser, generateMockUser } from '@test/mock/user.mock';
import { PrismaService } from '@common/database/prisma.service';
import { EmailAlreadyExistsError } from '../errors/email-already-exists.error';
import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  let repository: UserRepository;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = generateMockPrismaService();
    const moduleRef = await Test.createTestingModule({
      providers: [UserRepository, { provide: PrismaService, useValue: prisma }],
    }).compile();

    repository = moduleRef.get(UserRepository);
  });

  describe('create', () => {
    it('should persist the email and password hash without setting a role', async () => {
      const { email, passwordHash } = generateMockUser();

      await repository.create({ email, passwordHash });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { email, passwordHash } }),
      );
    });

    it('should return only public fields so the hash is never exposed', async () => {
      const { email, passwordHash } = generateMockUser();
      const publicUser = generateMockPublicUser({ email });
      prisma.user.create.mockResolvedValue(publicUser);

      const result = await repository.create({ email, passwordHash });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true, email: true, role: true },
        }),
      );
      expect(result).toEqual(publicUser);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw EmailAlreadyExistsError on a unique constraint violation', async () => {
      const { email, passwordHash } = generateMockUser();
      prisma.user.create.mockRejectedValue(
        generateMockPrismaKnownError(PRISMA_UNIQUE_CONSTRAINT_CODE),
      );

      await expect(
        repository.create({ email, passwordHash }),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
    });

    it('should rethrow any other database error', async () => {
      const { email, passwordHash } = generateMockUser();
      const error = generateMockPrismaKnownError();
      prisma.user.create.mockRejectedValue(error);

      await expect(repository.create({ email, passwordHash })).rejects.toBe(
        error,
      );
    });
  });
});
