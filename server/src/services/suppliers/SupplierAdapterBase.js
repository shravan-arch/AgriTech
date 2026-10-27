/**
 * Abstract Base Class for AgriTech Supplier Integrations.
 * All supplier adapters (Mode A Integrated or Mode B External) inherit from this base class.
 */
export class SupplierAdapterBase {
  constructor({ id, name, checkoutMode, enabled = true, partnerApproved = false }) {
    this.id = id;
    this.name = name;
    this.checkoutMode = checkoutMode; // 'integrated' (Mode A) or 'external_redirect' (Mode B)
    this.enabled = enabled;
    this.partnerApproved = partnerApproved;
  }

  /**
   * Search and retrieve products matching criteria.
   * Returns: { products: Array, total: number, page: number }
   */
  async searchProducts({ query = '', category = '', minPrice, maxPrice, page = 1, limit = 20 } = {}) {
    throw new Error(`searchProducts() not implemented by adapter '${this.id}'`);
  }

  /**
   * Retrieve single product details by ID.
   */
  async getProductDetails(productId) {
    throw new Error(`getProductDetails() not implemented by adapter '${this.id}'`);
  }

  /**
   * For Mode A: Initialize an order or quote.
   * For Mode B: Generate verified external redirection bundle.
   */
  async initiateCheckout({ items, farmerContext, deliveryAddress } = {}) {
    throw new Error(`initiateCheckout() not implemented by adapter '${this.id}'`);
  }

  /**
   * Confirm an order (Mode A only).
   */
  async confirmOrder(orderId, paymentProof) {
    throw new Error(`confirmOrder() is not supported by adapter '${this.id}' in Mode B`);
  }

  /**
   * Check order status from provider.
   */
  async getOrderStatus(externalOrderId) {
    throw new Error(`getOrderStatus() not implemented by adapter '${this.id}'`);
  }

  /**
   * Verify provider webhook signature.
   */
  verifyWebhook(payload, signature, headers = {}) {
    return false;
  }

  /**
   * Retrieve invoice document/data if supported.
   */
  async getInvoice(externalOrderId) {
    return null;
  }

  /**
   * Get capability metadata for client and audit reporting.
   */
  getCapabilities() {
    return {
      id: this.id,
      name: this.name,
      checkoutMode: this.checkoutMode,
      enabled: this.enabled,
      partnerApproved: this.partnerApproved,
      supportsIntegratedOrder: this.checkoutMode === 'integrated',
      supportsDirectRedirect: this.checkoutMode === 'external_redirect',
      supportsWebhooks: typeof this.verifyWebhook === 'function',
      supportsElectronicInvoice: typeof this.getInvoice === 'function',
    };
  }
}

export default SupplierAdapterBase;
