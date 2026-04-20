import { WikiError } from '../lib/errors.ts';
import { isNode } from '../lib/platform.ts';
import { partitionFor } from '../indexes/build.ts';
import { validatePage } from '../pages/schema.ts';
import { readSource, type RawSource } from '../sources/readers.ts';
import { INGEST_SYSTEM_PROMPT } from './prompts.ts';
import type { Wiki } from './wiki.ts';
import type { ConceptPage, EntityPage, FactPage, IngestResult, IngestedEntry, Page, PageType, SourceInput, SourcePage, SynthesisPage } from '../types/index.ts';

async function readFileBytes(path: string): Promise<Uint8Array> {
  if (!isNode) throw new WikiError('INVALID_SOURCE', 'file-based ingest requires Node; use { kind: "text" } elsewhere', undefined, { path });
  return new Uint8Array(await (await import('node:fs/promises')).readFile(path));
}
interface RawIngestOutput {
  source_page: unknown;
  facts?: unknown[];
  entity_updates?: unknown[];
  concept_updates?: unknown[];
  synthesis_updates?: unknown[];
  supersessions?: Array<{ old_fact_id: string; new_fact_id: string; reason: string }>;
}

async function loadRawSource(source: SourceInput): Promise<RawSource> {
  if (source.kind === 'text') {
    const bytes = new TextEncoder().encode(source.content);
    return readSource({ bytes, origin: source.origin ?? source.sourceId, format: source.format });
  }
  let bytes: Uint8Array;
  try {
    bytes = await readFileBytes(source.path);
  } catch (err: unknown) {
    if (err instanceof WikiError) throw err;
    throw new WikiError('INVALID_SOURCE', `cannot read ${source.path}`, err);
  }
  return readSource({ bytes, origin: source.path });
}

function resolveSourceId(source: SourceInput, raw: RawSource): string {
  if (source.kind === 'text') return source.sourceId;
  if (source.sourceId) return source.sourceId;
  return `src-${raw.hash.slice(0, 12)}`;
}

function parseLLMJson(text: string): RawIngestOutput {
  const trimmed = text.trim().replace(/^```(?:json)?\n?|```$/g, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err: unknown) {
    throw new WikiError('SCHEMA_VIOLATION', 'LLM response is not valid JSON', err);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new WikiError('SCHEMA_VIOLATION', 'LLM response is not a JSON object');
  }
  return parsed as RawIngestOutput;
}

function buildContext(wiki: Wiki, raw: RawSource, sourceId: string): string {
  const refs = wiki.refsFromManifest();
  const existingIds = refs.map((r) => `${r.path} (${r.id})`).join('\n');
  return [
    `Source id: ${sourceId}`,
    `Origin: ${raw.origin}`,
    `Format: ${raw.format}`,
    `Hash: ${raw.hash}`,
    `Size bytes: ${raw.sizeBytes}`,
    '',
    '### Existing pages in wiki',
    existingIds || '(empty wiki)',
    '',
    '### Source content',
    raw.content
  ].join('\n');
}

async function callIngestLLM(wiki: Wiki, userMessage: string): Promise<RawIngestOutput> {
  const resp = await wiki.llm.complete({
    system: INGEST_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    responseFormat: 'json'
  });
  return parseLLMJson(resp.text);
}

interface Validated { sourcePage: SourcePage; facts: FactPage[]; entities: EntityPage[]; concepts: ConceptPage[]; synthesis: SynthesisPage[] }
function validateAll(out: RawIngestOutput): Validated {
  const sourcePage = validatePage(out.source_page) as SourcePage;
  if (sourcePage.type !== 'source') throw new WikiError('SCHEMA_VIOLATION', 'source_page is not of type "source"');
  const facts = (out.facts ?? []).map((f) => validatePage(f) as FactPage);
  const entities = (out.entity_updates ?? []).map((e) => validatePage(e) as EntityPage);
  const concepts = (out.concept_updates ?? []).map((c) => validatePage(c) as ConceptPage);
  const synthesis = (out.synthesis_updates ?? []).map((s) => validatePage(s) as SynthesisPage);
  const checks: Array<[string, Page[]]> = [['fact', facts], ['entity', entities], ['concept', concepts], ['synthesis', synthesis]];
  for (const [expected, arr] of checks) {
    for (const p of arr) if (p.type !== expected) throw new WikiError('SCHEMA_VIOLATION', `expected ${expected}, got ${p.type}`);
  }
  return { sourcePage, facts, entities, concepts, synthesis };
}

function applySupersessions(
  wiki: Wiki,
  supersessions: Array<{ old_fact_id: string; new_fact_id: string; reason: string }>,
  newFacts: FactPage[]
): Array<{ oldFactId: string; newFactId: string; reason: string }> {
  const out: Array<{ oldFactId: string; newFactId: string; reason: string }> = [];
  for (const s of supersessions) {
    const oldPage = wiki.readPage(`facts/${s.old_fact_id}.md`);
    if (!oldPage || oldPage.type !== 'fact') {
      throw new WikiError('SCHEMA_VIOLATION', `supersession references unknown fact ${s.old_fact_id}`);
    }
    const updated: FactPage = { ...oldPage, supersededBy: s.new_fact_id };
    wiki.stagePage(updated);
    const newFact = newFacts.find((f) => f.id === s.new_fact_id);
    if (newFact && !newFact.supersedes) newFact.supersedes = s.old_fact_id;
    out.push({ oldFactId: s.old_fact_id, newFactId: s.new_fact_id, reason: s.reason });
  }
  return out;
}

function stageAll(wiki: Wiki, pages: Page[]): string[] {
  return pages.map((p) => wiki.stagePage(p));
}

async function updateEmbeddings(wiki: Wiki, pages: Page[]): Promise<void> {
  if (!wiki.embeddings || pages.length === 0) return;
  await wiki.adapter.preload(['.wiki/embeddings.json']);
  const raw = wiki.adapter.readJson<Array<{ path: string; type: PageType; id: string; vector: number[] }>>('.wiki/embeddings.json') ?? [];
  const byPath = new Map(raw.map((e) => [e.path, e]));
  for (const p of pages) {
    const path = `${partitionFor(p.type)}/${p.id}.md`;
    const vec = await wiki.embeddings.embed((p.body || p.title).slice(0, 4000));
    byPath.set(path, { path, type: p.type, id: p.id, vector: Array.from(vec) });
  }
  wiki.adapter.writeJson('.wiki/embeddings.json', Array.from(byPath.values()));
}

function buildCommitMessage(
  title: string,
  sourceId: string,
  counts: { facts: number; entities: string[]; concepts: string[]; synthesis: string[] },
  supersessions: Array<{ oldFactId: string; newFactId: string }>
): string {
  return [
    `ingest: ${title}`,
    '',
    `source: ${sourceId}`,
    `+facts: ${counts.facts}`,
    `~entities: ${counts.entities.join(', ') || '(none)'}`,
    `~concepts: ${counts.concepts.join(', ') || '(none)'}`,
    `~synthesis: ${counts.synthesis.join(', ') || '(none)'}`,
    `supersedes: ${supersessions.map((s) => s.oldFactId).join(', ') || '(none)'}`
  ].join('\n');
}

export async function runIngest(wiki: Wiki, source: SourceInput): Promise<IngestResult> {
  const raw = await loadRawSource(source);
  const sourceId = resolveSourceId(source, raw);
  await wiki.preloadAllPages();
  const ingested = wiki.readIngested();
  const existing = ingested[sourceId];
  if (existing && existing.hash === raw.hash && !source.force) {
    throw new WikiError(
      'SOURCE_ALREADY_INGESTED',
      `source ${sourceId} already ingested (use --force to re-ingest)`,
      undefined,
      { sourceId }
    );
  }
  const userMessage = buildContext(wiki, raw, sourceId);
  const parsed = await callIngestLLM(wiki, userMessage);
  const { sourcePage, facts, entities, concepts, synthesis } = validateAll(parsed);
  const supersessions = applySupersessions(wiki, parsed.supersessions ?? [], facts);
  const newPages: Page[] = [...facts, ...entities, ...concepts, ...synthesis, sourcePage];
  stageAll(wiki, newPages);
  await updateEmbeddings(wiki, newPages);
  const allPages = await wiki.preloadAllPages();
  wiki.rebuildIndexes(allPages);
  const entry: IngestedEntry = {
    hash: raw.hash,
    ingested: sourcePage.ingested,
    facts_produced: facts.map((f) => f.id)
  };
  const cache = wiki.readIngested();
  cache[sourceId] = entry;
  wiki.writeIngested(cache);
  wiki.setPendingCommitMessage(
    buildCommitMessage(sourcePage.title, sourceId, { facts: facts.length, entities: entities.map((e) => e.id), concepts: concepts.map((c) => c.id), synthesis: synthesis.map((s) => s.id) }, supersessions)
  );
  const commitSha = await wiki.commit();
  return {
    sourceId,
    commitSha,
    factsProduced: facts.map((f) => f.id),
    entitiesTouched: entities.map((e) => e.id),
    conceptsTouched: concepts.map((c) => c.id),
    synthesisTouched: synthesis.map((s) => s.id),
    supersessions,
    warnings: []
  };
}
