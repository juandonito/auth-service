/** What is persisted for a refresh token: its row, without the raw token. */
export interface CreateRefreshTokenDto {
  /** Also the `jti` claim of the token. */
  id: string;
  familyId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}
