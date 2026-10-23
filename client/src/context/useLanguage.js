import { useContext } from 'react';
import LanguageContext from './LanguageContextValue.js';

export const useLanguage = () => {
  return useContext(LanguageContext);
};

export default useLanguage;
