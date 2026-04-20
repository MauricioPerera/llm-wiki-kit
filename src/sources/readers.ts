import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { WikiError } from '../lib/errors.ts';
import type { SourceFormat } from '../types/index.ts';

export interface RawSource {
  content: string;
  format: SourceFormat;
  title: string;
  origin: string;
  sizeBytes: number;
  hash: string;
}

export interface ReaderInput {
  bytes: Uint8Array;
  origin: string;
  format?: SourceFormat;
}

const FM_STRIP_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

function detectFormatFromPath(origin: string): SourceFormat {
  const lower = origin.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md';
  if (lower.endsWith('.txt')) return 'txt';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  throw new WikiError(
    'INVALID_SOURCE',
    `unsupported source extension: ${origin}`,
    undefined,
    { origin }
  );
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto
    ?.subtle;
  if (!subtle) {
    throw new WikiError(
      'INVALID_SOURCE',
      'SubtleCrypto unavailable in this runtime'
    );
  }
  const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function firstHeading(md: string): string | null {
  const match = /^#\s+(.+)$/m.exec(md);
  return match?.[1]?.trim() ?? null;
}

function readMarkdown(raw: string): { content: string; title: string } {
  const stripped = raw.replace(FM_STRIP_RE, '');
  const title = firstHeading(stripped) ?? 'Untitled markdown source';
  return { content: stripped.trim() + '\n', title };
}

function readText(raw: string): { content: string; title: string } {
  const firstLine = raw.split(/\r?\n/, 1)[0]?.trim() ?? '';
  const title = firstLine.length > 0 ? firstLine.slice(0, 80) : 'Untitled text source';
  return { content: raw, title };
}

function readHtml(raw: string): { content: string; title: string } {
  const { document } = parseHTML(raw);
  const docForReadability = document as unknown as Document;
  const reader = new Readability(docForReadability);
  const article = reader.parse();
  if (!article || !article.textContent) {
    throw new WikiError(
      'INVALID_SOURCE',
      'readability extraction returned no content'
    );
  }
  const title =
    article.title?.trim() ||
    document.querySelector('title')?.textContent?.trim() ||
    'Untitled HTML source';
  return { content: article.textContent.trim() + '\n', title };
}

export async function readSource(input: ReaderInput): Promise<RawSource> {
  const format = input.format ?? detectFormatFromPath(input.origin);
  const raw = decodeUtf8(input.bytes);
  const hash = await sha256Hex(input.bytes);
  const sizeBytes = input.bytes.byteLength;

  let extracted: { content: string; title: string };
  switch (format) {
    case 'md':
      extracted = readMarkdown(raw);
      break;
    case 'txt':
      extracted = readText(raw);
      break;
    case 'html':
      extracted = readHtml(raw);
      break;
  }

  return {
    content: extracted.content,
    format,
    title: extracted.title,
    origin: input.origin,
    sizeBytes,
    hash
  };
}
