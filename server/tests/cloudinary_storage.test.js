import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { v2 as cloudinary } from 'cloudinary';
import {
  parseCloudinaryUrl,
  getCloudinaryStatus,
  initCloudinary,
  isCloudinaryConfigured,
  getActiveStorageProvider,
} from '../src/storage/cloudinaryConfig.js';
import { photoStorage, detectImageMimeType } from '../src/storage/photoStorage.js';
import { createApp } from '../src/app.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';
const MOCK_CLOUDINARY_URL = 'cloudinary://987654321098765:supersecretkey12345@agritech-cloud';

// Authentic test image buffers
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
]);

const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);

const SPOOFED_TEXT_BUFFER = Buffer.from('NOT_AN_IMAGE_FILE_JUST_PLAIN_TEXT_DATA');

// =============================================================================
// SUITE 1: CLOUDINARY CONFIGURATION AND CREDENTIAL VALIDATION
// =============================================================================
describe('Cloudinary Configuration & Credential Safety', () => {
  test('parseCloudinaryUrl parses valid standard URL format', () => {
    const res = parseCloudinaryUrl('cloudinary://111222333:mysecret@agritech-prod');
    assert.equal(res.valid, true);
    assert.equal(res.apiKey, '111222333');
    assert.equal(res.apiSecret, 'mysecret');
    assert.equal(res.cloudName, 'agritech-prod');
  });

  test('parseCloudinaryUrl handles trailing slashes cleanly', () => {
    const res = parseCloudinaryUrl('cloudinary://111222333:mysecret@agritech-prod///');
    assert.equal(res.valid, true);
    assert.equal(res.cloudName, 'agritech-prod');
  });

  test('parseCloudinaryUrl rejects missing, empty, or whitespace URL', () => {
    assert.equal(parseCloudinaryUrl(null).valid, false);
    assert.equal(parseCloudinaryUrl('').valid, false);
    assert.equal(parseCloudinaryUrl('   ').valid, false);
    assert.match(parseCloudinaryUrl('').error, /missing/i);
  });

  test('parseCloudinaryUrl rejects malformed URLs with descriptive error', () => {
    const res = parseCloudinaryUrl('cloudinary://missingsecret@cloud');
    assert.equal(res.valid, false);
    assert.match(res.error, /Expected format: cloudinary:\/\/API_KEY:API_SECRET@CLOUD_NAME/i);
  });

  test('getCloudinaryStatus masks API key and NEVER exposes API secret', () => {
    const status = getCloudinaryStatus(MOCK_CLOUDINARY_URL);
    assert.equal(status.configured, true);
    assert.equal(status.cloudName, 'agritech-cloud');
    assert.equal(status.apiKeyMasked, '987...765');
    assert.equal(status.apiSecret, undefined);
    assert.equal(status.error, undefined);
  });

  test('initCloudinary configures Cloudinary SDK and enables secure mode', () => {
    initCloudinary(MOCK_CLOUDINARY_URL);
    const cfg = cloudinary.config();
    assert.equal(cfg.cloud_name, 'agritech-cloud');
    assert.equal(cfg.api_key, '987654321098765');
    assert.equal(cfg.secure, true);
  });

  test('getActiveStorageProvider prioritizes explicit provider and falls back cleanly', () => {
    const prevProvider = process.env.PHOTO_STORAGE_PROVIDER;
    const prevUrl = process.env.CLOUDINARY_URL;

    try {
      delete process.env.PHOTO_STORAGE_PROVIDER;
      process.env.CLOUDINARY_URL = MOCK_CLOUDINARY_URL;
      assert.equal(getActiveStorageProvider(), 'cloudinary');

      process.env.PHOTO_STORAGE_PROVIDER = 'local';
      assert.equal(getActiveStorageProvider(), 'local');

      delete process.env.PHOTO_STORAGE_PROVIDER;
      delete process.env.CLOUDINARY_URL;
      assert.equal(getActiveStorageProvider(), 'local');
    } finally {
      if (prevProvider) process.env.PHOTO_STORAGE_PROVIDER = prevProvider;
      if (prevUrl) process.env.CLOUDINARY_URL = prevUrl;
    }
  });
});

// =============================================================================
// SUITE 2: MAGIC BYTES & UPLOAD VALIDATION
// =============================================================================
describe('Photo Format & Size Validation', () => {
  test('detectImageMimeType correctly identifies JPEG, PNG, and WebP magic bytes', () => {
    assert.equal(detectImageMimeType(VALID_JPEG_BUFFER), 'image/jpeg');
    assert.equal(detectImageMimeType(VALID_PNG_BUFFER), 'image/png');

    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, 0x00, 0x00, 0x00, 0x00,
    ]);
    assert.equal(detectImageMimeType(webpBuffer), 'image/webp');
  });

  test('detectImageMimeType rejects spoofed non-image payload', () => {
    assert.equal(detectImageMimeType(SPOOFED_TEXT_BUFFER), null);
    assert.equal(detectImageMimeType(Buffer.alloc(5)), null);
  });

  test('photoStorage.savePhoto rejects invalid magic bytes with descriptive error', async () => {
    await assert.rejects(
      () => photoStorage.savePhoto({ buffer: SPOOFED_TEXT_BUFFER, ownerId: 'user1' }),
      /magic bytes do not match JPEG, PNG, or WebP/i
    );
  });

  test('photoStorage.savePhoto rejects file buffer exceeding 10MB limit', async () => {
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;

    await assert.rejects(
      () => photoStorage.savePhoto({ buffer: oversized, ownerId: 'user1' }),
      /exceeds maximum allowed limit of 10MB/i
    );
  });
});

// =============================================================================
// SUITE 3: CLOUDINARY UPLOAD, SIGNED URLS, RETRIEVAL & DELETION UNIT TESTS
// =============================================================================
describe('Cloudinary Storage Provider: Adapter Operations', () => {
  let originalUploadStream;
  let originalDestroy;
  let originalPrivateDownloadUrl;
  let originalFetch;

  const uploadedAssets = new Map();
  let lastUploadOptions = null;
  let lastDestroyOptions = null;

  before(() => {
    process.env.CLOUDINARY_URL = MOCK_CLOUDINARY_URL;
    process.env.PHOTO_STORAGE_PROVIDER = 'cloudinary';
    initCloudinary(MOCK_CLOUDINARY_URL);

    originalUploadStream = cloudinary.uploader.upload_stream;
    originalDestroy = cloudinary.uploader.destroy;
    originalPrivateDownloadUrl = cloudinary.utils.private_download_url;
    originalFetch = global.fetch;

    // Mock upload_stream
    cloudinary.uploader.upload_stream = (options, callback) => {
      lastUploadOptions = options;
      const chunks = [];
      return {
        write(chunk) {
          chunks.push(chunk);
        },
        end(chunk) {
          if (chunk) chunks.push(chunk);
          const buffer = Buffer.concat(chunks);
          const publicId = `${options.folder}/${options.public_id || 'mock_file'}`;
          const result = {
            public_id: publicId,
            asset_id: `asset_${options.public_id || '123'}`,
            version: 1700000001,
            format: 'jpg',
            resource_type: 'image',
            type: options.type || 'authenticated',
            width: 1920,
            height: 1080,
            bytes: buffer.length,
          };
          uploadedAssets.set(publicId, { buffer, result });
          if (callback) callback(null, result);
        },
      };
    };

    // Mock destroy
    cloudinary.uploader.destroy = async (publicId, options = {}) => {
      lastDestroyOptions = { publicId, ...options };
      if (uploadedAssets.has(publicId)) {
        uploadedAssets.delete(publicId);
        return { result: 'ok' };
      }
      return { result: 'not found' };
    };

    // Mock fetch for signed download URLs
    global.fetch = async (url) => {
      const urlStr = String(url);
      for (const [pubId, asset] of uploadedAssets.entries()) {
        const encoded = encodeURIComponent(pubId);
        if (urlStr.includes(encoded) || urlStr.includes(pubId)) {
          return {
            ok: true,
            status: 200,
            arrayBuffer: async () => asset.buffer.buffer.slice(
              asset.buffer.byteOffset,
              asset.buffer.byteOffset + asset.buffer.byteLength
            ),
          };
        }
      }
      return { ok: false, status: 404 };
    };
  });

  after(() => {
    cloudinary.uploader.upload_stream = originalUploadStream;
    cloudinary.uploader.destroy = originalDestroy;
    cloudinary.utils.private_download_url = originalPrivateDownloadUrl;
    global.fetch = originalFetch;
    delete process.env.PHOTO_STORAGE_PROVIDER;
    delete process.env.CLOUDINARY_URL;
  });

  test('savePhoto uploads buffer to Cloudinary with authenticated type and owner folder', async () => {
    const ownerId = 'farmer_alpha';
    const saved = await photoStorage.savePhoto({
      buffer: VALID_JPEG_BUFFER,
      ownerId,
    });

    assert.equal(saved.storageProvider, 'cloudinary');
    assert.equal(saved.storageType, 'authenticated');
    assert.equal(saved.mimeType, 'image/jpeg');
    assert.ok(saved.storageKey.startsWith(`agritech/photos/${ownerId}/`));
    assert.ok(saved.assetId);

    // Verify upload stream options
    assert.equal(lastUploadOptions.folder, `agritech/photos/${ownerId}`);
    assert.equal(lastUploadOptions.type, 'authenticated');
    assert.equal(lastUploadOptions.resource_type, 'image');
  });

  test('getSignedUrl produces a time-limited private download URL with signature', () => {
    const signedUrl = photoStorage.getSignedUrl({
      storageKey: 'agritech/photos/farmer_alpha/field_pic1',
      storageProvider: 'cloudinary',
      storageType: 'authenticated',
      mimeType: 'image/jpeg',
      expiresIn: 1800,
    });

    assert.ok(signedUrl);
    assert.match(signedUrl, /^https:\/\/api\.cloudinary\.com/i);
    assert.match(signedUrl, /type=authenticated/);
    assert.match(signedUrl, /signature=/);
    assert.match(signedUrl, /expires_at=/);
  });

  test('getPhoto retrieves stored image buffer via signed download', async () => {
    const ownerId = 'farmer_beta';
    const saved = await photoStorage.savePhoto({
      buffer: VALID_PNG_BUFFER,
      ownerId,
    });

    const retrieved = await photoStorage.getPhoto({
      storageKey: saved.storageKey,
      storageProvider: 'cloudinary',
      storageType: 'authenticated',
      mimeType: 'image/png',
    });

    assert.ok(retrieved);
    assert.deepEqual(retrieved, VALID_PNG_BUFFER);
  });

  test('getPhoto returns null when asset does not exist on Cloudinary', async () => {
    const missing = await photoStorage.getPhoto({
      storageKey: 'agritech/photos/non_existent/fake',
      storageProvider: 'cloudinary',
      storageType: 'authenticated',
    });
    assert.equal(missing, null);
  });

  test('deletePhoto removes asset on Cloudinary with invalidate flag', async () => {
    const ownerId = 'farmer_gamma';
    const saved = await photoStorage.savePhoto({
      buffer: VALID_JPEG_BUFFER,
      ownerId,
    });

    assert.ok(uploadedAssets.has(saved.storageKey));

    const delRes = await photoStorage.deletePhoto({
      storageKey: saved.storageKey,
      storageProvider: 'cloudinary',
      storageType: 'authenticated',
    });

    assert.equal(delRes.success, true);
    assert.equal(delRes.result, 'ok');
    assert.equal(uploadedAssets.has(saved.storageKey), false);
    assert.equal(lastDestroyOptions.invalidate, true);
  });

  test('deletePhoto handles already deleted assets (not found) gracefully', async () => {
    const res = await photoStorage.deletePhoto({
      storageKey: 'agritech/photos/already_deleted/pic',
      storageProvider: 'cloudinary',
    });
    assert.equal(res.success, true);
    assert.equal(res.result, 'not found');
  });
});

// =============================================================================
// SUITE 4: END-TO-END API, PERSISTENCE & MULTI-TENANT ACCESS CONTROL
// =============================================================================
describe('End-to-End Photo API & Multi-Tenant Authorization', () => {
  let app;
  let server;
  let baseUrl;
  let farmerAToken;
  let farmerBToken;
  let farmerAFarmId;
  let farmerAFieldId;
  let createdPhotoId;

  // In-memory mock store
  const fieldPhotos = new Map();
  const mockCloudinaryAssets = new Map();
  let idCounter = 1;
  const genId = () => (idCounter++).toString(16).padStart(24, '0');

  const mockFarmStore = {
    async findFarm(ownerId, farmId) {
      if (farmId === farmerAFarmId && String(ownerId) === 'user_a') {
        return { _id: farmId, ownerId: 'user_a', name: 'Valley Farm' };
      }
      return null;
    },
    async findField(ownerId, fieldId) {
      if (fieldId === farmerAFieldId && String(ownerId) === 'user_a') {
        return { _id: fieldId, farmId: farmerAFarmId, ownerId: 'user_a', name: 'Plot 1' };
      }
      return null;
    },
    async createPhoto(ownerId, values) {
      const farm = await this.findFarm(ownerId, values.farmId);
      if (!farm) return { notFound: true, resource: 'farm' };
      const field = await this.findField(ownerId, values.fieldId);
      if (!field) return { notFound: true, resource: 'field' };

      const photoId = genId();
      const photo = {
        _id: photoId,
        ownerId: String(ownerId),
        ...values,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      fieldPhotos.set(photoId, photo);
      return { photo };
    },
    async findPhoto(ownerId, photoId) {
      const p = fieldPhotos.get(photoId);
      if (!p || p.ownerId !== String(ownerId)) return null;
      return p;
    },
    async listPhotos(ownerId, filters = {}) {
      return [...fieldPhotos.values()].filter((p) => {
        if (p.ownerId !== String(ownerId)) return false;
        if (filters.farmId && p.farmId !== String(filters.farmId)) return false;
        if (filters.fieldId && p.fieldId !== String(filters.fieldId)) return false;
        return true;
      });
    },
    async deletePhoto(ownerId, photoId) {
      const p = await this.findPhoto(ownerId, photoId);
      if (!p) return null;
      // Delete from storage
      await mockPhotoStorage.deletePhoto({
        storageKey: p.storageKey,
        storageProvider: p.storageProvider,
        storageType: p.storageType,
      });
      fieldPhotos.delete(photoId);
      return p;
    },
  };

  const mockPhotoStorage = {
    async savePhoto({ buffer, ownerId }) {
      const verifiedMime = detectImageMimeType(buffer);
      if (!verifiedMime) throw new Error('Invalid image file');
      const publicId = `agritech/photos/${ownerId}/${genId()}`;
      mockCloudinaryAssets.set(publicId, buffer);
      return {
        storageKey: publicId,
        storageProvider: 'cloudinary',
        storageType: 'authenticated',
        mimeType: verifiedMime,
        assetId: `cld_asset_${genId()}`,
        publicId,
        format: 'jpg',
        width: 1200,
        height: 800,
      };
    },
    async getPhoto({ storageKey }) {
      return mockCloudinaryAssets.get(storageKey) || null;
    },
    async deletePhoto({ storageKey }) {
      mockCloudinaryAssets.delete(storageKey);
      return { success: true, result: 'ok' };
    },
    getSignedUrl({ storageKey, mimeType }) {
      return `https://api.cloudinary.com/v1_1/agritech-cloud/image/download?public_id=${encodeURIComponent(storageKey)}&sig=mock`;
    },
  };

  const mockUserStore = {
    async findById(id) {
      if (id === 'user_a') return { _id: 'user_a', email: 'farmer_a@example.com', role: 'farmer' };
      if (id === 'user_b') return { _id: 'user_b', email: 'farmer_b@example.com', role: 'farmer' };
      return null;
    },
  };

  before(async () => {
    farmerAFarmId = genId();
    farmerAFieldId = genId();

    const jwt = (await import('jsonwebtoken')).default;
    farmerAToken = jwt.sign({ id: 'user_a', role: 'farmer' }, process.env.JWT_SECRET);
    farmerBToken = jwt.sign({ id: 'user_b', role: 'farmer' }, process.env.JWT_SECRET);

    app = createApp({
      farmStore: mockFarmStore,
      userStore: mockUserStore,
      photoStorage: mockPhotoStorage,
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  const uploadRequest = async (url, buffer, token, filename = 'test.jpg') => {
    const boundary = '----WebKitFormBoundaryTest123456';
    const postData = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="notes"\r\n\r\nHealthy wheat field\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(`${baseUrl}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: postData,
    });

    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };

  test('1. Rejects unauthenticated photo upload with 401', async () => {
    const res = await uploadRequest(
      `/api/farms/${farmerAFarmId}/fields/${farmerAFieldId}/photos`,
      VALID_JPEG_BUFFER,
      null
    );
    assert.equal(res.status, 401);
  });

  test('2. Farmer A uploads authentic JPEG to Cloudinary; stores metadata without binary in DB', async () => {
    const res = await uploadRequest(
      `/api/farms/${farmerAFarmId}/fields/${farmerAFieldId}/photos`,
      VALID_JPEG_BUFFER,
      farmerAToken
    );

    assert.equal(res.status, 201);
    assert.ok(res.data.photo);
    createdPhotoId = res.data.photo._id;

    assert.equal(res.data.photo.storageProvider, 'cloudinary');
    assert.equal(res.data.photo.storageType, 'authenticated');
    assert.ok(res.data.photo.storageKey.startsWith('agritech/photos/user_a/'));
    assert.ok(res.data.photo.cloudinaryAssetId);
    assert.equal(res.data.photo.notes, 'Healthy wheat field');

    // Verify image binary was NOT stored in database
    const dbRecord = fieldPhotos.get(createdPhotoId);
    assert.equal(dbRecord.buffer, undefined);
    assert.equal(dbRecord.binary, undefined);
    assert.equal(typeof dbRecord.storageKey, 'string');
  });

  test('3. Farmer A retrieves photo metadata with signed delivery URL', async () => {
    const res = await fetch(`${baseUrl}/api/farms/photos/${createdPhotoId}`, {
      headers: { Authorization: `Bearer ${farmerAToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.photo._id, createdPhotoId);
    assert.ok(body.photo.signedDeliveryUrl);
    assert.match(body.photo.signedDeliveryUrl, /api\.cloudinary\.com/);
  });

  test('4. Farmer A streams private photo binary file with secure headers', async () => {
    const res = await fetch(`${baseUrl}/api/farms/photos/${createdPhotoId}/file`, {
      headers: { Authorization: `Bearer ${farmerAToken}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/jpeg');
    assert.equal(res.headers.get('cache-control'), 'private, max-age=3600');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');

    const buf = Buffer.from(await res.arrayBuffer());
    assert.deepEqual(buf, VALID_JPEG_BUFFER);
  });

  test('5. MULTI-TENANT ISOLATION: Farmer B CANNOT read Farmer A photo metadata (404)', async () => {
    const res = await fetch(`${baseUrl}/api/farms/photos/${createdPhotoId}`, {
      headers: { Authorization: `Bearer ${farmerBToken}` },
    });
    assert.equal(res.status, 404);
  });

  test('6. MULTI-TENANT ISOLATION: Farmer B CANNOT stream Farmer A photo file (404)', async () => {
    const res = await fetch(`${baseUrl}/api/farms/photos/${createdPhotoId}/file`, {
      headers: { Authorization: `Bearer ${farmerBToken}` },
    });
    assert.equal(res.status, 404);
  });

  test('7. MULTI-TENANT ISOLATION: Farmer B CANNOT delete Farmer A photo (404)', async () => {
    const res = await fetch(`${baseUrl}/api/farms/photos/${createdPhotoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${farmerBToken}` },
    });
    assert.equal(res.status, 404);
    // Ensure photo still exists
    assert.ok(fieldPhotos.has(createdPhotoId));
  });

  test('8. Farmer A deletes photo: cleans up Cloudinary asset and DB metadata', async () => {
    const photoBefore = fieldPhotos.get(createdPhotoId);
    assert.ok(mockCloudinaryAssets.has(photoBefore.storageKey));

    const res = await fetch(`${baseUrl}/api/farms/photos/${createdPhotoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${farmerAToken}` },
    });
    assert.equal(res.status, 200);

    // Verify cleaned from DB and Cloudinary
    assert.equal(fieldPhotos.has(createdPhotoId), false);
    assert.equal(mockCloudinaryAssets.has(photoBefore.storageKey), false);

    // Subsequent retrieval returns 404
    const getRes = await fetch(`${baseUrl}/api/farms/photos/${createdPhotoId}`, {
      headers: { Authorization: `Bearer ${farmerAToken}` },
    });
    assert.equal(getRes.status, 404);
  });
});
