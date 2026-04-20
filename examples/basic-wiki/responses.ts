import type { LLMAdapter, LLMRequest, LLMResponse } from '../../src/types/index.ts';

const tesseraResponse = JSON.stringify({
  source_page: {
    type: 'source',
    id: 'helix-tessera-launch',
    title: 'Helix launches Tessera-1',
    origin: 'examples/basic-wiki/sources/tessera.md',
    ingested: '2026-04-20T10:00:00Z',
    format: 'md',
    sizeBytes: 600,
    hash: 'ex-1',
    producedFacts: ['tessera-launch-11111111', 'lattice-nav-speed-22222222'],
    touchedEntities: ['helix-robotics'],
    touchedConcepts: ['lattice-nav'],
    touchedSynthesis: [],
    body: ''
  },
  facts: [
    { type: 'fact', id: 'tessera-launch-11111111', title: 'Tessera-1 launched', claim: 'Helix Robotics launched Tessera-1 on April 2, 2026.', sources: ['helix-tessera-launch'], ingested: '2026-04-20T10:00:00Z', supersedes: null, supersededBy: null, confidence: 'high', tags: ['robotics'], body: '' },
    { type: 'fact', id: 'lattice-nav-speed-22222222', title: 'Lattice-Nav cuts latency 38%', claim: 'Helix claims Lattice-Nav cuts pick-and-place latency by 38%.', sources: ['helix-tessera-launch'], ingested: '2026-04-20T10:00:00Z', supersedes: null, supersededBy: null, confidence: 'medium', tags: ['robotics'], body: '' }
  ],
  entity_updates: [
    { type: 'entity', id: 'helix-robotics', title: 'Helix Robotics', aliases: [], kind: 'org', relatedFacts: ['tessera-launch-11111111'], relatedEntities: [], relatedConcepts: ['lattice-nav'], lastUpdated: '2026-04-20T10:00:00Z', tags: ['robotics'], body: 'Barcelona-based autonomous robotics startup.' }
  ],
  concept_updates: [
    { type: 'concept', id: 'lattice-nav', title: 'Lattice-Nav', aliases: [], relatedFacts: ['lattice-nav-speed-22222222'], relatedEntities: ['helix-robotics'], relatedConcepts: [], lastUpdated: '2026-04-20T10:00:00Z', tags: ['robotics'], body: 'Navigation framework blending occupancy maps with ephemeral object memory.' }
  ],
  synthesis_updates: [],
  supersessions: []
});

const a2eResponse = JSON.stringify({
  source_page: {
    type: 'source', id: 'a2e-apr-2026', title: 'A2E leaderboard April 2026', origin: 'examples/basic-wiki/sources/a2e.md',
    ingested: '2026-04-20T10:00:00Z', format: 'md', sizeBytes: 300, hash: 'ex-2',
    producedFacts: ['a2e-llama-86-33333333'], touchedEntities: [], touchedConcepts: ['a2e-benchmark'], touchedSynthesis: [], body: ''
  },
  facts: [
    { type: 'fact', id: 'a2e-llama-86-33333333', title: 'Llama 3.2 1B scores 86% on A2E', claim: 'Llama 3.2 1B scored 86% on A2E April 2026 with three guard rails.', sources: ['a2e-apr-2026'], ingested: '2026-04-20T10:00:00Z', supersedes: null, supersededBy: null, confidence: 'high', tags: ['a2e', 'llm'], body: '' }
  ],
  entity_updates: [],
  concept_updates: [
    { type: 'concept', id: 'a2e-benchmark', title: 'A2E benchmark', aliases: [], relatedFacts: ['a2e-llama-86-33333333'], relatedEntities: [], relatedConcepts: [], lastUpdated: '2026-04-20T10:00:00Z', tags: ['a2e'], body: 'Benchmark measuring deploy-readiness of small LLMs on agentic tasks.' }
  ],
  synthesis_updates: [], supersessions: []
});

const gemmaResponse = JSON.stringify({
  source_page: {
    type: 'source', id: 'gemma-3-4b-workers-ai', title: 'Workers AI adds Gemma 3 4B', origin: 'examples/basic-wiki/sources/gemma.md',
    ingested: '2026-04-20T10:00:00Z', format: 'md', sizeBytes: 280, hash: 'ex-3',
    producedFacts: ['gemma-3-on-cf-44444444'], touchedEntities: ['cloudflare'], touchedConcepts: [], touchedSynthesis: [], body: ''
  },
  facts: [
    { type: 'fact', id: 'gemma-3-on-cf-44444444', title: 'Gemma 3 4B on Workers AI', claim: 'Cloudflare enabled Gemma 3 4B on Workers AI on 2026-04-10.', sources: ['gemma-3-4b-workers-ai'], ingested: '2026-04-20T10:00:00Z', supersedes: null, supersededBy: null, confidence: 'high', tags: ['cloudflare', 'llm'], body: '' }
  ],
  entity_updates: [
    { type: 'entity', id: 'cloudflare', title: 'Cloudflare', aliases: [], kind: 'org', relatedFacts: ['gemma-3-on-cf-44444444'], relatedEntities: [], relatedConcepts: [], lastUpdated: '2026-04-20T10:00:00Z', tags: ['cloudflare'], body: 'Edge platform operator hosting Workers AI.' }
  ],
  concept_updates: [], synthesis_updates: [], supersessions: []
});

const queryAnswer = 'Helix Robotics launched Tessera-1 on April 2, 2026 [^1]. Lattice-Nav, the navigation framework behind Tessera-1, is claimed to cut pick-and-place latency by 38% [^2].\n\n[^1]: facts/tessera-launch-11111111.md\n[^2]: facts/lattice-nav-speed-22222222.md';

export class StubLLM implements LLMAdapter {
  readonly name = 'stub-llm';
  private readonly queue = [tesseraResponse, a2eResponse, gemmaResponse, queryAnswer];
  async complete(_req: LLMRequest): Promise<LLMResponse> {
    const next = this.queue.shift();
    if (!next) throw new Error('stub LLM queue exhausted');
    return { text: next };
  }
}
