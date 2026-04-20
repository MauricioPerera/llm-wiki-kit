export type WikiErrorCode =
  | 'WIKI_NOT_INITIALIZED'
  | 'INVALID_SOURCE'
  | 'EMBEDDING_ADAPTER_MISSING'
  | 'GIT_CONFLICT'
  | 'SCHEMA_VIOLATION'
  | 'SOURCE_ALREADY_INGESTED';

export const WIKI_ERROR_EXIT_CODES: Record<WikiErrorCode, number> = {
  WIKI_NOT_INITIALIZED: 10,
  INVALID_SOURCE: 11,
  EMBEDDING_ADAPTER_MISSING: 12,
  GIT_CONFLICT: 13,
  SCHEMA_VIOLATION: 14,
  SOURCE_ALREADY_INGESTED: 15
};

export class WikiError extends Error {
  public readonly code: WikiErrorCode;
  public override readonly cause: unknown;
  public readonly context: Record<string, unknown>;

  constructor(
    code: WikiErrorCode,
    message: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WikiError';
    this.code = code;
    this.cause = cause;
    this.context = context ?? {};
  }

  exitCode(): number {
    return WIKI_ERROR_EXIT_CODES[this.code];
  }
}

export function isWikiError(value: unknown): value is WikiError {
  return value instanceof WikiError;
}
