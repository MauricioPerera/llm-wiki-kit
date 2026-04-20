# CONTRACT

Execution contract for the coding agent. Read this first. Everything in this document is binding.

## 1. Objective

Build `llm-wiki-kit` v0.1: a CLI that ingests text sources into a git-backed Obsidian-compatible markdown wiki and answers queries over it using three retrieval layers.

Success: the CLI passes every acceptance criterion in section 6 against the test plan in `TEST-PLAN.md`.

## 2. Inputs and outputs

### 2.1 CLI commands

```
wiki init <dir>                          # create a new wiki repo
wiki ingest <path> [--source-id <id>]    # ingest a file or directory
wiki query <text> [--format json|md]     # answer a question from the wiki
wiki config <key> <value>                # set config (e.g. embedding adapter)
```

### 2.2 Library exports (for programmatic use)

```typescript
createWiki(opts: WikiOptions): Wiki
Wiki.ingest(source: SourceInput): Promise<IngestResult>
Wiki.query(text: string, opts?: QueryOptions): Promise<QueryResult>
```

Full type definitions in `API.md`.

### 2.3 Error codes

- `WIKI_NOT_INITIALIZED` — target dir is not a wiki repo
- `INVALID_SOURCE` — unreadable or unsupported file
- `EMBEDDING_ADAPTER_MISSING` — embeddings required but no adapter configured
- `GIT_CONFLICT` — underlying git-store rejected the commit
- `SCHEMA_VIOLATION` — page frontmatter failed validation
- `SOURCE_ALREADY_INGESTED` — same `source-id` already exists (use `--force` to re-ingest)

## 3. Stack and dependencies

- Runtime: Node 20+, Deno 1.40+, Cloudflare Workers (wrangler 3+)
- Language: TypeScript strict, ES2022 target
- Host libraries (peer deps): `js-doc-store`, `js-vector-store`, `js-git-store`
- Markdown: `remark` + `remark-frontmatter` + `remark-gfm`
- HTML extraction: `@mozilla/readability` + `linkedom` (no jsdom — Workers incompatible)
- Frontmatter validation: `zod` (peer dep, optional at runtime)
- CLI: `citty` (Node + Deno compatible, small)
- Testing: `vitest`
- NO: `express`, `axios`, `jsdom`, `lodash`, `commander`, `chalk`. Use `fetch`, `URL`, template strings.

All runtime code must work on all three targets. If a dependency is Node-only, gate it behind a platform check and provide a fallback or fail loud with a clear message.

## 4. Project patterns

This is a new project. Establish these patterns on first use; subsequent code must follow them.

- Errors: single `WikiError` class with `code` field matching section 2.3. No string throwing. No error wrapping that loses the original.
- Async: `Promise` only. No callbacks, no EventEmitter. Streaming ingest uses `AsyncIterable`.
- Config: resolved once at `createWiki()`, passed as argument down the call stack. No globals, no singletons, no module-level state.
- Paths: always absolute internally. CLI resolves relative paths to absolute before calling library.
- Logging: a single `Logger` interface injected via config. Default impl writes to stderr. Never `console.log` in library code.
- Platform detection: `src/lib/platform.ts` exports `isNode`, `isDeno`, `isWorker`. Call sites branch on these, never on `typeof process`.

Cross-reference `js-git-store/SPECIFICATION.md` for the tree-first, blob-on-demand pattern the storage layer depends on.

## 5. Artifacts to produce

Paths are relative to the repo root. Line limits are hard caps; if an artifact exceeds, extract helpers.

1. `src/index.ts` — public entry point. Re-exports from `core/`, `cli/`, `types/`. Max 40 lines.
2. `src/types/index.ts` — all shared types. Max 200 lines.
3. `src/core/wiki.ts` — `Wiki` class (ingest, query, config). Max 250 lines.
4. `src/core/ingest.ts` — ingest pipeline orchestration. Max 200 lines.
5. `src/core/query.ts` — three-layer retrieval orchestration. Max 200 lines.
6. `src/pages/schema.ts` — zod schemas for fact, entity, concept, synthesis, source. Max 150 lines.
7. `src/pages/render.ts` — markdown rendering from page objects. Max 150 lines.
8. `src/pages/parse.ts` — markdown parsing into page objects. Max 150 lines.
9. `src/indexes/build.ts` — hierarchical index generation. Max 150 lines.
10. `src/indexes/search.ts` — grep over indexes (layer 1). Max 100 lines.
11. `src/retrieval/bm25.ts` — BM25 over wiki pages (layer 2). Max 150 lines.
12. `src/retrieval/vector.ts` — embeddings adapter + search (layer 3). Max 150 lines.
13. `src/retrieval/rank.ts` — merge and rerank results from three layers. Max 100 lines.
14. `src/sources/readers.ts` — md, txt, html readers. Max 150 lines.
15. `src/lib/platform.ts` — runtime detection. Max 40 lines.
16. `src/lib/errors.ts` — `WikiError` class + code constants. Max 60 lines.
17. `src/lib/logger.ts` — `Logger` interface + default impl. Max 50 lines.
18. `src/cli/index.ts` — citty setup, subcommand registration. Max 100 lines.
19. `src/cli/commands/init.ts` — `wiki init`. Max 80 lines.
20. `src/cli/commands/ingest.ts` — `wiki ingest`. Max 100 lines.
21. `src/cli/commands/query.ts` — `wiki query`. Max 80 lines.
22. `src/cli/commands/config.ts` — `wiki config`. Max 60 lines.
23. `tests/` — one test file per `src/` module that has logic. Integration tests under `tests/integration/`.
24. `examples/basic-wiki/` — a minimal working wiki with 3 sample sources, a README showing the full ingest and query flow.
25. `package.json`, `tsconfig.json`, `vitest.config.ts`, `deno.json`, `wrangler.toml.example` — configured per the stack in section 3.
26. `src/core/prompts.ts` — exports `INGEST_SYSTEM_PROMPT` and `QUERY_SYSTEM_PROMPT` as string constants copied verbatim from `CLAUDE.md` §1 and §2. Max 200 lines (content + exports). Consumed by `src/core/ingest.ts` and `src/core/query.ts`. Added as a contract amendment on 2026-04-20 to resolve the contradiction between `CLAUDE.md`'s shipping instruction and the original 25-file inventory.

## 6. Acceptance criteria

Each item is binary. All must pass before the contract is considered fulfilled.

- [ ] `npm test`, `deno test`, and `vitest run` all pass with zero failures
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run typecheck` passes with zero errors under `strict: true`
- [ ] `wiki init` creates a repo that matches the layout in `SCHEMA.md` § 2
- [ ] `wiki ingest` on a markdown file creates fact pages, updates entity/concept/synthesis pages, updates indexes, and produces a single commit with a message following the format in `SPECIFICATION.md` § 5.2
- [ ] `wiki ingest` on the same source a second time without `--force` exits with code `SOURCE_ALREADY_INGESTED`
- [ ] `wiki query` returns results using all three retrieval layers in the order defined in `ARCHITECTURE.md` § 4.2
- [ ] Every page written passes the frontmatter validation in `src/pages/schema.ts` when that validation is enabled
- [ ] Supersession: ingesting a contradicting source creates a new fact with `supersedes` pointing to the old one; the old fact is not deleted
- [ ] The example under `examples/basic-wiki/` runs end to end on Node, Deno, and Workers (via `wrangler dev`)
- [ ] No file in `src/` exceeds its line cap from section 5
- [ ] No runtime dependency was added outside section 3
- [ ] No file under `src/` imports from `node:` without a platform check

## 7. Hard constraints

- NO modifying files outside `src/`, `tests/`, `examples/`, and the config files in section 5 item 25.
- NO adding runtime dependencies outside section 3. Dev-only deps require a justification comment in `package.json`.
- NO `console.log` in library code. CLI code may use the logger, not `console` directly.
- NO `any` in TypeScript. If a type is genuinely unknowable, use `unknown` and narrow.
- NO silent catches. Every caught error either gets re-thrown as `WikiError` with a code, or is handled with a documented reason.
- NO changing the file layout under `src/` from what section 5 specifies. If a new module feels necessary, STOP and report.
- NO running `git commit` from the agent. The ingest pipeline commits via `js-git-store`; the agent should not commit repo-level changes.
- NO generating README, CHANGELOG, or docs beyond what section 5 lists.
- NO introducing lint, MCP, or multi-user features. They are out of scope for v0.1 per `ROADMAP.md`.
- If any acceptance criterion in section 6 cannot be met, STOP and report the blocker. Do not implement workarounds or mark items as passing when they do not.
