import { create } from 'zustand';

export type Screen = 'welcome' | 'editor' | 'settings' | 'help' | 'imageCleanup';

interface NavigationState {
  screen: Screen;
  setScreen: (screen: Screen) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  screen: 'welcome',
  setScreen: (screen) => set({ screen }),
}));
