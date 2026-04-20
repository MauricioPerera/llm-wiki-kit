import { describe, it, expect } from 'vitest';
import { isNode, isDeno, isWorker, currentRuntime } from '../../../src/lib/platform.ts';

describe('lib/platform', () => {
  it('isNode is true in vitest (node) environment', () => {
    expect(isNode).toBe(true);
  });

  it('isDeno and isWorker are false in vitest', () => {
    expect(isDeno).toBe(false);
    expect(isWorker).toBe(false);
  });

  it('exactly one runtime flag is true', () => {
    const trueCount = [isNode, isDeno, isWorker].filter(Boolean).length;
    expect(trueCount).toBe(1);
  });

  it('currentRuntime reports node', () => {
    expect(currentRuntime()).toBe('node');
  });
});
