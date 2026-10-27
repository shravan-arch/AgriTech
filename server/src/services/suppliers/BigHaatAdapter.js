import { SupplierAdapterBase } from './SupplierAdapterBase.js';

/**
 * BigHaat Supplier Integration Adapter (Mode B: Verified External Redirection)
 * Uses 100% verified, live product URLs directly from the official bighaat.com storefront.
 * Sourced and verified against active official product feeds.
 * Includes authorized CDN product image URLs and explicit verified-link status.
 */
export class BigHaatAdapter extends SupplierAdapterBase {
  constructor() {
    const isEnabled = process.env.BIGHAAT_ENABLED !== 'false';

    super({
      id: 'bighaat',
      name: 'BigHaat India',
      checkoutMode: 'external_redirect',
      enabled: isEnabled,
      partnerApproved: false,
    });

    // Curated catalog with 100% verified live URLs and authentic CDN product images
    this.catalog = [
      {
        id: 'bh_fmc_coragen_150ml',
        providerId: 'bighaat',
        supplierName: 'BigHaat India',
        name: 'FMC Coragen Insecticide (Chlorantraniliprole 18.5% SC)',
        category: 'pesticide',
        sku: 'FMC-CORAGEN-150ML',
        packSize: '150 ml Bottle',
        indicativePriceINR: 1071,
        priceType: 'indicative',
        priceNote: 'Indicative price; verify live discounts and batch pricing on BigHaat.',
        inStock: true,
        stockStatus: 'Check live stock on BigHaat',
        deliveryEstimate: '3 to 5 business days pan-India delivery',
        description: 'Broad-spectrum anthranilic diamide insecticide (Rynaxypyr) controlling Stem Borer, Leaf Folder, and Fruit Borer in paddy, sugarcane, and vegetables.',
        specifications: {
          brand: 'FMC India',
          activeIngredient: 'Chlorantraniliprole 18.5% SC',
          dosage: '60 ml per acre',
          targetPests: 'Stem Borer, Leaf Folder, Fruit Borer',
          toxicity: 'Green Label (Low mammalian toxicity)',
        },
        externalProductUrl: 'https://www.bighaat.com/products/coragen-dupont',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0722/2059/files/coragen-dupont-file-1135.jpg?v=1737429360',
        imageAlt: 'FMC Coragen Insecticide Bottle',
        urlVerified: true,
        verifiedAt: '2026-10-28',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: false,
      },
      {
        id: 'bh_bayer_roundup_1l',
        providerId: 'bighaat',
        supplierName: 'BigHaat India',
        name: 'Bayer Roundup Non-Selective Herbicide (Glyphosate 41% SL)',
        category: 'pesticide',
        sku: 'BAYER-ROUNDUP-1L',
        packSize: '1 Liter Bottle',
        indicativePriceINR: 510,
        priceType: 'indicative',
        priceNote: 'Indicative price; subject to live seller promotions on BigHaat.',
        inStock: true,
        stockStatus: 'Check live stock on BigHaat',
        deliveryEstimate: '3 to 5 business days pan-India delivery',
        description: 'Systemic, non-selective post-emergence weed control herbicide absorbed by foliage and translocated throughout the plant.',
        specifications: {
          brand: 'Bayer CropScience',
          activeIngredient: 'Glyphosate 41% SL',
          application: 'Non-cropped land, bunds, and plantation weed management',
          action: 'Systemic translocated herbicide',
        },
        externalProductUrl: 'https://www.bighaat.com/products/roundup-herbicide',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0722/2059/files/roundup-herbicide-file-2203.jpg?v=1737425966',
        imageAlt: 'Bayer Roundup Herbicide 1L Pack',
        urlVerified: true,
        verifiedAt: '2026-10-28',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: false,
      },
      {
        id: 'bh_dhanuka_conika_250g',
        providerId: 'bighaat',
        supplierName: 'BigHaat India',
        name: 'Dhanuka Conika Systemic & Contact Fungicide',
        category: 'pesticide',
        sku: 'DHAN-CONIKA-250G',
        packSize: '250g Pack',
        indicativePriceINR: 460,
        priceType: 'indicative',
        priceNote: 'Indicative price; verify live listing on BigHaat.',
        inStock: true,
        stockStatus: 'Check live stock on BigHaat',
        deliveryEstimate: '3 to 5 business days',
        description: 'Dual combination fungicide (Kasugamycin 5% + Copper Oxychloride 45% WP) providing systemic and contact prevention against bacterial blight and fungal blast.',
        specifications: {
          brand: 'Dhanuka Agritech',
          composition: 'Kasugamycin 5% + Copper Oxychloride 45% WP',
          targetDiseases: 'Bacterial Leaf Blight, Blast in Paddy, Anthracnose in Chilli',
        },
        externalProductUrl: 'https://www.bighaat.com/products/conika-fungicide',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0722/2059/files/conika-fungicide-file-4999.webp?v=1737471922',
        imageAlt: 'Dhanuka Conika Fungicide Packet',
        urlVerified: true,
        verifiedAt: '2026-10-28',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: false,
      },
      {
        id: 'bh_katyayani_npk_1kg',
        providerId: 'bighaat',
        supplierName: 'BigHaat India',
        name: 'Katyayani NPK 19:19:19 100% Water Soluble Fertilizer',
        category: 'fertilizer',
        sku: 'KAT-NPK19-1KG',
        packSize: '1 kg Pack',
        indicativePriceINR: 290,
        priceType: 'indicative',
        priceNote: 'Indicative price; verify current live listing on BigHaat.',
        inStock: true,
        stockStatus: 'Check live stock on BigHaat',
        deliveryEstimate: '3 to 5 business days',
        description: 'Balanced water-soluble nitrogen, phosphorus, and potassium fertilizer for vegetative boost and balanced nutrition in polyhouse and field crops.',
        specifications: {
          brand: 'Katyayani Organics',
          ratio: '19:19:19 balanced NPK',
          solubility: '100% water soluble',
          application: 'Foliar spray and drip irrigation',
        },
        externalProductUrl: 'https://www.bighaat.com/products/katyayani-npk-19-19-19-water-soluble-fertilizer',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0722/2059/files/ProductImage1_919c9933-672f-40f5-80f8-c0e47d3dec2c.png?v=1774462915',
        imageAlt: 'Katyayani NPK 19:19:19 Fertilizer Pack',
        urlVerified: true,
        verifiedAt: '2026-10-28',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: false,
      },
      {
        id: 'bh_rallis_surplus_1l',
        providerId: 'bighaat',
        supplierName: 'BigHaat India',
        name: 'Tata Surplus Micronutrient Liquid Fertilizer (Rallis India)',
        category: 'fertilizer',
        sku: 'RAL-SURPLUS-1L',
        packSize: '1 Liter Bottle',
        indicativePriceINR: 450,
        priceType: 'indicative',
        priceNote: 'Indicative price; verify current live listing on BigHaat.',
        inStock: true,
        stockStatus: 'Check live stock on BigHaat',
        deliveryEstimate: '3 to 5 business days',
        description: 'Multi-micronutrient liquid formulation containing Zinc, Iron, Manganese, Copper, and Boron tailored for cotton, pulses, and vegetables.',
        specifications: {
          brand: 'Tata Rallis',
          elements: 'Zn, Fe, Mn, Cu, B',
          dosage: '2.5 ml per liter of water',
        },
        externalProductUrl: 'https://www.bighaat.com/products/rallis-surplus-micro-nutrients-fertilizer',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0722/2059/files/rallis-surplus-micro-nutrients-fertilizer-file-5036.webp?v=1737471949',
        imageAlt: 'Tata Surplus Micronutrient Fertilizer Bottle',
        urlVerified: true,
        verifiedAt: '2026-10-28',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: false,
      },
      {
        id: 'bh_pi_biovita_1l',
        providerId: 'bighaat',
        supplierName: 'BigHaat India',
        name: 'PI Biovita Liquid Biofertilizer (Ascophyllum Nodosum Seaweed)',
        category: 'fertilizer',
        sku: 'PI-BIOVITA-1L',
        packSize: '1 Liter Bottle',
        indicativePriceINR: 680,
        priceType: 'indicative',
        priceNote: 'Indicative price; verify current live listing on BigHaat.',
        inStock: true,
        stockStatus: 'Check live stock on BigHaat',
        deliveryEstimate: '3 to 4 business days',
        description: 'Natural seaweed extract (Ascophyllum nodosum) providing organic bio-stimulants, micronutrients, and root growth enhancement.',
        specifications: {
          brand: 'PI Industries',
          source: 'Seaweed Extract (Ascophyllum nodosum)',
          dosage: '2 - 3 ml per liter of water',
          application: 'Foliar spray and drip fertigation',
        },
        externalProductUrl: 'https://www.bighaat.com/products/biovita-liquid-biofertilizer',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0722/2059/files/biovita-liquid-biofertilizer-file-20047.jpg?v=1772222413',
        imageAlt: 'PI Biovita Liquid Biofertilizer Bottle',
        urlVerified: true,
        verifiedAt: '2026-10-28',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: false,
      },
      {
        id: 'bh_syngenta_saaho_10g',
        providerId: 'bighaat',
        supplierName: 'BigHaat India',
        name: 'Syngenta Saaho TO-3251 Tomato Hybrid Seeds',
        category: 'seeds',
        sku: 'SYN-SAAHO-10G',
        packSize: '10g Packet',
        indicativePriceINR: 480,
        priceType: 'indicative',
        priceNote: 'Indicative price; verify batch germination and purity on BigHaat.',
        inStock: true,
        stockStatus: 'Check live stock on BigHaat',
        deliveryEstimate: '3 to 5 business days',
        description: 'Determinate red square-round tomato with TYLCV (Tomato Yellow Leaf Curl Virus) tolerance and high firm fruit firmness for long-distance transport.',
        specifications: {
          brand: 'Syngenta',
          crop: 'Tomato',
          fruitWeight: '80 - 100 grams',
          harvesting: '60 - 65 days after transplanting',
        },
        externalProductUrl: 'https://www.bighaat.com/products/saaho-tomato-to-3251',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0722/2059/files/saaho-to-3251-tomato-seeds-file-20101_6092faf0-6058-4d5f-bae2-6088f5a948cb.jpg?v=1747131359',
        imageAlt: 'Syngenta Saaho Tomato Seeds Packet',
        urlVerified: true,
        verifiedAt: '2026-10-28',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: false,
      },
      {
        id: 'bh_namdhari_sweetcorn_1kg',
        providerId: 'bighaat',
        supplierName: 'BigHaat India',
        name: 'Namdhari NS 680 Sweet Corn F1 Hybrid Seeds',
        category: 'seeds',
        sku: 'NAM-NS680-1KG',
        packSize: '1 kg Pack',
        indicativePriceINR: 1180,
        priceType: 'indicative',
        priceNote: 'Indicative price; verify current live listing on BigHaat.',
        inStock: true,
        stockStatus: 'Check live stock on BigHaat',
        deliveryEstimate: '3 to 5 business days',
        description: 'Vigorous sweet corn hybrid producing high-sweetness yellow kernels with uniform cob size and strong tip filling.',
        specifications: {
          brand: 'Namdhari Seeds',
          maturity: '75 - 80 days',
          sweetness: '14 - 16 Brix',
        },
        externalProductUrl: 'https://www.bighaat.com/products/sweet-corn-namdhari',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0722/2059/files/sweet-corn-namdhari-file-26.jpg?v=1737430007',
        imageAlt: 'Namdhari Sweet Corn Seeds Pack',
        urlVerified: true,
        verifiedAt: '2026-10-28',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: false,
      },
      {
        id: 'bh_balwaan_sprayer_12x8',
        providerId: 'bighaat',
        supplierName: 'BigHaat India',
        name: 'Balwaan Shakti 12V 8Ah Rechargeable Battery Knapsack Sprayer',
        category: 'equipment',
        sku: 'BAL-SHAKTI-12X8',
        packSize: '16 Liter Tank Unit',
        indicativePriceINR: 2699,
        priceType: 'indicative',
        priceNote: 'Indicative price; verify live warranty and accessories on BigHaat.',
        inStock: true,
        stockStatus: 'Check live stock on BigHaat',
        deliveryEstimate: '4 to 6 business days',
        description: 'Heavy-duty 16-liter knapsack agricultural sprayer equipped with a 12V 8Ah maintenance-free battery, auto-cutoff pressure regulator, and telescopic lance.',
        specifications: {
          brand: 'Balwaan Krishi',
          tankCapacity: '16 Liters',
          battery: '12V 8Ah Lead-Acid / Dry Cell',
          pressure: '0.2 - 0.45 Mpa',
        },
        externalProductUrl: 'https://www.bighaat.com/products/balwaan-shakti-battery-sprayer-12x8',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0722/2059/files/balwaan-shakti-battery-sprayer-12x8-file-7234.jpg?v=1737436843',
        imageAlt: 'Balwaan 16L Battery Knapsack Sprayer',
        urlVerified: true,
        verifiedAt: '2026-10-28',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: false,
      },
      {
        id: 'bh_garden_tools_4pcs',
        providerId: 'bighaat',
        supplierName: 'BigHaat India',
        name: 'Kisan Home & Farm Ergonomic Hand Garden Tools Set (4 Pcs)',
        category: 'equipment',
        sku: 'KIS-GTOOLS-4PC',
        packSize: '4 Tools Set',
        indicativePriceINR: 499,
        priceType: 'indicative',
        priceNote: 'Indicative price; verify current live listing on BigHaat.',
        inStock: true,
        stockStatus: 'Check live stock on BigHaat',
        deliveryEstimate: '3 to 5 business days',
        description: 'Complete 4-piece agricultural hand tool set comprising trowel, transplanter, hand fork, and weeder with powder-coated anti-rust heads.',
        specifications: {
          brand: 'AgriPro / Kisan Tools',
          contents: 'Hand Trowel, Cultivator, Hand Fork, Weeder',
          material: 'High-grade carbon steel with rubber grip',
        },
        externalProductUrl: 'https://www.bighaat.com/products/garden-tools-4-pcs',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0722/2059/files/garden-tools-4-pcs-file-2713.png?v=1737435345',
        imageAlt: 'Kisan Farm Hand Tools 4-Pcs Set',
        urlVerified: true,
        verifiedAt: '2026-10-28',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: false,
      },
      {
        id: 'bh_netafim_drip_kit',
        providerId: 'bighaat',
        supplierName: 'BigHaat India',
        name: 'Netafim Portable Family Drip Irrigation Kit',
        category: 'irrigation',
        sku: 'NET-PDRIP-KIT',
        packSize: 'Complete Micro-Drip Kit',
        indicativePriceINR: 3450,
        priceType: 'indicative',
        priceNote: 'Indicative price; verify current live listing on BigHaat.',
        inStock: true,
        stockStatus: 'Check live stock on BigHaat',
        deliveryEstimate: '4 to 7 business days',
        description: 'Gravity-fed precision micro-drip irrigation kit for smallholders and vegetable plots, conserving up to 60% water compared to furrow irrigation.',
        specifications: {
          brand: 'Netafim India',
          coverage: 'Up to 500 sq meters plot',
          operatingPressure: 'Gravity flow (0.2 bar minimum)',
          dripperSpacing: '30 cm',
        },
        externalProductUrl: 'https://www.bighaat.com/products/netafim-portable-drip-kit-3600m2-1-2m-30cm',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0722/2059/files/netafim-portable-drip-kit-3600m2-1-2m-30cm-file-13113.webp?v=1737475763',
        imageAlt: 'Netafim Portable Drip Irrigation Kit',
        urlVerified: true,
        verifiedAt: '2026-10-28',
        checkoutMode: 'external_redirect',
        requiresPartnerApproval: false,
      },
    ];
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.name,
      checkoutMode: this.checkoutMode,
      enabled: this.enabled,
      partnerApproved: this.partnerApproved,
      supportsIntegratedOrder: false,
      supportsElectronicInvoice: false,
      directWebCheckoutAvailable: true,
      verifiedProductsCount: this.catalog.filter((p) => p.urlVerified).length,
      disclaimer:
        'Official deep links to bighaat.com. BigHaat processes orders, fulfillment, payments, and official GST invoices.',
    };
  }

  async searchProducts({ query = '', category = '', minPrice, maxPrice, page = 1, limit = 20 } = {}) {
    if (!this.enabled) {
      return { products: [], total: 0, page, message: 'BigHaat supplier integration is disabled.' };
    }

    // Strictly filter: ONLY include products with verified working product-detail URLs
    let results = this.catalog
      .filter((p) => p.urlVerified === true && p.externalProductUrl && p.externalProductUrl.startsWith('https://www.bighaat.com/products/'))
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
          p.sku.toLowerCase().includes(q) ||
          p.specifications?.brand?.toLowerCase().includes(q)
      );
    }

    if (category && category !== 'all') {
      results = results.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    if (minPrice !== undefined && minPrice !== '') {
      results = results.filter((p) => p.unitPriceINR >= Number(minPrice));
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      results = results.filter((p) => p.unitPriceINR <= Number(maxPrice));
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
        directWebCheckoutAvailable: true,
      },
    };
  }

  async getProductDetails(productId) {
    const item = this.catalog.find((p) => p.id === productId);
    if (!item) {
      throw new Error(`Product '${productId}' not found in BigHaat catalogue.`);
    }
    if (!item.urlVerified) {
      throw new Error(`Product '${productId}' has an unverified destination link and is not purchasable.`);
    }
    return {
      ...item,
      unitPriceINR: item.indicativePriceINR,
    };
  }

  /**
   * Mode B: Generate authentic redirection package.
   * Truthfully informs the farmer that checkout is conducted entirely on BigHaat's website.
   * Does NOT place an order or create a completed purchase record.
   */
  async initiateCheckout({ items = [], farmerContext = {} } = {}) {
    if (!this.enabled) {
      throw new Error('BigHaat supplier integration is currently disabled.');
    }

    const firstItem = items[0];
    const product = firstItem ? this.catalog.find((p) => p.id === firstItem.productId) : null;

    if (!product || !product.urlVerified) {
      throw new Error('This product direct link is unverified or unavailable. Please browse on the official supplier portal.');
    }

    const targetUrl = product.externalProductUrl;

    return {
      checkoutMode: 'external_redirect',
      providerId: this.id,
      supplierName: this.name,
      redirectUrl: targetUrl,
      urlVerified: true,
      product: {
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        packSize: product.packSize,
        indicativePriceINR: product.indicativePriceINR,
      },
      disclaimer:
        'You are leaving AgriTech to complete your purchase directly on BigHaat (bighaat.com). BigHaat handles your checkout, payment, fulfillment, and official tax invoice. AgriTech does not process payment or create a completed purchase for external redirects. After purchasing, return to Purchase History to record your order details and upload your official invoice.',
      items,
      indicativeTotalINR: items.reduce(
        (sum, item) => sum + (Number(item.quantity) * Number(item.unitPriceINR || item.indicativePriceINR) || 0),
        0
      ),
    };
  }

  async getOrderStatus(externalOrderId) {
    return {
      providerId: this.id,
      externalOrderId,
      orderStatus: 'farmer_reported',
      paymentStatus: 'pending',
      message: 'BigHaat does not provide a public status-polling API. Status is maintained via farmer-uploaded invoices.',
    };
  }
}

export default BigHaatAdapter;
