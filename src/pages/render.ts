import YAML from 'yaml';
import type {
  Page,
  FactPage,
  EntityPage,
  ConceptPage,
  SynthesisPage,
  SourcePage
} from '../types/index.ts';

function toYaml(obj: Record<string, unknown>): string {
  return YAML.stringify(obj, {
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN'
  });
}

function wrap(fm: Record<string, unknown>, body: string): string {
  const yaml = toYaml(fm).trimEnd();
  const trimmedBody = body.replace(/^\n+/, '').replace(/\s+$/, '');
  return `---\n${yaml}\n---\n\n${trimmedBody}${trimmedBody.length > 0 ? '\n' : ''}`;
}

function renderFact(p: FactPage): string {
  return wrap(
    {
      type: p.type,
      id: p.id,
      title: p.title,
      claim: p.claim,
      sources: p.sources,
      ingested: p.ingested,
      supersedes: p.supersedes,
      'superseded-by': p.supersededBy,
      confidence: p.confidence,
      tags: p.tags
    },
    p.body
  );
}

function renderEntity(p: EntityPage): string {
  return wrap(
    {
      type: p.type,
      id: p.id,
      title: p.title,
      aliases: p.aliases,
      kind: p.kind,
      'related-facts': p.relatedFacts,
      'related-entities': p.relatedEntities,
      'related-concepts': p.relatedConcepts,
      'last-updated': p.lastUpdated,
      tags: p.tags
    },
    p.body
  );
}

function renderConcept(p: ConceptPage): string {
  return wrap(
    {
      type: p.type,
      id: p.id,
      title: p.title,
      aliases: p.aliases,
      'related-facts': p.relatedFacts,
      'related-entities': p.relatedEntities,
      'related-concepts': p.relatedConcepts,
      'last-updated': p.lastUpdated,
      tags: p.tags
    },
    p.body
  );
}

function renderSynthesis(p: SynthesisPage): string {
  return wrap(
    {
      type: p.type,
      id: p.id,
      title: p.title,
      scope: p.scope,
      references: {
        facts: p.references.facts,
        entities: p.references.entities,
        concepts: p.references.concepts,
        sources: p.references.sources
      },
      'last-updated': p.lastUpdated,
      tags: p.tags
    },
    p.body
  );
}

function renderSource(p: SourcePage): string {
  return wrap(
    {
      type: p.type,
      id: p.id,
      title: p.title,
      origin: p.origin,
      ingested: p.ingested,
      format: p.format,
      'size-bytes': p.sizeBytes,
      hash: p.hash,
      'produced-facts': p.producedFacts,
      'touched-entities': p.touchedEntities,
      'touched-concepts': p.touchedConcepts,
      'touched-synthesis': p.touchedSynthesis
    },
    p.body
  );
}

export function renderPage(page: Page): string {
  switch (page.type) {
    case 'fact':
      return renderFact(page);
    case 'entity':
      return renderEntity(page);
    case 'concept':
      return renderConcept(page);
    case 'synthesis':
      return renderSynthesis(page);
    case 'source':
      return renderSource(page);
  }
}
