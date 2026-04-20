import { buildAllIndexes } from '../../src/indexes/build.ts';
import { searchIndex, searchIndexes } from '../../src/indexes/search.ts';
import { bench, printResults, type BenchResult } from './harness.ts';
import { makeCorpus } from './fixtures.ts';

export async function runIndexBenchmarks(): Promise<BenchResult[]> {
  const results: BenchResult[] = [];

  const sizes: Array<[number, number]> = [[100, 2000], [1000, 500], [10000, 100]];
  for (const [n, iters] of sizes) {
    const corpus = makeCorpus(n, Math.floor(n / 10));
    results.push(
      bench(`indexes/build (n=${n} pages)`, () => {
        buildAllIndexes(corpus);
      }, { iters })
    );
  }

  const corpus1k = makeCorpus(1000, 100);
  const indexes = buildAllIndexes(corpus1k);
  const factsIndex = indexes['index/facts.md'] ?? '';

  results.push(
    bench('indexes/search grep single index (n=1k)', () => {
      searchIndex(factsIndex, 'helix tessera');
    }, { iters: 3000 })
  );

  results.push(
    bench('indexes/search grep all indexes (n=1k)', () => {
      searchIndexes(indexes, 'helix tessera', 20);
    }, { iters: 1000 })
  );

  const corpus10k = makeCorpus(10000, 1000);
  const indexes10k = buildAllIndexes(corpus10k);
  results.push(
    bench('indexes/search grep all indexes (n=10k)', () => {
      searchIndexes(indexes10k, 'helix tessera', 20);
    }, { iters: 200 })
  );

  printResults('Index build + grep retrieval', results);
  return results;
}
