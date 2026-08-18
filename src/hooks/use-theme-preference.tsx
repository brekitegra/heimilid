import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'heimilid-theme-preference';

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

/** Wraps the whole app so an explicit Light/Dark override (set from the
 * Profile screen) can beat the OS's own color scheme — 'system' (the
 * default) just defers to it as before. */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    // Effects don't run during SSR, so this never touches AsyncStorage
    // before there's a real browser/native runtime to persist it in.
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  return <ThemePreferenceContext.Provider value={{ preference, setPreference }}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemePreference must be used within a ThemePreferenceProvider');
  return ctx;
}
