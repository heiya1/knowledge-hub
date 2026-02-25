import { create } from 'zustand';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type Language = 'auto' | 'ja' | 'en';

interface Settings {
  theme: ThemeMode;
  language: Language;
  gitAuthorName: string;
  gitAuthorEmail: string;
  autoSave: boolean;
  fontSize: number;
}

interface SettingsState extends Settings {
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: Language) => void;
  setGitAuthor: (name: string, email: string) => void;
  setAutoSave: (autoSave: boolean) => void;
  setFontSize: (fontSize: number) => void;
  loadSettings: (settings: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'auto',
  language: 'auto',
  gitAuthorName: '',
  gitAuthorEmail: '',
  autoSave: true,
  fontSize: 16,
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  setGitAuthor: (name, email) => set({ gitAuthorName: name, gitAuthorEmail: email }),
  setAutoSave: (autoSave) => set({ autoSave }),
  setFontSize: (fontSize) => set({ fontSize }),
  loadSettings: (settings) => set(settings),
}));
