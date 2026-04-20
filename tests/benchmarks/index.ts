import { performance } from 'node:perf_hooks';
import { runPageBenchmarks } from './pages.bench.ts';
import { runIndexBenchmarks } from './indexes.bench.ts';
import { runRetrievalBenchmarks } from './retrieval.bench.ts';
import { runPipelineBenchmarks } from './pipeline.bench.ts';
import { formatTable, type BenchResult } from './harness.ts';

async function main(): Promise<void> {
  const started = performance.now();
  const all: BenchResult[] = [];

  process.stdout.write('# llm-wiki-kit v0.1 benchmarks\n');
  process.stdout.write(`node ${process.version} — ${process.platform} ${process.arch}\n`);

  all.push(...(await runPageBenchmarks()));
  all.push(...(await runIndexBenchmarks()));
  all.push(...(await runRetrievalBenchmarks()));
  all.push(...(await runPipelineBenchmarks()));

  process.stdout.write('\n### Summary\n\n');
  process.stdout.write(formatTable(all) + '\n');
  process.stdout.write(`\ntotal wall time: ${(performance.now() - started).toFixed(0)} ms\n`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(msg + '\n');
  process.exit(1);
});
