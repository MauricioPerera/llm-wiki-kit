import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readSource } from '../../../src/sources/readers.ts';
import { WikiError } from '../../../src/lib/errors.ts';

const fixturesDir = resolve(__dirname, '../../fixtures/sources');

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('sources/readers', () => {
  it('markdown reader strips existing frontmatter', async () => {
    const bytes = encode(
      '---\ntitle: existing\n---\n\n# Hello\n\nBody here.\n'
    );
    const src = await readSource({ bytes, origin: 'sample.md' });
    expect(src.format).toBe('md');
    expect(src.content.startsWith('# Hello')).toBe(true);
    expect(src.content).not.toContain('title: existing');
    expect(src.title).toBe('Hello');
  });

  it('txt reader returns content unchanged', async () => {
    const raw = 'Line 1\nLine 2\n';
    const src = await readSource({ bytes: encode(raw), origin: 'note.txt' });
    expect(src.format).toBe('txt');
    expect(src.content).toBe(raw);
    expect(src.title).toBe('Line 1');
  });

  it('html reader extracts main article, drops nav and ads', async () => {
    const bytes = await readFile(resolve(fixturesDir, 'basic.html'));
    const src = await readSource({
      bytes: new Uint8Array(bytes),
      origin: 'basic.html'
    });
    expect(src.format).toBe('html');
    expect(src.content).toContain('Gemma 3 4B');
    expect(src.content).not.toContain('Sponsored');
    expect(src.title).toContain('Gemma');
  });

  it('unsupported extension throws INVALID_SOURCE', async () => {
    await expect(
      readSource({ bytes: encode('x'), origin: 'data.xyz' })
    ).rejects.toBeInstanceOf(WikiError);
  });

  it('explicit format override works', async () => {
    const src = await readSource({
      bytes: encode('plain content'),
      origin: 'noext',
      format: 'txt'
    });
    expect(src.format).toBe('txt');
  });

  it('sha256 hash is stable for identical bytes', async () => {
    const bytes = encode('stable content');
    const a = await readSource({ bytes, origin: 'a.txt' });
    const b = await readSource({ bytes, origin: 'b.txt' });
    expect(a.hash).toBe(b.hash);
  });

  it('simple.md fixture produces a titled source', async () => {
    const bytes = await readFile(resolve(fixturesDir, 'simple.md'));
    const src = await readSource({
      bytes: new Uint8Array(bytes),
      origin: 'simple.md'
    });
    expect(src.title).toBe('Helix Robotics launches Tessera-1');
    expect(src.sizeBytes).toBeGreaterThan(0);
  });
});
