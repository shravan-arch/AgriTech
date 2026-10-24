import { useEffect, useRef, useState } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/**
 * Google Sign-In Button component.
 * Integrates with Google Identity Services (GIS) and verifies identity tokens via backend.
 */
export const GoogleSignInButton = ({ onCredentialReceived, disabled = false, text = 'Continue with Google' }) => {
  const containerRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(
    () => typeof window !== 'undefined' && Boolean(window.google?.accounts?.id)
  );
  const [infoMessage, setInfoMessage] = useState('');
  const configMissing = !GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || window.google?.accounts?.id) {
      return;
    }

    const existingScript = document.getElementById('google-gsi-client');
    if (existingScript) {
      existingScript.addEventListener('load', () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      setInfoMessage('Unable to connect to Google Identity Services. Check your internet connection.');
    };
    document.head.appendChild(script);
  }, []);

  const onCredentialReceivedRef = useRef(onCredentialReceived);
  useEffect(() => {
    onCredentialReceivedRef.current = onCredentialReceived;
  }, [onCredentialReceived]);

  useEffect(() => {
    if (!scriptLoaded || !GOOGLE_CLIENT_ID || !window.google?.accounts?.id || !containerRef.current) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response?.credential && onCredentialReceivedRef.current) {
            onCredentialReceivedRef.current(response.credential);
          }
        },
      });

      // Clear any previous render
      containerRef.current.innerHTML = '';

      // Render official Google button
      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: containerRef.current.offsetWidth || 380,
      });
    } catch {
      // In case of GIS initialization error
    }
  }, [scriptLoaded]);

  const handleFallbackClick = () => {
    if (configMissing) {
      setInfoMessage(
        'Google Client ID is not configured. Add VITE_GOOGLE_CLIENT_ID to your client/.env file.'
      );
      return;
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setInfoMessage('Google One Tap prompt was skipped. Please use the button directly.');
        }
      });
    } else {
      setInfoMessage('Google services are still initializing. Please wait a moment.');
    }
  };

  return (
    <div className="google-auth-wrapper">
      {/* Container for rendered Google Identity Services button */}
      <div
        ref={containerRef}
        className={`google-gis-container ${!scriptLoaded || configMissing ? 'd-none' : ''}`}
        style={{ minHeight: '44px' }}
      />

      {/* Styled fallback button displayed when GIS script is loading, offline, or awaiting config */}
      {(!scriptLoaded || configMissing) && (
        <button
          type="button"
          className="btn btn-outline-secondary google-btn w-100"
          onClick={handleFallbackClick}
          disabled={disabled}
          aria-label={text}
        >
          <svg className="google-icon me-2" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{text}</span>
        </button>
      )}

      {infoMessage && (
        <div className="alert alert-info py-2 px-3 mt-2 text-start small mb-0" role="status">
          <i className="bi bi-info-circle me-1" aria-hidden="true" />
          {infoMessage}
        </div>
      )}
    </div>
  );
};

export default GoogleSignInButton;
