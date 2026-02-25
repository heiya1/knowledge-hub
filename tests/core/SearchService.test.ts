import { describe, it, expect, beforeEach } from 'vitest';
import { SearchService } from '../../src/core/services/SearchService';
import type { DocumentMeta } from '../../src/core/models/Document';

function makeMeta(overrides: Partial<DocumentMeta> & { id: string; title: string }): DocumentMeta {
  return {
    parent: null,
    order: 0,
    tags: [],
    createdAt: '2026-02-25T10:00:00.000Z',
    updatedAt: '2026-02-25T10:00:00.000Z',
    ...overrides,
  };
}

describe('SearchService', () => {
  let service: SearchService;

  const docs: DocumentMeta[] = [
    makeMeta({ id: '1', title: 'Getting Started', tags: ['guide', 'tutorial'] }),
    makeMeta({ id: '2', title: 'API Reference', tags: ['api', 'docs'] }),
    makeMeta({ id: '3', title: 'Architecture Overview', tags: ['design', 'architecture'] }),
    makeMeta({ id: '4', title: 'Deployment Guide', tags: ['guide', 'deploy'] }),
  ];

  beforeEach(() => {
    service = new SearchService();
    service.rebuild(docs);
  });

  it('searches by exact title match', () => {
    const results = service.search('Getting Started');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('1');
    expect(results[0].title).toBe('Getting Started');
  });

  it('searches by partial title (prefix)', () => {
    const results = service.search('Arch');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === '3')).toBe(true);
  });

  it('searches by tag content', () => {
    const results = service.search('deploy');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === '4')).toBe(true);
  });

  it('supports fuzzy search', () => {
    const results = service.search('Geting'); // typo: missing 't'
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === '1')).toBe(true);
  });

  it('returns empty results for empty query', () => {
    const results = service.search('');
    expect(results).toHaveLength(0);
  });

  it('returns empty results for whitespace query', () => {
    const results = service.search('   ');
    expect(results).toHaveLength(0);
  });

  it('returns empty results for non-matching query', () => {
    const results = service.search('zzzznotexisting');
    expect(results).toHaveLength(0);
  });

  it('rebuild replaces all documents', () => {
    const newDocs = [
      makeMeta({ id: '10', title: 'New Document' }),
    ];
    service.rebuild(newDocs);

    const oldResults = service.search('Getting');
    expect(oldResults).toHaveLength(0);

    const newResults = service.search('New Document');
    expect(newResults.length).toBeGreaterThan(0);
    expect(newResults[0].id).toBe('10');
  });

  it('addDocument adds a searchable document', () => {
    const newDoc = makeMeta({ id: '5', title: 'Troubleshooting' });
    service.addDocument(newDoc);

    const results = service.search('Troubleshooting');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('5');
  });

  it('addDocument updates an existing document', () => {
    const updated = makeMeta({ id: '1', title: 'Quick Start Guide' });
    service.addDocument(updated);

    const oldResults = service.search('Getting Started');
    expect(oldResults).toHaveLength(0);

    const newResults = service.search('Quick Start');
    expect(newResults.length).toBeGreaterThan(0);
    expect(newResults[0].id).toBe('1');
  });

  it('removeDocument removes a document from the index', () => {
    service.removeDocument('2');

    const results = service.search('API Reference');
    expect(results).toHaveLength(0);
  });

  it('removeDocument does not throw for non-existent id', () => {
    expect(() => service.removeDocument('nonexistent')).not.toThrow();
  });

  it('results include score and match info', () => {
    const results = service.search('guide');
    expect(results.length).toBeGreaterThan(0);
    expect(typeof results[0].score).toBe('number');
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].match).toBeDefined();
  });
});
