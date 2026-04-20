# llm-wiki-kit

[![CI](https://github.com/MauricioPerera/llm-wiki-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/MauricioPerera/llm-wiki-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-20+-green.svg)](https://nodejs.org/)
[![Deno](https://img.shields.io/badge/deno-2.x-black.svg)](https://deno.com/)
[![Workers](https://img.shields.io/badge/cloudflare-workers-orange.svg)](https://workers.cloudflare.com/)

LLM-maintained personal knowledge base on top of [js-doc-store](https://github.com/MauricioPerera/js-doc-store), [js-vector-store](https://github.com/MauricioPerera/js-vector-store), and [js-git-store](https://github.com/MauricioPerera/js-git-store). Implements the pattern described by Andrej Karpathy in [llm-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), with a git-native substrate that addresses the scaling and attribution weaknesses flagged in the discussion.

TypeScript strict, tri-target (Node 20+ / Deno 2 / Cloudflare Workers). Adapter-agnostic LLM and embedding interfaces.

## Status

**v0.1.0-pre** — first public drop. Library API + CLI + one end-to-end example + Workers query-only deployment example all working.

- 86/86 vitest tests passing on Node, 8/8 smoke tests on Deno
- Strict typecheck clean (`tsc --noEmit` and `deno check src/index.ts`)
- Coverage 93.8% lines / 84.8% branches
- Query target verified end-to-end via `wrangler dev`

Public API may change in 0.2. All signatures in `API.md` §1-7 are considered stable for the 0.1.x line.

## What it is

A CLI (`wiki`) and library that ingests text sources (md, txt, html via readability) into a git-backed Obsidian-compatible markdown wiki, and answers queries over it using three retrieval layers (grep on indexes, BM25 on pages, embeddings on pages). The LLM does the summarizing, cross-referencing, and bookkeeping; the human curates sources and asks questions.

The wiki layout separates immutable facts (claims atomic to a single source) from regenerable synthesis (narratives that reference facts, entities, and concepts). Supersession is explicit with historical preservation. Each ingest is a single atomic commit, which makes rollback of hallucinations trivial.

## Why it matters

LLM Wiki critics (see the gist comments) raised four real weaknesses:
1. Flat `index.md` does not scale past a few hundred pages
2. At scale you end up needing a search engine (which is RAG again)
3. LLM can hallucinate and break cross-references
4. Conflicts between sources get resolved arbitrarily

This kit addresses each one:
1. Hierarchical indexes per bucket (facts, entities, concepts, synthesis, sources)
2. Retrieval in layers — indexes first, then BM25 on pages, then embeddings on pages. RAG is transport, not substrate
3. Git-native rollback, signed commits, supersession with history
4. Contradictions are marked explicitly in supersession chains, never silently overwritten

## Quick start

### Library

```ts
import { createWiki, initializeWiki } from 'llm-wiki-kit';
import type { LLMAdapter, FileAdapter } from 'llm-wiki-kit';

// Bring your own storage adapter (GitStoreAdapter for git-native, or any
// object implementing the FileAdapter interface for testing).
const storageAdapter: FileAdapter = /* your adapter */;

// Bring your own LLM adapter. Any model reachable via HTTP with a JSON mode.
const llmAdapter: LLMAdapter = /* your adapter */;

await initializeWiki(storageAdapter);
const wiki = await createWiki({ path: '/abs/path/to/wiki', storageAdapter, llmAdapter });

await wiki.ingest({ kind: 'file', path: '/path/to/source.md' });
const result = await wiki.query('what did the March 2026 release change?');
console.log(result.answer);
```

### CLI

```bash
npm install -g llm-wiki-kit   # once published; for now clone + npm link
export WIKI_LLM_ADAPTER=/abs/path/to/your/llm-adapter.mjs
wiki init ./my-wiki
wiki ingest ./sources/release-notes.md --dir ./my-wiki
wiki query "what changed in March 2026?" --dir ./my-wiki
```

The LLM adapter is a module that default-exports an object matching the `LLMAdapter` interface in [`src/types/index.ts`](src/types/index.ts).

### Examples in this repo

- [`examples/basic-wiki/`](examples/basic-wiki) — end-to-end ingest + query with an in-memory adapter and stub LLM. Run with `npx tsx examples/basic-wiki/run.ts`.
- [`examples/workers-query/`](examples/workers-query) — query-only Cloudflare Worker with bundled seed. Run with `wrangler dev` from inside the directory; bind Workers AI to get real answers.

## Scope v0.1

- CLI: `wiki ingest <path>`, `wiki query <text>`, `wiki init <dir>`, `wiki config`
- Ingest for text formats: md, txt, html (via readability)
- Retrieval: grep on indexes + BM25 + embeddings on wiki pages
- Markdown pages, Obsidian-compatible, YAML frontmatter validated with zod
- Adapter-agnostic embeddings (user provides)
- Node, Deno, and Cloudflare Workers targets
- Single-user, single-repo

Out of scope for v0.1: lint command, MCP server, multi-user workflow, PDF/image ingest, web UI, remote sync.

Deferred until dependent projects ship: real git commits via [`js-git-store`](https://github.com/MauricioPerera/js-git-store) (not yet on npm; the CLI currently falls back to a plain filesystem adapter without git semantics).

## Documentation

Read these in order:

1. [`CONTRACT.md`](CONTRACT.md) — execution contract, binary acceptance criteria, scope fences
2. [`SPECIFICATION.md`](SPECIFICATION.md) — the "why" behind each decision
3. [`SCHEMA.md`](SCHEMA.md) — page types, frontmatter, paths, naming
4. [`ARCHITECTURE.md`](ARCHITECTURE.md) — module layout, data flow, error model
5. [`API.md`](API.md) — public surface of the library and the CLI
6. [`TEST-PLAN.md`](TEST-PLAN.md) — test scenarios (all implemented)
7. [`CLAUDE.md`](CLAUDE.md) — operational prompts shipped as `INGEST_SYSTEM_PROMPT` / `QUERY_SYSTEM_PROMPT` in `src/core/prompts.ts`
8. [`ROADMAP.md`](ROADMAP.md) — phased delivery plan

## Repository layout

```
.
├── CONTRACT.md          # Execution contract + acceptance criteria
├── SPECIFICATION.md     # Technical spec — the "why"
├── SCHEMA.md            # Page types, frontmatter, paths
├── ARCHITECTURE.md      # Module layout + data flow
├── API.md               # Public surface
├── TEST-PLAN.md         # Test scenarios
├── CLAUDE.md            # Operational prompts (verbatim in src/core/prompts.ts)
├── ROADMAP.md           # Phased delivery plan
├── README.md            # This file
├── LICENSE              # MIT
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── deno.json
├── wrangler.toml.example
├── .github/workflows/ci.yml
├── src/
│   ├── core/            # wiki facade, ingest + query pipelines, prompts
│   ├── cli/             # citty-based CLI (init, ingest, query, config)
│   ├── pages/           # schema (zod), render, parse
│   ├── indexes/         # build + grep
│   ├── retrieval/       # bm25, vector, rrf
│   ├── sources/         # md / txt / html readers
│   ├── types/           # public type surface
│   ├── lib/             # platform detection, errors, logger
│   └── index.ts
├── tests/
│   ├── unit/            # 68 vitest tests across leaf modules
│   ├── integration/     # 18 vitest tests against the full pipeline
│   ├── deno/            # Deno smoke tests (deno test)
│   ├── benchmarks/      # bench harness + per-module suites (npm run bench)
│   └── fixtures/        # md / html / txt sources
└── examples/
    ├── basic-wiki/      # end-to-end in-memory flow
    └── workers-query/   # Cloudflare Workers query-only target
```

## Develop

```bash
git clone https://github.com/MauricioPerera/llm-wiki-kit.git
cd llm-wiki-kit
npm install
npm test             # vitest, 86 tests
npm run typecheck    # tsc --noEmit, strict
npm run bench        # full benchmark suite

deno task test       # requires deno 2.x
deno task typecheck
```

CI (`.github/workflows/ci.yml`) runs Node + Deno + a `wrangler deploy --dry-run` smoke on every push to main and every PR.

## Relationship to related projects

This kit sits on top of three sibling libraries by the same author. All four can be used independently:

- **[js-doc-store](https://github.com/MauricioPerera/js-doc-store)** — zero-dependency vanilla JS document database with MongoDB-style queries. Used here for the dedup cache (`.wiki/ingested.json`) and config.
- **[js-vector-store](https://github.com/MauricioPerera/js-vector-store)** — zero-dependency vanilla JS vector store with Float32/Int8/1-bit quantization and IVF search. Referenced as the target for Phase 2 embedding storage. v0.1 ships a simpler inline JSON store (`.wiki/embeddings.json` written via whatever `FileAdapter` is configured) so the retrieval layer works without the vector-store dependency.
- **[js-git-store](https://github.com/MauricioPerera/js-git-store)** — git-native `FileStorageAdapter` for the two above, with tree-first / blob-on-demand and a dual-branch layout (index ref = light, content ref = heavy, partial-cloned). This kit's `storageAdapter` option takes a `GitStoreAdapter` directly.

The pattern itself instantiates [Karpathy's llm-wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), extended to address the four scaling weaknesses flagged in the discussion (hierarchical indexes, three-layer retrieval, git-native rollback, explicit supersession chains).

## License

MIT (see [LICENSE](LICENSE)).
