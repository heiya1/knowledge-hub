import YAML from 'yaml';
import type { DocumentMeta, Document } from '../models/Document';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontmatter(raw: string): Document {
  const match = raw.match(FRONTMATTER_REGEX);
  if (!match) {
    throw new Error('Invalid frontmatter format');
  }
  const meta = YAML.parse(match[1]) as Omit<DocumentMeta, 'id'>;
  const body = match[2];
  return {
    id: '', // id is determined by filename, set externally
    title: meta.title ?? 'Untitled',
    parent: meta.parent ?? null,
    order: meta.order ?? 0,
    tags: meta.tags ?? [],
    createdAt: meta.createdAt ?? new Date().toISOString(),
    updatedAt: meta.updatedAt ?? new Date().toISOString(),
    body,
  };
}

export function stringifyFrontmatter(doc: Document): string {
  const { id: _id, body, ...meta } = doc;
  const yamlStr = YAML.stringify(meta, { lineWidth: 0 }).trim();
  return `---\n${yamlStr}\n---\n${body}`;
}
