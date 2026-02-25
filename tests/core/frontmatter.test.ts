import { describe, it, expect } from 'vitest';
import { parseFrontmatter, stringifyFrontmatter } from '../../src/core/utils/frontmatter';

describe('parseFrontmatter', () => {
  it('parses valid frontmatter', () => {
    const raw = `---
title: "Test Page"
parent: "abc123"
order: 2
tags: ["draft"]
createdAt: "2026-02-25T10:00:00.000Z"
updatedAt: "2026-02-25T12:00:00.000Z"
---
Hello world`;

    const doc = parseFrontmatter(raw);
    expect(doc.title).toBe('Test Page');
    expect(doc.parent).toBe('abc123');
    expect(doc.order).toBe(2);
    expect(doc.tags).toEqual(['draft']);
    expect(doc.body).toBe('Hello world');
  });

  it('handles missing optional fields', () => {
    const raw = `---
title: "Minimal"
---
Body text`;

    const doc = parseFrontmatter(raw);
    expect(doc.title).toBe('Minimal');
    expect(doc.parent).toBeNull();
    expect(doc.order).toBe(0);
    expect(doc.tags).toEqual([]);
    expect(doc.body).toBe('Body text');
  });

  it('throws on invalid format', () => {
    expect(() => parseFrontmatter('no frontmatter here')).toThrow();
  });
});

describe('stringifyFrontmatter', () => {
  it('round-trips correctly', () => {
    const doc = {
      id: 'test-id',
      title: 'Round Trip',
      parent: null,
      order: 0,
      tags: ['test'],
      createdAt: '2026-02-25T10:00:00.000Z',
      updatedAt: '2026-02-25T12:00:00.000Z',
      body: '# Hello\n\nWorld',
    };

    const str = stringifyFrontmatter(doc);
    const parsed = parseFrontmatter(str);
    expect(parsed.title).toBe('Round Trip');
    expect(parsed.parent).toBeNull();
    expect(parsed.tags).toEqual(['test']);
    expect(parsed.body).toBe('# Hello\n\nWorld');
  });
});
