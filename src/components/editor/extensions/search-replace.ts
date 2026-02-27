import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/core';

export interface SearchReplaceStorage {
  searchTerm: string;
  replaceWith: string;
  results: { from: number; to: number }[];
  currentIndex: number;
}

const searchReplacePluginKey = new PluginKey('searchReplace');

/** Helper to access the searchReplace storage from the editor instance */
function getStorage(editor: Editor): SearchReplaceStorage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (editor.storage as any).searchReplace as SearchReplaceStorage;
}

function findMatches(doc: ProseMirrorNode, searchTerm: string): { from: number; to: number }[] {
  if (!searchTerm) return [];

  const results: { from: number; to: number }[] = [];
  const searchLower = searchTerm.toLowerCase();

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const textLower = node.text.toLowerCase();
    let index = 0;
    while (index < textLower.length) {
      const found = textLower.indexOf(searchLower, index);
      if (found === -1) break;
      results.push({ from: pos + found, to: pos + found + searchTerm.length });
      index = found + 1;
    }
  });

  return results;
}

function createDecorations(
  doc: ProseMirrorNode,
  results: { from: number; to: number }[],
  currentIndex: number
): DecorationSet {
  const decorations: Decoration[] = [];

  results.forEach((result, i) => {
    const className = i === currentIndex ? 'search-result-current' : 'search-result';
    decorations.push(
      Decoration.inline(result.from, result.to, {
        class: className,
      })
    );
  });

  return DecorationSet.create(doc, decorations);
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearchTerm: (term: string) => ReturnType;
      setReplaceTerm: (term: string) => ReturnType;
      nextSearchResult: () => ReturnType;
      prevSearchResult: () => ReturnType;
      replaceOne: () => ReturnType;
      replaceAll: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

export const SearchReplace = Extension.create<Record<string, never>, SearchReplaceStorage>({
  name: 'searchReplace',

  addStorage() {
    return {
      searchTerm: '',
      replaceWith: '',
      results: [],
      currentIndex: 0,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ editor, dispatch }) => {
          const storage = getStorage(editor);
          storage.searchTerm = term;
          const results = findMatches(editor.state.doc, term);
          storage.results = results;
          if (storage.currentIndex >= results.length) {
            storage.currentIndex = 0;
          }
          if (dispatch) {
            dispatch(editor.state.tr.setMeta(searchReplacePluginKey, { action: 'update' }));
          }
          return true;
        },

      setReplaceTerm:
        (term: string) =>
        ({ editor }) => {
          const storage = getStorage(editor);
          storage.replaceWith = term;
          return true;
        },

      nextSearchResult:
        () =>
        ({ editor, dispatch }) => {
          const storage = getStorage(editor);
          if (storage.results.length === 0) return false;
          storage.currentIndex = (storage.currentIndex + 1) % storage.results.length;
          if (dispatch) {
            const result = storage.results[storage.currentIndex];
            const tr = editor.state.tr.setMeta(searchReplacePluginKey, { action: 'update' });
            tr.setSelection(TextSelection.create(editor.state.doc, result.from, result.to));
            tr.scrollIntoView();
            dispatch(tr);
          }
          return true;
        },

      prevSearchResult:
        () =>
        ({ editor, dispatch }) => {
          const storage = getStorage(editor);
          if (storage.results.length === 0) return false;
          storage.currentIndex = (storage.currentIndex - 1 + storage.results.length) % storage.results.length;
          if (dispatch) {
            const result = storage.results[storage.currentIndex];
            const tr = editor.state.tr.setMeta(searchReplacePluginKey, { action: 'update' });
            tr.setSelection(TextSelection.create(editor.state.doc, result.from, result.to));
            tr.scrollIntoView();
            dispatch(tr);
          }
          return true;
        },

      replaceOne:
        () =>
        ({ editor, dispatch }) => {
          const storage = getStorage(editor);
          if (storage.results.length === 0) return false;
          const result = storage.results[storage.currentIndex];
          if (dispatch) {
            const tr = editor.state.tr;
            tr.insertText(storage.replaceWith, result.from, result.to);
            dispatch(tr);
            // Re-run search after replacement
            requestAnimationFrame(() => {
              editor.commands.setSearchTerm(storage.searchTerm);
            });
          }
          return true;
        },

      replaceAll:
        () =>
        ({ editor, dispatch }) => {
          const storage = getStorage(editor);
          if (storage.results.length === 0) return false;
          if (dispatch) {
            const tr = editor.state.tr;
            // Replace in reverse order to preserve positions
            const reversed = [...storage.results].reverse();
            for (const r of reversed) {
              tr.insertText(storage.replaceWith, r.from, r.to);
            }
            dispatch(tr);
            // Re-search after replacing all
            requestAnimationFrame(() => {
              editor.commands.setSearchTerm(storage.searchTerm);
            });
          }
          return true;
        },

      clearSearch:
        () =>
        ({ editor, dispatch }) => {
          const storage = getStorage(editor);
          storage.searchTerm = '';
          storage.replaceWith = '';
          storage.results = [];
          storage.currentIndex = 0;
          if (dispatch) {
            dispatch(editor.state.tr.setMeta(searchReplacePluginKey, { action: 'clear' }));
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    return [
      new Plugin({
        key: searchReplacePluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldDecorations) {
            const meta = tr.getMeta(searchReplacePluginKey);
            if (meta) {
              const storage = extensionThis.storage as SearchReplaceStorage;
              if (meta.action === 'clear') {
                return DecorationSet.empty;
              }
              return createDecorations(tr.doc, storage.results, storage.currentIndex);
            }
            // If the document changed, re-run search to get fresh positions
            if (tr.docChanged) {
              const storage = extensionThis.storage as SearchReplaceStorage;
              if (storage.searchTerm) {
                const results = findMatches(tr.doc, storage.searchTerm);
                storage.results = results;
                if (storage.currentIndex >= results.length) {
                  storage.currentIndex = 0;
                }
                return createDecorations(tr.doc, results, storage.currentIndex);
              }
              return DecorationSet.empty;
            }
            return oldDecorations;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
