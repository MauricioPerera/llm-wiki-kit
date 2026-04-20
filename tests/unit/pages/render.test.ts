import { describe, it, expect } from 'vitest';
import { renderPage } from '../../../src/pages/render.ts';
import { parsePage } from '../../../src/pages/parse.ts';
import type { FactPage, EntityPage, SourcePage, SynthesisPage } from '../../../src/types/index.ts';

const fact: FactPage = {
  type: 'fact',
  id: 'helix-launches-tessera-abcd1234',
  title: 'Helix launches Tessera-1',
  claim: 'Helix Robotics launched Tessera-1 on April 2, 2026.',
  sources: ['helix-press-release-2026-04'],
  ingested: '2026-04-20T09:00:00Z',
  supersedes: null,
  supersededBy: null,
  confidence: 'high',
  tags: ['robotics', 'spain'],
  body: 'See [[entities/helix-robotics]] for context.'
};

const entity: EntityPage = {
  type: 'entity',
  id: 'helix-robotics',
  title: 'Helix Robotics',
  aliases: ['Helix'],
  kind: 'org',
  relatedFacts: ['helix-launches-tessera-abcd1234'],
  relatedEntities: [],
  relatedConcepts: ['lattice-nav'],
  lastUpdated: '2026-04-20T09:00:00Z',
  tags: ['robotics'],
  body: 'Barcelona-based autonomous robotics startup.'
};

const synth: SynthesisPage = {
  type: 'synthesis',
  id: 'spanish-robotics-2026',
  title: 'Spanish robotics in 2026',
  scope: 'Overview of notable Spanish robotics firms and products in 2026',
  references: {
    facts: ['helix-launches-tessera-abcd1234'],
    entities: ['helix-robotics'],
    concepts: ['lattice-nav'],
    sources: ['helix-press-release-2026-04']
  },
  lastUpdated: '2026-04-20T09:00:00Z',
  tags: [],
  body: 'Helix [[entities/helix-robotics]] leads a new wave.'
};

const source: SourcePage = {
  type: 'source',
  id: 'helix-press-release-2026-04',
  title: 'Helix press release, April 2026',
  origin: 'https://helix.example/press/tessera-1',
  ingested: '2026-04-20T09:00:00Z',
  format: 'html',
  sizeBytes: 4096,
  hash: 'deadbeef',
  producedFacts: ['helix-launches-tessera-abcd1234'],
  touchedEntities: ['helix-robotics'],
  touchedConcepts: ['lattice-nav'],
  touchedSynthesis: [],
  body: ''
};

describe('pages/render', () => {
  it('renders a fact page with frontmatter fields from SCHEMA §4.1', () => {
    const md = renderPage(fact);
    expect(md.startsWith('---\n')).toBe(true);
    expect(md).toContain('type: fact');
    expect(md).toContain('id: helix-launches-tessera-abcd1234');
    expect(md).toContain('claim: Helix Robotics launched Tessera-1 on April 2, 2026.');
    expect(md).toContain('superseded-by: null');
    expect(md).toContain('confidence: high');
    expect(md).toMatch(/tags:\n {2}- robotics\n {2}- spain/);
    expect(md).toContain('[[entities/helix-robotics]]');
  });

  it('round-trips fact through parse', () => {
    expect(parsePage(renderPage(fact))).toEqual(fact);
  });

  it('round-trips entity through parse', () => {
    expect(parsePage(renderPage(entity))).toEqual(entity);
  });

  it('round-trips synthesis through parse', () => {
    expect(parsePage(renderPage(synth))).toEqual(synth);
  });

  it('round-trips source through parse', () => {
    expect(parsePage(renderPage(source))).toEqual(source);
  });

  it('tags serialize as YAML array, not inline comma list', () => {
    const md = renderPage(fact);
    expect(md).not.toMatch(/tags: \[/);
    expect(md).toMatch(/tags:\n/);
  });
});
