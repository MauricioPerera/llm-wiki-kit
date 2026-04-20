import { describe, it, expect } from 'vitest';
import { initializeWiki, createWiki } from '../../src/core/wiki.ts';
import { WikiError } from '../../src/lib/errors.ts';
import { createMemoryAdapter, FakeLLMAdapter, ingestResponse } from './helpers.ts';

const helixResponse = ingestResponse({
  sourceId: 'helix-press-2026-04',
  title: 'Helix launches Tessera-1',
  facts: [
    { id: 'tessera-launch-abcd1234', title: 'Tessera-1 launched', claim: 'Helix Robotics launched Tessera-1 on April 2, 2026.' },
    { id: 'lattice-nav-speed-efgh5678', title: 'Lattice-Nav 38% faster', claim: 'Helix claims Lattice-Nav cuts pick-and-place latency by 38%.' }
  ],
  entities: [{ id: 'helix-robotics', title: 'Helix Robotics', kind: 'org', body: 'Barcelona-based robotics startup.' }],
  concepts: [{ id: 'lattice-nav', title: 'Lattice-Nav', body: 'Navigation framework.' }]
});

async function seededWiki(responses: string[]) {
  const adapter = createMemoryAdapter();
  await initializeWiki(adapter);
  const llm = new FakeLLMAdapter(responses);
  const wiki = await createWiki({ path: '/tmp/w', llmAdapter: llm, storageAdapter: adapter });
  return { wiki, adapter, llm };
}

describe('integration/ingest', () => {
  it('produces fact + entity + concept pages and updates indexes', async () => {
    const { wiki, adapter } = await seededWiki([helixResponse]);
    const result = await wiki.ingest({
      kind: 'text',
      content: '# Helix\n\nLaunched Tessera-1.\n',
      format: 'md',
      sourceId: 'helix-press-2026-04'
    });
    expect(result.factsProduced).toHaveLength(2);
    expect(result.entitiesTouched).toContain('helix-robotics');
    expect(result.conceptsTouched).toContain('lattice-nav');
    expect(adapter.readBinShared?.('facts/tessera-launch-abcd1234.md')).toBeTruthy();
    expect(adapter.readBinShared?.('entities/helix-robotics.md')).toBeTruthy();
    expect(adapter.readBinShared?.('index/facts.md')).toBeTruthy();
    const manifest = adapter.readJson<{ pages: Record<string, unknown> }>('.wiki/manifest.json');
    expect(Object.keys(manifest!.pages)).toHaveLength(5);
  });

  it('pending commit message follows the §5.2 format', async () => {
    const { wiki } = await seededWiki([helixResponse]);
    await wiki.ingest({ kind: 'text', content: 'x', format: 'md', sourceId: 'helix-press-2026-04' });
    const msg = wiki.consumePendingCommitMessage();
    expect(msg).toMatch(/^ingest: Helix launches Tessera-1/);
    expect(msg).toContain('source: helix-press-2026-04');
    expect(msg).toContain('+facts: 2');
    expect(msg).toContain('~entities: helix-robotics');
  });

  it('re-ingesting the same source without --force fails with SOURCE_ALREADY_INGESTED', async () => {
    const { wiki, llm } = await seededWiki([helixResponse, helixResponse]);
    await wiki.ingest({ kind: 'text', content: 'x', format: 'md', sourceId: 'helix-press-2026-04' });
    try {
      await wiki.ingest({ kind: 'text', content: 'x', format: 'md', sourceId: 'helix-press-2026-04' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(WikiError);
      expect((e as WikiError).code).toBe('SOURCE_ALREADY_INGESTED');
    }
    expect(llm.calls).toHaveLength(1);
  });

  it('re-ingesting with force creates a second pass', async () => {
    const { wiki, llm } = await seededWiki([helixResponse, helixResponse]);
    await wiki.ingest({ kind: 'text', content: 'x', format: 'md', sourceId: 'helix-press-2026-04' });
    await wiki.ingest({ kind: 'text', content: 'x', format: 'md', sourceId: 'helix-press-2026-04', force: true });
    expect(llm.calls).toHaveLength(2);
  });

  it('mid-pipeline LLM failure leaves the wiki empty', async () => {
    const adapter = createMemoryAdapter();
    await initializeWiki(adapter);
    const llm = new FakeLLMAdapter();
    const wiki = await createWiki({ path: '/tmp/w', llmAdapter: llm, storageAdapter: adapter });
    await expect(
      wiki.ingest({ kind: 'text', content: 'x', format: 'md', sourceId: 's1' })
    ).rejects.toThrow();
    const manifest = adapter.readJson<{ pages: Record<string, unknown> }>('.wiki/manifest.json');
    expect(manifest?.pages).toEqual({});
  });
});
