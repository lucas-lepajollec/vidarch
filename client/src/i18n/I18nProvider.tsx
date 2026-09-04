/* oxlint-disable react/only-export-components */
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

export function readRequestedLanguage(): UiLanguage | null {
  if (typeof window === 'undefined') return null;
  const requested = new URLSearchParams(window.location.search).get('lang');
  return isUiLanguage(requested) ? requested : null;
}

function readStoredLanguage(): UiLanguage {
  const requested = readRequestedLanguage();
  if (requested) return requested;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isUiLanguage(stored)) return stored;
  } catch {}
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
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = messages[language]['meta.title'];
    document.querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', messages[language]['meta.description']);
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
