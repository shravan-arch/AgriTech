import { useLanguage } from '../context/useLanguage.js';

const LanguageToggle = ({ className = '', size = 'sm' }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={`btn-group ${className}`}
      role="group"
      aria-label="Language selection"
      style={{ display: 'inline-flex' }}
    >
      <button
        type="button"
        className={`btn btn-${size} ${language === 'en' ? 'btn-primary' : 'btn-outline-secondary'}`}
        onClick={() => setLanguage('en')}
        title="English"
        style={{ fontWeight: language === 'en' ? '600' : '400' }}
      >
        EN
      </button>
      <button
        type="button"
        className={`btn btn-${size} ${language === 'hi' ? 'btn-primary' : 'btn-outline-secondary'}`}
        onClick={() => setLanguage('hi')}
        title="हिंदी (Hindi)"
        style={{ fontWeight: language === 'hi' ? '600' : '400' }}
      >
        हिंदी
      </button>
    </div>
  );
};

export default LanguageToggle;
