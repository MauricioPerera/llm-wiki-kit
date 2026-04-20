import { WikiError } from '../lib/errors.ts';
import type { EmbeddingAdapter, PageType } from '../types/index.ts';

export interface VectorDocument {
  path: string;
  type: PageType;
  id: string;
  vector: Float32Array;
}

export interface VectorHit {
  path: string;
  type: PageType;
  id: string;
  score: number;
}

export interface VectorSearchOptions {
  topK?: number;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new WikiError(
      'SCHEMA_VIOLATION',
      `vector dimension mismatch: ${a.length} vs ${b.length}`,
      undefined,
      { a: a.length, b: b.length }
    );
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function assertDimensions(
  adapter: EmbeddingAdapter,
  vector: Float32Array
): void {
  const expected = adapter.dimensions();
  if (vector.length !== expected) {
    throw new WikiError(
      'SCHEMA_VIOLATION',
      `adapter returned vector of length ${vector.length}, expected ${expected}`,
      undefined,
      { expected, actual: vector.length }
    );
  }
}

export async function embedQuery(
  adapter: EmbeddingAdapter,
  text: string
): Promise<Float32Array> {
  const vector = await adapter.embed(text);
  assertDimensions(adapter, vector);
  return vector;
}

export async function embedDocuments(
  adapter: EmbeddingAdapter,
  texts: string[]
): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  if (typeof adapter.embedBatch === 'function') {
    const vectors = await adapter.embedBatch(texts);
    for (const v of vectors) assertDimensions(adapter, v);
    return vectors;
  }
  const out: Float32Array[] = [];
  for (const text of texts) {
    const v = await adapter.embed(text);
    assertDimensions(adapter, v);
    out.push(v);
  }
  return out;
}

export function searchVectors(
  queryVector: Float32Array,
  documents: VectorDocument[],
  opts: VectorSearchOptions = {}
): VectorHit[] {
  if (documents.length === 0) return [];
  const hits: VectorHit[] = documents.map((doc) => ({
    path: doc.path,
    type: doc.type,
    id: doc.id,
    score: cosineSimilarity(queryVector, doc.vector)
  }));
  hits.sort((a, b) => b.score - a.score);
  return typeof opts.topK === 'number' ? hits.slice(0, opts.topK) : hits;
}

export async function searchByAdapter(
  adapter: EmbeddingAdapter | null | undefined,
  query: string,
  documents: VectorDocument[],
  opts: VectorSearchOptions = {}
): Promise<VectorHit[]> {
  if (!adapter) return [];
  if (documents.length === 0) return [];
  const qv = await embedQuery(adapter, query);
  return searchVectors(qv, documents, opts);
}
