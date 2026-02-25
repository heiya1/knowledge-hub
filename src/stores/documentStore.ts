import { create } from 'zustand';
import type { DocumentMeta, Document } from '../core/models/Document';
import type { TreeNode } from '../core/models/TreeNode';

interface DocumentState {
  documents: DocumentMeta[];
  tree: TreeNode[];
  currentDocumentId: string | null;
  currentDocument: Document | null;
  loading: boolean;
  setDocuments: (docs: DocumentMeta[]) => void;
  setTree: (tree: TreeNode[]) => void;
  setCurrentDocumentId: (id: string | null) => void;
  setCurrentDocument: (doc: Document | null) => void;
  setLoading: (loading: boolean) => void;
  updateDocumentMeta: (id: string, meta: Partial<DocumentMeta>) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  tree: [],
  currentDocumentId: null,
  currentDocument: null,
  loading: false,
  setDocuments: (documents) => set({ documents }),
  setTree: (tree) => set({ tree }),
  setCurrentDocumentId: (id) => set({ currentDocumentId: id }),
  setCurrentDocument: (doc) => set({ currentDocument: doc }),
  setLoading: (loading) => set({ loading }),
  updateDocumentMeta: (id, meta) => set((state) => ({
    documents: state.documents.map((d) =>
      d.id === id ? { ...d, ...meta } : d
    ),
  })),
}));
