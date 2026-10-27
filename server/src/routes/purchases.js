import { Router } from 'express';
import { createPurchaseController, invoiceUploadMiddleware } from '../controllers/purchaseController.js';
import { createProtect, restrictAdminFromAgriculturalWrites } from '../middleware/auth.js';
import { purchaseStore as defaultPurchaseStore } from '../storage/purchaseStore.js';
import { userStore as defaultUserStore } from '../storage/userStore.js';
import { invoiceStorage as defaultInvoiceStorage } from '../storage/invoiceStorage.js';
import { supplierRegistry as defaultSupplierRegistry } from '../services/suppliers/supplierRegistry.js';

export const createPurchaseRouter = (
  purchaseStore = defaultPurchaseStore,
  userStore = defaultUserStore,
  invoiceStorage = defaultInvoiceStorage,
  supplierRegistry = defaultSupplierRegistry
) => {
  const router = Router();
  const controller = createPurchaseController(purchaseStore, invoiceStorage, supplierRegistry);
  const protect = createProtect(userStore);

  // 1. Public or Webhook routes (no user JWT required)
  router.post('/webhook/:providerId', controller.handleWebhook);

  // 2. Authenticated discovery and catalog routes
  router.get('/suppliers', protect, controller.getSuppliers);
  router.get('/products', protect, controller.searchProducts);
  router.get('/products/:providerId/:productId', protect, controller.getProductDetails);

  // 3. Authenticated checkout and order placement routes
  router.post('/checkout', protect, restrictAdminFromAgriculturalWrites, controller.initiateCheckout);
  router.post('/confirm', protect, restrictAdminFromAgriculturalWrites, controller.confirmOrder);
  router.post('/test-fixture', protect, restrictAdminFromAgriculturalWrites, controller.createTestFixture);

  // 4. Authenticated purchase history and invoice handling routes
  router.route('/')
    .get(protect, controller.listPurchases)
    .post(protect, restrictAdminFromAgriculturalWrites, controller.createPurchase);

  router.route('/:purchaseId')
    .get(protect, controller.getPurchase)
    .delete(protect, restrictAdminFromAgriculturalWrites, controller.deletePurchase);

  router.post(
    '/:purchaseId/invoice',
    protect,
    restrictAdminFromAgriculturalWrites,
    invoiceUploadMiddleware,
    controller.uploadInvoice
  );

  router.get('/:purchaseId/invoice/file', protect, controller.downloadInvoice);

  return router;
};

export default createPurchaseRouter;
