import { SupplierAdapterBase } from './SupplierAdapterBase.js';

/**
 * ONDC (Open Network for Digital Commerce) Agri-Inputs Adapter
 * Disabled from active purchasing: ONDC requires an accredited Network Participant (NP) agreement
 * and Ed25519 cryptographic signing keys to place live orders on the network.
 */
export class OndcAgriAdapter extends SupplierAdapterBase {
  constructor() {
    super({
      id: 'ondc',
      name: 'ONDC Agri Network',
      checkoutMode: 'external_redirect',
      enabled: false, // Disabled until live Network Participant accreditation
      partnerApproved: false,
    });
  }

  async searchProducts() {
    return {
      products: [],
      total: 0,
      page: 1,
      message: 'ONDC live integrated purchasing is disabled pending Network Participant onboarding.',
    };
  }

  async getProductDetails(productId) {
    throw new Error('ONDC integration is disabled pending Network Participant onboarding.');
  }

  async initiateCheckout() {
    throw new Error('Integrated ONDC network checkout is disabled.');
  }

  async confirmOrder() {
    throw new Error('Integrated ONDC order confirmation is disabled.');
  }

  async getOrderStatus() {
    return null;
  }
}

export default OndcAgriAdapter;
