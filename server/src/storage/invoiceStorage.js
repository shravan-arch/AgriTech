import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { initCloudinary, getActiveStorageProvider, isCloudinaryConfigured } from './cloudinaryConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultInvoiceUploadDir = path.resolve(__dirname, '../../uploads/invoices');

export const getInvoiceUploadDir = () =>
  process.env.INVOICE_UPLOAD_DIR
    ? path.resolve(process.env.INVOICE_UPLOAD_DIR)
    : defaultInvoiceUploadDir;

/**
 * Detect authentic document/image MIME type using magic bytes.
 * Never trust client-provided Content-Type or file extensions alone.
 */
export const detectDocumentMimeType = (buffer) => {
  if (!buffer || buffer.length < 4) return null;

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
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

  // WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
};

const getExtensionForMime = (mime) => {
  switch (mime) {
    case 'application/pdf':
      return '.pdf';
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
  const uploadDir = getInvoiceUploadDir();
  const safeRelative = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '');
  const resolved = path.resolve(uploadDir, safeRelative);
  if (!resolved.startsWith(uploadDir)) {
    throw new Error('Access outside invoice storage directory is forbidden.');
  }
  return resolved;
};

export const invoiceStorage = {
  /**
   * Save invoice file (PDF or image) securely.
   */
  async saveInvoice({ buffer, ownerId, originalName = '' }) {
    const verifiedMime = detectDocumentMimeType(buffer);
    if (!verifiedMime) {
      throw new Error(
        'Invalid document file format: only authentic PDF documents, JPEG, PNG, or WebP images are permitted.'
      );
    }

    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error('Invoice file size exceeds maximum permitted limit of 10MB.');
    }

    const provider = getActiveStorageProvider();

    // 1. Cloudinary Storage Provider (if active and configured)
    if (provider === 'cloudinary' && isCloudinaryConfigured()) {
      try {
        initCloudinary();
        const deliveryType = process.env.CLOUDINARY_DELIVERY_TYPE || 'authenticated';
        const folder = `agritech/invoices/${ownerId}`;
        const publicIdSuffix = randomBytes(16).toString('hex');
        const resourceType = verifiedMime === 'application/pdf' ? 'raw' : 'image';

        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              public_id: publicIdSuffix,
              folder,
              resource_type: resourceType,
              type: deliveryType,
              overwrite: false,
              unique_filename: false,
            },
            (error, result) => {
              if (error) {
                return reject(new Error(`Cloudinary document upload failed: ${error.message || error}`));
              }
              resolve(result);
            }
          );
          stream.end(buffer);
        });

        return {
          storageKey: uploadResult.public_id || `${folder}/${publicIdSuffix}`,
          storageProvider: 'cloudinary',
          mimeType: verifiedMime,
          originalName: path.basename(originalName).slice(0, 100),
          bytes: buffer.length,
        };
      } catch (err) {
        // Fall back to safe local storage if Cloudinary network upload fails
        console.warn(`[InvoiceStorage] Cloudinary upload failed, falling back to local disk: ${err.message}`);
      }
    }

    // 2. Local Disk Storage Provider
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
      originalName: path.basename(originalName).slice(0, 100),
      bytes: buffer.length,
    };
  },

  /**
   * Retrieve invoice file buffer.
   */
  async getInvoice({ storageKey, storageProvider = 'local', mimeType }) {
    if (storageProvider === 'local') {
      const absolutePath = resolveSafeLocalPath(storageKey);
      try {
        return await fs.promises.readFile(absolutePath);
      } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
    }

    if (storageProvider === 'cloudinary' && isCloudinaryConfigured()) {
      initCloudinary();
      const resourceType = mimeType === 'application/pdf' ? 'raw' : 'image';
      const type = process.env.CLOUDINARY_DELIVERY_TYPE || 'authenticated';
      const downloadUrl = cloudinary.utils.private_download_url(storageKey, '', {
        resource_type: resourceType,
        type,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      });

      const res = await fetch(downloadUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
    }

    return null;
  },

  /**
   * Delete invoice file.
   */
  async deleteInvoice({ storageKey, storageProvider = 'local' }) {
    if (!storageKey) return { success: true };

    if (storageProvider === 'local') {
      try {
        const absolutePath = resolveSafeLocalPath(storageKey);
        await fs.promises.unlink(absolutePath);
        return { success: true };
      } catch (err) {
        if (err.code === 'ENOENT') return { success: true, result: 'not_found' };
        return { success: false, error: err.message };
      }
    }

    if (storageProvider === 'cloudinary' && isCloudinaryConfigured()) {
      try {
        initCloudinary();
        await cloudinary.uploader.destroy(storageKey, {
          resource_type: 'raw',
          type: process.env.CLOUDINARY_DELIVERY_TYPE || 'authenticated',
          invalidate: true,
        });
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    return { success: true };
  },
};
