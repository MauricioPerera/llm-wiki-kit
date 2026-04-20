import type {
  EmbeddingAdapter,
  FileAdapter,
  LLMAdapter,
  LLMRequest,
  LLMResponse
} from '../../src/types/index.ts';

export function createMemoryAdapter(): FileAdapter {
  const jsonStore = new Map<string, unknown>();
  const binStore = new Map<string, Uint8Array>();
  return {
    readJson<T = unknown>(filename: string): T | null {
      return (jsonStore.has(filename) ? (jsonStore.get(filename) as T) : null);
    },
    writeJson(filename, data) {
      jsonStore.set(filename, data);
      binStore.delete(filename);
    },
    readBin(filename) {
      const v = binStore.get(filename);
      if (!v) return null;
      const copy = new Uint8Array(v);
      return copy.buffer as ArrayBuffer;
    },
    readBinShared(filename) {
      return binStore.get(filename) ?? null;
    },
    writeBin(filename, buffer) {
      const bytes = buffer instanceof Uint8Array ? new Uint8Array(buffer) : new Uint8Array(buffer);
      binStore.set(filename, bytes);
      jsonStore.delete(filename);
    },
    delete(filename) {
      jsonStore.delete(filename);
      binStore.delete(filename);
    },
    async preload() { /* in-memory — nothing to do */ },
    async persist() { /* no-op */ }
  };
}

export class FakeLLMAdapter implements LLMAdapter {
  readonly name = 'fake-llm';
  private readonly queue: string[];
  readonly calls: LLMRequest[] = [];

  constructor(responses: string[] = []) {
    this.queue = [...responses];
  }
  push(response: string): void {
    this.queue.push(response);
  }
  async complete(opts: LLMRequest): Promise<LLMResponse> {
    this.calls.push(opts);
    const next = this.queue.shift();
    if (next === undefined) throw new Error('FakeLLMAdapter queue exhausted');
    return { text: next };
  }
}

function hashVec(text: string, dim: number): Float32Array {
  const arr = new Float32Array(dim);
  let seed = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  for (let i = 0; i < dim; i += 1) {
    seed = Math.imul(seed ^ (i + 1), 2654435761) >>> 0;
    arr[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
  }
  let norm = 0;
  for (let i = 0; i < dim; i += 1) norm += (arr[i] ?? 0) * (arr[i] ?? 0);
  const denom = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i += 1) arr[i] = (arr[i] ?? 0) / denom;
  return arr;
}

export class FakeEmbeddingAdapter implements EmbeddingAdapter {
  readonly name = 'fake-embed';
  readonly dim: number;
  constructor(dim = 32) { this.dim = dim; }
  dimensions(): number { return this.dim; }
  async embed(text: string): Promise<Float32Array> {
    return hashVec(text, this.dim);
  }
}

export function ingestResponse(fields: {
  sourceId: string;
  title: string;
  format?: 'md' | 'txt' | 'html';
  hash?: string;
  sizeBytes?: number;
  facts: Array<{ id: string; title: string; claim: string; supersedes?: string | null; confidence?: 'low' | 'medium' | 'high'; tags?: string[] }>;
  entities?: Array<{ id: string; title: string; kind?: string; body?: string; tags?: string[] }>;
  concepts?: Array<{ id: string; title: string; body?: string; tags?: string[] }>;
  supersessions?: Array<{ old_fact_id: string; new_fact_id: string; reason: string }>;
  now?: string;
}): string {
  const now = fields.now ?? '2026-04-20T10:00:00Z';
  return JSON.stringify({
    source_page: {
      type: 'source',
      id: fields.sourceId,
      title: fields.title,
      origin: `tests://${fields.sourceId}`,
      ingested: now,
      format: fields.format ?? 'md',
      sizeBytes: fields.sizeBytes ?? 100,
      hash: fields.hash ?? 'fixtures-hash',
      producedFacts: fields.facts.map((f) => f.id),
      touchedEntities: (fields.entities ?? []).map((e) => e.id),
      touchedConcepts: (fields.concepts ?? []).map((c) => c.id),
      touchedSynthesis: [],
      body: ''
    },
    facts: fields.facts.map((f) => ({
      type: 'fact',
      id: f.id,
      title: f.title,
      claim: f.claim,
      sources: [fields.sourceId],
      ingested: now,
      supersedes: f.supersedes ?? null,
      supersededBy: null,
      confidence: f.confidence ?? 'high',
      tags: f.tags ?? [],
      body: ''
    })),
    entity_updates: (fields.entities ?? []).map((e) => ({
      type: 'entity',
      id: e.id,
      title: e.title,
      aliases: [],
      kind: e.kind ?? 'org',
      relatedFacts: [],
      relatedEntities: [],
      relatedConcepts: [],
      lastUpdated: now,
      tags: e.tags ?? [],
      body: e.body ?? ''
    })),
    concept_updates: (fields.concepts ?? []).map((c) => ({
      type: 'concept',
      id: c.id,
      title: c.title,
      aliases: [],
      relatedFacts: [],
      relatedEntities: [],
      relatedConcepts: [],
      lastUpdated: now,
      tags: c.tags ?? [],
      body: c.body ?? ''
    })),
    synthesis_updates: [],
    supersessions: fields.supersessions ?? []
  });
}
