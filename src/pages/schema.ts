import { z } from 'zod';
import { WikiError } from '../lib/errors.ts';
import type { Page, PageType } from '../types/index.ts';

const iso = z.string().min(1);
const slug = z.string().min(1).max(96);
const tags = z.array(z.string()).default([]);

export const FactSchema = z.object({
  type: z.literal('fact'),
  id: slug,
  title: z.string().min(1),
  claim: z.string().min(1),
  sources: z.array(z.string().min(1)).min(1),
  ingested: iso,
  supersedes: z.string().nullable(),
  supersededBy: z.string().nullable(),
  confidence: z.enum(['low', 'medium', 'high']),
  tags,
  body: z.string().default('')
});

export const EntitySchema = z.object({
  type: z.literal('entity'),
  id: slug,
  title: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  kind: z.enum(['person', 'org', 'place', 'product', 'other']),
  relatedFacts: z.array(z.string()).default([]),
  relatedEntities: z.array(z.string()).default([]),
  relatedConcepts: z.array(z.string()).default([]),
  lastUpdated: iso,
  tags,
  body: z.string().default('')
});

export const ConceptSchema = z.object({
  type: z.literal('concept'),
  id: slug,
  title: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  relatedFacts: z.array(z.string()).default([]),
  relatedEntities: z.array(z.string()).default([]),
  relatedConcepts: z.array(z.string()).default([]),
  lastUpdated: iso,
  tags,
  body: z.string().default('')
});

export const SynthesisSchema = z.object({
  type: z.literal('synthesis'),
  id: slug,
  title: z.string().min(1),
  scope: z.string().min(1),
  references: z.object({
    facts: z.array(z.string()).default([]),
    entities: z.array(z.string()).default([]),
    concepts: z.array(z.string()).default([]),
    sources: z.array(z.string()).default([])
  }),
  lastUpdated: iso,
  tags,
  body: z.string().default('')
});

export const SourceSchema = z.object({
  type: z.literal('source'),
  id: z.string().min(1),
  title: z.string().min(1),
  origin: z.string().min(1),
  ingested: iso,
  format: z.enum(['md', 'txt', 'html']),
  sizeBytes: z.number().int().nonnegative(),
  hash: z.string().min(1),
  producedFacts: z.array(z.string()).default([]),
  touchedEntities: z.array(z.string()).default([]),
  touchedConcepts: z.array(z.string()).default([]),
  touchedSynthesis: z.array(z.string()).default([]),
  body: z.string().default('')
});

export const PageSchema = z.discriminatedUnion('type', [
  FactSchema,
  EntitySchema,
  ConceptSchema,
  SynthesisSchema,
  SourceSchema
]);

export function validatePage(input: unknown): Page {
  const parsed = PageSchema.safeParse(input);
  if (!parsed.success) {
    throw new WikiError(
      'SCHEMA_VIOLATION',
      'page failed frontmatter validation',
      parsed.error,
      { issues: parsed.error.issues }
    );
  }
  return parsed.data as Page;
}

export function validatePageOfType<T extends PageType>(
  input: unknown,
  type: T
): Extract<Page, { type: T }> {
  const page = validatePage(input);
  if (page.type !== type) {
    throw new WikiError(
      'SCHEMA_VIOLATION',
      `expected page type ${type}, got ${page.type}`,
      undefined,
      { expected: type, actual: page.type }
    );
  }
  return page as Extract<Page, { type: T }>;
}
