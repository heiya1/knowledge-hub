import { create } from 'zustand';

interface FavoritesState {
  favorites: string[];  // page IDs
  recentPages: Array<{ id: string; title: string; timestamp: string }>;  // last 20
  toggleFavorite: (id: string) => void;
  addRecentPage: (id: string, title: string) => void;
  loadFromStorage: (data: { favorites?: string[]; recentPages?: Array<{ id: string; title: string; timestamp: string }> }) => void;
}

export const useFavoritesStore = create<FavoritesState>((set) => ({
  favorites: [],
  recentPages: [],

  toggleFavorite: (id: string) => {
    set((state) => {
      const index = state.favorites.indexOf(id);
      if (index >= 0) {
        return { favorites: state.favorites.filter((fid) => fid !== id) };
      }
      return { favorites: [...state.favorites, id] };
    });
  },

  addRecentPage: (id: string, title: string) => {
    set((state) => {
      const timestamp = new Date().toISOString();
      const filtered = state.recentPages.filter((p) => p.id !== id);
      const updated = [{ id, title, timestamp }, ...filtered].slice(0, 20);
      return { recentPages: updated };
    });
  },

  loadFromStorage: (data) => {
    set({
      favorites: data.favorites ?? [],
      recentPages: data.recentPages ?? [],
    });
  },
}));
