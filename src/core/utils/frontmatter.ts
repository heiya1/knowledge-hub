import YAML from 'yaml';
import type { Document } from '../models/Document';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontmatter(raw: string): Document {
  const match = raw.match(FRONTMATTER_REGEX);
  if (!match) {
    return {
      id: '',
      title: '',
      parent: null,
      tags: [],
      body: raw,
      hasFrontmatter: false,
    };
  }
  const rawMeta = (YAML.parse(match[1]) ?? {}) as Record<string, unknown>;
  const body = match[2];
  return {
    id: '',
    title: '',
    parent: null,
    tags: (rawMeta.tags as string[]) ?? [],
    body,
    hasFrontmatter: true,
    _rawMeta: rawMeta,
  };
}

export function stringifyFrontmatter(doc: Document): string {
  const base = doc._rawMeta ? { ...doc._rawMeta } : {};

  // Sync tags: doc.tags is the source of truth for tags in the app
  const tags = doc.tags?.filter(t => !t.startsWith('__')) ?? [];
  if (tags.length > 0) {
    base.tags = tags;
  } else {
    delete base.tags;
  }

  if (Object.keys(base).length === 0) {
    return doc.body;
  }

  const yamlStr = YAML.stringify(base, { lineWidth: 0 }).trim();
  return `---\n${yamlStr}\n---\n${doc.body}`;
}
