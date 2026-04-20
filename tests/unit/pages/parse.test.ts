import { describe, it, expect } from 'vitest';
import { parsePage } from '../../../src/pages/parse.ts';
import { WikiError } from '../../../src/lib/errors.ts';

const validFactMd = `---
type: fact
id: helix-launches-tessera-abcd1234
title: Helix launches Tessera-1
claim: Helix Robotics launched Tessera-1 on April 2, 2026.
sources:
  - helix-press-release-2026-04
ingested: 2026-04-20T09:00:00Z
supersedes: null
superseded-by: null
confidence: high
tags:
  - robotics
---

Body text.
`;

describe('pages/parse', () => {
  it('parses a fact page', () => {
    const page = parsePage(validFactMd);
    expect(page.type).toBe('fact');
    if (page.type === 'fact') {
      expect(page.id).toBe('helix-launches-tessera-abcd1234');
      expect(page.sources).toEqual(['helix-press-release-2026-04']);
      expect(page.supersededBy).toBeNull();
      expect(page.body).toBe('Body text.');
    }
  });

  it('throws SCHEMA_VIOLATION on unknown type', () => {
    const md = validFactMd.replace('type: fact', 'type: monster');
    try {
      parsePage(md);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(WikiError);
      expect((e as WikiError).code).toBe('SCHEMA_VIOLATION');
    }
  });

  it('throws on missing frontmatter block', () => {
    expect(() => parsePage('no frontmatter here')).toThrow(WikiError);
  });

  it('throws when frontmatter is not a mapping', () => {
    expect(() => parsePage('---\n- item1\n- item2\n---\nbody\n')).toThrow(WikiError);
  });

  it('handles CRLF line endings', () => {
    const crlf = validFactMd.replace(/\n/g, '\r\n');
    const page = parsePage(crlf);
    expect(page.type).toBe('fact');
  });

  it('coerces missing supersedes/supersededBy to null', () => {
    const md = `---
type: fact
id: x-abcd1234
title: X
claim: X claim.
sources:
  - src-1
ingested: 2026-04-20T09:00:00Z
confidence: medium
---

body
`;
    const page = parsePage(md);
    if (page.type === 'fact') {
      expect(page.supersedes).toBeNull();
      expect(page.supersededBy).toBeNull();
    }
  });
});
