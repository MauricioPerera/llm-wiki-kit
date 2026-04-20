import { WikiError } from '../lib/errors.ts';
import { silentLogger } from '../lib/logger.ts';
import { renderPage } from '../pages/render.ts';
import { parsePage } from '../pages/parse.ts';
import { buildAllIndexes, partitionFor } from '../indexes/build.ts';
import type {
  EmbeddingAdapter,
  FactPage,
  FileAdapter,
  IngestResult,
  IngestedCache,
  LLMAdapter,
  LoggerLike,
  Page,
  PageRef,
  PageType,
  QueryOptions,
  QueryResult,
  SourceInput,
  WikiConfig,
  WikiOptions
} from '../types/index.ts';
import { DEFAULT_CONFIG } from '../types/index.ts';
import { runIngest } from './ingest.ts';
import { runQuery } from './query.ts';

export interface Manifest {
  pages: Record<string, { type: PageType; id: string }>;
}

const META_FILES = [
  '.wiki/config.json',
  '.wiki/manifest.json',
  '.wiki/ingested.json',
  '.wiki/embeddings.json'
];

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

export class Wiki {
  private pendingCommitMessage: string | null = null;

  constructor(
    readonly path: string,
    readonly adapter: FileAdapter,
    private wikiConfig: WikiConfig,
    readonly llm: LLMAdapter,
    readonly embeddings: EmbeddingAdapter | null,
    readonly logger: LoggerLike
  ) {}

  getConfig(): WikiConfig {
    return { ...this.wikiConfig };
  }

  async setConfig(partial: Partial<WikiConfig>): Promise<void> {
    const merged: WikiConfig = { ...this.wikiConfig, ...partial };
    this.wikiConfig = merged;
    this.adapter.writeJson('.wiki/config.json', merged);
    await this.adapter.persist();
  }

  readManifest(): Manifest {
    return this.adapter.readJson<Manifest>('.wiki/manifest.json') ?? { pages: {} };
  }

  writeManifest(m: Manifest): void {
    this.adapter.writeJson('.wiki/manifest.json', m);
  }

  readIngested(): IngestedCache {
    return this.adapter.readJson<IngestedCache>('.wiki/ingested.json') ?? {};
  }

  writeIngested(cache: IngestedCache): void {
    this.adapter.writeJson('.wiki/ingested.json', cache);
  }

  async preloadAllPages(): Promise<Page[]> {
    const manifest = this.readManifest();
    const paths = Object.keys(manifest.pages);
    await this.adapter.preload([...paths, ...META_FILES]);
    const pages: Page[] = [];
    for (const p of paths) {
      const page = this.readPage(p);
      if (page) pages.push(page);
    }
    return pages;
  }

  readPage(wikiRelativePath: string): Page | null {
    const shared = this.adapter.readBinShared?.(wikiRelativePath);
    if (shared) {
      return parsePage(decoder.decode(shared));
    }
    const ab = this.adapter.readBin(wikiRelativePath);
    if (!ab) return null;
    return parsePage(decoder.decode(new Uint8Array(ab)));
  }

  stagePage(page: Page): string {
    const part = partitionFor(page.type);
    const path = `${part}/${page.id}.md`;
    const md = renderPage(page);
    this.adapter.writeBin(path, encoder.encode(md));
    const m = this.readManifest();
    m.pages[path] = { type: page.type, id: page.id };
    this.writeManifest(m);
    return path;
  }

  rebuildIndexes(pages: Page[]): void {
    const indexes = buildAllIndexes(pages);
    for (const [path, content] of Object.entries(indexes)) {
      this.adapter.writeBin(path, encoder.encode(content));
    }
  }

  setPendingCommitMessage(msg: string): void {
    this.pendingCommitMessage = msg;
  }

  consumePendingCommitMessage(): string | null {
    const m = this.pendingCommitMessage;
    this.pendingCommitMessage = null;
    return m;
  }

  async commit(): Promise<string> {
    try {
      await this.adapter.persist();
    } catch (err: unknown) {
      throw new WikiError('GIT_CONFLICT', 'persist failed', err);
    }
    return `ingest-${Date.now().toString(36)}`;
  }

  async ingest(source: SourceInput): Promise<IngestResult> {
    return runIngest(this, source);
  }

  async query(text: string, opts: QueryOptions = {}): Promise<QueryResult> {
    return runQuery(this, text, opts);
  }

  async close(): Promise<void> {
    if (this.adapter.close) await this.adapter.close();
  }

  refsFromManifest(): PageRef[] {
    const m = this.readManifest();
    return Object.entries(m.pages).map(([path, meta]) => ({
      path,
      type: meta.type,
      id: meta.id
    }));
  }

  listFactsBySlugPrefix(prefix: string): FactPage[] {
    const m = this.readManifest();
    const out: FactPage[] = [];
    for (const [path, meta] of Object.entries(m.pages)) {
      if (meta.type !== 'fact') continue;
      if (!meta.id.startsWith(prefix)) continue;
      const page = this.readPage(path);
      if (page && page.type === 'fact') out.push(page);
    }
    return out;
  }
}

async function loadStorageAdapter(opts: WikiOptions): Promise<FileAdapter> {
  if (opts.storageAdapter) return opts.storageAdapter;
  throw new WikiError(
    'WIKI_NOT_INITIALIZED',
    'no storageAdapter provided and built-in GitStoreAdapter bootstrap is handled by the CLI layer'
  );
}

export async function createWiki(opts: WikiOptions): Promise<Wiki> {
  const adapter = await loadStorageAdapter(opts);
  await adapter.preload(META_FILES);
  const cfgRaw = adapter.readJson<WikiConfig>('.wiki/config.json');
  if (cfgRaw === null) {
    throw new WikiError('WIKI_NOT_INITIALIZED', `no wiki at ${opts.path}`);
  }
  const config: WikiConfig = { ...DEFAULT_CONFIG, ...cfgRaw, ...(opts.config ?? {}) };
  const logger: LoggerLike = opts.logger ?? silentLogger;
  const embeddings = opts.embeddingAdapter ?? null;
  return new Wiki(opts.path, adapter, config, opts.llmAdapter, embeddings, logger);
}

export async function initializeWiki(adapter: FileAdapter): Promise<void> {
  adapter.writeJson('.wiki/config.json', DEFAULT_CONFIG);
  adapter.writeJson('.wiki/manifest.json', { pages: {} });
  adapter.writeJson('.wiki/ingested.json', {});
  const empty = (label: string): string =>
    `# ${label}\n\n_No entries._\n`;
  const parts: Array<[string, string]> = [
    ['facts', 'Facts'],
    ['entities', 'Entities'],
    ['concepts', 'Concepts'],
    ['synthesis', 'Synthesis'],
    ['sources', 'Sources']
  ];
  for (const [slug, label] of parts) {
    adapter.writeBin(`index/${slug}.md`, encoder.encode(empty(label)));
    adapter.writeBin(`${slug}/.gitkeep`, new Uint8Array());
  }
  const root = `# Wiki Index\n\nTotal pages: 0\n\n${parts
    .map(([slug, label]) => `- [[index/${slug}.md|${label}]] — 0 pages`)
    .join('\n')}\n`;
  adapter.writeBin('index/root.md', encoder.encode(root));
  await adapter.persist();
}
