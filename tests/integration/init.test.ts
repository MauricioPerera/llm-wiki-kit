import { describe, it, expect } from 'vitest';
import { initializeWiki, createWiki } from '../../src/core/wiki.ts';
import { WikiError } from '../../src/lib/errors.ts';
import { createMemoryAdapter, FakeLLMAdapter } from './helpers.ts';

describe('integration/init', () => {
  it('creates the full schema layout', async () => {
    const adapter = createMemoryAdapter();
    await initializeWiki(adapter);
    await adapter.preload([]);
    expect(adapter.readJson('.wiki/config.json')).not.toBeNull();
    expect(adapter.readJson('.wiki/manifest.json')).toEqual({ pages: {} });
    expect(adapter.readJson('.wiki/ingested.json')).toEqual({});
    for (const part of ['facts', 'entities', 'concepts', 'synthesis', 'sources']) {
      expect(adapter.readBinShared?.(`index/${part}.md`)).toBeTruthy();
    }
    expect(adapter.readBinShared?.('index/root.md')).toBeTruthy();
  });

  it('createWiki fails on uninitialized adapter', async () => {
    const adapter = createMemoryAdapter();
    await expect(
      createWiki({
        path: '/tmp/none',
        llmAdapter: new FakeLLMAdapter(),
        storageAdapter: adapter
      })
    ).rejects.toBeInstanceOf(WikiError);
  });

  it('createWiki succeeds after init, query returns no results', async () => {
    const adapter = createMemoryAdapter();
    await initializeWiki(adapter);
    const wiki = await createWiki({
      path: '/tmp/w',
      llmAdapter: new FakeLLMAdapter(['answer: no data']),
      storageAdapter: adapter
    });
    const result = await wiki.query('anything');
    expect(result.citations).toEqual([]);
    expect(result.retrievalTrace.finalPageCount).toBe(0);
  });
});
