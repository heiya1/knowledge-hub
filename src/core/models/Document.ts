export interface DocumentMeta {
  id: string;
  title: string;
  parent: string | null;
  tags: string[];
}

export interface Document extends DocumentMeta {
  body: string;
  /** Whether the file originally had frontmatter. Files without it are saved as plain markdown. */
  hasFrontmatter?: boolean;
  /** Preserve unknown frontmatter fields from the original file */
  _rawMeta?: Record<string, unknown>;
}
