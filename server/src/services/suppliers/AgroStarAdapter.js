import { SupplierAdapterBase } from './SupplierAdapterBase.js';

/**
 * AgroStar Supplier Integration Adapter
 * AgroStar (corporate.agrostar.in) operates an omnichannel direct-to-farmer and retailer network.
 * Direct-to-consumer web product checkout links are currently not available publicly.
 * Products are listed for indicative information; direct checkout is disabled until official API access is granted.
 */
export class AgroStarAdapter extends SupplierAdapterBase {
  constructor() {
    const isEnabled = process.env.AGROSTAR_ENABLED !== 'false';

    super({
      id: 'agrostar',
      name: 'AgroStar',
      checkoutMode: 'external_redirect',
      enabled: isEnabled,
      partnerApproved: false,
    });

    this.catalog = [
      {
        id: 'as_seed_mahyco_cotton_bollgard',
        providerId: 'agrostar',
        supplierName: 'AgroStar',
        name: 'Mahyco MRC 7351 BG-II Cotton Hybrid Seeds',
        category: 'seeds',
        sku: 'MAH-MRC7351-475G',
        packSize: '475g Packet (450g BG-II + 25g Non-Bt Refugia)',
        indicativePriceINR: 864,
        priceType: 'indicative',
        priceNote: 'Indicative price; AgroStar orders are fulfilled via the official AgroStar mobile app.',
        inStock: false,
        stockStatus: 'Available via AgroStar Mobile App / Kendra',
        deliveryEstimate: '2 to 4 business days via AgroStar rural delivery',
        description: 'Bollgard-II hybrid cotton with high boll retention and ginning outturn. Available via AgroStar Saathi retailer app or Kendra.',
        specifications: {
          brand: 'Mahyco Seeds',
          crop: 'Cotton (Kapas)',
          duration: '160 - 170 Days',
          technology: 'Bollgard II',
        },
        externalProductUrl: 'https://corporate.agrostar.in',
        urlVerified: false,
        verificationMessage: 'Direct web product URL is unavailable. Purchases are conducted via the AgroStar Mobile App or local Kendra.',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: true,
      },
      {
        id: 'as_fert_coromandel_gromor_28280',
        providerId: 'agrostar',
        supplierName: 'AgroStar',
        name: 'Coromandel GROMOR 28:28:0 Complex Fertilizer',
        category: 'fertilizer',
        sku: 'COR-GROMOR-28280-50KG',
        packSize: '50 kg Bag',
        indicativePriceINR: 1550,
        priceType: 'indicative',
        priceNote: 'Indicative price; check local AgroStar retail partner rates.',
        inStock: false,
        stockStatus: 'Available via AgroStar Retailer Network',
        deliveryEstimate: '3 to 5 business days',
        description: 'High-analysis complex fertilizer with equal high Nitrogen and Phosphorus (28:28:0) for basal application.',
        specifications: {
          brand: 'Coromandel International',
          grade: 'NPK 28:28:0',
        },
        externalProductUrl: 'https://corporate.agrostar.in',
        urlVerified: false,
        verificationMessage: 'Direct web product URL is unavailable. Purchases are conducted via the AgroStar Mobile App or local Kendra.',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: true,
      },
    ];
  }

  async searchProducts({ query = '', category = '', minPrice, maxPrice, page = 1, limit = 20 } = {}) {
    if (!this.enabled) {
      return { products: [], total: 0, page, message: 'AgroStar supplier integration is disabled.' };
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
      throw new Error(`Product '${productId}' not found in AgroStar catalogue.`);
    }
    return {
      ...item,
      unitPriceINR: item.indicativePriceINR,
    };
  }

  async initiateCheckout({ items = [] } = {}) {
    throw new Error(
      'Direct web checkout is unavailable for AgroStar. Purchases must be made via the official AgroStar mobile app or physical Kendra. Once purchased, you can record your receipt in Purchase History.'
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

export default AgroStarAdapter;
