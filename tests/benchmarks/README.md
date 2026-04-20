# Benchmarks

Micro and end-to-end benchmarks for `llm-wiki-kit`. Zero-dep harness built on
`perf_hooks.performance.now`.

## Run

```bash
npm run bench
```

Takes ~5 minutes on commodity hardware. LLM latency is excluded (fake adapter).

## Scope

| Suite | What it measures |
|---|---|
| `pages.bench.ts` | `renderPage` + `parsePage` throughput at 40/400 word bodies |
| `indexes.bench.ts` | `buildAllIndexes` at 100/1k/10k pages; `searchIndex` grep latency |
| `retrieval.bench.ts` | BM25 at n=100/1k/10k; vector search at dim=32 and 768 × n=100/1k/10k; RRF merge |
| `pipeline.bench.ts` | End-to-end `wiki.query` with n=100/1k seeded pages, fake LLM |

## Reference run (2026-04-20, Node v22.21.1, win32 x64, warm CPU)

Selected numbers from a single run on a mid-range laptop. Your mileage will vary.

| Operation | per op |
|---|---|
| `pages/render` (40 words) | 0.29 ms |
| `pages/parse` (40 words) | 1.24 ms |
| `pages/round-trip` | 2.02 ms |
| `indexes/build` (n=1k) | 8.09 ms |
| `indexes/build` (n=10k) | 83.14 ms |
| `indexes/search` grep all (n=1k) | 13.02 ms |
| `indexes/search` grep all (n=10k) | 188.29 ms |
| `retrieval/bm25` (n=1k) | 93.22 ms |
| `retrieval/bm25` (n=10k) | 702.47 ms |
| `retrieval/vector` dim=32 (n=1k) | 1.11 ms |
| `retrieval/vector` dim=768 (n=1k) | 6.21 ms |
| `retrieval/vector` dim=768 (n=10k) | 88.66 ms |
| `retrieval/vector` cosine dim=768 | 6.5 µs |
| `retrieval/rank` RRF 3×20 | 43 µs |
| `core/query` end-to-end (n=1k, no LLM) | 1205 ms |

## How to read these

- **Layer 1 (index grep)** scales linearly with corpus size (~13 ms per 1k
  pages grepping all 6 indexes). At 10k pages, this is where you start feeling it.
- **Layer 2 (BM25)** re-tokenizes the corpus on every query. Acceptable at n≤1k.
  At n=10k (~700 ms) it is the dominant cost — a persisted posting list would cut
  this by an order of magnitude. This is open territory for v0.2+ work.
- **Layer 3 (vector)** scales O(n · dim). At dim=768, n=10k is ~90 ms — well
  within interactive budgets. An IVF index would help beyond that.
- **End-to-end query** at n=1k is ~1.2 s with no LLM latency. BM25 dominates
  when layer 1 misses; optimizing BM25 is the single highest-leverage change.
- **Render is 4× faster than parse** because YAML parsing is the slow path. Fine
  because ingest writes many pages but reads at query time are cached.

## Notes

- Benchmarks run single-threaded. They do not reflect concurrent load.
- `core/query` end-to-end includes a `preloadAllPages` call which dominates at
  n=1k. In a real deployment with `js-git-store` partial clone, this cost is
  amortized via its LRU cache.
- Warmup is `iters / 20` before timing. V8 JIT has stabilized by the time the
  measured loop starts.
