import { BigHaatAdapter } from './BigHaatAdapter.js';
import { AgroStarAdapter } from './AgroStarAdapter.js';
import { AgrimAdapter } from './AgrimAdapter.js';
import { OndcAgriAdapter } from './OndcAgriAdapter.js';
import { PartnerGatewayAdapter } from './PartnerGatewayAdapter.js';

export class SupplierRegistry {
  constructor() {
    this.adapters = new Map();
    this.initDefaultAdapters();
  }

  initDefaultAdapters() {
    this.register(new BigHaatAdapter());
    this.register(new AgroStarAdapter());
    this.register(new AgrimAdapter());
    this.register(new OndcAgriAdapter());
    this.register(new PartnerGatewayAdapter());
  }

  register(adapter) {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapter(providerId) {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(`Supplier provider '${providerId}' is not registered or supported.`);
    }
    return adapter;
  }

  listSuppliers() {
    return Array.from(this.adapters.values()).map((adapter) => adapter.getCapabilities());
  }

  /**
   * Search catalogs across all enabled suppliers or a specific supplier.
   */
  async searchCatalog({ query = '', category = '', supplierId, minPrice, maxPrice, page = 1, limit = 24 } = {}) {
    let targetAdapters = [];
    if (supplierId && supplierId !== 'all') {
      const adapter = this.adapters.get(supplierId);
      if (adapter && adapter.enabled) targetAdapters = [adapter];
    } else {
      targetAdapters = Array.from(this.adapters.values()).filter((a) => a.enabled);
    }

    if (targetAdapters.length === 0) {
      return {
        products: [],
        total: 0,
        page: Number(page),
        suppliers: this.listSuppliers(),
      };
    }

    const adapterPromises = targetAdapters.map(async (adapter) => {
      try {
        const res = await adapter.searchProducts({ query, category, minPrice, maxPrice, page: 1, limit: 100 });
        return res.products || [];
      } catch (err) {
        console.warn(`[SupplierRegistry] Error fetching from ${adapter.id}:`, err.message);
        return [];
      }
    });

    const resultsByAdapter = await Promise.all(adapterPromises);
    const aggregated = resultsByAdapter.flat();

    // Strictly enforce: Remove unusable products whose URL is unverified, broken, or a homepage
    const verifiedOnly = aggregated.filter(
      (p) =>
        p.urlVerified === true &&
        p.externalProductUrl &&
        p.externalProductUrl.startsWith('http') &&
        !p.externalProductUrl.endsWith('.in') &&
        !p.externalProductUrl.endsWith('.in/') &&
        !p.externalProductUrl.endsWith('.com') &&
        !p.externalProductUrl.endsWith('.com/')
    );

    // Sort by name or relevance
    verifiedOnly.sort((a, b) => a.name.localeCompare(b.name));

    const total = verifiedOnly.length;
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginated = verifiedOnly.slice(startIndex, startIndex + Number(limit));

    return {
      products: paginated,
      total,
      page: Number(page),
      suppliers: this.listSuppliers(),
    };
  }

  /**
   * Find a specific product by providerId and productId.
   */
  async getProduct(providerId, productId) {
    const adapter = this.getAdapter(providerId);
    return adapter.getProductDetails(productId);
  }
}

export const supplierRegistry = new SupplierRegistry();
export default supplierRegistry;
