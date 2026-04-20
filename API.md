# API

Public surface of the library and the CLI. Everything not listed here is internal and may change without notice.

## 1. Library entry

```typescript
import { createWiki } from 'llm-wiki-kit';
```

### 1.1 createWiki

```typescript
function createWiki(opts: WikiOptions): Promise<Wiki>;

interface WikiOptions {
  path: string;                        // absolute path to wiki repo root
  embeddingAdapter?: EmbeddingAdapter; // optional, enables layer 3 retrieval
  llmAdapter: LLMAdapter;              // required, drives ingest and query agents
  logger?: Logger;                     // optional, defaults to stderr JSON logger
  config?: Partial<WikiConfig>;        // overrides of .wiki/config.json
}
```

Returns a ready `Wiki` instance. Throws `WIKI_NOT_INITIALIZED` if `path` is not a wiki repo (no `.wiki/` directory).

## 2. Wiki class

```typescript
class Wiki {
  ingest(source: SourceInput): Promise<IngestResult>;
  query(text: string, opts?: QueryOptions): Promise<QueryResult>;
  getConfig(): WikiConfig;
  setConfig(partial: Partial<WikiConfig>): Promise<void>;
}
```

### 2.1 ingest

```typescript
type SourceInput =
  | { kind: 'file'; path: string; sourceId?: string; force?: boolean }
  | { kind: 'text'; content: string; format: 'md' | 'txt' | 'html'; sourceId: string; origin?: string; force?: boolean };

interface IngestResult {
  sourceId: string;
  commitSha: string;
  factsProduced: string[];       // fact ids
  entitiesTouched: string[];     // entity slugs
  conceptsTouched: string[];
  synthesisTouched: string[];
  supersessions: Array<{ oldFactId: string; newFactId: string; reason: string }>;
  warnings: string[];
}
```

Throws `INVALID_SOURCE`, `SOURCE_ALREADY_INGESTED`, `SCHEMA_VIOLATION`, `GIT_CONFLICT`, `EMBEDDING_ADAPTER_MISSING` (only if config requires embeddings).

### 2.2 query

```typescript
interface QueryOptions {
  topK?: number;               // max pages in context, default from config.retrieval.final_k
  includeSuperseded?: boolean; // default false
  format?: 'json' | 'markdown'; // default 'markdown'
}

interface QueryResult {
  answer: string;              // rendered per format
  citations: Citation[];
  retrievalTrace: RetrievalTrace;
}

interface Citation {
  pagePath: string;            // wiki-relative, e.g. 'facts/a2e-benchmark-xyz.md'
  pageType: 'fact' | 'entity' | 'concept' | 'synthesis' | 'source';
  pageId: string;
  sources: string[];           // source-ids backing the cited page
  excerpt: string;             // short quote from the page body
}

interface RetrievalTrace {
  layersRun: Array<'index' | 'bm25' | 'vector'>;
  hitsPerLayer: Record<string, number>;
  finalPageCount: number;
  latencyMs: number;
}
```

## 3. Page types

```typescript
type PageType = 'fact' | 'entity' | 'concept' | 'synthesis' | 'source';

interface FactPage {
  type: 'fact';
  id: string;
  title: string;
  claim: string;
  sources: string[];
  ingested: string;              // ISO8601
  supersedes: string | null;
  supersededBy: string | null;
  confidence: 'low' | 'medium' | 'high';
  tags: string[];
  body: string;
}

interface EntityPage {
  type: 'entity';
  id: string;
  title: string;
  aliases: string[];
  kind: 'person' | 'org' | 'place' | 'product' | 'other';
  relatedFacts: string[];
  relatedEntities: string[];
  relatedConcepts: string[];
  lastUpdated: string;
  tags: string[];
  body: string;
}

interface ConceptPage {
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

interface SynthesisPage {
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

interface SourcePage {
  type: 'source';
  id: string;
  title: string;
  origin: string;
  ingested: string;
  format: 'md' | 'txt' | 'html';
  sizeBytes: number;
  hash: string;
  producedFacts: string[];
  touchedEntities: string[];
  touchedConcepts: string[];
  touchedSynthesis: string[];
  body: string;
}

type Page = FactPage | EntityPage | ConceptPage | SynthesisPage | SourcePage;
```

## 4. EmbeddingAdapter

```typescript
interface EmbeddingAdapter {
  name: string;                              // identifier, stored in config
  dimensions(): number;
  embed(text: string): Promise<Float32Array>;
  embedBatch?(texts: string[]): Promise<Float32Array[]>;  // optional optimization
}
```

Contract: `embed` must return a vector of `dimensions()` length every time. The kit caches nothing; the adapter is responsible for batching if it wants to optimize.

## 5. LLMAdapter

```typescript
interface LLMAdapter {
  name: string;
  complete(opts: LLMRequest): Promise<LLMResponse>;
}

interface LLMRequest {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}

interface LLMResponse {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}
```

Contract: `responseFormat: 'json'` must return valid JSON text. The kit parses it; the adapter is responsible for forcing JSON mode on the underlying model.

## 6. Logger

```typescript
interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
}
```

## 7. Errors

```typescript
type WikiErrorCode =
  | 'WIKI_NOT_INITIALIZED'
  | 'INVALID_SOURCE'
  | 'EMBEDDING_ADAPTER_MISSING'
  | 'GIT_CONFLICT'
  | 'SCHEMA_VIOLATION'
  | 'SOURCE_ALREADY_INGESTED';

class WikiError extends Error {
  code: WikiErrorCode;
  cause?: unknown;
  context?: Record<string, unknown>;
}
```

## 8. CLI

### 8.1 Commands

```
wiki init <dir>
  Create a new wiki repo at <dir>. Fails if <dir> exists and is non-empty.

wiki ingest <path> [--source-id <id>] [--force]
  Ingest a file or directory. If <path> is a directory, recursively ingests
  all supported files. --source-id overrides the auto-generated id. --force
  re-ingests a previously ingested source.

wiki query <text> [--format json|md] [--include-superseded] [--top-k <n>]
  Answer <text> against the wiki. --format defaults to md.

wiki config <key> <value>
  Set a config key. Use dotted paths: `wiki config retrieval.final_k 30`.
  With no arguments, prints the full config.
```

### 8.2 Exit codes

```
0    success
10   WIKI_NOT_INITIALIZED
11   INVALID_SOURCE
12   EMBEDDING_ADAPTER_MISSING
13   GIT_CONFLICT
14   SCHEMA_VIOLATION
15   SOURCE_ALREADY_INGESTED
1    unexpected error (surface the stack on --debug)
```

## 9. Stability

v0.1 is pre-release. Public surface may change in 0.2. All signatures in sections 1-7 are considered stable for the 0.1.x line once released; patch releases may not remove or rename any public member.
