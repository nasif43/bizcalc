import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import translations from './translations';

type Lang = 'en' | 'bn';

type I18nContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('lang');
      if (stored === 'bn' || stored === 'en') setLangState(stored);
    } catch (e) {
      // ignore
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('lang', l);
    } catch (e) {}
  };

  const t = (key: string) => {
    const fromLang = (translations as any)[lang] || {};
    const fallback = (translations as any)['en'] || {};
    return (fromLang[key] ?? fallback[key] ?? key) as string;
  };

  const value = useMemo(() => ({ lang, setLang, t }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
};

export default I18nContext;
