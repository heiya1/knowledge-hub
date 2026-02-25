import { create } from 'zustand';

interface EditorState {
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  setLastSavedAt: (time: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  setDirty: (isDirty) => set({ isDirty }),
  setSaving: (isSaving) => set({ isSaving }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
}));
