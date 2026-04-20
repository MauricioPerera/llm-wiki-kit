import { describe, it, expect } from 'vitest';
import { WikiError, isWikiError, WIKI_ERROR_EXIT_CODES } from '../../../src/lib/errors.ts';

describe('lib/errors', () => {
  it('carries code, message, cause, context', () => {
    const cause = new Error('boom');
    const err = new WikiError('INVALID_SOURCE', 'bad input', cause, { foo: 1 });
    expect(err.code).toBe('INVALID_SOURCE');
    expect(err.message).toBe('bad input');
    expect(err.cause).toBe(cause);
    expect(err.context).toEqual({ foo: 1 });
    expect(err.name).toBe('WikiError');
  });

  it('preserves cause chain across rethrows', () => {
    const root = new Error('root');
    const first = new WikiError('INVALID_SOURCE', 'first', root);
    const second = new WikiError('SCHEMA_VIOLATION', 'second', first);
    expect(second.cause).toBe(first);
    expect((second.cause as WikiError).cause).toBe(root);
  });

  it('exitCode maps to the right number', () => {
    const err = new WikiError('SOURCE_ALREADY_INGESTED', 'dup');
    expect(err.exitCode()).toBe(15);
    expect(err.exitCode()).toBe(WIKI_ERROR_EXIT_CODES.SOURCE_ALREADY_INGESTED);
  });

  it('isWikiError discriminates', () => {
    expect(isWikiError(new WikiError('GIT_CONFLICT', 'x'))).toBe(true);
    expect(isWikiError(new Error('x'))).toBe(false);
    expect(isWikiError(null)).toBe(false);
  });
});
