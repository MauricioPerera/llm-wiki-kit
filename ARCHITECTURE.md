# ARCHITECTURE

Module layout, data flow, error model. All paths relative to repo root.

## 1. Module map

```
src/
├── index.ts                    # public entry, re-exports
├── types/index.ts              # shared types
├── core/
│   ├── wiki.ts                 # Wiki class (facade)
│   ├── ingest.ts               # ingest pipeline
│   └── query.ts                # query pipeline
├── pages/
│   ├── schema.ts               # zod schemas per page type
│   ├── render.ts               # page object → markdown
│   └── parse.ts                # markdown → page object
├── indexes/
│   ├── build.ts                # regenerate indexes from pages
│   └── search.ts               # grep over indexes (layer 1)
├── retrieval/
│   ├── bm25.ts                 # BM25 over pages (layer 2)
│   ├── vector.ts               # embeddings adapter + search (layer 3)
│   └── rank.ts                 # RRF merge of three layers
├── sources/
│   └── readers.ts              # md, txt, html
├── lib/
│   ├── platform.ts             # runtime detection
│   ├── errors.ts               # WikiError + codes
│   └── logger.ts               # Logger interface
└── cli/
    ├── index.ts                # citty root
    └── commands/{init,ingest,query,config}.ts
```

## 2. Dependency direction

```
cli → core → {pages, indexes, retrieval, sources} → lib
```

`core` depends on the host libs (`js-doc-store`, `js-vector-store`, `js-git-store`). Leaf modules do not. This keeps `pages`, `indexes`, `retrieval`, `sources` unit-testable without the storage substrate.

## 3. Ingest data flow

```
source file
  │
  ▼
sources/readers.ts             # load raw text, normalize
  │  → { source-id, raw-text, metadata }
  ▼
[LLM call: ingest agent]       # CLAUDE.md § 2 drives this
  │  → { facts[], entity-updates[], concept-updates[], synthesis-updates[], source-page }
  ▼
pages/schema.ts                # validate each produced page
  │
  ▼
core/ingest.ts                 # orchestrate:
  │    1. detect supersessions against existing facts
  │    2. resolve slugs (collision handling per SCHEMA § 3)
  │    3. render pages via pages/render.ts
  │    4. write via js-doc-store
  │    5. update ingested.json
  │    6. regenerate affected indexes via indexes/build.ts
  │    7. embed new fact bodies via retrieval/vector.ts (if adapter configured)
  │    8. commit atomically via js-git-store
  ▼
IngestResult
```

Any failure before step 8 aborts the commit. The working tree stays unchanged by design: writes go through `js-doc-store`, which stages to the git index branch; only the final commit makes the change visible.

## 4. Query data flow

### 4.1 Pipeline

```
query text
  │
  ▼
indexes/search.ts              # layer 1: grep on index files
  │  → top_k_per_layer index hits → page paths
  ▼
retrieval/bm25.ts              # layer 2: BM25 over all pages
  │  → top_k_per_layer page hits
  ▼
retrieval/vector.ts            # layer 3: embed query, vector search (if adapter)
  │  → top_k_per_layer page hits
  ▼
retrieval/rank.ts              # RRF merge, dedup, final_k cut
  │
  ▼
[LLM call: query agent]        # CLAUDE.md § 3 drives this
  │  → answer with citations
  ▼
QueryResult
```

### 4.2 Ordering

Layer 1 runs first and always. Layer 2 runs when layer 1 returns fewer than `top_k_per_layer / 2` hits or when the query contains no index-matching tokens. Layer 3 runs when the adapter is configured and the merged layer 1+2 results contain fewer than `final_k / 2` distinct pages.

Skipping later layers on high-confidence early hits saves tokens and latency without hurting recall on the cases that matter.

## 5. Storage substrate interaction

`core/ingest.ts` and `core/query.ts` talk to a single `GitStoreAdapter` from `js-git-store` (for raw page + index files) and optionally to `js-doc-store` and `js-vector-store` on top of the same adapter (for structured metadata and embeddings).

- **Pages** (`facts/*.md`, `entities/*.md`, `concepts/*.md`, `synthesis/*.md`, `sources/*.md`) and **indexes** (`index/*.md`) are written as raw UTF-8 bytes via `adapter.writeBin(path, bytes)` and read via `adapter.readBinShared(path)` or `adapter.readBin(path)`. This keeps them as real Markdown files on disk so Obsidian, `grep`, and any standard tooling work without translation.
- **Dedup cache** (`.wiki/ingested.json`) and **config** (`.wiki/config.json`) are stored via `js-doc-store` on top of the same adapter (structured JSON queried with `find({source_id})`).
- **Embeddings** go to `js-vector-store`, one collection, with metadata pointing back at the wiki-relative page path.
- The git branches are managed by `js-git-store`: the `index` ref holds `.md` pages and indexes (light, shallow); the `content` ref holds `.bin` + `.docs.json` heavy files (partial clone, fetched on demand). The default `heavyFileRegex` (`/\.(bin|docs\.json)$/`) already routes correctly without per-path configuration.
- Amendment log (2026-04-20): the earlier draft of this section described pages as documents inside a `js-doc-store` collection, which would have made them invisible to Obsidian. The corrected model above preserves the Markdown-as-artifact property called out in the README and SPECIFICATION.

The kit never shells out to `git`. All git operations go through `js-git-store`.

## 6. Error model

Single class:

```typescript
class WikiError extends Error {
  constructor(
    public code: WikiErrorCode,
    message: string,
    public cause?: unknown,
    public context?: Record<string, unknown>,
  ) { super(message); }
}
```

Codes are the set from `CONTRACT.md` § 2.3. Additions require a contract amendment.

Rules:

- Library functions never throw plain `Error`. Every thrown error is a `WikiError`.
- Caught errors are either re-thrown as `WikiError` with a code or handled with a one-line comment explaining why swallowing is correct.
- CLI layer catches `WikiError`, formats per `--format`, exits with the code number mapped in `src/cli/index.ts`.

## 7. Logging

`Logger` interface:

```typescript
interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
}
```

Default impl writes newline-delimited JSON to stderr. CLI replaces it with a human-friendly impl. Library code uses the injected logger only; never `console`.

## 8. Platform gating

`src/lib/platform.ts` exports:

```typescript
export const isNode: boolean;
export const isDeno: boolean;
export const isWorker: boolean;
```

Node-only imports (`node:fs`, `node:path`) live in modules gated by `if (isNode)` or in files with a `.node.ts` suffix loaded via conditional imports. The CLI is Node-only by design; library code is tri-target.

HTML extraction uses `linkedom` (works on all three) not `jsdom` (Node-only).

## 9. Concurrency

v0.1 is single-process. Ingest holds an in-memory lock; concurrent `wiki ingest` calls on the same repo are rejected with `GIT_CONFLICT`. Query is read-only and runs without locking.

Multi-process and remote collaboration are post-v0.1. The git substrate is ready for it; the kit is not.

## 10. Extension points

Three stable seams for downstream users:

- `EmbeddingAdapter` (see `API.md` § 4) — plug any embedding model.
- `SourceReader` — register a reader for a new format. v0.1 ships md, txt, html; PDF in a later phase registers through the same interface.
- `Logger` — inject any logger.

Nothing else is a public extension point. The ingest/query prompts are internal to this kit and may change across minor versions.
