# llm-wiki-kit

LLM-maintained personal knowledge base on top of [js-doc-store](https://github.com/MauricioPerera/js-doc-store), [js-vector-store](https://github.com/MauricioPerera/js-vector-store), and [js-git-store](https://github.com/MauricioPerera/js-git-store). Implements the pattern described by Andrej Karpathy in [llm-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), with a git-native substrate that addresses the scaling and attribution weaknesses flagged in the discussion.

Zero runtime dependencies beyond the three host libraries. Node 20+, Deno, and Cloudflare Workers targets. TypeScript strict.

## Status

**Pre-v0.1.** The artifacts in this repo are the execution contract for a coding agent to build the implementation. No code has been written yet. Read the contracts below, in order, and use them to drive the build.

## What it is

A CLI (`wiki`) that ingests text sources (md, txt, html via readability) into a git-backed Obsidian-compatible markdown wiki, and answers queries over it using three retrieval layers (grep on indexes, BM25 on pages, embeddings on pages). The LLM does the summarizing, cross-referencing, and bookkeeping; the human curates sources and asks questions.

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

## Scope v0.1

- CLI: `wiki ingest <path>`, `wiki query <text>`, `wiki init <dir>`
- Ingest for text formats: md, txt, html (via readability)
- Retrieval: grep on indexes + BM25 + embeddings on wiki pages
- Markdown pages, Obsidian-compatible, YAML frontmatter
- Adapter-agnostic embeddings (user provides)
- Node, Deno, and Cloudflare Workers targets
- Single-user, single-repo

Out of scope for v0.1: lint command, MCP server, multi-user workflow, PDF/image ingest, web UI, remote sync.

## How to use this repo if you are an AI coding agent

1. Read `CONTRACT.md` — execution contract, binary acceptance criteria, scope fences
2. Read `SPECIFICATION.md` — the "why" behind each decision
3. Read `SCHEMA.md` — page types, frontmatter, paths, naming
4. Read `ARCHITECTURE.md` — module layout, data flow, error model
5. Read `API.md` — public surface of the library and the CLI
6. Read `TEST-PLAN.md` — concrete test scenarios you must implement
7. Read `CLAUDE.md` — the operational prompt for the ingest and query agents
8. Read `ROADMAP.md` — phased delivery plan

Cross-reference the host libraries (`js-doc-store`, `js-vector-store`, `js-git-store`) for the adapter and storage interfaces you must satisfy.

Write the code under `src/`, tests under `tests/`, examples under `examples/`, per the contract's constraints. Do not deviate from the hard constraints without stopping and reporting.

## How to use this repo if you are a human

Same as above. The artifacts are self-describing.

## Repository layout

```
.
├── CONTRACT.md          # Execution contract — READ FIRST
├── SPECIFICATION.md     # Technical spec — the "why"
├── SCHEMA.md            # Page types, frontmatter, paths
├── ARCHITECTURE.md      # Module layout + data flow
├── API.md               # Public surface
├── TEST-PLAN.md         # Concrete test scenarios
├── CLAUDE.md            # Operational prompt for ingest/query agents
├── ROADMAP.md           # Phased delivery plan
├── README.md            # This file
├── LICENSE              # MIT
├── package.json         # Starter metadata
├── tsconfig.json        # Strict TS config
├── .gitignore
├── src/                 # (empty) implementation goes here
├── tests/               # (empty) tests go here
└── examples/            # (empty) reference wikis go here
```

## Relationship to related projects

This kit sits on top of three sibling libraries by the same author. All four can be used independently:

- **[js-doc-store](https://github.com/MauricioPerera/js-doc-store)** — zero-dependency vanilla JS document database with MongoDB-style queries. Used here for the dedup cache (`.wiki/ingested.json`) and config.
- **[js-vector-store](https://github.com/MauricioPerera/js-vector-store)** — zero-dependency vanilla JS vector store with Float32/Int8/1-bit quantization and IVF search. Referenced as the target for Phase 2 embedding storage (v0.1 uses an inline JSON store on the same git-backed adapter).
- **[js-git-store](https://github.com/MauricioPerera/js-git-store)** — git-native `FileStorageAdapter` for the two above, with tree-first / blob-on-demand and a dual-branch layout (index ref = light, content ref = heavy, partial-cloned). This kit's `storageAdapter` option takes a `GitStoreAdapter` directly.

The pattern itself instantiates [Karpathy's llm-wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), extended to address the four scaling weaknesses flagged in the discussion (hierarchical indexes, three-layer retrieval, git-native rollback, explicit supersession chains).

## License

MIT (see LICENSE).
