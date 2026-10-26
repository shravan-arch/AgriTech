import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { initCloudinary, getActiveStorageProvider } from './cloudinaryConfig.js';

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

    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error('File size exceeds maximum allowed limit of 10MB.');
    }

    const provider = getActiveStorageProvider();

    // 1. Cloudinary Storage Provider
    if (provider === 'cloudinary') {
      initCloudinary();
      const deliveryType = process.env.CLOUDINARY_DELIVERY_TYPE || 'authenticated';
      const folder = `agritech/photos/${ownerId}`;
      const publicIdSuffix = randomBytes(16).toString('hex');
      const fullPublicId = `${folder}/${publicIdSuffix}`;

      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: publicIdSuffix,
            folder,
            resource_type: 'image',
            type: deliveryType,
            overwrite: false,
            unique_filename: false,
          },
          (error, result) => {
            if (error) {
              return reject(new Error(`Cloudinary upload failed: ${error.message || error}`));
            }
            resolve(result);
          }
        );
        stream.end(buffer);
      });

      return {
        storageKey: uploadResult.public_id || fullPublicId,
        storageProvider: 'cloudinary',
        storageType: deliveryType,
        mimeType: verifiedMime,
        assetId: uploadResult.asset_id,
        publicId: uploadResult.public_id || fullPublicId,
        version: uploadResult.version ? String(uploadResult.version) : undefined,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
        bytes: uploadResult.bytes || buffer.length,
      };
    }

    // 2. Local Disk Storage Provider (Development / Fallback)
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
        storageType: 'local',
        mimeType: verifiedMime,
      };
    }

    throw new Error(
      `Unsupported or unconfigured photo storage provider '${provider}'. Configure CLOUDINARY_URL or set PHOTO_STORAGE_PROVIDER=local.`
    );
  },

  /**
   * Read photograph bytes.
   */
  async getPhoto({ storageKey, storageProvider = 'local', storageType = 'authenticated', mimeType }) {
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

    if (storageProvider === 'cloudinary') {
      initCloudinary();
      const format =
        mimeType === 'image/png'
          ? 'png'
          : mimeType === 'image/webp'
            ? 'webp'
            : 'jpg';
      const type = storageType || process.env.CLOUDINARY_DELIVERY_TYPE || 'authenticated';

      // 1. Primary retrieval strategy: time-limited signed private download URL
      const downloadUrl = cloudinary.utils.private_download_url(storageKey, format, {
        resource_type: 'image',
        type,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      });

      let res = await fetch(downloadUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }

      if (res.status === 404) {
        // Fallback: try signed standard URL
        const signedUrl = cloudinary.utils.url(storageKey, {
          sign_url: true,
          type,
          secure: true,
        });
        const fallbackRes = await fetch(signedUrl);
        if (fallbackRes.ok) {
          const ab = await fallbackRes.arrayBuffer();
          return Buffer.from(ab);
        }
        if (fallbackRes.status === 404) return null;
      }

      throw new Error(`Cloudinary photo retrieval failed with HTTP ${res.status}`);
    }

    throw new Error(`Unsupported storage provider: ${storageProvider}`);
  },

  /**
   * Delete photograph bytes.
   */
  async deletePhoto({ storageKey, storageProvider = 'local', storageType = 'authenticated' }) {
    if (storageProvider === 'local') {
      const absolutePath = resolveSafeLocalPath(storageKey);
      try {
        await fs.promises.unlink(absolutePath);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
      return { success: true, result: 'ok' };
    }

    if (storageProvider === 'cloudinary') {
      initCloudinary();
      const type = storageType || process.env.CLOUDINARY_DELIVERY_TYPE || 'authenticated';

      const result = await cloudinary.uploader.destroy(storageKey, {
        resource_type: 'image',
        type,
        invalidate: true,
      });

      if (result && (result.result === 'ok' || result.result === 'not found')) {
        return { success: true, result: result.result };
      }

      // If delivery type differed, try fallback with type 'upload'
      if (type !== 'upload') {
        const fallback = await cloudinary.uploader.destroy(storageKey, {
          resource_type: 'image',
          type: 'upload',
          invalidate: true,
        });
        if (fallback && (fallback.result === 'ok' || fallback.result === 'not found')) {
          return { success: true, result: fallback.result };
        }
      }

      throw new Error(`Cloudinary deletion failed: ${result?.result || 'Asset deletion error'}`);
    }

    if (storageProvider === 'vercel-blob' || storageProvider === 'vercel') {
      try {
        const { del } = await import('@vercel/blob');
        await del(storageKey, { token: process.env.BLOB_READ_WRITE_TOKEN });
      } catch {
        // Recoverable cleanup for external blob storage
      }
      return;
    }

    throw new Error(`Unsupported storage provider: ${storageProvider}`);
  },

export default photoStorage;

