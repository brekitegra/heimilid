import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { TRANSLATIONS, type TranslationKey } from '@/lib/translations';

export type { TranslationKey };

export type Language = 'en' | 'is';

const STORAGE_KEY = 'heimilid-language';

type LanguageContextValue = {
  language: Language;
  setLanguage: (next: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Wraps the whole app, mirroring use-theme-preference.tsx's exact
 * shape — an explicit English/Icelandic choice (set from the Profile
 * screen or the corner quick-menu) persisted the same way the
 * light/dark override is. Defaults to English, matching how every
 * string in this app has always been written. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    // Effects don't run during SSR, so this never touches AsyncStorage
    // before there's a real browser/native runtime to persist it in.
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'en' || stored === 'is') setLanguageState(stored);
    });
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

/** `t('key')` bound to the current language, with optional `{placeholder}`
 * interpolation for templated strings (e.g. `t('choresDeleteConfirmMessage',
 * { title })` for a template of `Remove "{title}"?`). Covers every
 * section's static UI text now (composer labels, buttons, placeholders,
 * empty states, alert dialogs). Deliberately does NOT cover:
 *  1. Dynamic captions built by the plain *-format.ts lib functions (e.g.
 *     "3-day streak") — those files have no hook access, and naive
 *     word-by-word translation would produce broken Icelandic grammar,
 *     so they take a `language` parameter directly and branch internally
 *     instead of going through this dictionary.
 *  2. A few "quick pick" pills whose tapped label is the literal value
 *     saved to the database (pet species, kids' subject/activity/chore
 *     quick-picks) — these need a code/label split before they can be
 *     translated without corrupting stored data.
 * Both are tracked as an explicit follow-up, not silently skipped. */
export function useTranslation() {
  const { language } = useLanguage();
  return useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const text: string = TRANSLATIONS[language][key];
      if (!params) return text;
      return Object.entries(params).reduce((result, [name, value]) => result.split(`{${name}}`).join(String(value)), text);
    },
    [language],
  );
}
