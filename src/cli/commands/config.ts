import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { WikiError } from '../../lib/errors.ts';
import { createFsAdapter, runCliWithError } from '../index.ts';

export const configCmd = defineCommand({
  meta: { name: 'config', description: 'Get or set a wiki config key' },
  args: {
    key: { type: 'positional', required: false },
    value: { type: 'positional', required: false },
    dir: { type: 'string', required: false }
  },
  async run({ args }) {
    await runCliWithError(async () => {
      const dir = resolve(String(args.dir ?? process.cwd()));
      const adapter = createFsAdapter(dir);
      await adapter.preload(['.wiki/config.json']);
      const cfg = adapter.readJson<Record<string, unknown>>('.wiki/config.json');
      if (!cfg) throw new WikiError('WIKI_NOT_INITIALIZED', `no wiki at ${dir}`);
      if (args.key === undefined) {
        process.stdout.write(JSON.stringify(cfg, null, 2) + '\n');
        return;
      }
      const parts = String(args.key).split('.');
      if (args.value === undefined) {
        let node: unknown = cfg;
        for (const p of parts) node = (node as Record<string, unknown> | null)?.[p];
        process.stdout.write(JSON.stringify(node ?? null, null, 2) + '\n');
        return;
      }
      let target: Record<string, unknown> = cfg;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const seg = parts[i]!;
        const next = target[seg];
        if (typeof next !== 'object' || next === null) target[seg] = {};
        target = target[seg] as Record<string, unknown>;
      }
      let parsed: unknown;
      try { parsed = JSON.parse(String(args.value)); } catch { parsed = args.value; }
      target[parts[parts.length - 1]!] = parsed;
      adapter.writeJson('.wiki/config.json', cfg);
      await adapter.persist();
      process.stdout.write('updated\n');
    });
  }
});
