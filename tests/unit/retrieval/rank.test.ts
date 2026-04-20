import { describe, it, expect } from 'vitest';
import { rrfMerge, type LayerInput } from '../../../src/retrieval/rank.ts';

function hit(id: string, score = 1): { path: string; type: 'fact'; id: string; score: number } {
  return { path: `facts/${id}.md`, type: 'fact', id, score };
}

describe('retrieval/rank', () => {
  it('dedupes and merges three layers with no overlap', () => {
    const layers: LayerInput[] = [
      { layer: 'index', hits: [hit('a')] },
      { layer: 'bm25', hits: [hit('b')] },
      { layer: 'vector', hits: [hit('c')] }
    ];
    const merged = rrfMerge(layers);
    expect(merged).toHaveLength(3);
    const ids = merged.map((m) => m.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('full overlap boosts a single doc to the top', () => {
    const layers: LayerInput[] = [
      { layer: 'index', hits: [hit('shared'), hit('a')] },
      { layer: 'bm25', hits: [hit('shared'), hit('b')] },
      { layer: 'vector', hits: [hit('shared'), hit('c')] }
    ];
    const merged = rrfMerge(layers);
    expect(merged[0]?.id).toBe('shared');
  });

  it('finalK caps the output length', () => {
    const layers: LayerInput[] = [
      {
        layer: 'bm25',
        hits: Array.from({ length: 20 }, (_, i) => hit(`d${i}`))
      }
    ];
    const merged = rrfMerge(layers, { finalK: 5 });
    expect(merged).toHaveLength(5);
  });

  it('empty input returns empty', () => {
    expect(rrfMerge([])).toEqual([]);
  });

  it('respects RRF rank order within a single layer', () => {
    const layers: LayerInput[] = [
      {
        layer: 'index',
        hits: [hit('first'), hit('second'), hit('third')]
      }
    ];
    const merged = rrfMerge(layers);
    expect(merged.map((m) => m.id)).toEqual(['first', 'second', 'third']);
  });

  it('first-layer-seen is recorded on the hit', () => {
    const layers: LayerInput[] = [
      { layer: 'bm25', hits: [hit('x')] },
      { layer: 'vector', hits: [hit('x')] }
    ];
    const merged = rrfMerge(layers);
    expect(merged[0]?.layer).toBe('bm25');
  });
});
