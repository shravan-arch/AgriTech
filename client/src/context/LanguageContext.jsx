import { useState, useMemo, useCallback, useEffect } from 'react';
import LanguageContext from './LanguageContextValue.js';
import { getTranslation } from '../lib/translations.js';
import { useAuth } from './useAuth.js';

const SUPPORTED_LANGUAGES = ['en', 'hi', 'pa', 'mr', 'gu', 'te', 'kn', 'ta', 'bn'];

export const LanguageProvider = ({ children }) => {
  const { user, updateProfile } = useAuth();

  const [language, setLanguageState] = useState(() => {
    const local = localStorage.getItem('agritech_lang');
    if (local && SUPPORTED_LANGUAGES.includes(local)) return local;
    if (user?.language && SUPPORTED_LANGUAGES.includes(user.language)) return user.language;
    return 'en';
  });

  // Keep document html lang attribute in sync for accessibility and browser rendering
  useEffect(() => {
    if (document?.documentElement) {
      document.documentElement.lang = language;
    }
  }, [language]);

  // Keep in sync with user profile language updates on initial load or account switch
  useEffect(() => {
    if (user?.language && SUPPORTED_LANGUAGES.includes(user.language)) {
      const currentStored = localStorage.getItem('agritech_lang');
      if (!currentStored) {
        setLanguageState(user.language);
        localStorage.setItem('agritech_lang', user.language);
      }
    }
  }, [user?.language]);

  const setLanguage = useCallback(async (newLang) => {
    if (!SUPPORTED_LANGUAGES.includes(newLang)) return;
    setLanguageState(newLang);
    try {
      localStorage.setItem('agritech_lang', newLang);
    } catch {
      // Local storage write resilience
    }

    if (user && updateProfile) {
      try {
        await updateProfile({ language: newLang });
      } catch {
        // Local preference is already active and preserved
      }
    }
  }, [user, updateProfile]);

  const t = useCallback((key, params) => {
    return getTranslation(language, key, params);
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
  }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageProvider;
