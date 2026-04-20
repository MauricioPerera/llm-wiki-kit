export type PageType = 'fact' | 'entity' | 'concept' | 'synthesis' | 'source';
export type Confidence = 'low' | 'medium' | 'high';
export type EntityKind = 'person' | 'org' | 'place' | 'product' | 'other';
export type SourceFormat = 'md' | 'txt' | 'html';

export interface FactPage {
  type: 'fact';
  id: string;
  title: string;
  claim: string;
  sources: string[];
  ingested: string;
  supersedes: string | null;
  supersededBy: string | null;
  confidence: Confidence;
  tags: string[];
  body: string;
}
export interface EntityPage {
  type: 'entity';
  id: string;
  title: string;
  aliases: string[];
  kind: EntityKind;
  relatedFacts: string[];
  relatedEntities: string[];
  relatedConcepts: string[];
  lastUpdated: string;
  tags: string[];
  body: string;
}
export interface ConceptPage {
  type: 'concept';
  id: string;
  title: string;
  aliases: string[];
  relatedFacts: string[];
  relatedEntities: string[];
  relatedConcepts: string[];
  lastUpdated: string;
  tags: string[];
  body: string;
}
export interface SynthesisPage {
  type: 'synthesis';
  id: string;
  title: string;
  scope: string;
  references: {
    facts: string[];
    entities: string[];
    concepts: string[];
    sources: string[];
  };
  lastUpdated: string;
  tags: string[];
  body: string;
}
export interface SourcePage {
  type: 'source';
  id: string;
  title: string;
  origin: string;
  ingested: string;
  format: SourceFormat;
  sizeBytes: number;
  hash: string;
  producedFacts: string[];
  touchedEntities: string[];
  touchedConcepts: string[];
  touchedSynthesis: string[];
  body: string;
}
export type Page = FactPage | EntityPage | ConceptPage | SynthesisPage | SourcePage;

export interface WikiConfig {
  version: number;
  embedding_adapter: string | null;
  embedding_dimensions: number | null;
  bm25: { k1: number; b: number };
  retrieval: { top_k_per_layer: number; final_k: number };
  ingest: { require_frontmatter_validation: boolean };
}
export const DEFAULT_CONFIG: WikiConfig = {
  version: 1,
  embedding_adapter: null,
  embedding_dimensions: null,
  bm25: { k1: 1.5, b: 0.75 },
  retrieval: { top_k_per_layer: 10, final_k: 20 },
  ingest: { require_frontmatter_validation: true }
};

export interface EmbeddingAdapter {
  name: string;
  dimensions(): number;
  embed(text: string): Promise<Float32Array>;
  embedBatch?(texts: string[]): Promise<Float32Array[]>;
}
export interface LLMRequest {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}
export interface LLMResponse {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}
export interface LLMAdapter {
  name: string;
  complete(opts: LLMRequest): Promise<LLMResponse>;
}

export interface Citation {
  pagePath: string;
  pageType: PageType;
  pageId: string;
  sources: string[];
  excerpt: string;
}
export interface RetrievalTrace {
  layersRun: Array<'index' | 'bm25' | 'vector'>;
  hitsPerLayer: Record<string, number>;
  finalPageCount: number;
  latencyMs: number;
}
export interface QueryResult {
  answer: string;
  citations: Citation[];
  retrievalTrace: RetrievalTrace;
}
export interface IngestResult {
  sourceId: string;
  commitSha: string;
  factsProduced: string[];
  entitiesTouched: string[];
  conceptsTouched: string[];
  synthesisTouched: string[];
  supersessions: Array<{ oldFactId: string; newFactId: string; reason: string }>;
  warnings: string[];
}
export type SourceInput =
  | { kind: 'file'; path: string; sourceId?: string; force?: boolean }
  | {
      kind: 'text';
      content: string;
      format: SourceFormat;
      sourceId: string;
      origin?: string;
      force?: boolean;
    };
export interface QueryOptions {
  topK?: number;
  includeSuperseded?: boolean;
  format?: 'json' | 'markdown';
}
export interface PageRef {
  path: string;
  type: PageType;
  id: string;
}
export interface RetrievalHit extends PageRef {
  score: number;
  layer: 'index' | 'bm25' | 'vector';
}

export interface FileAdapter {
  readJson<T = unknown>(filename: string): T | null;
  writeJson(filename: string, data: unknown): void;
  readBin(filename: string): ArrayBuffer | null;
  readBinShared?(filename: string): Uint8Array | null;
  writeBin(filename: string, buffer: ArrayBuffer | Uint8Array): void;
  delete(filename: string): void;
  preload(filenames: string[]): Promise<void>;
  persist(): Promise<void>;
  push?(): Promise<void>;
  close?(): Promise<void>;
}
export interface LoggerLike {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
}
export interface WikiOptions {
  path: string;
  llmAdapter: LLMAdapter;
  embeddingAdapter?: EmbeddingAdapter;
  logger?: LoggerLike;
  config?: Partial<WikiConfig>;
  storageAdapter?: FileAdapter;
}
export interface IngestedEntry {
  hash: string;
  ingested: string;
  facts_produced: string[];
}
export type IngestedCache = Record<string, IngestedEntry>;
