/** A freshly signed refresh token with everything needed to persist its row. */
export interface IssuedRefreshToken {
  /** Row id, also the `jti` claim of the token. */
  id: string;
  familyId: string;
  /** The raw token: returned to the client once, never stored. */
  token: string;
  tokenHash: string;
  /** Equal to the `exp` claim of the token. */
  expiresAt: Date;
}
