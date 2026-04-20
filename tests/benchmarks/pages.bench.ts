import { renderPage } from '../../src/pages/render.ts';
import { parsePage } from '../../src/pages/parse.ts';
import { bench, printResults, type BenchResult } from './harness.ts';
import { makeFact } from './fixtures.ts';

export async function runPageBenchmarks(): Promise<BenchResult[]> {
  const results: BenchResult[] = [];

  const fact = makeFact(42);
  results.push(
    bench('pages/render fact (body=40 words)', () => {
      renderPage(fact);
    }, { iters: 5000 })
  );

  const md = renderPage(fact);
  results.push(
    bench('pages/parse fact (body=40 words)', () => {
      parsePage(md);
    }, { iters: 5000 })
  );

  const bigFact = makeFact(42, 400);
  results.push(
    bench('pages/render fact (body=400 words)', () => {
      renderPage(bigFact);
    }, { iters: 2000 })
  );

  const bigMd = renderPage(bigFact);
  results.push(
    bench('pages/parse fact (body=400 words)', () => {
      parsePage(bigMd);
    }, { iters: 2000 })
  );

  results.push(
    bench('pages round-trip (render + parse)', () => {
      parsePage(renderPage(fact));
    }, { iters: 3000 })
  );

  printResults('Page rendering + parsing', results);
  return results;
}
