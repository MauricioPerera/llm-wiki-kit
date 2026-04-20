import type { FactPage, EntityPage, Page } from '../../src/types/index.ts';

const WORDS = [
  'helix', 'tessera', 'lattice', 'nav', 'robotics', 'barcelona', 'warehouse',
  'autonomous', 'pick', 'place', 'latency', 'occupancy', 'map', 'memory',
  'navigation', 'framework', 'benchmark', 'llm', 'agentic', 'embedding',
  'retrieval', 'cosine', 'vector', 'scalar', 'index', 'page', 'synthesis',
  'entity', 'concept', 'source', 'claim', 'confidence', 'supersedes'
];

function pseudoText(seed: number, len: number): string {
  const out: string[] = [];
  let s = seed;
  for (let i = 0; i < len; i += 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out.push(WORDS[s % WORDS.length] ?? 'x');
  }
  return out.join(' ');
}

export function makeFact(index: number, bodyWords = 40): FactPage {
  const hash = (index * 2654435761 >>> 0).toString(16).padStart(8, '0').slice(-8);
  return {
    type: 'fact',
    id: `fact-${index}-${hash}`,
    title: `Fact ${index} — ${pseudoText(index, 4)}`,
    claim: pseudoText(index * 7, 12),
    sources: [`src-${Math.floor(index / 5)}`],
    ingested: '2026-04-20T10:00:00Z',
    supersedes: null,
    supersededBy: null,
    confidence: index % 3 === 0 ? 'high' : index % 3 === 1 ? 'medium' : 'low',
    tags: [WORDS[index % WORDS.length] ?? 'x'],
    body: pseudoText(index * 13, bodyWords)
  };
}

export function makeEntity(index: number): EntityPage {
  return {
    type: 'entity',
    id: `entity-${index}`,
    title: `Entity ${index}`,
    aliases: [],
    kind: 'org',
    relatedFacts: [],
    relatedEntities: [],
    relatedConcepts: [],
    lastUpdated: '2026-04-20T10:00:00Z',
    tags: [],
    body: pseudoText(index * 17, 20)
  };
}

export function makeCorpus(nFacts: number, nEntities = 0): Page[] {
  const pages: Page[] = [];
  for (let i = 0; i < nFacts; i += 1) pages.push(makeFact(i));
  for (let i = 0; i < nEntities; i += 1) pages.push(makeEntity(i));
  return pages;
}

export function fillVector(seed: number, dim: number): Float32Array {
  const v = new Float32Array(dim);
  let s = (seed * 2654435761) >>> 0;
  for (let i = 0; i < dim; i += 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    v[i] = ((s >>> 0) / 0xffffffff) * 2 - 1;
  }
  let norm = 0;
  for (let i = 0; i < dim; i += 1) norm += (v[i] ?? 0) * (v[i] ?? 0);
  const d = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i += 1) v[i] = (v[i] ?? 0) / d;
  return v;
}
