# SCHEMA

Page types, frontmatter, paths, naming. All references to `wiki/` mean the repo root of a wiki instance.

## 1. Page types

Five types. Each has a fixed directory, a frontmatter contract, and a body contract.

| Type | Path | Mutability | Purpose |
|---|---|---|---|
| fact | `wiki/facts/` | Immutable except via supersession | Atomic claim tied to one source |
| entity | `wiki/entities/` | Rewriteable | Person, org, place, product |
| concept | `wiki/concepts/` | Rewriteable | Idea, framework, term |
| synthesis | `wiki/synthesis/` | Rewriteable | Narrative referencing other pages |
| source | `wiki/sources/` | Append-only | Metadata about an ingested source |

## 2. Repository layout

```
wiki/
├── .wiki/                  # kit metadata (config, lockfiles, cache)
│   ├── config.json
│   └── ingested.json       # source-id index for dedup
├── facts/
│   └── <slug>.md
├── entities/
│   └── <slug>.md
├── concepts/
│   └── <slug>.md
├── synthesis/
│   └── <slug>.md
├── sources/
│   └── <source-id>.md
└── index/
    ├── root.md
    ├── facts.md
    ├── entities.md
    ├── concepts.md
    ├── synthesis.md
    └── sources.md
```

`wiki init` creates this layout. Empty directories keep a `.gitkeep`.

## 3. Slugging

- Lowercase, kebab-case, ASCII only.
- Strip diacritics before kebab-casing.
- Collisions append `-2`, `-3`, etc. The kit never overwrites.
- Max 80 chars. Longer titles get truncated at the last word boundary under 80.
- Facts use a content-hash suffix: `<slug>-<hash8>.md` where `hash8` is the first 8 hex chars of SHA-256 of the claim text. This avoids slug collisions on similar claims from different sources.

## 4. Frontmatter contracts

All frontmatter is YAML. All fields listed as required must be present. Validation is zod-based and optional at runtime, but the kit always produces valid frontmatter on write.

### 4.1 Fact

```yaml
---
type: fact
id: <slug-hash8>
title: <short claim summary, one line>
claim: <the claim itself, one or two sentences>
sources:
  - <source-id>
ingested: <ISO8601>
supersedes: <fact-id or null>
superseded-by: <fact-id or null>
confidence: low | medium | high
tags: []
---
```

Body: optional extended discussion, quote, or context. Keep under 500 words.

### 4.2 Entity

```yaml
---
type: entity
id: <slug>
title: <canonical name>
aliases: []
kind: person | org | place | product | other
related-facts: [<fact-id>, ...]
related-entities: [<slug>, ...]
related-concepts: [<slug>, ...]
last-updated: <ISO8601>
tags: []
---
```

Body: synthesis paragraphs describing the entity. The LLM rewrites this on every ingest that touches the entity.

### 4.3 Concept

```yaml
---
type: concept
id: <slug>
title: <canonical name>
aliases: []
related-facts: [<fact-id>, ...]
related-entities: [<slug>, ...]
related-concepts: [<slug>, ...]
last-updated: <ISO8601>
tags: []
---
```

Body: definition, context, examples. Rewriteable.

### 4.4 Synthesis

```yaml
---
type: synthesis
id: <slug>
title: <one-line summary>
scope: <what question or topic this synthesizes>
references:
  facts: [<fact-id>, ...]
  entities: [<slug>, ...]
  concepts: [<slug>, ...]
  sources: [<source-id>, ...]
last-updated: <ISO8601>
tags: []
---
```

Body: the narrative. Every claim in the body must be traceable to at least one reference. The kit does not enforce this mechanically in v0.1, but the ingest prompt instructs the LLM to respect it.

### 4.5 Source

```yaml
---
type: source
id: <source-id>
title: <source title>
origin: <url or file path>
ingested: <ISO8601>
format: md | txt | html
size-bytes: <number>
hash: <sha256 of raw content>
produced-facts: [<fact-id>, ...]
touched-entities: [<slug>, ...]
touched-concepts: [<slug>, ...]
touched-synthesis: [<slug>, ...]
---
```

Body: optional short abstract of the source. Not the raw text. Raw text belongs outside the wiki.

## 5. Indexes

Each index is a plain markdown file. Entries are one line per page, in this format:

```
- [[<path-relative-to-wiki>|<title>]] — <one-line summary> <tags-if-any>
```

Example in `index/facts.md`:

```
- [[facts/workers-ai-supports-gemma-3-4b.md|Workers AI supports Gemma 3 4B]] — Cloudflare enabled Gemma 3 4B on Workers AI in Q1 2026 #cloudflare #llm
- [[facts/a2e-benchmark-86-percent.md|A2E hits 86% deploy-ready]] — Llama 3.2 1B + 3 guard rails scored 86% on the A2E benchmark #a2e
```

`index/root.md` is the entry point. It links to the five sub-indexes and includes global counters.

Grep over an index (layer 1 retrieval) uses simple patterns on the one-line summary and tags.

## 6. Wikilinks

Use Obsidian wikilink syntax for cross-references inside bodies and indexes:

```
[[facts/<fact-id>]]
[[entities/<slug>]]
[[concepts/<slug>]]
[[synthesis/<slug>]]
[[sources/<source-id>]]
```

The kit does not require link resolution at runtime, but Obsidian renders them natively and the graph view works out of the box.

## 7. Config

`wiki/.wiki/config.json`:

```json
{
  "version": 1,
  "embedding_adapter": null,
  "embedding_dimensions": null,
  "bm25": { "k1": 1.5, "b": 0.75 },
  "retrieval": { "top_k_per_layer": 10, "final_k": 20 },
  "ingest": { "require_frontmatter_validation": true }
}
```

`embedding_adapter` is a module path or a URL to a Workers-hosted adapter. Null disables layer 3 retrieval.

## 8. Dedup cache

`wiki/.wiki/ingested.json`:

```json
{
  "<source-id>": {
    "hash": "<sha256>",
    "ingested": "<ISO8601>",
    "facts_produced": ["<fact-id>", ...]
  }
}
```

`wiki ingest` checks this before processing. `--force` bypasses it.
