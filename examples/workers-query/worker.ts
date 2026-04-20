import { createWiki } from '../../src/core/wiki.ts';
import type { FileAdapter, LLMAdapter, LLMRequest, LLMResponse } from '../../src/types/index.ts';
import seedRaw from './seed.json' with { type: 'json' };

interface SeedShape { json: Record<string, unknown>; bin: Record<string, string> }

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function createBundleAdapter(seed: SeedShape): FileAdapter {
  const json = new Map<string, unknown>(Object.entries(seed.json));
  const bin = new Map<string, Uint8Array>();
  for (const [k, b64] of Object.entries(seed.bin)) bin.set(k, base64ToBytes(b64));
  return {
    readJson<T = unknown>(f: string): T | null {
      return json.has(f) ? (json.get(f) as T) : null;
    },
    writeJson(f, d) { json.set(f, d); bin.delete(f); },
    readBin(f) {
      const v = bin.get(f);
      return v ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) as ArrayBuffer : null;
    },
    readBinShared(f) { return bin.get(f) ?? null; },
    writeBin(f, b) {
      const bytes = b instanceof Uint8Array ? new Uint8Array(b) : new Uint8Array(b);
      bin.set(f, bytes);
      json.delete(f);
    },
    delete(f) { json.delete(f); bin.delete(f); },
    async preload() {},
    async persist() {}
  };
}

interface Env {
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<{ response?: string }> };
}

class EchoLLM implements LLMAdapter {
  readonly name = 'echo-llm';
  async complete(req: LLMRequest): Promise<LLMResponse> {
    const last = req.messages[req.messages.length - 1]?.content ?? '';
    const hint = last.split('Question: ')[1]?.split('\n')[0] ?? '(no question)';
    return { text: `(echo) Received question: ${hint}. This Worker renders citations but uses an echo LLM — bind Workers AI or another provider to get a real answer.` };
  }
}

class WorkersAILLM implements LLMAdapter {
  readonly name = 'workers-ai';
  constructor(private ai: NonNullable<Env['AI']>, private model = '@cf/meta/llama-3.1-8b-instruct') {}
  async complete(req: LLMRequest): Promise<LLMResponse> {
    const messages = [{ role: 'system', content: req.system }, ...req.messages];
    const out = await this.ai.run(this.model, { messages, max_tokens: req.maxTokens ?? 512 });
    return { text: out.response ?? '' };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response('POST /query { "text": "..." } — llm-wiki-kit Workers query-only target\n', { headers: { 'content-type': 'text/plain' } });
    }
    if (url.pathname !== '/query' || request.method !== 'POST') {
      return new Response('not found', { status: 404 });
    }
    let body: { text?: string; format?: 'markdown' | 'json'; topK?: number };
    try {
      body = await request.json();
    } catch {
      return new Response('invalid JSON body', { status: 400 });
    }
    if (!body.text) return new Response('missing text', { status: 400 });
    const adapter = createBundleAdapter(seedRaw as unknown as SeedShape);
    const llm = env.AI ? new WorkersAILLM(env.AI) : new EchoLLM();
    const wiki = await createWiki({ path: '/bundle', llmAdapter: llm, storageAdapter: adapter });
    const result = await wiki.query(body.text, {
      ...(body.format ? { format: body.format } : {}),
      ...(body.topK ? { topK: body.topK } : {})
    });
    return Response.json(result);
  }
};
