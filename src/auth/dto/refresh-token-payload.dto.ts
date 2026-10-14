/** The claims of a verified refresh token that the rest of the code relies on. */
export interface RefreshTokenPayload {
  /** User id. */
  sub: string;
  /** Id of the `RefreshToken` row for this exact token. */
  jti: string;
}
