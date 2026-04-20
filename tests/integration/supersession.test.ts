import { describe, it, expect } from 'vitest';
import { initializeWiki, createWiki } from '../../src/core/wiki.ts';
import { createMemoryAdapter, FakeLLMAdapter, ingestResponse } from './helpers.ts';
import type { FactPage } from '../../src/types/index.ts';

const firstIngest = ingestResponse({
  sourceId: 'src-a',
  title: 'Source A — X is blue',
  facts: [{ id: 'x-color-aaaa1111', title: 'X is blue', claim: 'X is blue.' }],
  now: '2026-04-19T09:00:00Z'
});

const secondIngest = ingestResponse({
  sourceId: 'src-b',
  title: 'Source B — X is red',
  facts: [{ id: 'x-color-bbbb2222', title: 'X is red', claim: 'X is red.', supersedes: 'x-color-aaaa1111' }],
  supersessions: [{ old_fact_id: 'x-color-aaaa1111', new_fact_id: 'x-color-bbbb2222', reason: 'Direct contradiction — B states red where A said blue' }],
  now: '2026-04-20T09:00:00Z'
});

async function seededSupersession() {
  const adapter = createMemoryAdapter();
  await initializeWiki(adapter);
  const llm = new FakeLLMAdapter([firstIngest, secondIngest]);
  const wiki = await createWiki({ path: '/tmp/w', llmAdapter: llm, storageAdapter: adapter });
  await wiki.ingest({ kind: 'text', content: 'a', format: 'md', sourceId: 'src-a' });
  await wiki.ingest({ kind: 'text', content: 'b', format: 'md', sourceId: 'src-b' });
  return { wiki, adapter, llm };
}

describe('integration/supersession', () => {
  it('new fact has supersedes pointing at old fact', async () => {
    const { wiki } = await seededSupersession();
    const newFact = wiki.readPage('facts/x-color-bbbb2222.md') as FactPage | null;
    expect(newFact?.type).toBe('fact');
    expect(newFact?.supersedes).toBe('x-color-aaaa1111');
  });

  it('old fact has supersededBy pointing at new fact', async () => {
    const { wiki } = await seededSupersession();
    const oldFact = wiki.readPage('facts/x-color-aaaa1111.md') as FactPage | null;
    expect(oldFact?.type).toBe('fact');
    expect(oldFact?.supersededBy).toBe('x-color-bbbb2222');
  });

  it('old fact is not deleted', async () => {
    const { wiki } = await seededSupersession();
    const manifest = wiki.readManifest();
    expect(manifest.pages['facts/x-color-aaaa1111.md']).toBeDefined();
    expect(manifest.pages['facts/x-color-bbbb2222.md']).toBeDefined();
  });

  it('default query only surfaces the superseding fact', async () => {
    const { wiki, llm } = await seededSupersession();
    llm.push('X is red [^1].\n\n[^1]: facts/x-color-bbbb2222.md');
    const result = await wiki.query('X color');
    const paths = result.citations.map((c) => c.pagePath);
    expect(paths).toContain('facts/x-color-bbbb2222.md');
    expect(paths).not.toContain('facts/x-color-aaaa1111.md');
  });

  it('query with includeSuperseded surfaces both', async () => {
    const { wiki, llm } = await seededSupersession();
    llm.push('Both blue and red [^1] [^2].\n\n[^1]: facts/x-color-aaaa1111.md\n[^2]: facts/x-color-bbbb2222.md');
    const result = await wiki.query('X color', { includeSuperseded: true });
    const paths = result.citations.map((c) => c.pagePath);
    expect(paths).toContain('facts/x-color-aaaa1111.md');
    expect(paths).toContain('facts/x-color-bbbb2222.md');
  });
});
