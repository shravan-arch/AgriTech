import { useState, useMemo, useCallback } from 'react';
import LanguageContext from './LanguageContextValue.js';
import { getTranslation } from '../lib/translations.js';
import { useAuth } from './useAuth.js';

export const LanguageProvider = ({ children }) => {
  const { user, updateProfile } = useAuth();
  const [language, setLanguageState] = useState(() => {
    return user?.language || localStorage.getItem('agritech_lang') || 'en';
  });

  // Keep in sync with user profile language updates
  const [prevUserLanguage, setPrevUserLanguage] = useState(user?.language);
  if (user?.language && user.language !== prevUserLanguage) {
    setPrevUserLanguage(user.language);
    setLanguageState(user.language);
    localStorage.setItem('agritech_lang', user.language);
  }

  const setLanguage = useCallback(async (newLang) => {
    if (!['en', 'hi', 'pa', 'mr', 'gu', 'te', 'kn', 'ta', 'bn'].includes(newLang)) return;
    setLanguageState(newLang);
    localStorage.setItem('agritech_lang', newLang);

    if (user) {
      try {
        await updateProfile({ language: newLang });
      } catch {
        // Local preference is already saved
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
