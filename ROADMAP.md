# ROADMAP

Phased delivery. v0.1 is shipped (tag `v0.1.0-pre`). Later phases are out of scope unless explicitly re-contracted.

## v0.1 — Core ingest and query — **shipped v0.1.0-pre on 2026-04-20**

Delivered:

- CLI: `init`, `ingest`, `query`, `config` (citty-based, Node-only)
- Text readers: md, txt, html (readability + linkedom)
- Three-layer retrieval: index grep + BM25 + embeddings on pages (RRF merge)
- Markdown pages, Obsidian-compatible, zod-validated frontmatter
- Supersession with history (facts never deleted, pair of linked pages)
- Adapter-agnostic embeddings and LLM (`EmbeddingAdapter`, `LLMAdapter`)
- Node 20+ (86/86 vitest tests), Deno 2.x (8/8 smoke tests), Cloudflare Workers (query-only verified via `wrangler dev`)
- Benchmark suite under `tests/benchmarks/` with persisted reference numbers

Deferred to a patch release:

- Real git commits via `js-git-store` — the adapter is wired via the `storageAdapter` option but `js-git-store` is not yet published to npm. The CLI falls back to a plain filesystem adapter until then.
- Workers ingest — blocked on `js-git-store` shipping a Workers-compatible target.

Out of scope (never in v0.1):

- Lint command
- MCP server
- Multi-user workflow and PRs
- PDF/image ingest
- Web UI
- Remote sync
- Reranker beyond RRF
- Concurrent ingest

Acceptance: every item in `CONTRACT.md` § 6 except real git commits (see above), which are deferred to v0.1.x once `js-git-store` publishes.

## v0.2 — Lint and health

- `wiki lint` command: detects contradictions, orphan pages, broken wikilinks, facts without sources, stale claims, missing cross-references.
- Pre-commit hook version of the same.
- `wiki verify --source <source-id>`: re-checks that facts produced by a source still match the source content.
- Coverage report: what portion of each source is represented in the wiki.

## v0.3 — MCP server

- Thin MCP wrapper around the library API.
- Tools: `ingest`, `query`, `lint`, `list_pages`, `get_page`, `explain_supersession`.
- Fits any MCP-capable client (Claude Desktop, Claude Code, Cursor, etc.).
- Auth model: local-only for v0.3; remote in v0.5.

## v0.4 — Richer sources

- PDF ingest (text extraction, no OCR).
- Image ingest with optional vision adapter for captioning.
- URL ingest (fetch + readability).
- Directory watchers for auto-ingest on file drop.

## v0.5 — Multi-user and remote

- PR-style workflow: ingest to a branch, human reviews diff, merges to `main`.
- Signed commits with attribution per user.
- Remote git substrate on GitHub/GitLab via `js-git-store` v2.
- Edge-deployed query via Workers + GitHub REST.

## v0.6 — Reranker and retrieval tuning

- Optional reranker adapter (cross-encoder via Workers AI or local).
- Query-time layer selection tuning.
- Per-bucket retrieval config.
- Hybrid dense/sparse scoring.

## v1.0 — Stabilization

- Public API stabilized.
- Documentation site.
- Benchmark suite (ingest throughput, query latency, retrieval quality).
- At least three reference integrations shipped.
- Semantic versioning strict from here.

## Deferred indefinitely

- Proprietary page formats
- A built-in web UI competing with Obsidian
- A hosted SaaS version
- Opinionated domain packs (medical, legal, finance)

These may be projects separate from this kit. The kit stays a library + CLI.
