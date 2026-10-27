import multer from 'multer';
import { purchaseStore as defaultPurchaseStore } from '../storage/purchaseStore.js';
import { invoiceStorage as defaultInvoiceStorage } from '../storage/invoiceStorage.js';
import { supplierRegistry as defaultSupplierRegistry } from '../services/suppliers/supplierRegistry.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export const invoiceUploadMiddleware = (req, res, next) => {
  upload.single('invoice')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invoice file size exceeds maximum permitted limit of 10MB.',
        });
      }
      return res.status(400).json({
        error: 'Validation Error',
        message: `Upload error: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Upload error: ${err.message}`,
      });
    }
    next();
  });
};

export const createPurchaseController = (
  purchaseStore = defaultPurchaseStore,
  invoiceStorage = defaultInvoiceStorage,
  supplierRegistry = defaultSupplierRegistry
) => {
  return {
    /**
     * GET /api/purchases/suppliers
     * List registered suppliers and their capabilities.
     */
    async getSuppliers(req, res, next) {
      try {
        const suppliers = supplierRegistry.listSuppliers();
        return res.status(200).json({ suppliers });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/purchases/products
     * Search products across all active suppliers.
     */
    async searchProducts(req, res, next) {
      try {
        const { query, category, supplierId, minPrice, maxPrice, page, limit } = req.query;
        const result = await supplierRegistry.searchCatalog({
          query,
          category,
          supplierId,
          minPrice,
          maxPrice,
          page,
          limit,
        });
        return res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/purchases/products/:providerId/:productId
     * Get specific product details.
     */
    async getProductDetails(req, res, next) {
      try {
        const { providerId, productId } = req.params;
        const product = await supplierRegistry.getProduct(providerId, productId);
        return res.status(200).json({ product });
      } catch (err) {
        if (err.message.includes('not found') || err.message.includes('not registered')) {
          return res.status(404).json({ error: 'Not Found', message: err.message });
        }
        next(err);
      }
    },

    /**
     * POST /api/purchases/checkout
     * Initiate checkout (Mode B external redirection bundle).
     */
    async initiateCheckout(req, res, next) {
      try {
        const { providerId, items, deliveryAddress } = req.body;
        if (!providerId) {
          return res.status(400).json({ error: 'Validation Error', message: 'providerId is required.' });
        }
        if (!Array.isArray(items) || items.length === 0) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'items must be a non-empty array of products.',
          });
        }

        const adapter = supplierRegistry.getAdapter(providerId);
        if (!adapter.enabled) {
          return res.status(400).json({
            error: 'Supplier Unavailable',
            message: `Supplier '${adapter.name}' is currently disabled or unconfigured.`,
          });
        }

        if (adapter.checkoutMode === 'integrated') {
          return res.status(400).json({
            error: 'Integrated Checkout Disabled',
            message: 'Integrated in-app checkout is disabled. Only verified external supplier checkout is supported.',
          });
        }

        const checkoutResult = await adapter.initiateCheckout({
          items,
          farmerContext: req.user,
          deliveryAddress,
        });

        return res.status(200).json(checkoutResult);
      } catch (err) {
        if (err.message && (err.message.includes('unverified') || err.message.includes('unavailable') || err.message.includes('disabled'))) {
          return res.status(400).json({
            error: 'Checkout Unavailable',
            message: err.message,
          });
        }
        next(err);
      }
    },

    /**
     * POST /api/purchases/confirm
     * Confirm Mode A integrated order.
     * DISABLED: In-app integrated checkout is disabled until a genuine supplier API
     * and real payment gateway are configured and verified.
     */
    async confirmOrder(req, res) {
      return res.status(400).json({
        error: 'Integrated Checkout Disabled',
        message: 'Integrated in-app checkout is currently disabled. Active purchases must be completed directly on verified supplier websites (external checkout). Integrated checkout will be re-enabled once official supplier APIs and real payment gateways are connected.',
      });
    },

    /**
     * GET /api/purchases
     * List purchase history for authenticated farmer.
     */
    async listPurchases(req, res, next) {
      try {
        const { status, providerId, limit = 50, skip = 0 } = req.query;
        const purchases = await purchaseStore.listPurchases(req.user.id, {
          status,
          providerId,
          limit,
          skip,
        });
        const stats = await purchaseStore.getPurchaseStats(req.user.id);

        return res.status(200).json({
          purchases,
          stats,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/purchases/:purchaseId
     * Get single purchase details.
     */
    async getPurchase(req, res, next) {
      try {
        const { purchaseId } = req.params;
        const purchase = await purchaseStore.getPurchaseById(purchaseId, req.user.id);
        if (!purchase) {
          return res.status(404).json({ error: 'Not Found', message: 'Purchase record not found.' });
        }
        return res.status(200).json({ purchase });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/purchases
     * Create manual purchase record or log completed external order.
     */
    async createPurchase(req, res, next) {
      try {
        const {
          supplierName,
          providerId,
          checkoutMode = 'external_redirect',
          externalOrderId = '',
          idempotencyKey,
          items,
          subtotalINR,
          taxINR = 0,
          deliveryINR = 0,
          discountINR = 0,
          totalINR,
          purchaseDate,
          paymentStatus = 'pending',
          orderStatus = 'initiated',
          externalUrl = '',
          notes = '',
          source = 'farmer_entered',
        } = req.body;

        if (!supplierName || !items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'supplierName and at least one item are required.',
          });
        }

        // Validate items
        for (const item of items) {
          if (!item.name || Number(item.unitPriceINR) < 0 || Number(item.quantity) < 1) {
            return res.status(400).json({
              error: 'Validation Error',
              message: 'Each item must have a valid name, quantity >= 1, and non-negative unit price.',
            });
          }
        }

        // Idempotency check to prevent duplicate entries
        if (idempotencyKey || (externalOrderId && providerId)) {
          const existing = await purchaseStore.findExisting({
            ownerId: req.user.id,
            idempotencyKey,
            externalOrderId,
            providerId,
          });
          if (existing) {
            return res.status(409).json({
              error: 'Conflict',
              message: 'A purchase record with this order ID or idempotency key already exists.',
              purchase: existing,
            });
          }
        }

        const purchaseRecord = await purchaseStore.createPurchase({
          ownerId: req.user.id,
          supplierName: supplierName.trim(),
          providerId: providerId || 'manual',
          checkoutMode,
          externalOrderId: externalOrderId.trim(),
          idempotencyKey: idempotencyKey?.trim(),
          items,
          subtotalINR,
          taxINR,
          deliveryINR,
          discountINR,
          totalINR,
          purchaseDate: purchaseDate || new Date(),
          paymentStatus,
          orderStatus,
          externalUrl: externalUrl.trim(),
          notes: notes.trim(),
          source: ['provider_api', 'verified_webhook', 'supplier_invoice_import', 'farmer_entered'].includes(source)
            ? source
            : 'farmer_entered',
        });

        return res.status(201).json({
          success: true,
          message: 'Purchase record created successfully.',
          purchase: purchaseRecord,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/purchases/:purchaseId/invoice
     * Upload authentic supplier invoice document (PDF, PNG, JPEG, WebP).
     */
    async uploadInvoice(req, res, next) {
      try {
        const { purchaseId } = req.params;
        const purchase = await purchaseStore.getPurchaseById(purchaseId, req.user.id);
        if (!purchase) {
          return res.status(404).json({ error: 'Not Found', message: 'Purchase record not found.' });
        }

        if (!req.file || !req.file.buffer) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'No file uploaded. Please attach an invoice file (PDF, PNG, or JPEG).',
          });
        }

        const { invoiceNumber, invoiceDate, supplierTaxId } = req.body;

        const savedFile = await invoiceStorage.saveInvoice({
          buffer: req.file.buffer,
          ownerId: req.user.id,
          originalName: req.file.originalname,
        });

        const updated = await purchaseStore.attachInvoice(purchaseId, req.user.id, {
          invoiceNumber: invoiceNumber || purchase.invoice?.invoiceNumber || '',
          invoiceDate: invoiceDate || purchase.invoice?.invoiceDate || new Date(),
          supplierTaxId: supplierTaxId || purchase.invoice?.supplierTaxId || '',
          storageKey: savedFile.storageKey,
          storageProvider: savedFile.storageProvider,
          mimeType: savedFile.mimeType,
          originalName: savedFile.originalName,
          bytes: savedFile.bytes,
        });

        return res.status(200).json({
          success: true,
          message: 'Official invoice uploaded and attached successfully.',
          purchase: updated,
        });
      } catch (err) {
        if (err.message.includes('magic bytes') || err.message.includes('Invalid document file format')) {
          return res.status(400).json({ error: 'Validation Error', message: err.message });
        }
        next(err);
      }
    },

    /**
     * GET /api/purchases/:purchaseId/invoice/file
     * Stream authenticated invoice document.
     */
    async downloadInvoice(req, res, next) {
      try {
        const { purchaseId } = req.params;
        const purchase = await purchaseStore.getPurchaseById(purchaseId, req.user.id);
        if (!purchase) {
          return res.status(404).json({ error: 'Not Found', message: 'Purchase record not found.' });
        }

        const invoice = purchase.invoice;
        if (!invoice || !invoice.documentStorageKey) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'No official invoice document is attached to this purchase record.',
          });
        }

        const fileBuffer = await invoiceStorage.getInvoice({
          storageKey: invoice.documentStorageKey,
          storageProvider: invoice.documentStorageProvider,
          mimeType: invoice.documentMimeType,
        });

        if (!fileBuffer) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Invoice document file could not be found or retrieved.',
          });
        }

        const mime = invoice.documentMimeType || 'application/pdf';
        const filename = invoice.documentOriginalName || `invoice-${purchaseId}.pdf`;

        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        return res.send(fileBuffer);
      } catch (err) {
        next(err);
      }
    },

    /**
     * DELETE /api/purchases/:purchaseId
     * Delete a purchase record.
     */
    async deletePurchase(req, res, next) {
      try {
        const { purchaseId } = req.params;
        const deleted = await purchaseStore.deletePurchase(purchaseId, req.user.id);
        if (!deleted) {
          return res.status(404).json({ error: 'Not Found', message: 'Purchase record not found.' });
        }
        return res.status(200).json({ success: true, message: 'Purchase record deleted.' });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/purchases/test-fixture
     * Test-only workflow: creates a clearly marked test purchase record and attached test invoice file.
     * STRICTLY blocked in production to prevent test fixtures from being seeded into production.
     */
    async createTestFixture(req, res, next) {
      try {
        if (process.env.NODE_ENV === 'production') {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Test purchase fixture workflow is disabled in production.',
          });
        }

        const testExternalId = `TEST-ORD-${Date.now().toString().slice(-6)}`;
        const testItem = {
          name: '[TEST] Certified Mustard Hybrid Seeds',
          sku: 'TEST-SEED-MUSTARD',
          category: 'seeds',
          packSize: '1 kg Test Pack',
          quantity: 2,
          unitPriceINR: 450,
          subtotalINR: 900,
        };

        const testRecord = await purchaseStore.createPurchase({
          ownerId: req.user.id,
          supplierName: 'AgriTech Test Inputs Ltd.',
          providerId: 'test_provider',
          checkoutMode: 'manual_import',
          externalOrderId: testExternalId,
          idempotencyKey: `idemp_${testExternalId}`,
          items: [testItem],
          subtotalINR: 900,
          taxINR: 45,
          deliveryINR: 0,
          discountINR: 0,
          totalINR: 945,
          purchaseDate: new Date(),
          paymentStatus: 'paid',
          orderStatus: 'delivered',
          notes: '[TEST RECORD - Verification Fixture]',
          source: 'farmer_entered',
          isTestRecord: true,
        });

        // Build authentic valid %PDF-1.4 header test document
        const testPdfBuffer = Buffer.from(
          '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n185\n%%EOF\n',
          'utf-8'
        );

        const savedFile = await invoiceStorage.saveInvoice({
          buffer: testPdfBuffer,
          ownerId: req.user.id,
          originalName: `test-invoice-${testExternalId}.pdf`,
        });

        const updated = await purchaseStore.attachInvoice(testRecord._id || testRecord.id, req.user.id, {
          invoiceNumber: `INV-${testExternalId}`,
          invoiceDate: new Date(),
          supplierTaxId: '03TEST9999Z1',
          storageKey: savedFile.storageKey,
          storageProvider: savedFile.storageProvider,
          mimeType: savedFile.mimeType,
          originalName: savedFile.originalName,
          bytes: savedFile.bytes,
        });

        return res.status(201).json({
          success: true,
          message: 'Test purchase record and invoice fixture created successfully.',
          purchase: updated,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/purchases/webhook/:providerId
     * Webhook receiver for provider status updates with cryptographic verification.
     */
    async handleWebhook(req, res, next) {
      try {
        const { providerId } = req.params;
        let adapter;
        try {
          adapter = supplierRegistry.getAdapter(providerId);
        } catch {
          return res.status(404).json({ error: 'Not Found', message: `Unknown provider '${providerId}'.` });
        }

        const signature =
          req.headers['x-signature'] ||
          req.headers['x-webhook-signature'] ||
          req.headers['x-partner-signature'] ||
          '';

        const isValid = adapter.verifyWebhook(req.body, signature, req.headers);
        if (!isValid) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid webhook signature or verification failed.',
          });
        }

        const { externalOrderId, orderStatus, paymentStatus, ownerId } = req.body;
        if (!externalOrderId || !ownerId) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Webhook payload missing externalOrderId or ownerId.',
          });
        }

        const existing = await purchaseStore.findExisting({
          ownerId,
          externalOrderId,
          idempotencyKey: externalOrderId,
          providerId,
        });

        if (existing) {
          await purchaseStore.updateStatus(existing._id || existing.id, ownerId, {
            orderStatus,
            paymentStatus,
            verifiedAt: new Date(),
            verifiedBy: `Verified Webhook (${adapter.name})`,
          });
        }

        return res.status(200).json({ received: true, verified: true });
      } catch (err) {
        next(err);
      }
    },
  };
};

export default createPurchaseController;
