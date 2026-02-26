import { create } from 'zustand';
import { generateId } from '../core/utils/id';

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface PendingAiAction {
  type: 'summarize' | 'translate' | 'rewrite' | 'explain';
  text: string;
}

interface AiState {
  messages: AiChatMessage[];
  isGenerating: boolean;
  panelOpen: boolean;
  abortController: AbortController | null;
  pendingAction: PendingAiAction | null;
  addMessage: (msg: Omit<AiChatMessage, 'id' | 'timestamp'>) => void;
  updateLastMessage: (content: string) => void;
  appendToLastMessage: (chunk: string) => void;
  setGenerating: (v: boolean) => void;
  setPanelOpen: (v: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  clearMessages: () => void;
  setPendingAction: (action: PendingAiAction | null) => void;
}

export const useAiStore = create<AiState>((set) => ({
  messages: [],
  isGenerating: false,
  panelOpen: false,
  abortController: null,
  pendingAction: null,

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: generateId(),
          timestamp: new Date().toISOString(),
        },
      ],
    })),

  updateLastMessage: (content) =>
    set((state) => {
      const msgs = [...state.messages];
      if (msgs.length > 0) {
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
      }
      return { messages: msgs };
    }),

  appendToLastMessage: (chunk) =>
    set((state) => {
      const msgs = [...state.messages];
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
      }
      return { messages: msgs };
    }),

  setGenerating: (isGenerating) => set({ isGenerating }),

  setPanelOpen: (panelOpen) => set({ panelOpen }),

  setAbortController: (abortController) => set({ abortController }),

  clearMessages: () => set({ messages: [] }),

  setPendingAction: (pendingAction) => set({ pendingAction }),
}));
