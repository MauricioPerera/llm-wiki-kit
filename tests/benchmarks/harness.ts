import { performance } from 'node:perf_hooks';

export interface BenchResult {
  name: string;
  iters: number;
  totalMs: number;
  perOpMs: number;
  opsPerSec: number;
}

export interface BenchOptions {
  iters?: number;
  warmup?: number;
}

function resolveIters(opts: BenchOptions = {}): { iters: number; warmup: number } {
  const iters = opts.iters ?? 1000;
  const warmup = opts.warmup ?? Math.max(5, Math.floor(iters / 20));
  return { iters, warmup };
}

export function bench(
  name: string,
  fn: () => void,
  opts: BenchOptions = {}
): BenchResult {
  const { iters, warmup } = resolveIters(opts);
  for (let i = 0; i < warmup; i += 1) fn();
  const start = performance.now();
  for (let i = 0; i < iters; i += 1) fn();
  const totalMs = performance.now() - start;
  return {
    name,
    iters,
    totalMs,
    perOpMs: totalMs / iters,
    opsPerSec: (1000 * iters) / totalMs
  };
}

export async function benchAsync(
  name: string,
  fn: () => Promise<void>,
  opts: BenchOptions = {}
): Promise<BenchResult> {
  const { iters, warmup } = resolveIters(opts);
  for (let i = 0; i < warmup; i += 1) await fn();
  const start = performance.now();
  for (let i = 0; i < iters; i += 1) await fn();
  const totalMs = performance.now() - start;
  return {
    name,
    iters,
    totalMs,
    perOpMs: totalMs / iters,
    opsPerSec: (1000 * iters) / totalMs
  };
}

function pad(s: string, n: number, right = false): string {
  if (s.length >= n) return s;
  const space = ' '.repeat(n - s.length);
  return right ? s + space : space + s;
}

function fmtNum(n: number, digits = 3): string {
  if (n >= 1000) return n.toFixed(0);
  if (n >= 1) return n.toFixed(digits);
  return n.toFixed(digits + 1);
}

export function formatTable(results: BenchResult[]): string {
  const header = [
    pad('name', 48, true),
    pad('iters', 8),
    pad('per op (ms)', 14),
    pad('ops/sec', 12)
  ].join('  ');
  const rule = '-'.repeat(header.length);
  const rows = results.map((r) =>
    [
      pad(r.name, 48, true),
      pad(String(r.iters), 8),
      pad(fmtNum(r.perOpMs, 4), 14),
      pad(fmtNum(r.opsPerSec), 12)
    ].join('  ')
  );
  return [rule, header, rule, ...rows, rule].join('\n');
}

export function printResults(title: string, results: BenchResult[]): void {
  process.stdout.write(`\n### ${title}\n\n`);
  process.stdout.write(formatTable(results) + '\n');
}
