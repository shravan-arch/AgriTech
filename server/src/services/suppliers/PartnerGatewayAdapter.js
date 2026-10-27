import { SupplierAdapterBase } from './SupplierAdapterBase.js';

/**
 * AgriTech Partner Gateway Adapter
 * Disabled: In-app integrated checkout is disabled until a real supplier API
 * and actual payment processing integration (e.g. UPI/Razorpay) are configured and verified.
 */
export class PartnerGatewayAdapter extends SupplierAdapterBase {
  constructor() {
    super({
      id: 'partner_gateway',
      name: 'AgriTech Partner Gateway',
      checkoutMode: 'external_redirect',
      enabled: false, // Disabled: no simulated integrated orders
      partnerApproved: false,
    });
  }

  async searchProducts() {
    return {
      products: [],
      total: 0,
      page: 1,
      message: 'Integrated checkout is disabled until live supplier API and payment gateway are configured.',
    };
  }

  async getProductDetails(productId) {
    throw new Error('Partner Gateway integration is disabled.');
  }

  async initiateCheckout() {
    throw new Error('Integrated in-app purchasing is disabled. Please purchase on official supplier websites.');
  }

  async confirmOrder() {
    throw new Error('Integrated in-app purchasing is disabled. No local orders will be simulated.');
  }

  async getOrderStatus() {
    return null;
  }
}

export default PartnerGatewayAdapter;
