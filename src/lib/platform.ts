declare const Deno: { version: { deno: string } } | undefined;
declare const WebSocketPair: unknown;

const hasDeno = typeof (globalThis as { Deno?: unknown }).Deno !== 'undefined';
const hasWorkerGlobal =
  typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !==
  'undefined';
const hasProcess =
  typeof (globalThis as { process?: { versions?: { node?: string } } })
    .process?.versions?.node === 'string';

export const isDeno: boolean = hasDeno && !hasWorkerGlobal;
export const isWorker: boolean = hasWorkerGlobal && !hasDeno;
export const isNode: boolean = hasProcess && !hasDeno && !hasWorkerGlobal;

export type Runtime = 'node' | 'deno' | 'worker' | 'unknown';

export function currentRuntime(): Runtime {
  if (isNode) return 'node';
  if (isDeno) return 'deno';
  if (isWorker) return 'worker';
  return 'unknown';
}
