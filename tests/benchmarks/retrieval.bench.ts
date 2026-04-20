import { searchBM25, type BM25Document } from '../../src/retrieval/bm25.ts';
import { cosineSimilarity, searchVectors, type VectorDocument } from '../../src/retrieval/vector.ts';
import { rrfMerge, type LayerInput } from '../../src/retrieval/rank.ts';
import { bench, printResults, type BenchResult } from './harness.ts';
import { makeFact, fillVector } from './fixtures.ts';

function buildBM25Corpus(n: number): BM25Document[] {
  const docs: BM25Document[] = [];
  for (let i = 0; i < n; i += 1) {
    const f = makeFact(i, 80);
    docs.push({ path: `facts/${f.id}.md`, type: 'fact', id: f.id, text: `${f.title} ${f.claim} ${f.body}` });
  }
  return docs;
}

function buildVectorCorpus(n: number, dim: number): VectorDocument[] {
  const docs: VectorDocument[] = [];
  for (let i = 0; i < n; i += 1) {
    docs.push({ path: `facts/f-${i}.md`, type: 'fact', id: `f-${i}`, vector: fillVector(i, dim) });
  }
  return docs;
}

export async function runRetrievalBenchmarks(): Promise<BenchResult[]> {
  const results: BenchResult[] = [];

  for (const n of [100, 1000, 10000]) {
    const corpus = buildBM25Corpus(n);
    const iters = n >= 10000 ? 50 : n >= 1000 ? 500 : 2000;
    results.push(
      bench(`retrieval/bm25 search (n=${n})`, () => {
        searchBM25(corpus, 'helix tessera lattice', { topK: 20 });
      }, { iters })
    );
  }

  for (const dim of [32, 768]) {
    for (const n of [100, 1000, 10000]) {
      const corpus = buildVectorCorpus(n, dim);
      const query = fillVector(99999, dim);
      const iters = n >= 10000 ? 200 : n >= 1000 ? 1000 : 3000;
      results.push(
        bench(`retrieval/vector search (n=${n}, dim=${dim})`, () => {
          searchVectors(query, corpus, { topK: 20 });
        }, { iters })
      );
    }
  }

  const a = fillVector(1, 768);
  const b = fillVector(2, 768);
  results.push(
    bench('retrieval/vector cosine (dim=768)', () => {
      cosineSimilarity(a, b);
    }, { iters: 50000 })
  );

  const layers: LayerInput[] = [
    { layer: 'index', hits: Array.from({ length: 20 }, (_, i) => ({ path: `facts/a-${i}.md`, type: 'fact' as const, id: `a-${i}`, score: 1 })) },
    { layer: 'bm25', hits: Array.from({ length: 20 }, (_, i) => ({ path: `facts/b-${i}.md`, type: 'fact' as const, id: `b-${i}`, score: 1 })) },
    { layer: 'vector', hits: Array.from({ length: 20 }, (_, i) => ({ path: `facts/c-${i}.md`, type: 'fact' as const, id: `c-${i}`, score: 1 })) }
  ];
  results.push(
    bench('retrieval/rank RRF 3 layers × 20 hits', () => {
      rrfMerge(layers, { finalK: 20 });
    }, { iters: 10000 })
  );

  printResults('Retrieval (BM25 + vector + RRF)', results);
  return results;
}
