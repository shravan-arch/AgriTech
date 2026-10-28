import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import { fetchPhotoBlobUrl } from '../lib/api.js';

export const AuthenticatedImage = ({
  photoId,
  alt = 'Field photo',
  className = '',
  style = {},
  onClick,
}) => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [imageState, setImageState] = useState({
    forPhotoId: null,
    src: null,
    failed: false,
  });

  const isCurrent = imageState.forPhotoId === photoId;
  const loading = !isCurrent;
  const failed = isCurrent && imageState.failed;
  const src = isCurrent ? imageState.src : null;

  useEffect(() => {
    let active = true;
    let currentObjectUrl = null;

    fetchPhotoBlobUrl(photoId, token)
      .then((objectUrl) => {
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        currentObjectUrl = objectUrl;
        setImageState({ forPhotoId: photoId, src: objectUrl, failed: false });
      })
      .catch(() => {
        if (active) {
          setImageState({ forPhotoId: photoId, src: null, failed: true });
        }
      });

    return () => {
      active = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [photoId, token]);

  if (loading) {
    return (
      <div className={`photo-loading-skeleton ${className}`.trim()} style={style}>
        <div className="spinner-border spinner-border-sm text-success" role="status" aria-label={t('common.loadingImage')} />
      </div>
    );
  }

  if (failed || !src) {
    return (
      <div className={`photo-error-placeholder ${className}`.trim()} style={style}>
        <i className="bi bi-image" aria-hidden="true" style={{ fontSize: '1.75rem' }} />
        <span className="small">{t('common.photoUnavailable')}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
      loading="lazy"
    />
  );
};

export default AuthenticatedImage;
