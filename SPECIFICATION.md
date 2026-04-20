# SPECIFICATION

The "why" behind the contract. Read `CONTRACT.md` first.

## 1. Pattern origin

This kit instantiates the LLM Wiki pattern from Karpathy's gist: the LLM reads sources, distills them into a persistent markdown wiki, and answers queries against the wiki rather than re-deriving from raw sources on every question. The wiki compounds; the sources are immutable.

The critics in the gist comments raised four weaknesses. This kit answers each:

| Weakness | Answer in this kit |
|---|---|
| Flat `index.md` does not scale | Hierarchical indexes per bucket; grep stays cheap |
| At scale you need a search engine | Three retrieval layers, indexes first, BM25 and embeddings on wiki pages (not raw sources) |
| LLM hallucinates and breaks cross-refs | Git-native rollback; supersession with history; frontmatter validation |
| Conflicts resolved arbitrarily | Supersession chains explicit; contradictions marked, never silently overwritten |

## 2. Separation into page types

Karpathy's gist treats all wiki pages as homogeneous. This kit splits them into five buckets. Reasons:

- **Facts** are atomic claims tied to a single source. They are immutable except through explicit supersession. This makes "source of truth" unambiguous.
- **Entities** (people, orgs, places, products) and **concepts** (ideas, frameworks) are aggregations over many facts. They are rewriteable because they are regenerable from the underlying facts.
- **Synthesis** pages are narratives that reference facts, entities, and concepts. They are the most rewriteable; they represent the LLM's current best understanding and can be rebuilt from the other layers without information loss.
- **Sources** are metadata pages (not the raw source). They let queries answer "where did this claim come from?" without loading the original.

Path-based routing at ingest time also gives the LLM a stronger prior: when producing a fact page, the agent knows it must cite a source and stay atomic. When producing synthesis, it knows it should reference other pages, not introduce new claims.

## 3. Git-native substrate

The choice of `js-git-store` is deliberate. A wiki on plain markdown files loses attribution, rollback, and branch-per-experiment. Git gives all three for free. The tree-first, blob-on-demand pattern in `js-git-store` additionally addresses the scaling complaint: the index branch stays small and is always fully cloned, while the content branch is fetched on demand.

Consequences for this kit:

- Every ingest is a single atomic commit. A bad ingest is one `git revert` away.
- Branches model embedding-model versions (`main`, `embeddings-v2`) and experimental syntheses.
- Signed commits give multi-user attribution in post-v0.1 phases without changing the data model.
- The repo is the wire format. Clone = replica. No server required.

## 4. Retrieval in three layers

v0.1 uses a fixed pipeline. The LLM Wiki gist offers a single level of retrieval (grep over `index.md`); critics noted this caps at ~hundreds of pages. The three layers compose:

1. **Grep over hierarchical indexes** — cheap, deterministic, always runs first. Hits on index entries point directly at page paths.
2. **BM25 over wiki pages** — runs when grep misses or returns too few results. Operates on the destilled wiki, not raw sources, so precision is higher than classical RAG over chunks.
3. **Embeddings over wiki pages** — semantic fallback. Adapter-agnostic because the choice of embedding model is user-dependent (OpenAI, Workers AI, local transformers, Gemma, etc.).

Layers are merged with a simple union + rerank (reciprocal rank fusion). No embedding-on-raw-chunks path in v0.1; that is classical RAG and contradicts the pattern's thesis.

## 5. Ingest as a single commit

### 5.1 Why batch

A single source can touch 10-15 pages (one or more fact pages, one synthesis update, two or three entity touches, an index bump). Committing each change individually would pollute the history and break atomicity: a crash halfway through leaves the repo in an inconsistent state with no single commit to revert.

Batching gives:

- 1 ingest = 1 commit = 1 revert
- Clean, human-readable history
- Atomic failure: if any page write fails, the commit never happens

### 5.2 Commit message format

```
ingest: <source-title>

source: <source-id>
+facts: <n>
~entities: <list>
~concepts: <list>
~synthesis: <list>
supersedes: <list of fact ids or empty>
```

This format is parseable with simple tools and human-readable. The ingest pipeline is responsible for producing it.

## 6. Supersession over overwrite

When a new source contradicts an existing fact, the pipeline does not overwrite. It creates a new fact page with a `supersedes` field pointing at the old fact, and marks the old fact with `superseded-by`. Both pages remain on disk.

Reasons:

- The original fact may have been correct at an earlier time; temporal claims stay traceable.
- The LLM may have been wrong about the contradiction. A human reviewer can unwind without losing data.
- Git already records the change, but inspection is cheaper when the supersession is visible in the frontmatter without a git log lookup.

Queries by default only surface non-superseded facts. An explicit flag (post-v0.1) will expose superseded history.

## 7. Adapter-agnostic embeddings

v0.1 does not bundle an embedding model. The user configures an `EmbeddingAdapter` that the kit calls. Reasons:

- Embedding model choice is environment-dependent. A user on Workers wants Workers AI; a user offline wants transformers.js; a user on Node wants OpenAI or Cohere.
- Bundling a default locks the kit to a dependency direction it should not own.
- The adapter interface is small (two methods: `embed(text: string): Promise<Float32Array>` and `dimensions(): number`), so user-provided adapters are trivial.

## 8. Why markdown, not JSON

Pages are markdown with YAML frontmatter because:

- Obsidian compatibility is explicit in the pattern. Users browse, edit, and visualize graph views.
- Markdown is human-auditable. When the LLM hallucinates, the human catches it by reading.
- The wiki is the artifact. A JSON store with a rendering layer would be a database with a frontend, not a wiki.

Frontmatter is validated (zod, optional at runtime) because the alternative is LLM-produced YAML that drifts over time and breaks tools downstream.

## 9. Multi-runtime target

Node, Deno, and Workers are targeted simultaneously because:

- The host libraries (`js-doc-store`, `js-vector-store`, `js-git-store`) target the same three.
- Edge deployment (Workers) is on the `js-git-store` roadmap; this kit should not block that.
- The constraint forces discipline: no `node:fs` unguarded, no jsdom, no native modules. Code that works on all three is simpler and more portable.

## 10. Out of scope for v0.1

- **Lint**: valuable but not on the critical path. Ingest and query must work first; lint is polish.
- **MCP server**: CLI is the v0.1 interface. MCP wraps the CLI in a later phase.
- **Multi-user**: attribution via signed commits is free from git; workflow (PRs, review, branches per user) is a later concern.
- **PDF/image ingest**: text-first to keep the reader layer small.
- **Web UI**: Obsidian + graph view is the default UI.

Each deferral is specified in `ROADMAP.md` with its target phase.
