import { v2 as cloudinary } from 'cloudinary';

/**
 * Parses and validates a Cloudinary URL string.
 * Format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 *
 * @param {string} url - The Cloudinary connection URL
 * @returns {{ valid: boolean, apiKey?: string, apiSecret?: string, cloudName?: string, error?: string }}
 */
export const parseCloudinaryUrl = (url) => {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return {
      valid: false,
      error: 'CLOUDINARY_URL environment variable is missing.',
    };
  }

  const cleaned = url.trim().replace(/\/+$/, '');
  const match = cleaned.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?#\s]+)$/i);

  if (!match) {
    return {
      valid: false,
      error:
        'Invalid CLOUDINARY_URL format. Expected format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME',
    };
  }

  const [, apiKey, apiSecret, cloudName] = match;

  if (!apiKey || !apiSecret || !cloudName) {
    return {
      valid: false,
      error:
        'Invalid CLOUDINARY_URL: API_KEY, API_SECRET, and CLOUD_NAME must all be non-empty.',
    };
  }

  return {
    valid: true,
    apiKey,
    apiSecret,
    cloudName,
  };
};

/**
 * Returns safe status about Cloudinary configuration without exposing secrets.
 */
export const getCloudinaryStatus = (url = process.env.CLOUDINARY_URL) => {
  const parsed = parseCloudinaryUrl(url);
  if (!parsed.valid) {
    return {
      configured: false,
      error: parsed.error,
    };
  }

  const keyLen = parsed.apiKey.length;
  const maskedKey =
    keyLen > 6
      ? `${parsed.apiKey.slice(0, 3)}...${parsed.apiKey.slice(-3)}`
      : '***';

  return {
    configured: true,
    cloudName: parsed.cloudName,
    apiKeyMasked: maskedKey,
    deliveryType: process.env.CLOUDINARY_DELIVERY_TYPE || 'authenticated',
  };
};

/**
 * Initializes Cloudinary SDK with validated credentials.
 */
export const initCloudinary = (url = process.env.CLOUDINARY_URL) => {
  const parsed = parseCloudinaryUrl(url);
  if (!parsed.valid) {
    throw new Error(`Cloudinary Configuration Error: ${parsed.error}`);
  }

  cloudinary.config({
    cloud_name: parsed.cloudName,
    api_key: parsed.apiKey,
    api_secret: parsed.apiSecret,
    secure: true,
  });

  return cloudinary;
};

/**
 * Checks whether Cloudinary is configured with valid credentials in the environment.
 */
export const isCloudinaryConfigured = (url = process.env.CLOUDINARY_URL) => {
  const parsed = parseCloudinaryUrl(url);
  return parsed.valid;
};

/**
 * Determines the active storage provider.
 * Priority:
 * 1. Explicit PHOTO_STORAGE_PROVIDER ('cloudinary' | 'local')
 * 2. If CLOUDINARY_URL is present -> 'cloudinary'
 * 3. Default fallback -> 'local'
 */
export const getActiveStorageProvider = () => {
  if (process.env.PHOTO_STORAGE_PROVIDER) {
    return process.env.PHOTO_STORAGE_PROVIDER.trim().toLowerCase();
  }
  if (process.env.CLOUDINARY_URL) {
    return 'cloudinary';
  }
  return 'local';
};

export default {
  parseCloudinaryUrl,
  getCloudinaryStatus,
  initCloudinary,
  isCloudinaryConfigured,
  getActiveStorageProvider,
};
