export class PostgresError extends Error {
  readonly code: string | undefined;
  readonly detail: string | undefined;
  readonly constraint: string | undefined;

  constructor(
    message: string,
    code?: string,
    detail?: string,
    constraint?: string,
  ) {
    super(message);
    this.name = 'PostgresError';
    this.code = code;
    this.detail = detail;
    this.constraint = constraint;
  }
}

export function extractError(error: unknown): PostgresError {
  if (error instanceof PostgresError) return error;

  if (error instanceof Error) {
    const pgErr = error as Error & { code?: string; detail?: string; constraint?: string };
    return new PostgresError(
      pgErr.message,
      pgErr.code,
      pgErr.detail,
      pgErr.constraint,
    );
  }

  return new PostgresError('Unknown database error');
}
