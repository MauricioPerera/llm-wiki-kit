import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createWiki, initializeWiki } from '../../src/core/wiki.ts';
import type { FileAdapter, Page } from '../../src/types/index.ts';
import { StubLLM } from '../basic-wiki/responses.ts';

interface SeedShape {
  json: Record<string, unknown>;
  bin: Record<string, string>;
}

function createRecordingAdapter(): { adapter: FileAdapter; snapshot: () => SeedShape } {
  const json = new Map<string, unknown>();
  const bin = new Map<string, Uint8Array>();
  const adapter: FileAdapter = {
    readJson<T = unknown>(f: string): T | null {
      return json.has(f) ? (json.get(f) as T) : null;
    },
    writeJson(f, d) { json.set(f, d); bin.delete(f); },
    readBin(f) {
      const v = bin.get(f);
      return v ? (new Uint8Array(v).buffer as ArrayBuffer) : null;
    },
    readBinShared(f) { return bin.get(f) ?? null; },
    writeBin(f, b) {
      const bytes = b instanceof Uint8Array ? new Uint8Array(b) : new Uint8Array(b);
      bin.set(f, bytes);
      json.delete(f);
    },
    delete(f) { json.delete(f); bin.delete(f); },
    async preload() {},
    async persist() {}
  };
  const snapshot = (): SeedShape => {
    const jsonOut: Record<string, unknown> = {};
    for (const [k, v] of json.entries()) jsonOut[k] = v;
    const binOut: Record<string, string> = {};
    for (const [k, v] of bin.entries()) binOut[k] = Buffer.from(v).toString('base64');
    return { json: jsonOut, bin: binOut };
  };
  return { adapter, snapshot };
}

async function main(): Promise<void> {
  const { adapter, snapshot } = createRecordingAdapter();
  await initializeWiki(adapter);
  const wiki = await createWiki({ path: '/bundle', llmAdapter: new StubLLM(), storageAdapter: adapter });
  const sources: Array<[string, string]> = [
    ['tessera', '# Tessera-1 launch\n\nHelix Robotics launched Tessera-1.'],
    ['a2e', '# A2E benchmark\n\nLlama 3.2 1B scored 86% on A2E.'],
    ['gemma', '# Gemma 3 4B on Workers AI\n\nCloudflare enabled Gemma 3 4B.']
  ];
  for (const [id, content] of sources) {
    await wiki.ingest({ kind: 'text', content, format: 'md', sourceId: id });
  }
  const seed = snapshot();
  const out = resolve(import.meta.dirname ?? './examples/workers-query', 'seed.json');
  await writeFile(out, JSON.stringify(seed, null, 0), 'utf-8');
  const pages = Object.keys((seed.json['.wiki/manifest.json'] as { pages: Record<string, unknown> }).pages);
  process.stdout.write(`wrote ${out} (${pages.length} pages, ${Object.keys(seed.bin).length} bin files)\n`);
}

main().catch((err: unknown) => { process.stderr.write((err as Error).message + '\n'); process.exit(1); });
