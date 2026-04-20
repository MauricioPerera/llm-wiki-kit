import { describe, it, expect } from 'vitest';
import { searchIndex, searchIndexes } from '../../../src/indexes/search.ts';

const indexContent = `# Facts

- [[facts/a-abcd1234.md|Helix launches Tessera]] — Helix Robotics launched Tessera-1 on April 2 2026 #robotics #spain
- [[facts/b-abcd5678.md|A2E benchmark]] — Llama 3.2 1B scored 86 percent on A2E #a2e
- [[facts/c-abcd9999.md|Workers AI adds Gemma]] — Cloudflare enabled Gemma 3 4B on Workers AI #cloudflare
`;

describe('indexes/search', () => {
  it('returns the single page matching a unique token', () => {
    const hits = searchIndex(indexContent, 'tessera');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.path).toBe('facts/a-abcd1234.md');
  });

  it('returns all pages tagged with a tag', () => {
    const hits = searchIndex(indexContent, '#cloudflare');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.path).toBe('facts/c-abcd9999.md');
  });

  it('non-existent token returns empty array', () => {
    expect(searchIndex(indexContent, 'quantum')).toEqual([]);
  });

  it('is case-insensitive on summaries', () => {
    expect(searchIndex(indexContent, 'HELIX')).toHaveLength(1);
    expect(searchIndex(indexContent, 'helix')).toHaveLength(1);
  });

  it('empty query returns empty array', () => {
    expect(searchIndex(indexContent, '')).toEqual([]);
  });

  it('searchIndexes aggregates across multiple index files', () => {
    const other = `# Concepts

- [[concepts/lattice-nav.md|Lattice-Nav]] — navigation framework by Helix #nav
`;
    const hits = searchIndexes({ 'index/facts.md': indexContent, 'index/concepts.md': other }, 'helix');
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });
});
