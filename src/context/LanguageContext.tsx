import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Language,
  Translations,
  TRANSLATIONS,
  RULE_NAME_MAP,
  STATUS_LABEL_MAP,
} from '../utils/translations';
import { WinningPattern } from '../types/bingo';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: Translations;
  getRuleName: (rule: WinningPattern | string) => string;
  getStatusLabel: (status: string) => string;
  translateAnnouncement: (announcement: string, claimWindowSeconds?: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('bingo_language');
      if (saved === 'am' || saved === 'en') return saved;
    } catch {}
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('bingo_language', lang);
    } catch {}
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'am' : 'en');
  };

  const t = TRANSLATIONS[language];

  const getRuleName = (rule: WinningPattern | string): string => {
    return RULE_NAME_MAP[language][rule] || RULE_NAME_MAP.en[rule] || rule;
  };

  const getStatusLabel = (status: string): string => {
    return STATUS_LABEL_MAP[language][status] || STATUS_LABEL_MAP.en[status] || status.replace(/_/g, ' ');
  };

  const translateAnnouncement = (announcement: string, claimWindowSeconds?: number): string => {
    if (language === 'en') {
      if (announcement.startsWith('Bingo claimed, bingo claim window will be closed in')) {
        const secs = claimWindowSeconds && claimWindowSeconds > 0 ? claimWindowSeconds : 15;
        return `Bingo claimed, bingo claim window will be closed in ${secs} seconds`;
      }
      return announcement;
    }

    // Amharic translation mappings for announcements
    if (announcement === 'Next game') return t.nextGame;
    if (announcement === 'Game is starting ..') return t.gameStarting;
    if (announcement === 'Game is playing') return t.gamePlaying;
    if (announcement === 'Game stopped') return t.gameStopped;
    if (announcement === 'Game paused') return t.gamePaused;
    if (announcement === 'Game resumed') return t.gameResumed;
    if (announcement === 'Game reset') return t.gameReset;
    if (announcement === 'Game suspended by administrator' || announcement.includes('suspended by the administrator')) {
      return t.gameSuspended;
    }
    if (announcement === 'registration opened') return t.registrationOpened;
    if (announcement === 'registration closed') return t.registrationClosed;
    if (announcement === 'game completed, ready for the next game') return t.gameCompletedNext;
    if (announcement.startsWith('Bingo claimed, bingo claim window will be closed in') || announcement.startsWith('Bingo claimed')) {
      const secs = claimWindowSeconds && claimWindowSeconds > 0 ? claimWindowSeconds : 15;
      return t.bingoClaimedWindow.replace('{seconds}', String(secs));
    }

    return announcement;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        getRuleName,
        getStatusLabel,
        translateAnnouncement,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
