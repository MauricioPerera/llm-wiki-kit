import type { PageType, RetrievalHit } from '../types/index.ts';

export interface LayerHit {
  path: string;
  type: PageType;
  id: string;
  score: number;
}

export interface RRFOptions {
  k?: number;
  finalK?: number;
}

export interface LayerInput {
  layer: 'index' | 'bm25' | 'vector';
  hits: LayerHit[];
}

export function rrfMerge(
  layers: LayerInput[],
  opts: RRFOptions = {}
): RetrievalHit[] {
  const k = opts.k ?? 60;
  const accum = new Map<
    string,
    {
      path: string;
      type: PageType;
      id: string;
      score: number;
      firstLayer: 'index' | 'bm25' | 'vector';
    }
  >();

  for (const layer of layers) {
    layer.hits.forEach((hit, rank) => {
      const contribution = 1 / (k + rank + 1);
      const existing = accum.get(hit.path);
      if (existing) {
        existing.score += contribution;
      } else {
        accum.set(hit.path, {
          path: hit.path,
          type: hit.type,
          id: hit.id,
          score: contribution,
          firstLayer: layer.layer
        });
      }
    });
  }

  const merged: RetrievalHit[] = Array.from(accum.values()).map((h) => ({
    path: h.path,
    type: h.type,
    id: h.id,
    score: h.score,
    layer: h.firstLayer
  }));
  merged.sort((a, b) => b.score - a.score);
  if (typeof opts.finalK === 'number') {
    return merged.slice(0, opts.finalK);
  }
  return merged;
}
