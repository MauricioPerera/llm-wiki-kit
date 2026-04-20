import { performance } from 'node:perf_hooks';
import { createWiki, initializeWiki } from '../../src/core/wiki.ts';
import { benchAsync, printResults, type BenchResult } from './harness.ts';
import { createMemoryAdapter, FakeLLMAdapter } from '../integration/helpers.ts';
import { makeFact } from './fixtures.ts';
import type { Page } from '../../src/types/index.ts';

async function seedWiki(n: number): Promise<{ wiki: Awaited<ReturnType<typeof createWiki>>; llm: FakeLLMAdapter }> {
  const adapter = createMemoryAdapter();
  await initializeWiki(adapter);
  const llm = new FakeLLMAdapter([]);
  const wiki = await createWiki({ path: '/tmp/bench', llmAdapter: llm, storageAdapter: adapter });
  const pages: Page[] = Array.from({ length: n }, (_, i) => makeFact(i));
  for (const p of pages) wiki.stagePage(p);
  wiki.rebuildIndexes(pages);
  return { wiki, llm };
}

export async function runPipelineBenchmarks(): Promise<BenchResult[]> {
  const results: BenchResult[] = [];

  for (const n of [100, 1000]) {
    const { wiki, llm } = await seedWiki(n);
    const setupPush = (): void => {
      llm.push('answer[^1]\n\n[^1]: facts/fact-0-xxxxxxxx.md');
    };
    results.push(
      await benchAsync(
        `core/query end-to-end (n=${n} pages, no LLM latency)`,
        async () => {
          setupPush();
          await wiki.query('helix tessera lattice');
        },
        { iters: n >= 1000 ? 20 : 80 }
      )
    );
  }

  const { wiki } = await seedWiki(200);
  const start = performance.now();
  const pages = await wiki.preloadAllPages();
  const elapsed = performance.now() - start;
  results.push({
    name: 'core/preloadAllPages (n=200, 1 call)',
    iters: 1,
    totalMs: elapsed,
    perOpMs: elapsed,
    opsPerSec: 1000 / elapsed
  });
  if (pages.length !== 200) throw new Error(`expected 200 pages, got ${pages.length}`);

  printResults('End-to-end query pipeline', results);
  return results;
}
