import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { generateMockRegisterDto } from '../../../test/mock/auth.mock';
import {
  generateMockAccessToken,
  generateMockJwtService,
  type MockJwtService,
} from '../../../test/mock/jwt-service.mock';
import {
  generateMockPasswordHasher,
  type MockPasswordHasher,
} from '../../../test/mock/password-hasher.mock';
import {
  generateMockUserRepository,
  type MockUserRepository,
} from '../../../test/mock/user-repository.mock';
import {
  generateMockPublicUser,
  generateMockUser,
} from '../../../test/mock/user.mock';
import { EmailAlreadyExistsError } from '../../users/errors/email-already-exists.error';
import { UserRepository } from '../../users/repositories/user.repository';
import { PasswordHasher } from '../services/password-hasher.service';
import { RegisterUseCase } from './register.usecase';

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let userRepository: MockUserRepository;
  let passwordHasher: MockPasswordHasher;
  let jwtService: MockJwtService;

  beforeEach(async () => {
    userRepository = generateMockUserRepository();
    passwordHasher = generateMockPasswordHasher();
    jwtService = generateMockJwtService();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RegisterUseCase,
        { provide: UserRepository, useValue: userRepository },
        { provide: PasswordHasher, useValue: passwordHasher },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    useCase = moduleRef.get(RegisterUseCase);
  });

  describe('execute', () => {
    it('should persist the user with the hashed password instead of the plaintext one', async () => {
      const dto = generateMockRegisterDto();
      const { passwordHash } = generateMockUser();
      passwordHasher.hash.mockResolvedValue(passwordHash);

      await useCase.execute(dto);

      expect(passwordHasher.hash).toHaveBeenCalledWith(dto.password);
      expect(userRepository.create).toHaveBeenCalledWith({
        email: dto.email,
        passwordHash,
      });
    });

    it('should sign the access token with the created user id and role', async () => {
      const user = generateMockPublicUser();
      userRepository.create.mockResolvedValue(user);

      await useCase.execute(generateMockRegisterDto());

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        role: user.role,
      });
    });

    it('should return only the signed access token', async () => {
      const accessToken = generateMockAccessToken();
      jwtService.signAsync.mockResolvedValue(accessToken);

      const result = await useCase.execute(generateMockRegisterDto());

      expect(result).toEqual({ accessToken });
    });

    it('should propagate EmailAlreadyExistsError without signing a token', async () => {
      userRepository.create.mockRejectedValue(new EmailAlreadyExistsError());

      await expect(
        useCase.execute(generateMockRegisterDto()),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });
});
