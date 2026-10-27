import { SupplierAdapterBase } from './SupplierAdapterBase.js';

/**
 * AGRIM Supplier Integration Adapter
 * AGRIM (agrim.app) is an exclusive B2B agri-inputs marketplace for rural retailers and bulk buyers.
 * Operations require retailer login through the AGRIM Retailer Mobile App.
 * Direct web checkout is disabled until authorized B2B API access is established.
 */
export class AgrimAdapter extends SupplierAdapterBase {
  constructor() {
    const isEnabled = process.env.AGRIM_ENABLED !== 'false';

    super({
      id: 'agrim',
      name: 'AGRIM (B2B Agri Inputs)',
      checkoutMode: 'external_redirect',
      enabled: isEnabled,
      partnerApproved: false,
    });

    this.catalog = [
      {
        id: 'agrim_irrig_drip_kit_1acre',
        providerId: 'agrim',
        supplierName: 'AGRIM (B2B Agri Inputs)',
        name: 'Jain Irrigation 1-Acre Complete Drip Irrigation Kit',
        category: 'irrigation',
        sku: 'JAIN-DRIP-1ACRE-KIT',
        packSize: '1 Complete Field Set (16mm Lateral + Screen Filter + Fittings)',
        indicativePriceINR: 18500,
        priceType: 'indicative',
        priceNote: 'Indicative wholesale lot price for registered retailers.',
        inStock: false,
        stockStatus: 'Wholesale B2B availability via AGRIM App',
        deliveryEstimate: '5 to 7 business days bulk transport',
        description: 'Complete 1-acre drip irrigation installation package. B2B wholesale lot available to verified rural retailers on the AGRIM Retailer App.',
        specifications: {
          brand: 'Jain Irrigation Systems',
          areaCoverage: '1 Acre',
          tier: 'Wholesale B2B Only',
        },
        externalProductUrl: 'https://agrim.app',
        urlVerified: false,
        verificationMessage: 'Direct web checkout is unavailable. AGRIM requires business registration on the AGRIM Retailer App.',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: true,
      },
    ];
  }

  async searchProducts({ query = '', category = '', minPrice, maxPrice, page = 1, limit = 20 } = {}) {
    if (!this.enabled) {
      return { products: [], total: 0, page, message: 'AGRIM supplier integration is disabled.' };
    }

    // Hide products whose purchase URL is unverified, broken, or unavailable.
    // Do not confuse a homepage or app link with a working product-detail link.
    let results = this.catalog
      .filter((p) => p.urlVerified === true)
      .map((p) => ({
        ...p,
        unitPriceINR: p.indicativePriceINR,
      }));

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }

    if (category && category !== 'all') {
      results = results.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    const total = results.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginated = results.slice(startIndex, startIndex + Number(limit));

    return {
      products: paginated,
      total,
      page: Number(page),
      supplier: {
        id: this.id,
        name: this.name,
        checkoutMode: this.checkoutMode,
        directWebCheckoutAvailable: false,
      },
    };
  }

  async getProductDetails(productId) {
    const item = this.catalog.find((p) => p.id === productId);
    if (!item) {
      throw new Error(`Product '${productId}' not found in AGRIM catalogue.`);
    }
    return {
      ...item,
      unitPriceINR: item.indicativePriceINR,
    };
  }

  async initiateCheckout({ items = [] } = {}) {
    throw new Error(
      'Direct web checkout is unavailable for AGRIM. AGRIM is an exclusive B2B wholesale marketplace accessed through the AGRIM Retailer App.'
    );
  }

  async getOrderStatus(externalOrderId) {
    return {
      providerId: this.id,
      externalOrderId,
      orderStatus: 'farmer_reported',
      paymentStatus: 'pending',
      message: 'Status is maintained via farmer-uploaded invoices.',
    };
  }
}

export default AgrimAdapter;
