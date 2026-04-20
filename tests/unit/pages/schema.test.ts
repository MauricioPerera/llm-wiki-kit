import { describe, it, expect } from 'vitest';
import { validatePage, validatePageOfType } from '../../../src/pages/schema.ts';
import { WikiError } from '../../../src/lib/errors.ts';

const validFact = {
  type: 'fact',
  id: 'helix-launches-tessera-abcd1234',
  title: 'Helix launches Tessera-1',
  claim: 'Helix Robotics launched Tessera-1 on April 2, 2026.',
  sources: ['helix-press-release-2026-04'],
  ingested: '2026-04-20T09:00:00Z',
  supersedes: null,
  supersededBy: null,
  confidence: 'high',
  tags: ['robotics'],
  body: ''
};

describe('pages/schema', () => {
  it('validates a correct fact page', () => {
    const p = validatePage(validFact);
    expect(p.type).toBe('fact');
  });

  it('fails when sources missing', () => {
    const bad = { ...validFact } as Record<string, unknown>;
    delete bad.sources;
    expect(() => validatePage(bad)).toThrow(WikiError);
    try {
      validatePage(bad);
    } catch (e) {
      expect((e as WikiError).code).toBe('SCHEMA_VIOLATION');
    }
  });

  it('fails when sources is empty', () => {
    const bad = { ...validFact, sources: [] };
    expect(() => validatePage(bad)).toThrow(WikiError);
  });

  it('fails when confidence is out of enum', () => {
    const bad = { ...validFact, confidence: 'unsure' };
    expect(() => validatePage(bad)).toThrow(WikiError);
  });

  it('fails when entity aliases is not an array', () => {
    const bad = {
      type: 'entity',
      id: 'helix-robotics',
      title: 'Helix Robotics',
      aliases: 'Helix',
      kind: 'org',
      relatedFacts: [],
      relatedEntities: [],
      relatedConcepts: [],
      lastUpdated: '2026-04-20T09:00:00Z',
      tags: [],
      body: ''
    };
    expect(() => validatePage(bad)).toThrow(WikiError);
  });

  it('fails when source page missing hash', () => {
    const bad = {
      type: 'source',
      id: 'src-1',
      title: 'Src',
      origin: '/tmp/s.md',
      ingested: '2026-04-20T09:00:00Z',
      format: 'md',
      sizeBytes: 10,
      producedFacts: [],
      touchedEntities: [],
      touchedConcepts: [],
      touchedSynthesis: [],
      body: ''
    };
    expect(() => validatePage(bad)).toThrow(WikiError);
  });

  it('fails when synthesis references.facts contains non-string', () => {
    const bad = {
      type: 'synthesis',
      id: 'synth-1',
      title: 'S',
      scope: 'robotics',
      references: { facts: [1, 2], entities: [], concepts: [], sources: [] },
      lastUpdated: '2026-04-20T09:00:00Z',
      tags: [],
      body: ''
    };
    expect(() => validatePage(bad)).toThrow(WikiError);
  });

  it('validatePageOfType rejects mismatched type', () => {
    expect(() => validatePageOfType(validFact, 'entity')).toThrow(WikiError);
  });
});
