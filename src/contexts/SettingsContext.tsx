import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { getStoredLang, storeLang, LANGS, LANG_LABELS } from "../i18n";
import { lsGet, lsSet } from "../utils/storage";
import { LS_MY_TEAMS_KEY } from "../constants";
import type { Lang } from "../types";

interface SettingsContextValue {
  lang: Lang;
  handleLangChange: (lang: Lang) => void;
  myTeams: string[];
  toggleMyTeam: (name: string) => void;
  clearMyTeams: () => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => getStoredLang());
  const [myTeams, setMyTeams] = useState<string[]>(() => {
    try {
      const stored = lsGet(LS_MY_TEAMS_KEY);
      if (stored) return JSON.parse(stored) as string[];
    } catch {
      // ignore
    }
    return [];
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const handleLangChange = useCallback((newLang: Lang) => {
    setLang(newLang);
    storeLang(newLang);
    document.documentElement.lang = newLang;
  }, []);

  const toggleMyTeam = useCallback((name: string) => {
    setMyTeams((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      lsSet(LS_MY_TEAMS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearMyTeams = useCallback(() => {
    setMyTeams([]);
    lsSet(LS_MY_TEAMS_KEY, JSON.stringify([]));
  }, []);

  return (
    <SettingsContext.Provider value={{ lang, handleLangChange, myTeams, toggleMyTeam, clearMyTeams, showSettings, setShowSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export { LANGS, LANG_LABELS };
