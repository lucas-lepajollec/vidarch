import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  BCP47,
  interpolate,
  messages,
  type UiLanguage,
} from './messages';

const STORAGE_KEY = 'vidarch.ui_language';

function isUiLanguage(value: string | null | undefined): value is UiLanguage {
  return value === 'en' || value === 'fr' || value === 'es' || value === 'de';
}

function readStoredLanguage(): UiLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isUiLanguage(stored)) return stored;
  } catch (_) {}
  return 'en';
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

interface I18nContextValue {
  language: UiLanguage;
  locale: string;
  setLanguage: (lang: UiLanguage) => void;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<UiLanguage>(readStoredLanguage);

  const setLanguage = useCallback((lang: UiLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback<TranslateFn>((key, vars) => {
    const dict = messages[language] || messages.en;
    const template = dict[key] || messages.en[key] || key;
    return interpolate(template, vars);
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    locale: BCP47[language],
    setLanguage,
    t,
  }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
