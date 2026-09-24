import { Test } from '@nestjs/testing';
import { generateMockPassword } from '../../../test/mock/auth.mock';
import { generateRandomEmail } from '../../../test/mock/common.mock';
import {
  generateMockUserRepository,
  type MockUserRepository,
} from '../repositories/user.repository.mock';
import {
  generateMockPasswordHasher,
  type MockPasswordHasher,
} from '../services/password-hasher.service.mock';
import {
  generateMockPublicUser,
  generateMockUser,
} from '../../../test/mock/user.mock';
import { EmailAlreadyExistsError } from '../errors/email-already-exists.error';
import { UserRepository } from '../repositories/user.repository';
import { PasswordHasher } from '../services/password-hasher.service';
import { CreateUserUseCase } from './create-user.usecase';

describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let userRepository: MockUserRepository;
  let passwordHasher: MockPasswordHasher;

  beforeEach(async () => {
    userRepository = generateMockUserRepository();
    passwordHasher = generateMockPasswordHasher();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateUserUseCase,
        { provide: UserRepository, useValue: userRepository },
        { provide: PasswordHasher, useValue: passwordHasher },
      ],
    }).compile();

    useCase = moduleRef.get(CreateUserUseCase);
  });

  describe('execute', () => {
    it('should persist the user with the hashed password instead of the plaintext one', async () => {
      const email = generateRandomEmail();
      const password = generateMockPassword();
      const { passwordHash } = generateMockUser();
      passwordHasher.hash.mockResolvedValue(passwordHash);

      await useCase.execute({ email, password });

      expect(passwordHasher.hash).toHaveBeenCalledWith(password);
      expect(userRepository.create).toHaveBeenCalledWith({
        email,
        passwordHash,
      });
    });

    it('should return the created public user', async () => {
      const publicUser = generateMockPublicUser();
      userRepository.create.mockResolvedValue(publicUser);

      const result = await useCase.execute({
        email: generateRandomEmail(),
        password: generateMockPassword(),
      });

      expect(result).toEqual(publicUser);
    });

    it('should propagate EmailAlreadyExistsError on a duplicate email', async () => {
      userRepository.create.mockRejectedValue(new EmailAlreadyExistsError());

      await expect(
        useCase.execute({
          email: generateRandomEmail(),
          password: generateMockPassword(),
        }),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
    });
  });
});
