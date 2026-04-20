import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { WikiError } from '../../lib/errors.ts';
import { createWiki } from '../../core/wiki.ts';
import { createStderrLogger } from '../../lib/logger.ts';
import type { EmbeddingAdapter, LLMAdapter } from '../../types/index.ts';
import { createFsAdapter, runCliWithError } from '../index.ts';

async function load<T>(envVar: string, required: boolean): Promise<T | undefined> {
  const p = process.env[envVar];
  if (!p) {
    if (required) throw new WikiError('INVALID_SOURCE', `env var ${envVar} not set`);
    return undefined;
  }
  const mod = await import(/* @vite-ignore */ p);
  const ex = (mod as { default?: unknown; adapter?: unknown }).default ?? (mod as { adapter?: unknown }).adapter ?? mod;
  return ex as T;
}

export const queryCmd = defineCommand({
  meta: { name: 'query', description: 'Answer a question from the wiki' },
  args: {
    text: { type: 'positional', required: true, description: 'Question text' },
    format: { type: 'string', required: false, description: 'json | md (default md)' },
    'include-superseded': { type: 'boolean', required: false },
    'top-k': { type: 'string', required: false },
    dir: { type: 'string', required: false }
  },
  async run({ args }) {
    await runCliWithError(async () => {
      const dir = resolve(String(args.dir ?? process.cwd()));
      const llm = await load<LLMAdapter>('WIKI_LLM_ADAPTER', true);
      const embeddings = await load<EmbeddingAdapter>('WIKI_EMBEDDING_ADAPTER', false);
      const wiki = await createWiki({
        path: dir,
        llmAdapter: llm as LLMAdapter,
        ...(embeddings ? { embeddingAdapter: embeddings } : {}),
        logger: createStderrLogger(),
        storageAdapter: createFsAdapter(dir)
      });
      const format = (String(args.format ?? 'md') === 'json') ? 'json' : 'markdown';
      const result = await wiki.query(String(args.text), {
        format,
        ...(args['include-superseded'] ? { includeSuperseded: true } : {}),
        ...(args['top-k'] ? { topK: Number(args['top-k']) } : {})
      });
      process.stdout.write(format === 'json' ? JSON.stringify(result, null, 2) + '\n' : result.answer + '\n');
    });
  }
});
