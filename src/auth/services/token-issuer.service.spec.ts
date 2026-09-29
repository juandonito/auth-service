import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  generateMockAccessToken,
  generateMockJwtService,
  type MockJwtService,
} from '@test/mock/jwt-service.mock';
import { generateMockUser } from '@test/mock/user.mock';
import { TokenIssuer } from './token-issuer.service';

describe('TokenIssuer', () => {
  let tokenIssuer: TokenIssuer;
  let jwtService: MockJwtService;

  beforeEach(async () => {
    jwtService = generateMockJwtService();
    const moduleRef = await Test.createTestingModule({
      providers: [TokenIssuer, { provide: JwtService, useValue: jwtService }],
    }).compile();

    tokenIssuer = moduleRef.get(TokenIssuer);
  });

  describe('issue', () => {
    it('should sign the token with the user id as sub and the user role', async () => {
      const user = generateMockUser();

      await tokenIssuer.issue(user);

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        role: user.role,
      });
    });

    it('should return only the signed access token', async () => {
      const accessToken = generateMockAccessToken();
      jwtService.signAsync.mockResolvedValue(accessToken);

      const result = await tokenIssuer.issue(generateMockUser());

      expect(result).toEqual({ accessToken });
    });
  });
});
