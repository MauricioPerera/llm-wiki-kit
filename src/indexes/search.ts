const ENTRY_RE = /^- \[\[([^|\]]+)\|([^\]]+)\]\]\s*—\s*(.*)$/;

export interface IndexHit {
  path: string;
  title: string;
  summary: string;
  tags: string[];
  score: number;
}

function extractTags(summaryWithTags: string): { summary: string; tags: string[] } {
  const tags: string[] = [];
  const parts = summaryWithTags.split(/\s+/);
  const summaryParts: string[] = [];
  for (const part of parts) {
    if (part.startsWith('#') && part.length > 1) {
      tags.push(part.slice(1));
    } else {
      summaryParts.push(part);
    }
  }
  return { summary: summaryParts.join(' ').trim(), tags };
}

function parseEntry(line: string): Omit<IndexHit, 'score'> | null {
  const match = ENTRY_RE.exec(line.trim());
  if (!match) return null;
  const path = match[1]?.trim() ?? '';
  const title = match[2]?.trim() ?? '';
  const rest = match[3] ?? '';
  const { summary, tags } = extractTags(rest);
  return { path, title, summary, tags };
}

function scoreEntry(
  entry: Omit<IndexHit, 'score'>,
  tokens: string[]
): number {
  if (tokens.length === 0) return 0;
  const haystack = (
    entry.title +
    ' ' +
    entry.summary +
    ' ' +
    entry.tags.join(' ')
  ).toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (token.startsWith('#')) {
      const tagMatch = token.slice(1);
      if (entry.tags.some((t) => t.toLowerCase() === tagMatch)) score += 2;
      continue;
    }
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

export function searchIndex(indexContent: string, query: string): IndexHit[] {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return [];

  const hits: IndexHit[] = [];
  for (const line of indexContent.split(/\r?\n/)) {
    const entry = parseEntry(line);
    if (!entry) continue;
    const score = scoreEntry(entry, tokens);
    if (score > 0) hits.push({ ...entry, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits;
}

export function searchIndexes(
  indexes: Record<string, string>,
  query: string,
  limit?: number
): IndexHit[] {
  const all: IndexHit[] = [];
  for (const content of Object.values(indexes)) {
    all.push(...searchIndex(content, query));
  }
  all.sort((a, b) => b.score - a.score);
  return typeof limit === 'number' ? all.slice(0, limit) : all;
}
