import { describe, it, expect } from 'vitest';
import { searchBM25, tokenize, type BM25Document } from '../../../src/retrieval/bm25.ts';

function makeDoc(id: string, text: string): BM25Document {
  return { path: `facts/${id}.md`, type: 'fact', id, text };
}

const corpus: BM25Document[] = [
  makeDoc('a-1', 'Helix Robotics launched Tessera-1 in Barcelona.'),
  makeDoc('b-2', 'A2E benchmark measures agentic tasks on small LLMs.'),
  makeDoc('c-3', 'Workers AI adds Gemma 3 4B for low-latency inference.'),
  makeDoc('d-4', 'Carreras Logistics receives first Tessera-1 production units.'),
  makeDoc('e-5', 'Lattice-Nav navigation framework cuts pick-and-place latency.'),
  makeDoc('f-6', 'Helix Robotics holds seed funding from Inflexion Ventures.'),
  makeDoc('g-7', 'Gemma 3 4B is accessible via the cf/google/gemma-3-4b binding.'),
  makeDoc('h-8', 'The A2E leaderboard for April 2026 shows 86 percent.'),
  makeDoc('i-9', 'Marina Oller co-founded Helix Robotics in 2022.'),
  makeDoc('j-10', 'Carreras Logistics operates warehouses across Catalonia.')
];

describe('retrieval/bm25', () => {
  it('ranks the matching doc highest for a unique query', () => {
    const hits = searchBM25(corpus, 'lattice-nav');
    expect(hits[0]?.id).toBe('e-5');
  });

  it('is deterministic across identical runs', () => {
    const a = searchBM25(corpus, 'tessera helix');
    const b = searchBM25(corpus, 'tessera helix');
    expect(a).toEqual(b);
  });

  it('changing k1 changes ranking under saturation', () => {
    const a = searchBM25(corpus, 'helix robotics', { k1: 0.5 });
    const b = searchBM25(corpus, 'helix robotics', { k1: 3.0 });
    expect(a.map((h) => h.score)).not.toEqual(b.map((h) => h.score));
  });

  it('empty query returns empty', () => {
    expect(searchBM25(corpus, '')).toEqual([]);
  });

  it('empty corpus returns empty', () => {
    expect(searchBM25([], 'helix')).toEqual([]);
  });

  it('topK caps results', () => {
    const hits = searchBM25(corpus, 'helix', { topK: 2 });
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it('tokenize splits on non-word chars, keeps hyphens and apostrophes', () => {
    expect(tokenize("it's a co-op")).toEqual(["it's", 'a', 'co-op']);
  });
});
