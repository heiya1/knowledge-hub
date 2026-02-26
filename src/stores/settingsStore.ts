import { create } from 'zustand';
import type { AiProvider } from '../core/interfaces/IAiService';

export type { AiProvider };
export type ThemeMode = 'auto' | 'light' | 'dark';
export type Language = 'auto' | 'ja' | 'en';

export type SyncInterval = 15 | 30 | 60 | 120;

interface Settings {
  theme: ThemeMode;
  language: Language;
  gitAuthorName: string;
  gitAuthorEmail: string;
  autoSave: boolean;
  fontSize: number;
  gitToken: string;
  autoSync: boolean;
  syncInterval: SyncInterval;
  aiProvider: AiProvider;
  aiApiKey: string;
  ollamaModel: string;
  ollamaUrl: string;
}

interface SettingsState extends Settings {
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: Language) => void;
  setGitAuthor: (name: string, email: string) => void;
  setAutoSave: (autoSave: boolean) => void;
  setFontSize: (fontSize: number) => void;
  setGitToken: (gitToken: string) => void;
  setAutoSync: (autoSync: boolean) => void;
  setSyncInterval: (syncInterval: SyncInterval) => void;
  setAiProvider: (aiProvider: AiProvider) => void;
  setAiApiKey: (aiApiKey: string) => void;
  setOllamaModel: (ollamaModel: string) => void;
  setOllamaUrl: (ollamaUrl: string) => void;
  loadSettings: (settings: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'auto',
  language: 'auto',
  gitAuthorName: '',
  gitAuthorEmail: '',
  autoSave: true,
  fontSize: 16,
  gitToken: '',
  autoSync: true,
  syncInterval: 30,
  aiProvider: 'claude',
  aiApiKey: '',
  ollamaModel: 'llama3.2',
  ollamaUrl: 'http://localhost:11434',
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  setGitAuthor: (name, email) => set({ gitAuthorName: name, gitAuthorEmail: email }),
  setAutoSave: (autoSave) => set({ autoSave }),
  setFontSize: (fontSize) => set({ fontSize }),
  setGitToken: (gitToken) => set({ gitToken }),
  setAutoSync: (autoSync) => set({ autoSync }),
  setSyncInterval: (syncInterval) => set({ syncInterval }),
  setAiProvider: (aiProvider) => set({ aiProvider }),
  setAiApiKey: (aiApiKey) => set({ aiApiKey }),
  setOllamaModel: (ollamaModel) => set({ ollamaModel }),
  setOllamaUrl: (ollamaUrl) => set({ ollamaUrl }),
  loadSettings: (settings) => set(settings),
}));
