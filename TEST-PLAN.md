# TEST-PLAN

Concrete test scenarios the agent must implement. Every scenario listed here must have a corresponding test file under `tests/`.

## 1. Test organization

```
tests/
├── unit/
│   ├── pages/
│   │   ├── schema.test.ts
│   │   ├── render.test.ts
│   │   └── parse.test.ts
│   ├── indexes/
│   │   ├── build.test.ts
│   │   └── search.test.ts
│   ├── retrieval/
│   │   ├── bm25.test.ts
│   │   ├── vector.test.ts
│   │   └── rank.test.ts
│   ├── sources/
│   │   └── readers.test.ts
│   └── lib/
│       ├── platform.test.ts
│       └── errors.test.ts
├── integration/
│   ├── init.test.ts
│   ├── ingest.test.ts
│   ├── query.test.ts
│   └── supersession.test.ts
└── fixtures/
    ├── sources/
    │   ├── simple.md
    │   ├── complex.md
    │   ├── contradicting.md
    │   ├── basic.html
    │   └── plain.txt
    └── wikis/
        └── seeded/       # pre-built wiki for query tests
```

All tests use `vitest`. Integration tests use a fake `LLMAdapter` and a fake `EmbeddingAdapter` that produce deterministic outputs from fixtures.

## 2. Unit scenarios

### 2.1 pages/schema

- Valid fact page passes validation.
- Missing `sources` field fails with `SCHEMA_VIOLATION`.
- `confidence` outside the enum fails.
- Entity with non-array `aliases` fails.
- Source page with missing `hash` fails.
- Synthesis with `references.facts` containing non-string fails.

### 2.2 pages/render

- Fact page object renders to markdown with frontmatter matching `SCHEMA.md` § 4.1 byte-for-byte.
- Round-trip: `parse(render(page)) deepEqual page`.
- Wikilinks in body preserved verbatim.
- Tags in frontmatter serialize as YAML arrays, not inline comma lists.

### 2.3 pages/parse

- Markdown with valid frontmatter parses into the correct page type based on `type` field.
- Unknown `type` throws `SCHEMA_VIOLATION`.
- Missing frontmatter throws `SCHEMA_VIOLATION`.
- CRLF and LF line endings both parse correctly.

### 2.4 indexes/build

- Given 3 fact pages, builds `index/facts.md` with 3 entries, one per line, in slug-alphabetical order.
- Given an empty partition, builds an index with a header and no entries.
- Rebuild is idempotent: calling twice produces byte-identical output.

### 2.5 indexes/search

- Grep for a token that appears in exactly one summary returns that page path and no others.
- Grep for a tag returns all pages tagged with it.
- Grep for a non-existent token returns empty array, no error.
- Case-insensitive match on summaries.

### 2.6 retrieval/bm25

- Given a corpus of 10 pages, a query matching one page's title returns that page with highest score.
- BM25 scores for identical queries on identical corpora are deterministic.
- Configurable `k1` and `b` affect ranking.
- Empty query returns empty results.

### 2.7 retrieval/vector

- `EmbeddingAdapter` absent and layer 3 invoked returns empty results, not an error.
- Given a fake adapter returning fixed vectors, cosine similarity ranking is correct.
- Adapter returning wrong-dimension vector throws `SCHEMA_VIOLATION`.

### 2.8 retrieval/rank

- RRF merge of three layers with no overlap returns all hits deduplicated.
- Full overlap across three layers returns one result with boosted rank.
- `final_k` caps output length.

### 2.9 sources/readers

- Markdown reader strips existing frontmatter before returning body.
- HTML reader via readability extracts main content, discards nav/ads.
- TXT reader returns raw content unchanged.
- Unsupported extension throws `INVALID_SOURCE`.

### 2.10 lib/platform

- `isNode` true in vitest environment.
- `isDeno` and `isWorker` false in vitest environment.
- Mutually exclusive (exactly one is true at any time).

### 2.11 lib/errors

- `WikiError` carries `code`, `cause`, `context`.
- `cause` chain preserved across re-throws.

## 3. Integration scenarios

### 3.1 init

- `wiki init <empty-dir>` creates the layout from `SCHEMA.md` § 2.
- `wiki init` on a non-empty dir fails without writing anything.
- After init, `wiki query "anything"` returns no results and exits 0.

### 3.2 ingest

- Ingesting `fixtures/sources/simple.md` produces at least one fact page, at least one entity page, updates all 5 indexes, and produces a single commit.
- Commit message follows the format in `SPECIFICATION.md` § 5.2.
- Re-ingesting the same source exits 15 (`SOURCE_ALREADY_INGESTED`).
- Re-ingesting with `--force` creates a new commit.
- `fixtures/sources/basic.html` extracts content and ingests it as if it were markdown.
- A mid-pipeline failure (simulated via a fake adapter that throws) leaves the working tree and the git log untouched.

### 3.3 query

- On a seeded wiki with known pages, `wiki query` returns citations pointing at the correct pages.
- `--format json` returns parseable JSON matching `QueryResult`.
- `--format md` returns a markdown answer with footnote-style citations.
- `retrievalTrace.layersRun` reflects the layer selection logic from `ARCHITECTURE.md` § 4.2.
- Query against an empty wiki returns an answer acknowledging no information, no error.

### 3.4 supersession

- Ingest source A producing fact F1 with claim "X is blue".
- Ingest source B producing fact F2 with claim "X is red", contradicting F1.
- F2 exists with `supersedes: F1`. F1 exists with `supersededBy: F2`.
- Default query surfaces F2 only.
- Query with `--include-superseded` surfaces both.
- `git log` shows two commits, one per ingest.

## 4. Cross-runtime scenarios

Each of these must pass on Node, Deno, and Workers (Workers via `wrangler dev` and a fetch-based harness).

- `createWiki` succeeds on all three.
- `Wiki.query` on the seeded wiki returns identical citations on all three.
- `Wiki.ingest` works on Node and Deno. On Workers, ingest is expected to work but requires a Workers-compatible `js-git-store` (still pre-v0.1 for that target); test is a skip with a comment referencing the `js-git-store` roadmap.

## 5. Fixtures

### 5.1 sources/simple.md

A short markdown doc (~300 words) about a fictional company and product. Produces 3-5 facts, 2 entities, 1 concept on ingest.

### 5.2 sources/complex.md

A ~2000-word markdown doc with multiple entities, concepts, and internal cross-references. Produces 10-15 facts, 5 entities, 3 concepts, 1 synthesis.

### 5.3 sources/contradicting.md

A short doc that directly contradicts one fact from `simple.md`. Used for the supersession test.

### 5.4 sources/basic.html

A minimal HTML page with boilerplate nav, an article, and ads. Tests readability extraction.

### 5.5 sources/plain.txt

A plain-text doc with no structure. Tests the txt reader and the LLM's ability to produce structured facts from unstructured text.

### 5.6 wikis/seeded

A pre-ingested wiki with known pages. Integration tests use this as a stable corpus for query tests. Committed to the repo (small, markdown, no binaries).

## 6. Fake adapters

### 6.1 FakeLLMAdapter

Deterministic. Given a system prompt and user message, returns a fixture file's contents. The fixture is selected by hashing the input. Fixtures under `tests/fixtures/llm-responses/`. Adding a new integration test requires adding its expected LLM response as a fixture.

### 6.2 FakeEmbeddingAdapter

Returns fixed 32-dimensional vectors derived from string hashing. Deterministic, fast, dimension-consistent.

## 7. Acceptance

A run is green when:

- `vitest run` exits 0.
- `deno test tests/integration/query.test.ts` exits 0.
- Coverage (if measured) of `src/` is at least 80% line, 70% branch. Coverage under 80% is a warning, not a failure, for v0.1.

Flaky tests (non-deterministic failures across 3 consecutive runs) block merge; fix the source of non-determinism, do not retry.
