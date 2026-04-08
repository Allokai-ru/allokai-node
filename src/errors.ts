export class AlokaiError extends Error {
  readonly statusCode: number | null;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AlokaiError';
    this.statusCode = statusCode ?? null;
  }
}

export class AuthError extends AlokaiError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends AlokaiError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AlokaiError {
  readonly retryAfter: number | null;

  constructor(message: string, retryAfter?: number) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter ?? null;
  }
}

export class ValidationError extends AlokaiError {
  constructor(message: string) {
    super(message, 422);
    this.name = 'ValidationError';
  }
}
