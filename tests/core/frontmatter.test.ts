import { describe, it, expect } from 'vitest';
import { parseFrontmatter, stringifyFrontmatter } from '../../src/core/utils/frontmatter';

describe('parseFrontmatter', () => {
  it('parses frontmatter tags', () => {
    const raw = `---
tags: ["draft", "design"]
---
Hello world`;

    const doc = parseFrontmatter(raw);
    expect(doc.tags).toEqual(['draft', 'design']);
    expect(doc.body).toBe('Hello world');
    expect(doc.title).toBe(''); // title derived from filename, not frontmatter
  });

  it('handles empty frontmatter (no tags)', () => {
    const raw = `---
title: "Legacy Title"
---
Body text`;

    const doc = parseFrontmatter(raw);
    // title from frontmatter is ignored; derived from filename externally
    expect(doc.title).toBe('');
    expect(doc.tags).toEqual([]);
    expect(doc.body).toBe('Body text');
  });

  it('handles content without frontmatter', () => {
    const doc = parseFrontmatter('no frontmatter here');
    expect(doc.title).toBe('');
    expect(doc.parent).toBeNull();
    expect(doc.body).toBe('no frontmatter here');
    expect(doc.hasFrontmatter).toBe(false);
  });

  it('preserves all existing fields on stringify', () => {
    const raw = `---
title: "Legacy"
parent: "old-parent"
order: 1
tags: ["important"]
createdAt: "2026-01-01T00:00:00.000Z"
updatedAt: "2026-01-01T00:00:00.000Z"
---
content`;

    const doc = parseFrontmatter(raw);
    const str = stringifyFrontmatter(doc);
    // All original fields preserved as-is
    expect(str).toContain('title:');
    expect(str).toContain('parent:');
    expect(str).toContain('order:');
    expect(str).toContain('tags:');
    expect(str).toContain('important');
  });
});

describe('stringifyFrontmatter', () => {
  it('outputs pure markdown when no tags', () => {
    const doc = {
      id: 'test',
      title: 'Test',
      parent: null,
      tags: [],
      body: '# Hello\n\nWorld',
    };

    const str = stringifyFrontmatter(doc);
    // No frontmatter block at all
    expect(str).toBe('# Hello\n\nWorld');
    expect(str).not.toContain('---');
  });

  it('writes frontmatter only for tags', () => {
    const doc = {
      id: 'test',
      title: 'Test',
      parent: null,
      tags: ['draft'],
      body: '# Hello',
    };

    const str = stringifyFrontmatter(doc);
    expect(str).toContain('---');
    expect(str).toContain('tags:');
    expect(str).toContain('draft');
    expect(str).not.toContain('title:');
    expect(str).toContain('# Hello');
  });

  it('round-trips tags correctly', () => {
    const doc = {
      id: 'test',
      title: 'Test',
      parent: null,
      tags: ['test', 'important'],
      body: '# Hello\n\nWorld',
    };

    const str = stringifyFrontmatter(doc);
    const parsed = parseFrontmatter(str);
    expect(parsed.tags).toEqual(['test', 'important']);
    expect(parsed.body).toBe('# Hello\n\nWorld');
  });

  it('preserves all existing fields and updates tags', () => {
    const raw = `---
author: "John"
category: "docs"
tags: ["draft"]
---
content`;

    const doc = parseFrontmatter(raw);
    doc.tags = ['draft', 'review'];
    const str = stringifyFrontmatter(doc);
    expect(str).toContain('author: John');
    expect(str).toContain('category: docs');
    expect(str).toContain('review');
  });

  it('preserves all fields even without tags', () => {
    const raw = `---
author: "Jane"
title: "Old"
---
content`;

    const doc = parseFrontmatter(raw);
    const str = stringifyFrontmatter(doc);
    expect(str).toContain('---');
    expect(str).toContain('author: Jane');
    expect(str).toContain('title: Old');
  });
});
