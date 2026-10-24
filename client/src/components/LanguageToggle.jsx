import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/useLanguage.js';
import { INDIAN_LANGUAGES } from '../lib/translations.js';

const LanguageToggle = ({ className = '', id = 'global-language-selector' }) => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLang = INDIAN_LANGUAGES.find((item) => item.code === language) || INDIAN_LANGUAGES[0];

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectLanguage = (code) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className={`lang-dropdown-wrapper position-relative ${className}`} ref={dropdownRef}>
      <button
        id={id}
        type="button"
        className="btn btn-sm lang-trigger-btn d-inline-flex align-items-center gap-2 px-3 py-1-5 shadow-sm"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Select language (Current: ${currentLang.name})`}
        title="Change Language / भाषा बदलें"
      >
        <span className="lang-globe-icon d-inline-flex align-items-center justify-content-center text-success">
          <i className="bi bi-globe2" aria-hidden="true" />
        </span>
        <span className="lang-current-label fw-semibold text-dark">
          {currentLang.name}
        </span>
        <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle text-uppercase px-1-5 py-0-5" style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}>
          {currentLang.code}
        </span>
        <i
          className={`bi bi-chevron-down text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ fontSize: '0.75rem', transition: 'transform 0.2s ease' }}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="lang-dropdown-menu shadow-lg border rounded-4 p-2 bg-white position-absolute end-0 mt-2"
          role="menu"
          aria-labelledby={id}
          style={{
            zIndex: 1060,
            minWidth: '280px',
            maxWidth: '340px',
            animation: 'fadeInDown 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className="px-3 py-2 border-bottom mb-1">
            <div className="d-flex align-items-center justify-content-between">
              <span className="fw-bold text-dark small">Regional Languages</span>
              <span className="badge bg-light text-secondary border small">India Hub</span>
            </div>
            <p className="text-muted mb-0" style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>
              Select language of your agricultural region
            </p>
          </div>

          <div className="lang-items-list" style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {INDIAN_LANGUAGES.map((langItem) => {
              const isSelected = langItem.code === language;
              return (
                <button
                  key={langItem.code}
                  type="button"
                  className={`dropdown-item rounded-3 px-3 py-2 text-start d-flex align-items-center justify-content-between my-0-5 transition-all ${
                    isSelected ? 'active-lang-item bg-success text-white' : 'text-dark hover-bg-light'
                  }`}
                  onClick={() => handleSelectLanguage(langItem.code)}
                  role="menuitem"
                >
                  <div className="d-flex flex-column">
                    <div className="d-flex align-items-center gap-2">
                      <span className={`fw-bold ${isSelected ? 'text-white' : 'text-dark'}`} style={{ fontSize: '0.95rem' }}>
                        {langItem.name}
                      </span>
                      <span
                        className={`small text-uppercase ${isSelected ? 'text-white-50' : 'text-muted'}`}
                        style={{ fontSize: '0.72rem' }}
                      >
                        ({langItem.englishName})
                      </span>
                    </div>
                    <span
                      className={`small ${isSelected ? 'text-white-50' : 'text-secondary'}`}
                      style={{ fontSize: '0.72rem' }}
                    >
                      {langItem.region}
                    </span>
                  </div>

                  {isSelected ? (
                    <i className="bi bi-check2-circle text-white fs-5 ms-2 flex-shrink-0" aria-hidden="true" />
                  ) : (
                    <span className="badge bg-light text-muted border text-uppercase" style={{ fontSize: '0.65rem' }}>
                      {langItem.code}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageToggle;
