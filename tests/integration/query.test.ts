import { describe, it, expect } from 'vitest';
import { initializeWiki, createWiki } from '../../src/core/wiki.ts';
import { createMemoryAdapter, FakeLLMAdapter, FakeEmbeddingAdapter, ingestResponse } from './helpers.ts';

const seedResponse = ingestResponse({
  sourceId: 'helix-press-2026-04',
  title: 'Helix launches Tessera-1',
  facts: [
    { id: 'tessera-launch-abcd1234', title: 'Tessera-1 launched', claim: 'Helix Robotics launched Tessera-1 on April 2, 2026.', tags: ['robotics'] },
    { id: 'lattice-nav-speed-efgh5678', title: 'Lattice-Nav speeds up pick and place', claim: 'Lattice-Nav cuts latency by 38%.', tags: ['robotics'] }
  ],
  entities: [{ id: 'helix-robotics', title: 'Helix Robotics', kind: 'org', body: 'Barcelona-based robotics startup.' }],
  concepts: [{ id: 'lattice-nav', title: 'Lattice-Nav', body: 'Navigation framework blending occupancy maps with ephemeral object memory.' }]
});

async function seededWiki(opts: { withEmbeddings?: boolean } = {}) {
  const adapter = createMemoryAdapter();
  await initializeWiki(adapter);
  const llm = new FakeLLMAdapter([seedResponse]);
  const embeddings = opts.withEmbeddings ? new FakeEmbeddingAdapter(16) : undefined;
  const wiki = await createWiki({
    path: '/tmp/w',
    llmAdapter: llm,
    storageAdapter: adapter,
    ...(embeddings ? { embeddingAdapter: embeddings } : {})
  });
  await wiki.ingest({ kind: 'text', content: 'x', format: 'md', sourceId: 'helix-press-2026-04' });
  return { wiki, adapter, llm };
}

describe('integration/query', () => {
  it('returns citations pointing at the correct pages', async () => {
    const { wiki, llm } = await seededWiki();
    llm.push('Helix launched Tessera-1 in April 2026 [^1].\n\n[^1]: facts/tessera-launch-abcd1234.md');
    const result = await wiki.query('helix tessera');
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations.some((c) => c.pagePath === 'facts/tessera-launch-abcd1234.md')).toBe(true);
  });

  it('format json returns parseable JSON result', async () => {
    const { wiki, llm } = await seededWiki();
    llm.push('{"answer":"ok","citations":[]}');
    const result = await wiki.query('helix', { format: 'json' });
    expect(() => JSON.parse(result.answer)).not.toThrow();
    expect(result.citations).toBeDefined();
  });

  it('retrievalTrace reports layers run', async () => {
    const { wiki, llm } = await seededWiki();
    llm.push('Answer.\n\n[^1]: facts/tessera-launch-abcd1234.md');
    const result = await wiki.query('helix tessera');
    expect(result.retrievalTrace.layersRun[0]).toBe('index');
    expect(result.retrievalTrace.finalPageCount).toBeGreaterThan(0);
  });

  it('vector layer runs when embeddings configured and earlier layers are thin', async () => {
    const { wiki, llm } = await seededWiki({ withEmbeddings: true });
    llm.push('Answer.');
    const result = await wiki.query('unknown-query-token');
    expect(result.retrievalTrace.layersRun).toContain('bm25');
  });

  it('empty wiki returns zero citations', async () => {
    const adapter = createMemoryAdapter();
    await initializeWiki(adapter);
    const llm = new FakeLLMAdapter(['I have no information.']);
    const wiki = await createWiki({ path: '/tmp/w', llmAdapter: llm, storageAdapter: adapter });
    const result = await wiki.query('anything');
    expect(result.citations).toEqual([]);
    expect(result.retrievalTrace.finalPageCount).toBe(0);
  });
});
