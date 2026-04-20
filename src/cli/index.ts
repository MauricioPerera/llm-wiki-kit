#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';
import { mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { WikiError, WIKI_ERROR_EXIT_CODES, isWikiError } from '../lib/errors.ts';
import type { FileAdapter } from '../types/index.ts';
import { initCmd } from './commands/init.ts';
import { ingestCmd } from './commands/ingest.ts';
import { queryCmd } from './commands/query.ts';
import { configCmd } from './commands/config.ts';

interface CacheEntry { data: unknown; dirty: boolean; isBin: boolean; bytes?: Uint8Array }

export function createFsAdapter(root: string): FileAdapter {
  const cache = new Map<string, CacheEntry>();
  const abs = (p: string): string => resolve(root, p);
  async function flushOne(name: string, entry: CacheEntry): Promise<void> {
    const target = abs(name);
    await mkdir(dirname(target), { recursive: true });
    if (entry.isBin) {
      await writeFile(target, entry.bytes ?? new Uint8Array());
    } else if (entry.data === undefined) {
      if (existsSync(target)) await rm(target);
    } else {
      await writeFile(target, JSON.stringify(entry.data, null, 2), 'utf-8');
    }
    entry.dirty = false;
  }
  return {
    readJson<T = unknown>(filename: string): T | null {
      const c = cache.get(filename);
      if (c && !c.isBin) return c.data as T;
      try {
        const text = require('node:fs').readFileSync(abs(filename), 'utf-8');
        const data = JSON.parse(text);
        cache.set(filename, { data, dirty: false, isBin: false });
        return data as T;
      } catch { return null; }
    },
    writeJson(filename, data) {
      cache.set(filename, { data, dirty: true, isBin: false });
    },
    readBin(filename) {
      const c = cache.get(filename);
      if (c && c.isBin && c.bytes) return c.bytes.buffer.slice(c.bytes.byteOffset, c.bytes.byteOffset + c.bytes.byteLength);
      try {
        const buf = require('node:fs').readFileSync(abs(filename));
        const bytes = new Uint8Array(buf);
        cache.set(filename, { data: null, dirty: false, isBin: true, bytes });
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      } catch { return null; }
    },
    readBinShared(filename) {
      const c = cache.get(filename);
      return c?.isBin ? c.bytes ?? null : null;
    },
    writeBin(filename, buffer) {
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      cache.set(filename, { data: null, dirty: true, isBin: true, bytes });
    },
    delete(filename) {
      cache.set(filename, { data: undefined, dirty: true, isBin: false });
    },
    async preload(filenames) {
      for (const name of filenames) {
        if (cache.has(name)) continue;
        try {
          const buf = await readFile(abs(name));
          cache.set(name, { data: null, dirty: false, isBin: true, bytes: new Uint8Array(buf) });
        } catch { /* missing files are OK per contract */ }
      }
    },
    async persist() {
      for (const [name, entry] of cache.entries()) if (entry.dirty) await flushOne(name, entry);
    }
  };
}

export async function runCliWithError(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err: unknown) {
    if (isWikiError(err)) {
      process.stderr.write(`[${err.code}] ${err.message}\n`);
      process.exit(err.exitCode());
    }
    process.stderr.write(`${(err as Error).message ?? String(err)}\n`);
    process.exit(1);
  }
}

const main = defineCommand({
  meta: { name: 'wiki', version: '0.1.0-pre', description: 'LLM-maintained markdown wiki' },
  subCommands: { init: initCmd, ingest: ingestCmd, query: queryCmd, config: configCmd }
});

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  runMain(main);
}
