import type { PageType } from '../types/index.ts';

export interface BM25Document {
  path: string;
  type: PageType;
  id: string;
  text: string;
}

export interface BM25Options {
  k1?: number;
  b?: number;
  topK?: number;
}

export interface BM25Hit {
  path: string;
  type: PageType;
  id: string;
  score: number;
}

interface PreparedDoc {
  path: string;
  type: PageType;
  id: string;
  terms: string[];
  length: number;
  termFreq: Map<string, number>;
}

const TOKEN_RE = /[a-z0-9][a-z0-9'-]*/g;

export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const tokens: string[] = [];
  for (const match of lower.matchAll(TOKEN_RE)) {
    tokens.push(match[0]);
  }
  return tokens;
}

function prepare(docs: BM25Document[]): PreparedDoc[] {
  return docs.map((doc) => {
    const terms = tokenize(doc.text);
    const termFreq = new Map<string, number>();
    for (const term of terms) {
      termFreq.set(term, (termFreq.get(term) ?? 0) + 1);
    }
    return {
      path: doc.path,
      type: doc.type,
      id: doc.id,
      terms,
      length: terms.length,
      termFreq
    };
  });
}

function buildDocFreq(prepared: PreparedDoc[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of prepared) {
    for (const term of doc.termFreq.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  return df;
}

function idf(df: number, n: number): number {
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

export function searchBM25(
  docs: BM25Document[],
  query: string,
  opts: BM25Options = {}
): BM25Hit[] {
  const k1 = opts.k1 ?? 1.5;
  const b = opts.b ?? 0.75;
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0 || docs.length === 0) return [];

  const prepared = prepare(docs);
  const n = prepared.length;
  const avgdl =
    prepared.reduce((sum, d) => sum + d.length, 0) / Math.max(n, 1);
  const df = buildDocFreq(prepared);

  const scored: BM25Hit[] = prepared.map((doc) => {
    let score = 0;
    for (const term of queryTerms) {
      const tf = doc.termFreq.get(term);
      if (!tf) continue;
      const termDf = df.get(term) ?? 0;
      const termIdf = idf(termDf, n);
      const norm = 1 - b + b * (doc.length / Math.max(avgdl, 1));
      score += termIdf * ((tf * (k1 + 1)) / (tf + k1 * norm));
    }
    return { path: doc.path, type: doc.type, id: doc.id, score };
  });

  const filtered = scored.filter((h) => h.score > 0);
  filtered.sort((a, b2) => b2.score - a.score);
  return typeof opts.topK === 'number' ? filtered.slice(0, opts.topK) : filtered;
}
