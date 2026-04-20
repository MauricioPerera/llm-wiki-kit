import { partitionFor } from '../indexes/build.ts';
import { searchIndexes } from '../indexes/search.ts';
import { searchBM25, type BM25Document } from '../retrieval/bm25.ts';
import { searchByAdapter, type VectorDocument } from '../retrieval/vector.ts';
import { rrfMerge, type LayerInput } from '../retrieval/rank.ts';
import { QUERY_SYSTEM_PROMPT } from './prompts.ts';
import type { Wiki } from './wiki.ts';
import type { Citation, Page, PageType, QueryOptions, QueryResult, RetrievalHit } from '../types/index.ts';

const decoder = new TextDecoder();
const INDEX_FILES = ['index/root.md', 'index/facts.md', 'index/entities.md', 'index/concepts.md', 'index/synthesis.md', 'index/sources.md'];

interface EmbeddingEntry { path: string; type: PageType; id: string; vector: number[] }

function pagePath(p: Page): string {
  return `${partitionFor(p.type)}/${p.id}.md`;
}

function pageText(p: Page): string {
  const extras: string[] = [];
  if (p.type === 'fact') extras.push(p.claim);
  if (p.type === 'synthesis') extras.push(p.scope);
  if (p.type === 'entity' || p.type === 'concept') extras.push(...p.aliases);
  return [p.title, ...extras, p.body].join(' ');
}

function toBM25Doc(p: Page): BM25Document {
  return { path: pagePath(p), type: p.type, id: p.id, text: pageText(p) };
}

async function loadIndexFiles(wiki: Wiki): Promise<Record<string, string>> {
  await wiki.adapter.preload(INDEX_FILES);
  const out: Record<string, string> = {};
  for (const path of INDEX_FILES) {
    const shared = wiki.adapter.readBinShared?.(path);
    const ab = shared ?? wiki.adapter.readBin(path);
    if (!ab) continue;
    out[path] = decoder.decode(shared ? shared : new Uint8Array(ab as ArrayBuffer));
  }
  return out;
}

async function loadEmbeddings(wiki: Wiki): Promise<VectorDocument[]> {
  await wiki.adapter.preload(['.wiki/embeddings.json']);
  const raw = wiki.adapter.readJson<EmbeddingEntry[]>('.wiki/embeddings.json');
  if (!raw) return [];
  return raw.map((r) => ({ path: r.path, type: r.type, id: r.id, vector: Float32Array.from(r.vector) }));
}

function filterSuperseded(pages: Page[], include: boolean): Page[] {
  if (include) return pages;
  return pages.filter((p) => !(p.type === 'fact' && p.supersededBy));
}

function excerptOf(p: Page, maxWords = 25): string {
  const src = p.type === 'fact' ? p.claim : p.type === 'synthesis' ? p.scope : p.body || p.title;
  const words = src.split(/\s+/).slice(0, maxWords).join(' ');
  return words;
}

function buildCitations(pages: Page[]): Citation[] {
  return pages.map((p) => ({
    pagePath: pagePath(p),
    pageType: p.type,
    pageId: p.id,
    sources: p.type === 'fact' ? p.sources : p.type === 'source' ? [p.id] : [],
    excerpt: excerptOf(p)
  }));
}

function buildQueryContext(question: string, pages: Page[], format: 'markdown' | 'json'): string {
  const pageBlocks = pages.map((p) => {
    const header = `--- PAGE ${pagePath(p)} (${p.type}:${p.id}) ---`;
    return `${header}\ntitle: ${p.title}\n\n${p.body || excerptOf(p, 80)}`;
  }).join('\n\n');
  return [
    `Question: ${question}`,
    `Format: ${format}`,
    '',
    '### Retrieved pages',
    pageBlocks || '(none)'
  ].join('\n');
}

export async function runQuery(wiki: Wiki, text: string, opts: QueryOptions): Promise<QueryResult> {
  const start = Date.now();
  const config = wiki.getConfig();
  const topK = opts.topK ?? config.retrieval.final_k;
  const perLayer = config.retrieval.top_k_per_layer;
  const layersRun: Array<'index' | 'bm25' | 'vector'> = [];
  const hitsPerLayer: Record<string, number> = { index: 0, bm25: 0, vector: 0 };

  const allPages = await wiki.preloadAllPages();
  const pagesByPath = new Map<string, Page>(allPages.map((p) => [pagePath(p), p]));

  const indexes = await loadIndexFiles(wiki);
  const l1 = searchIndexes(indexes, text, perLayer);
  layersRun.push('index');
  hitsPerLayer.index = l1.length;
  const l1Layer: LayerInput = {
    layer: 'index',
    hits: l1.flatMap((h) => {
      const page = pagesByPath.get(h.path);
      return page ? [{ path: h.path, type: page.type, id: page.id, score: h.score }] : [];
    })
  };

  const layers: LayerInput[] = [l1Layer];
  if (l1.length < perLayer / 2) {
    const bm = searchBM25(allPages.map(toBM25Doc), text, { k1: config.bm25.k1, b: config.bm25.b, topK: perLayer });
    layersRun.push('bm25');
    hitsPerLayer.bm25 = bm.length;
    layers.push({ layer: 'bm25', hits: bm });
  }

  const preVector = rrfMerge(layers);
  if (wiki.embeddings && preVector.length < topK / 2) {
    const docs = await loadEmbeddings(wiki);
    if (docs.length > 0) {
      const v = await searchByAdapter(wiki.embeddings, text, docs, { topK: perLayer });
      layersRun.push('vector');
      hitsPerLayer.vector = v.length;
      layers.push({ layer: 'vector', hits: v });
    }
  }

  const merged: RetrievalHit[] = rrfMerge(layers, { finalK: topK });
  let retrievedPages: Page[] = [];
  for (const hit of merged) {
    const page = pagesByPath.get(hit.path);
    if (page) retrievedPages.push(page);
  }
  retrievedPages = filterSuperseded(retrievedPages, opts.includeSuperseded ?? false);

  const format = opts.format ?? 'markdown';
  const resp = await wiki.llm.complete({
    system: QUERY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildQueryContext(text, retrievedPages, format) }],
    responseFormat: format === 'json' ? 'json' : 'text'
  });
  return {
    answer: resp.text,
    citations: buildCitations(retrievedPages),
    retrievalTrace: { layersRun, hitsPerLayer, finalPageCount: retrievedPages.length, latencyMs: Date.now() - start }
  };
}
