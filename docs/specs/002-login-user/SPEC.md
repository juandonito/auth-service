# spec: Login User

## Goal

A user can log into their account with their credentials.

## In scope

- `POST /auth/login` - `{ email: string, password: string }` -> validate credentials -> returns `200 { accessToken }`
- Email input is normalized (trim + lowercase), same as register
- `LoginDto` validates only that `email` is an email and `password` is a string of at most 128 characters. It does not reuse register's strength rules.
- Malformed input (missing/invalid email, missing/non-string/too-long password) returns 400
- Wrong email or wrong password returns a normalized 401 `{ statusCode, error, message: "invalid credentials" }`, raised as `InvalidCredentialsError` and mapped in `DomainExceptionFilter`
- When the email is unknown, `PasswordHasher.verifyDummy` still runs an argon2 verification against a dummy hash built by the hasher itself (same parameters as real hashes), so both 401 paths cost the same
- JWT payload contains

```
{
    sub: string,
    role: Role,
}
```

(same payload register already issues; `Role` is the Prisma enum)

## Out of scope

- Refresh token handling and delivery
- RBAC guards (separate spec)
- OAuth2 / social login
- Rate limiting (separate spec)

## Success criteria

- [ ] Correct credentials return 200 with a JWT whose payload is `{ sub, role }`
- [ ] Wrong email returns 401 `invalid credentials`
- [ ] Existing email with wrong password returns 401 `invalid credentials`
- [ ] Unknown email still calls `PasswordHasher.verifyDummy` with the login password, and `PasswordHasher.verifyDummy` verifies against an argon2id hash (unit tests; no wall-clock assertions)
- [ ] JWT verifies with the configured `JWT_SECRET`
- [ ] JWT expires after the configured `JWT_EXPIRES_IN`
- [ ] Malformed input returns 400
- [ ] Email matching is case-insensitive and trimmed (register `foo@x.com`, log in as `Foo@X.com`)
- [ ] No response body contains `passwordHash`
