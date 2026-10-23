import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultUploadDir = path.resolve(__dirname, '../../uploads/photos');

export const getUploadDir = () =>
  process.env.PHOTO_UPLOAD_DIR
    ? path.resolve(process.env.PHOTO_UPLOAD_DIR)
    : defaultUploadDir;

/**
 * Detect authentic image format using magic bytes.
 * Never trust client-supplied MIME types or file extensions alone.
 */
export const detectImageMimeType = (buffer) => {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF ... WEBP
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'image/webp';
  }

  return null;
};

const getExtensionForMime = (mime) => {
  switch (mime) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.bin';
  }
};

const resolveSafeLocalPath = (storageKey) => {
  const uploadDir = getUploadDir();
  const safeRelative = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '');
  const resolved = path.resolve(uploadDir, safeRelative);
  if (!resolved.startsWith(uploadDir)) {
    throw new Error('Access outside photo storage directory is forbidden.');
  }
  return resolved;
};

export const photoStorage = {
  /**
   * Save photograph bytes using configured storage adapter.
   */
  async savePhoto({ buffer, ownerId }) {
    const verifiedMime = detectImageMimeType(buffer);
    if (!verifiedMime) {
      throw new Error('Invalid image file: magic bytes do not match JPEG, PNG, or WebP.');
    }

    const provider = process.env.PHOTO_STORAGE_PROVIDER || 'local';

    if (provider === 'local') {
      const ext = getExtensionForMime(verifiedMime);
      const filename = `${randomBytes(16).toString('hex')}${ext}`;
      const relativeKey = path.join(String(ownerId), filename);
      const absolutePath = resolveSafeLocalPath(relativeKey);

      await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.promises.writeFile(absolutePath, buffer);

      return {
        storageKey: relativeKey.replace(/\\/g, '/'),
        storageProvider: 'local',
        mimeType: verifiedMime,
      };
    }

    // Cloud storage hook (e.g. S3 or Cloudinary)
    // If provider is set to cloud but credentials are not configured:
    throw new Error(
      `Cloud storage provider '${provider}' is not configured with necessary credentials. Use 'local' for development.`
    );
  },

  /**
   * Read photograph bytes.
   */
  async getPhoto({ storageKey, storageProvider = 'local' }) {
    if (storageProvider === 'local') {
      const absolutePath = resolveSafeLocalPath(storageKey);
      try {
        const data = await fs.promises.readFile(absolutePath);
        return data;
      } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
    }

    throw new Error(`Unsupported storage provider: ${storageProvider}`);
  },

  /**
   * Delete photograph bytes.
   */
  async deletePhoto({ storageKey, storageProvider = 'local' }) {
    if (storageProvider === 'local') {
      const absolutePath = resolveSafeLocalPath(storageKey);
      try {
        await fs.promises.unlink(absolutePath);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
      return;
    }

    throw new Error(`Unsupported storage provider: ${storageProvider}`);
  },
};

export default photoStorage;
