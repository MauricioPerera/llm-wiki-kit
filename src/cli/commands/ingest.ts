import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { WikiError } from '../../lib/errors.ts';
import { createWiki } from '../../core/wiki.ts';
import { createStderrLogger } from '../../lib/logger.ts';
import type { EmbeddingAdapter, LLMAdapter } from '../../types/index.ts';
import { createFsAdapter, runCliWithError } from '../index.ts';

async function loadModuleAdapter<T>(envVar: string, required: boolean): Promise<T | undefined> {
  const path = process.env[envVar];
  if (!path) {
    if (required) throw new WikiError('INVALID_SOURCE', `env var ${envVar} not set`);
    return undefined;
  }
  const mod = await import(/* @vite-ignore */ path);
  const exported = (mod as { default?: unknown; adapter?: unknown }).default ?? (mod as { adapter?: unknown }).adapter ?? mod;
  return exported as T;
}

export const ingestCmd = defineCommand({
  meta: { name: 'ingest', description: 'Ingest a source file into the wiki' },
  args: {
    path: { type: 'positional', required: true, description: 'Path to source file' },
    'source-id': { type: 'string', required: false, description: 'Override the source id' },
    force: { type: 'boolean', required: false, description: 'Re-ingest even if cached' },
    dir: { type: 'string', required: false, description: 'Wiki directory (default cwd)' }
  },
  async run({ args }) {
    await runCliWithError(async () => {
      const dir = resolve(String(args.dir ?? process.cwd()));
      const llm = await loadModuleAdapter<LLMAdapter>('WIKI_LLM_ADAPTER', true);
      const embeddings = await loadModuleAdapter<EmbeddingAdapter>('WIKI_EMBEDDING_ADAPTER', false);
      const adapter = createFsAdapter(dir);
      const wiki = await createWiki({
        path: dir,
        llmAdapter: llm as LLMAdapter,
        ...(embeddings ? { embeddingAdapter: embeddings } : {}),
        logger: createStderrLogger(),
        storageAdapter: adapter
      });
      const result = await wiki.ingest({
        kind: 'file',
        path: resolve(String(args.path)),
        ...(args['source-id'] ? { sourceId: String(args['source-id']) } : {}),
        ...(args.force ? { force: true } : {})
      });
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    });
  }
});
