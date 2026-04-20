import type { Page, PageType } from '../types/index.ts';

export type Partition = 'facts' | 'entities' | 'concepts' | 'synthesis' | 'sources';

const TYPE_TO_PARTITION: Record<PageType, Partition> = {
  fact: 'facts',
  entity: 'entities',
  concept: 'concepts',
  synthesis: 'synthesis',
  source: 'sources'
};

const PARTITION_HEADERS: Record<Partition, string> = {
  facts: '# Facts',
  entities: '# Entities',
  concepts: '# Concepts',
  synthesis: '# Synthesis',
  sources: '# Sources'
};

interface IndexEntry {
  slug: string;
  path: string;
  title: string;
  summary: string;
  tags: string[];
}

function firstLine(text: string): string {
  const line = text.split(/\r?\n/, 1)[0] ?? '';
  return line.trim();
}

function summarize(page: Page): string {
  switch (page.type) {
    case 'fact':
      return page.claim;
    case 'entity':
    case 'concept':
      return firstLine(page.body) || page.title;
    case 'synthesis':
      return page.scope;
    case 'source':
      return firstLine(page.body) || `${page.format.toUpperCase()} source`;
  }
}

function pagePath(page: Page): string {
  const partition = TYPE_TO_PARTITION[page.type];
  return `${partition}/${page.id}.md`;
}

function toEntry(page: Page): IndexEntry {
  return {
    slug: page.id,
    path: pagePath(page),
    title: page.title,
    summary: summarize(page),
    tags: 'tags' in page ? page.tags : []
  };
}

function renderEntry(e: IndexEntry): string {
  const tagPart = e.tags.length > 0 ? ' ' + e.tags.map((t) => `#${t}`).join(' ') : '';
  const summary = e.summary.replace(/\s+/g, ' ').trim();
  return `- [[${e.path}|${e.title}]] — ${summary}${tagPart}`;
}

export function buildPartitionIndex(partition: Partition, pages: Page[]): string {
  const entries = pages
    .filter((p) => TYPE_TO_PARTITION[p.type] === partition)
    .map(toEntry)
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const header = PARTITION_HEADERS[partition];
  if (entries.length === 0) {
    return `${header}\n\n_No entries._\n`;
  }
  const lines = entries.map(renderEntry).join('\n');
  return `${header}\n\n${lines}\n`;
}

export function buildRootIndex(counts: Record<Partition, number>): string {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const rows: Array<[Partition, string]> = [
    ['facts', 'Facts'],
    ['entities', 'Entities'],
    ['concepts', 'Concepts'],
    ['synthesis', 'Synthesis'],
    ['sources', 'Sources']
  ];
  const list = rows
    .map(([p, label]) => `- [[index/${p}.md|${label}]] — ${counts[p] ?? 0} pages`)
    .join('\n');
  return `# Wiki Index\n\nTotal pages: ${total}\n\n${list}\n`;
}

export function buildAllIndexes(pages: Page[]): Record<string, string> {
  const partitions: Partition[] = [
    'facts',
    'entities',
    'concepts',
    'synthesis',
    'sources'
  ];
  const counts: Record<Partition, number> = {
    facts: 0,
    entities: 0,
    concepts: 0,
    synthesis: 0,
    sources: 0
  };
  for (const page of pages) {
    counts[TYPE_TO_PARTITION[page.type]] += 1;
  }
  const out: Record<string, string> = {};
  for (const part of partitions) {
    out[`index/${part}.md`] = buildPartitionIndex(part, pages);
  }
  out['index/root.md'] = buildRootIndex(counts);
  return out;
}

export function partitionFor(type: PageType): Partition {
  return TYPE_TO_PARTITION[type];
}
