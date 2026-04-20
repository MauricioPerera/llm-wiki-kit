import YAML from 'yaml';
import { WikiError } from '../lib/errors.ts';
import type { Page } from '../types/index.ts';
import { validatePage } from './schema.ts';

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n/g, '\n');
}

function splitFrontmatter(input: string): { fm: string; body: string } {
  const normalized = normalizeLineEndings(input);
  const match = FM_RE.exec(normalized);
  if (!match) {
    throw new WikiError('SCHEMA_VIOLATION', 'missing YAML frontmatter block');
  }
  const fm = match[1] ?? '';
  const body = (match[2] ?? '').replace(/^\n+/, '').replace(/\s+$/, '');
  return { fm, body };
}

function parseYaml(fm: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = YAML.parse(fm);
  } catch (err: unknown) {
    throw new WikiError(
      'SCHEMA_VIOLATION',
      'frontmatter is not valid YAML',
      err
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new WikiError(
      'SCHEMA_VIOLATION',
      'frontmatter must be a YAML mapping'
    );
  }
  return parsed as Record<string, unknown>;
}

function kebabToCamel(record: Record<string, unknown>): Record<string, unknown> {
  const aliases: Record<string, string> = {
    'superseded-by': 'supersededBy',
    'related-facts': 'relatedFacts',
    'related-entities': 'relatedEntities',
    'related-concepts': 'relatedConcepts',
    'last-updated': 'lastUpdated',
    'size-bytes': 'sizeBytes',
    'produced-facts': 'producedFacts',
    'touched-entities': 'touchedEntities',
    'touched-concepts': 'touchedConcepts',
    'touched-synthesis': 'touchedSynthesis'
  };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const target = aliases[key] ?? key;
    out[target] = value;
  }
  return out;
}

function coerceNullable(record: Record<string, unknown>, key: string): void {
  if (!(key in record)) {
    record[key] = null;
  }
}

function normalizeFact(r: Record<string, unknown>): Record<string, unknown> {
  coerceNullable(r, 'supersedes');
  coerceNullable(r, 'supersededBy');
  return r;
}

export function parsePage(input: string): Page {
  const { fm, body } = splitFrontmatter(input);
  const raw = parseYaml(fm);
  const camel = kebabToCamel(raw);
  camel.body = body;

  const type = camel.type;
  if (typeof type !== 'string') {
    throw new WikiError(
      'SCHEMA_VIOLATION',
      'frontmatter missing "type" field'
    );
  }

  const allowed = new Set(['fact', 'entity', 'concept', 'synthesis', 'source']);
  if (!allowed.has(type)) {
    throw new WikiError(
      'SCHEMA_VIOLATION',
      `unknown page type: ${type}`,
      undefined,
      { type }
    );
  }

  if (type === 'fact') {
    normalizeFact(camel);
  }

  return validatePage(camel);
}
