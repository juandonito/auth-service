/** Base class for business errors. Mapped to HTTP responses by DomainExceptionFilter. */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
