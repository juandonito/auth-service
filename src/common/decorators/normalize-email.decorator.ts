import { Transform } from 'class-transformer';

/** Trims and lowercases a string email; other values pass through so validation can reject them. */
export const NormalizeEmail = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
