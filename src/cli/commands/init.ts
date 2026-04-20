import { defineCommand } from 'citty';
import { mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WikiError } from '../../lib/errors.ts';
import { initializeWiki } from '../../core/wiki.ts';
import { createFsAdapter, runCliWithError } from '../index.ts';

export const initCmd = defineCommand({
  meta: { name: 'init', description: 'Initialize a new wiki repo at <dir>' },
  args: {
    dir: { type: 'positional', required: true, description: 'Target directory' }
  },
  async run({ args }) {
    await runCliWithError(async () => {
      const dir = resolve(String(args.dir));
      await mkdir(dir, { recursive: true });
      let items: string[] = [];
      try {
        items = await readdir(dir);
      } catch (err: unknown) {
        throw new WikiError('INVALID_SOURCE', `cannot read directory ${dir}`, err);
      }
      if (items.length > 0) {
        throw new WikiError('INVALID_SOURCE', `target directory is not empty: ${dir}`);
      }
      const adapter = createFsAdapter(dir);
      await initializeWiki(adapter);
      process.stdout.write(`initialized wiki at ${dir}\n`);
    });
  }
});
