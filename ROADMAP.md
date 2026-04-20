# ROADMAP

Phased delivery. v0.1 is the scope of this contract. Later phases are out of scope unless explicitly re-contracted.

## v0.1 — Core ingest and query

In scope:

- CLI: `init`, `ingest`, `query`, `config`
- Text readers: md, txt, html
- Three-layer retrieval: index grep + BM25 + embeddings on pages
- Git-native storage via `js-doc-store` + `js-vector-store` + `js-git-store`
- Markdown pages, Obsidian-compatible, zod-validated frontmatter
- Supersession with history
- Adapter-agnostic embeddings and LLM
- Node, Deno, Workers targets (Workers ingest may be deferred if `js-git-store` Workers target is not ready)

Out of scope for v0.1:

- Lint command
- MCP server
- Multi-user workflow and PRs
- PDF/image ingest
- Web UI
- Remote sync
- Reranker beyond RRF
- Concurrent ingest

Acceptance: every item in `CONTRACT.md` § 6.

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
