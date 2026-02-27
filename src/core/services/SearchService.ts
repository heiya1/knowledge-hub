import MiniSearch from 'minisearch';
import type { DocumentMeta } from '../models/Document';

export interface SearchResult {
  id: string;
  title: string;
  score: number;
  match: Record<string, string[]>;
}

/** Internal indexed document type where tags are joined into a single string for full-text search */
interface IndexedDocument {
  id: string;
  title: string;
  tags: string;
}

export class SearchService {
  private index: MiniSearch<IndexedDocument>;

  constructor() {
    this.index = new MiniSearch<IndexedDocument>({
      fields: ['title', 'tags'],
      storeFields: ['title'],
      searchOptions: {
        boost: { title: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
  }

  rebuild(documents: DocumentMeta[]): void {
    this.index.removeAll();
    this.index.addAll(
      documents.map((d) => ({
        id: d.id,
        title: d.title,
        tags: d.tags.join(' '),
      }))
    );
  }

  search(query: string): SearchResult[] {
    if (!query.trim()) return [];
    const results = this.index.search(query);
    return results.map((r) => ({
      id: r.id as string,
      title: (r as Record<string, unknown>).title as string ?? '',
      score: r.score,
      match: r.match,
    }));
  }

}
