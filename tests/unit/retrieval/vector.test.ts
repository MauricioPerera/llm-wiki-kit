import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  searchVectors,
  searchByAdapter,
  embedQuery,
  type VectorDocument
} from '../../../src/retrieval/vector.ts';
import { WikiError } from '../../../src/lib/errors.ts';
import type { EmbeddingAdapter } from '../../../src/types/index.ts';

function vec(values: number[]): Float32Array {
  return Float32Array.from(values);
}

const fakeAdapter: EmbeddingAdapter = {
  name: 'fake-4d',
  dimensions: () => 4,
  embed: async (text: string) => {
    if (text.includes('helix')) return vec([1, 0, 0, 0]);
    if (text.includes('gemma')) return vec([0, 1, 0, 0]);
    if (text.includes('a2e')) return vec([0, 0, 1, 0]);
    return vec([0, 0, 0, 1]);
  }
};

const docs: VectorDocument[] = [
  { path: 'facts/a.md', type: 'fact', id: 'a', vector: vec([0.9, 0.1, 0, 0]) },
  { path: 'facts/b.md', type: 'fact', id: 'b', vector: vec([0, 0.9, 0.1, 0]) },
  { path: 'facts/c.md', type: 'fact', id: 'c', vector: vec([0, 0, 0.9, 0.1]) }
];

describe('retrieval/vector', () => {
  it('no adapter returns empty, not error', async () => {
    const hits = await searchByAdapter(null, 'helix', docs);
    expect(hits).toEqual([]);
  });

  it('cosine ranks nearest vector first', async () => {
    const hits = await searchByAdapter(fakeAdapter, 'helix robotics', docs);
    expect(hits[0]?.id).toBe('a');
  });

  it('wrong-dimension vector throws SCHEMA_VIOLATION', async () => {
    const broken: EmbeddingAdapter = {
      name: 'broken',
      dimensions: () => 4,
      embed: async () => vec([1, 2, 3])
    };
    await expect(embedQuery(broken, 'x')).rejects.toBeInstanceOf(WikiError);
  });

  it('cosineSimilarity of orthogonal vectors is 0', () => {
    expect(cosineSimilarity(vec([1, 0]), vec([0, 1]))).toBe(0);
  });

  it('cosineSimilarity of identical vectors is ~1', () => {
    expect(cosineSimilarity(vec([1, 2, 3]), vec([1, 2, 3]))).toBeCloseTo(1, 6);
  });

  it('dimension mismatch in cosine throws', () => {
    expect(() => cosineSimilarity(vec([1, 0]), vec([1, 0, 0]))).toThrow(WikiError);
  });

  it('searchVectors respects topK', () => {
    const hits = searchVectors(vec([1, 0, 0, 0]), docs, { topK: 1 });
    expect(hits).toHaveLength(1);
  });

  it('empty document set returns empty', () => {
    expect(searchVectors(vec([1, 0, 0, 0]), [])).toEqual([]);
  });
});
