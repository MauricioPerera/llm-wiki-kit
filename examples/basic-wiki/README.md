# basic-wiki example

A minimal end-to-end flow using the in-memory adapter and a stub LLM. Shows:

1. Initializing a wiki in memory
2. Ingesting three sources
3. Querying the resulting wiki

Run with:

```bash
npx tsx examples/basic-wiki/run.ts
```

Sources live under `examples/basic-wiki/sources/`. The stub LLM responses live in `examples/basic-wiki/responses.ts` — swap them for a real `LLMAdapter` (OpenAI, Anthropic, local Llama, etc.) to ingest real content.

This example does not touch disk or git. For a real wiki you pass a `storageAdapter` backed by `js-git-store`:

```ts
import { GitStoreAdapter } from 'js-git-store';

const adapter = new GitStoreAdapter({
  repoUrl: 'file:///abs/path/to/your/wiki',
  localCacheDir: '/abs/path/to/your/wiki/.cache'
});
const wiki = await createWiki({ path: '/abs/path/to/your/wiki', llmAdapter, storageAdapter: adapter });
```

The CLI (`wiki init/ingest/query/config`) does the same wiring automatically, using a filesystem adapter if `js-git-store` is not installed.
