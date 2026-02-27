import { create } from 'zustand';
import type { DocumentMeta, Document } from '../core/models/Document';
import type { TreeNode } from '../core/models/TreeNode';

interface DocumentState {
  documents: DocumentMeta[];
  tree: TreeNode[];
  currentDocumentId: string | null;
  currentDocument: Document | null;
  backlinkIndex: Map<string, string[]>;
  setDocuments: (docs: DocumentMeta[]) => void;
  setTree: (tree: TreeNode[]) => void;
  setCurrentDocumentId: (id: string | null) => void;
  setCurrentDocument: (doc: Document | null) => void;
  setBacklinkIndex: (index: Map<string, string[]>) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  tree: [],
  currentDocumentId: null,
  currentDocument: null,
  backlinkIndex: new Map(),
  setDocuments: (documents) => set({ documents }),
  setTree: (tree) => set({ tree }),
  setCurrentDocumentId: (id) => set({ currentDocumentId: id }),
  setCurrentDocument: (doc) => set({ currentDocument: doc }),
  setBacklinkIndex: (backlinkIndex) => set({ backlinkIndex }),
}));
