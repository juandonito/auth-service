# spec: Register User

## GOAL

Users can create an account

## In scope

- `POST /auth/register` - email + password -> creates a User, returns access token
- passswords should be hashed with argon2
- passwords should be at least 9 caracters (9 included), contain 1 >= number, 1 >= uppercase, 1 >= lowercase
- duplicate email registration handled gracefully (no raw 500)

## Out of scope (future specs)

- Refresh token handeling
- RBAC guards (seperate specs)
- OAuth2 / social login
- Rate limiting

## Succes criteria

- [] Registering with a new emai lcreates a User row, `passwordHash` is never plaintext uncrypted password
- [] Registering with an existing email returns a clear 409, not 500
- [] No response body ever contains `passwordHash`
- [] User created has ROLE `USER` by default
