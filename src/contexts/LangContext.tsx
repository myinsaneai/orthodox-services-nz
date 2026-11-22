// src/contexts/LangContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Lang = 'en' | 'el';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue>({ lang: 'en', setLang: () => {} });

const STORAGE_KEY = 'gp_lang';

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'el') return saved;
  } catch { /* storage unavailable */ }
  return (navigator.language || '').toLowerCase().startsWith('el') ? 'el' : 'en';
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  };

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
