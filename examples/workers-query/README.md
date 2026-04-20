# workers-query example

Query-only deployment of `llm-wiki-kit` on Cloudflare Workers. Demonstrates that
the library runs end-to-end in the Workers runtime with a bundled wiki state.

## Layout

- `seed-builder.ts` — runs `wiki.ingest` against the 3 sample sources from
  `examples/basic-wiki`, then serializes the in-memory adapter state to
  `seed.json` (base64 for binary, plain JSON for metadata).
- `worker.ts` — Workers fetch handler that rebuilds the adapter from the bundle
  on each request, creates a `Wiki`, and runs `wiki.query`. Uses Workers AI if
  the `AI` binding is present, falls back to an echo LLM otherwise.
- `wrangler.toml` — minimal Workers config.
- `seed.json` — generated bundle (gitignore in production; included here so the
  example runs without a build step).

## Run locally

```bash
# 1. Build the seed (only when the basic-wiki fixtures change)
npx tsx examples/workers-query/seed-builder.ts

# 2. Start wrangler dev
cd examples/workers-query
wrangler dev --port 8787 --local

# 3. Hit the query endpoint
curl -X POST http://127.0.0.1:8787/query \
  -H "content-type: application/json" \
  -d '{"text":"what did Helix Robotics launch?"}'
```

Response is the full `QueryResult` — answer, citations, retrievalTrace.

## Enable Workers AI (real answers)

Uncomment the `[ai]` block in `wrangler.toml` and redeploy:

```toml
[ai]
binding = "AI"
```

The worker will then route through `@cf/meta/llama-3.1-8b-instruct` by default.
Swap the model in `worker.ts` (`WorkersAILLM` constructor) for any model in
the Workers AI catalog.

## Limits

- Current bundle is ~1 MB (225 KB gzipped) for 11 pages. Workers free tier caps
  at 1 MB compressed; the bundle approach scales to a few hundred pages max.
- Beyond that, use R2 for the seed blob and stream on cold start, or use
  `js-git-store` once it publishes a Workers-compatible target (see
  [ROADMAP.md v0.5](../../ROADMAP.md)).
- Ingest is not wired on Workers — file reads use `node:fs` gated by `isNode`,
  so POSTing sources to this worker would fail. Ingest runs on Node or Deno.

## What this verifies

- `src/core/wiki.ts`, `src/core/query.ts`, and all retrieval/page modules
  compile and execute under the Workers runtime (`workerd`).
- The `FileAdapter` abstraction is substrate-agnostic — the same `Wiki`
  instance that runs against a Node filesystem in the CLI runs against an
  in-memory bundle in a Worker.
