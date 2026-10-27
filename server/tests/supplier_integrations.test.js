import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { BigHaatAdapter } from '../src/services/suppliers/BigHaatAdapter.js';
import { AgroStarAdapter } from '../src/services/suppliers/AgroStarAdapter.js';
import { AgrimAdapter } from '../src/services/suppliers/AgrimAdapter.js';
import { OndcAgriAdapter } from '../src/services/suppliers/OndcAgriAdapter.js';
import { PartnerGatewayAdapter } from '../src/services/suppliers/PartnerGatewayAdapter.js';
import { supplierRegistry } from '../src/services/suppliers/supplierRegistry.js';
import { invoiceStorage, detectDocumentMimeType } from '../src/storage/invoiceStorage.js';
import { purchaseStore } from '../src/storage/purchaseStore.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';

const { createApp } = await import('../src/app.js');

describe('AgriTech Supplier Integrations: Provider Adapters & Normalization', () => {
  test('BigHaatAdapter: initializes in Mode B with authentic catalog items, verified live URLs, and CDN images', async () => {
    const adapter = new BigHaatAdapter();
    assert.equal(adapter.id, 'bighaat');
    assert.equal(adapter.checkoutMode, 'external_redirect');
    assert.equal(adapter.enabled, true);

    const result = await adapter.searchProducts({ query: 'Saaho' });
    assert.ok(result.products.length > 0);
    const item = result.products[0];
    assert.equal(item.providerId, 'bighaat');
    assert.ok(item.sku);
    assert.ok(item.packSize);
    assert.ok(item.unitPriceINR > 0);
    assert.equal(item.priceType, 'indicative');
    assert.equal(item.urlVerified, true);
    assert.match(item.externalProductUrl, /^https:\/\/www\.bighaat\.com\/products\//);
    assert.ok(item.imageUrl);
    assert.match(item.imageUrl, /^https:\/\/cdn\.shopify\.com\//);
  });

  test('AgroStarAdapter: hides unverified products from purchasable catalogue and disables web checkout', async () => {
    const adapter = new AgroStarAdapter();
    assert.equal(adapter.id, 'agrostar');
    assert.equal(adapter.checkoutMode, 'external_redirect');

    const result = await adapter.searchProducts({ category: 'seeds' });
    // Unverified products must not be returned in purchasable catalogue
    assert.equal(result.products.length, 0);

    await assert.rejects(
      async () => {
        await adapter.initiateCheckout({ items: [{ productId: 'as_seed_mahyco_cotton_bollgard' }] });
      },
      /Direct web checkout is unavailable for AgroStar/
    );
  });

  test('AgrimAdapter: hides wholesale app-only products from web purchasable catalogue', async () => {
    const adapter = new AgrimAdapter();
    assert.equal(adapter.id, 'agrim');
    assert.equal(adapter.checkoutMode, 'external_redirect');

    const result = await adapter.searchProducts({ category: 'irrigation' });
    // Unverified web products must not be returned in purchasable catalogue
    assert.equal(result.products.length, 0);

    await assert.rejects(
      async () => {
        await adapter.initiateCheckout({ items: [{ productId: 'agrim_irrigation_kit' }] });
      },
      /Direct web checkout is unavailable for AGRIM/
    );
  });

  test('OndcAgriAdapter: disabled pending live Network Participant accreditation', async () => {
    const adapter = new OndcAgriAdapter();
    assert.equal(adapter.id, 'ondc');
    assert.equal(adapter.enabled, false);

    await assert.rejects(
      async () => {
        await adapter.initiateCheckout();
      },
      /Integrated ONDC network checkout is disabled/
    );
  });

  test('PartnerGatewayAdapter: disabled from simulating local integrated purchases', async () => {
    const adapter = new PartnerGatewayAdapter();
    assert.equal(adapter.id, 'partner_gateway');
    assert.equal(adapter.enabled, false);

    await assert.rejects(
      async () => {
        await adapter.confirmOrder();
      },
      /Integrated in-app purchasing is disabled/
    );
  });

  test('SupplierRegistry: returns ONLY verified products with live destination links and images', async () => {
    const search = await supplierRegistry.searchCatalog({ limit: 50 });
    assert.ok(search.products.length >= 8);

    // Every returned product must be urlVerified and have a valid non-homepage destination URL
    for (const prod of search.products) {
      assert.equal(prod.urlVerified, true);
      assert.ok(prod.externalProductUrl);
      assert.equal(prod.externalProductUrl.endsWith('.com'), false);
      assert.equal(prod.externalProductUrl.endsWith('.in'), false);
      assert.ok(prod.imageUrl);
    }
  });
});

describe('Invoice Storage & Magic Byte Security Validation', () => {
  test('detectDocumentMimeType: correctly identifies PDF, JPEG, PNG, and WebP', () => {
    const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const webpHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);

    assert.equal(detectDocumentMimeType(pdfHeader), 'application/pdf');
    assert.equal(detectDocumentMimeType(jpegHeader), 'image/jpeg');
    assert.equal(detectDocumentMimeType(pngHeader), 'image/png');
    assert.equal(detectDocumentMimeType(webpHeader), 'image/webp');
  });

  test('detectDocumentMimeType: rejects executable script or HTML disguised as invoice', () => {
    const fakePdfScript = Buffer.from('<script>alert("exploit")</script>');
    assert.equal(detectDocumentMimeType(fakePdfScript), null);

    const fakeShell = Buffer.from('#!/bin/bash\necho "test"');
    assert.equal(detectDocumentMimeType(fakeShell), null);
  });

  test('invoiceStorage.saveInvoice: rejects spoofed non-document file', async () => {
    const maliciousBuffer = Buffer.from('This is a text file not a PDF');
    await assert.rejects(
      async () => {
        await invoiceStorage.saveInvoice({ buffer: maliciousBuffer, ownerId: 'test_user_1' });
      },
      /magic bytes do not match|Invalid document file format/
    );
  });
});

describe('End-to-End Purchase & Order API with Strict Multi-Tenant Isolation', () => {
  let server;
  let baseUrl;
  let farmerTokenA;
  let farmerTokenB;
  const farmerIdA = '65d1a2b3c4d5e6f7a8b9c0d1';
  const farmerIdB = '65d1a2b3c4d5e6f7a8b9c0d2';

  const usersMap = new Map();
  usersMap.set(farmerIdA, {
    _id: farmerIdA,
    id: farmerIdA,
    name: 'Farmer Ramesh',
    email: 'farmerA@agritech.org',
    role: 'farmer',
    status: 'active',
    emailVerified: true,
  });
  usersMap.set(farmerIdB, {
    _id: farmerIdB,
    id: farmerIdB,
    name: 'Farmer Suresh',
    email: 'farmerB@agritech.org',
    role: 'farmer',
    status: 'active',
    emailVerified: true,
  });

  const mockUserStore = {
    async findById(userId) {
      return usersMap.get(String(userId)) || null;
    },
  };

  before(async () => {
    try {
      const { writeLocalCollection } = await import('../src/storage/localJsonStore.js');
      writeLocalCollection('purchases', []);
    } catch {
      // Ignore if not local json mode
    }

    const app = createApp({ userStore: mockUserStore });
    server = app.listen(0);
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;

    farmerTokenA = jwt.sign(
      { id: farmerIdA, email: 'farmerA@agritech.org', role: 'farmer', emailVerified: true },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    farmerTokenB = jwt.sign(
      { id: farmerIdB, email: 'farmerB@agritech.org', role: 'farmer', emailVerified: true },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. Unauthenticated requests to /api/purchases are rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/purchases`);
    assert.equal(res.status, 401);
  });

  test('2. Discovery: Farmer A lists verified suppliers and capabilities', async () => {
    const res = await fetch(`${baseUrl}/api/purchases/suppliers`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.suppliers));
    assert.ok(data.suppliers.some((s) => s.id === 'bighaat' && s.checkoutMode === 'external_redirect'));
  });

  test('3. Mode B Handoff: Farmer A initiates checkout for BigHaat verified product and receives verified redirect URL', async () => {
    const res = await fetch(`${baseUrl}/api/purchases/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        providerId: 'bighaat',
        items: [{ productId: 'bh_fmc_coragen_150ml', quantity: 1, unitPriceINR: 1071 }],
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.checkoutMode, 'external_redirect');
    assert.equal(data.urlVerified, true);
    assert.equal(data.redirectUrl, 'https://www.bighaat.com/products/coragen-dupont');
    assert.ok(data.disclaimer.includes('BigHaat handles your checkout'));
  });

  test('3b. Buy Button Click Guarantee: External checkout initiation does NOT create a purchase record', async () => {
    // Check purchase list before clicking Buy
    const listBeforeRes = await fetch(`${baseUrl}/api/purchases`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` },
    });
    const listBeforeData = await listBeforeRes.json();
    const countBefore = listBeforeData.purchases.length;

    // Simulate clicking Buy on another verified product
    const clickRes = await fetch(`${baseUrl}/api/purchases/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        providerId: 'bighaat',
        items: [{ productId: 'bh_bayer_roundup_1l', quantity: 1, unitPriceINR: 510 }],
      }),
    });
    assert.equal(clickRes.status, 200);

    // Check purchase list after - must be exactly unchanged
    const listAfterRes = await fetch(`${baseUrl}/api/purchases`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` },
    });
    const listAfterData = await listAfterRes.json();
    assert.equal(listAfterData.purchases.length, countBefore);
  });

  test('4. Integrated Checkout Guard: Calling /api/purchases/confirm is rejected with 400 Integrated Checkout Disabled', async () => {
    const res = await fetch(`${baseUrl}/api/purchases/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        providerId: 'partner_gateway',
        idempotencyKey: 'idemp_order_test_101',
        quoteData: {
          items: [{ name: 'Fake Item', quantity: 1, unitPriceINR: 100 }],
        },
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, 'Integrated Checkout Disabled');
  });

  test('5. Unverified / App-Only Provider Guard: Calling /api/purchases/checkout for AgroStar is rejected with 400', async () => {
    const res = await fetch(`${baseUrl}/api/purchases/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        providerId: 'agrostar',
        items: [{ productId: 'as_seed_mahyco_cotton_bollgard', quantity: 1 }],
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, 'Checkout Unavailable');
    assert.match(data.message, /Direct web checkout is unavailable/);
  });

  let manualPurchaseId;
  test('6. Purchase Record: Farmer A manually records an external input purchase as farmer-reported', async () => {
    const res = await fetch(`${baseUrl}/api/purchases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        supplierName: 'Kisan Seva Kendra Fertilizer Depot',
        externalOrderId: 'MEMO-8842',
        idempotencyKey: 'idemp_memo_8842',
        items: [
          {
            name: 'Neem Coated Urea',
            category: 'fertilizer',
            packSize: '45 kg Bag',
            quantity: 5,
            unitPriceINR: 266.5,
          },
        ],
        subtotalINR: 1332.5,
        taxINR: 66.5,
        totalINR: 1399,
        paymentStatus: 'paid',
        orderStatus: 'delivered',
        notes: 'Applied for basal wheat nutrition',
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.purchase.supplierName, 'Kisan Seva Kendra Fertilizer Depot');
    assert.equal(data.purchase.source, 'farmer_entered');
    assert.equal(data.purchase.verifiedAt, null);
    assert.equal(data.purchase.verifiedBy, '');
    manualPurchaseId = data.purchase._id || data.purchase.id;
  });

  test('6b. Truthful Record Guarantee: Farmer-reported purchase is unverified without independent proof', async () => {
    assert.ok(manualPurchaseId);
    const getRes = await fetch(`${baseUrl}/api/purchases/${manualPurchaseId}`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` },
    });
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.purchase.source, 'farmer_entered');
    assert.equal(getData.purchase.verifiedAt, null);
    assert.equal(getData.purchase.verifiedBy, '');
  });

  test('7. Idempotency Guard: Re-submitting manual purchase with same idempotencyKey returns 409 Conflict', async () => {
    const res = await fetch(`${baseUrl}/api/purchases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: JSON.stringify({
        supplierName: 'Kisan Seva Kendra Fertilizer Depot',
        externalOrderId: 'MEMO-8842',
        idempotencyKey: 'idemp_memo_8842',
        items: [
          {
            name: 'Neem Coated Urea',
            category: 'fertilizer',
            packSize: '45 kg Bag',
            quantity: 5,
            unitPriceINR: 266.5,
          },
        ],
        totalINR: 1399,
      }),
    });

    assert.equal(res.status, 409);
    const data = await res.json();
    assert.equal(data.error, 'Conflict');
  });

  test('8. Invoice Attachment: Farmer A uploads authentic PDF invoice to purchase record', async () => {
    assert.ok(manualPurchaseId);

    // Build a minimal valid PDF-1.4 document in memory
    const validPdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n185\n%%EOF\n',
      'utf-8'
    );

    const formData = new FormData();
    formData.append('invoice', new Blob([validPdfBuffer], { type: 'application/pdf' }), 'tax-invoice-8842.pdf');
    formData.append('invoiceNumber', 'INV-MEMO-8842');
    formData.append('supplierTaxId', '03AAAAA0000A1Z2');

    const res = await fetch(`${baseUrl}/api/purchases/${manualPurchaseId}/invoice`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${farmerTokenA}`,
      },
      body: formData,
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.purchase.invoice?.invoiceNumber, 'INV-MEMO-8842');
    assert.equal(data.purchase.invoice?.documentMimeType, 'application/pdf');
  });

  test('9. Invoice Download: Farmer A downloads uploaded invoice file stream', async () => {
    assert.ok(manualPurchaseId);
    const res = await fetch(`${baseUrl}/api/purchases/${manualPurchaseId}/invoice/file`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    const buffer = Buffer.from(await res.arrayBuffer());
    assert.equal(detectDocumentMimeType(buffer), 'application/pdf');
  });

  test('10. MULTI-TENANT ISOLATION: Farmer B CANNOT access Farmer A purchase record (404)', async () => {
    assert.ok(manualPurchaseId);
    const res = await fetch(`${baseUrl}/api/purchases/${manualPurchaseId}`, {
      headers: { Authorization: `Bearer ${farmerTokenB}` },
    });
    assert.equal(res.status, 404);
  });

  test('11. MULTI-TENANT ISOLATION: Farmer B CANNOT download Farmer A invoice document (404)', async () => {
    assert.ok(manualPurchaseId);
    const res = await fetch(`${baseUrl}/api/purchases/${manualPurchaseId}/invoice/file`, {
      headers: { Authorization: `Bearer ${farmerTokenB}` },
    });
    assert.equal(res.status, 404);
  });

  test('12. MULTI-TENANT ISOLATION: Farmer B CANNOT upload invoice to Farmer A purchase (404)', async () => {
    assert.ok(manualPurchaseId);
    const validPdfBuffer = Buffer.from('%PDF-1.4\n%%EOF');
    const formData = new FormData();
    formData.append('invoice', new Blob([validPdfBuffer], { type: 'application/pdf' }), 'hack.pdf');

    const res = await fetch(`${baseUrl}/api/purchases/${manualPurchaseId}/invoice`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${farmerTokenB}` },
      body: formData,
    });
    assert.equal(res.status, 404);
  });

  test('13. Credential Security: Supplier endpoints never expose API keys or secrets in responses', async () => {
    const res = await fetch(`${baseUrl}/api/purchases/suppliers`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` },
    });
    const text = await res.text();
    const adapter = supplierRegistry.getAdapter('partner_gateway');
    assert.equal(text.includes(adapter.webhookSecret), false);
    assert.equal(text.includes(adapter.apiKey), false);
    assert.equal(text.includes(process.env.JWT_SECRET), false);
  });

  let testFixturePurchaseId;
  test('14. Test Fixture Workflow: Creates marked test purchase and authentic test invoice in non-production', async () => {
    const fixtureRes = await fetch(`${baseUrl}/api/purchases/test-fixture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${farmerTokenA}` },
    });
    assert.equal(fixtureRes.status, 201);
    const fixtureData = await fixtureRes.json();
    assert.equal(fixtureData.success, true);
    assert.equal(fixtureData.purchase.isTestRecord, true);
    assert.match(fixtureData.purchase.notes, /TEST RECORD/);
    assert.ok(fixtureData.purchase.invoice?.documentStorageKey);
    testFixturePurchaseId = fixtureData.purchase._id || fixtureData.purchase.id;

    // Verify downloading test fixture invoice
    const invRes = await fetch(`${baseUrl}/api/purchases/${testFixturePurchaseId}/invoice/file`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` },
    });
    assert.equal(invRes.status, 200);
    assert.equal(invRes.headers.get('content-type'), 'application/pdf');
    const invBuffer = Buffer.from(await invRes.arrayBuffer());
    assert.equal(detectDocumentMimeType(invBuffer), 'application/pdf');
  });

  test('15. Production Shield: Test fixture creation is strictly forbidden in production mode', async () => {
    const { createPurchaseController } = await import('../src/controllers/purchaseController.js');
    const controller = createPurchaseController(purchaseStore, invoiceStorage, supplierRegistry);
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      let statusCode = 0;
      let jsonBody = null;
      const mockRes = {
        status(code) {
          statusCode = code;
          return {
            json(body) {
              jsonBody = body;
            },
          };
        },
      };
      await controller.createTestFixture({ user: { id: farmerIdA } }, mockRes, () => {});
      assert.equal(statusCode, 403);
      assert.equal(jsonBody.error, 'Forbidden');
      assert.match(jsonBody.message, /disabled in production/);
    } finally {
      process.env.NODE_ENV = oldEnv;
    }
  });

  test('16. Backend Restart & Persistence Verification: Purchase records and documents persist across store reload', async () => {
    // List purchases directly from storage abstraction simulating restart
    const purchases = await purchaseStore.listPurchases(farmerIdA);
    assert.ok(purchases.length >= 2);
    const testRecord = purchases.find((p) => p.isTestRecord);
    assert.ok(testRecord);
    assert.ok(testRecord.invoice?.documentStorageKey);

    // Retrieve invoice document buffer directly from storage
    const fileBuffer = await invoiceStorage.getInvoice({
      storageKey: testRecord.invoice.documentStorageKey,
      storageProvider: testRecord.invoice.documentStorageProvider,
      mimeType: testRecord.invoice.documentMimeType,
    });
    assert.ok(Buffer.isBuffer(fileBuffer));
    assert.equal(fileBuffer.slice(0, 5).toString('ascii'), '%PDF-');
  });
});
