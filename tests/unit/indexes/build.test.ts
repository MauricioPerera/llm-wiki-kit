import { describe, it, expect } from 'vitest';
import {
  buildPartitionIndex,
  buildRootIndex,
  buildAllIndexes
} from '../../../src/indexes/build.ts';
import type { FactPage, EntityPage } from '../../../src/types/index.ts';

function makeFact(id: string, claim: string, tags: string[] = []): FactPage {
  return {
    type: 'fact',
    id,
    title: claim.slice(0, 40),
    claim,
    sources: ['src-1'],
    ingested: '2026-04-20T09:00:00Z',
    supersedes: null,
    supersededBy: null,
    confidence: 'high',
    tags,
    body: ''
  };
}

function makeEntity(id: string, title: string): EntityPage {
  return {
    type: 'entity',
    id,
    title,
    aliases: [],
    kind: 'org',
    relatedFacts: [],
    relatedEntities: [],
    relatedConcepts: [],
    lastUpdated: '2026-04-20T09:00:00Z',
    tags: [],
    body: `About ${title}.`
  };
}

describe('indexes/build', () => {
  it('builds a facts index with 3 entries in slug-alphabetical order', () => {
    const pages = [
      makeFact('c-fact-1111', 'C claim'),
      makeFact('a-fact-2222', 'A claim'),
      makeFact('b-fact-3333', 'B claim')
    ];
    const md = buildPartitionIndex('facts', pages);
    const lines = md.split('\n').filter((l) => l.startsWith('- '));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('a-fact-2222');
    expect(lines[1]).toContain('b-fact-3333');
    expect(lines[2]).toContain('c-fact-1111');
  });

  it('produces header-only output for an empty partition', () => {
    const md = buildPartitionIndex('concepts', []);
    expect(md).toContain('# Concepts');
    expect(md).toContain('_No entries._');
    expect(md.match(/^- /gm)).toBeNull();
  });

  it('is idempotent: two rebuilds produce identical bytes', () => {
    const pages = [makeFact('a-abcd1234', 'A', ['x']), makeFact('b-abcd5678', 'B')];
    const once = buildPartitionIndex('facts', pages);
    const twice = buildPartitionIndex('facts', pages);
    expect(once).toBe(twice);
  });

  it('root index counts pages per partition', () => {
    const md = buildRootIndex({ facts: 3, entities: 2, concepts: 1, synthesis: 0, sources: 1 });
    expect(md).toContain('Total pages: 7');
    expect(md).toContain('Facts');
    expect(md).toContain('Entities');
  });

  it('buildAllIndexes emits six files', () => {
    const all = buildAllIndexes([makeFact('a-abcd1234', 'A'), makeEntity('acme', 'Acme')]);
    expect(Object.keys(all).sort()).toEqual([
      'index/concepts.md',
      'index/entities.md',
      'index/facts.md',
      'index/root.md',
      'index/sources.md',
      'index/synthesis.md'
    ]);
  });

  it('tags render as #tag suffixes', () => {
    const pages = [makeFact('a-abcd1234', 'A claim', ['alpha', 'beta'])];
    const md = buildPartitionIndex('facts', pages);
    expect(md).toContain('#alpha');
    expect(md).toContain('#beta');
  });
});
