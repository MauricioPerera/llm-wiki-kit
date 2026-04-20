import { assert, assertEquals } from 'jsr:@std/assert@1';
import { renderPage } from '../../src/pages/render.ts';
import { parsePage } from '../../src/pages/parse.ts';
import { buildAllIndexes } from '../../src/indexes/build.ts';
import { searchIndex } from '../../src/indexes/search.ts';
import { searchBM25 } from '../../src/retrieval/bm25.ts';
import { rrfMerge } from '../../src/retrieval/rank.ts';
import { validatePage } from '../../src/pages/schema.ts';
import { WikiError, isWikiError } from '../../src/lib/errors.ts';
import { isDeno } from '../../src/lib/platform.ts';
import { initializeWiki, createWiki } from '../../src/core/wiki.ts';
import { createMemoryAdapter, FakeLLMAdapter, ingestResponse } from '../integration/helpers.ts';
import type { FactPage } from '../../src/types/index.ts';

const fact: FactPage = {
  type: 'fact',
  id: 'helix-tessera-abcd1234',
  title: 'Helix launches Tessera-1',
  claim: 'Helix Robotics launched Tessera-1 on April 2 2026.',
  sources: ['helix-press-2026-04'],
  ingested: '2026-04-20T09:00:00Z',
  supersedes: null,
  supersededBy: null,
  confidence: 'high',
  tags: ['robotics'],
  body: 'Context paragraph.'
};

Deno.test('platform: isDeno is true', () => {
  assert(isDeno, 'expected isDeno=true under deno test runtime');
});

Deno.test('pages: render + parse round-trip', () => {
  const md = renderPage(fact);
  const parsed = parsePage(md);
  assertEquals(parsed, fact);
});

Deno.test('schema: violation throws WikiError with SCHEMA_VIOLATION', () => {
  try {
    validatePage({ type: 'fact', id: 'x' });
    throw new Error('expected throw');
  } catch (err) {
    assert(isWikiError(err));
    assertEquals((err as WikiError).code, 'SCHEMA_VIOLATION');
  }
});

Deno.test('indexes: build + grep find the fact', () => {
  const indexes = buildAllIndexes([fact]);
  const hits = searchIndex(indexes['index/facts.md'] ?? '', 'tessera');
  assertEquals(hits.length, 1);
});

Deno.test('retrieval: BM25 ranks matching doc highest', () => {
  const docs = [
    { path: 'facts/a.md', type: 'fact' as const, id: 'a', text: 'helix tessera robotics' },
    { path: 'facts/b.md', type: 'fact' as const, id: 'b', text: 'unrelated content about weather' }
  ];
  const hits = searchBM25(docs, 'helix tessera');
  assertEquals(hits[0]?.id, 'a');
});

Deno.test('retrieval: RRF merges and dedupes', () => {
  const merged = rrfMerge([
    { layer: 'index', hits: [{ path: 'facts/a.md', type: 'fact', id: 'a', score: 1 }] },
    { layer: 'bm25', hits: [{ path: 'facts/a.md', type: 'fact', id: 'a', score: 1 }] }
  ]);
  assertEquals(merged.length, 1);
});

Deno.test('core: initializeWiki + createWiki + empty query round-trip', async () => {
  const adapter = createMemoryAdapter();
  await initializeWiki(adapter);
  const llm = new FakeLLMAdapter(['no data']);
  const wiki = await createWiki({ path: '/tmp/w', llmAdapter: llm, storageAdapter: adapter });
  const result = await wiki.query('anything');
  assertEquals(result.citations.length, 0);
  assertEquals(result.retrievalTrace.finalPageCount, 0);
});

Deno.test('core: ingest + query full pipeline', async () => {
  const adapter = createMemoryAdapter();
  await initializeWiki(adapter);
  const ingest = ingestResponse({
    sourceId: 'src-a',
    title: 'Deno ingest',
    facts: [{ id: 'fact-deno-abcd1234', title: 'Deno fact', claim: 'Deno runs this test.' }]
  });
  const llm = new FakeLLMAdapter([ingest, 'Deno runs this test [^1].\n\n[^1]: facts/fact-deno-abcd1234.md']);
  const wiki = await createWiki({ path: '/tmp/w', llmAdapter: llm, storageAdapter: adapter });
  const ingestResult = await wiki.ingest({ kind: 'text', content: 'x', format: 'md', sourceId: 'src-a' });
  assertEquals(ingestResult.factsProduced, ['fact-deno-abcd1234']);
  const queryResult = await wiki.query('Deno test');
  assert(queryResult.citations.length > 0, 'expected at least one citation');
});
