import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import { apiRequest } from '../lib/api.js';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '../components/ui.jsx';

const PRODUCT_CATEGORIES = [
  { id: 'all', labelKey: 'buyResources.categoryAll', label: 'All Categories', icon: 'bi-grid' },
  { id: 'seeds', labelKey: 'buyResources.categorySeeds', label: 'Seeds', icon: 'bi-flower2' },
  { id: 'fertilizer', labelKey: 'buyResources.categoryFertilizer', label: 'Fertilizers', icon: 'bi-droplet-half' },
  { id: 'pesticide', labelKey: 'buyResources.categoryPesticide', label: 'Crop Protection', icon: 'bi-shield-shaded' },
  { id: 'equipment', labelKey: 'buyResources.categoryEquipment', label: 'Tools & Sprayers', icon: 'bi-tools' },
  { id: 'irrigation', labelKey: 'buyResources.categoryIrrigation', label: 'Drip & Irrigation', icon: 'bi-moisture' },
];

/**
 * Category-specific high-contrast inline SVG fallbacks for reliable offline/fallback image display
 */
const getCategoryFallback = (category) => {
  const cat = (category || '').toLowerCase();
  switch (cat) {
    case 'seeds':
      return "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 150' width='100%25' height='100%25'%3E%3Crect width='200' height='150' fill='%23f0fdf4'/%3E%3Cpath d='M100 35 C75 55 65 75 70 100 C75 112 87 118 100 118 C113 118 125 112 130 100 C135 75 125 55 100 35 Z' fill='%2316a34a' opacity='0.85'/%3E%3Cpath d='M100 48 L100 112' stroke='%23dcfce7' stroke-width='2.5' stroke-linecap='round'/%3E%3Ctext x='100' y='138' font-family='sans-serif' font-size='11' font-weight='bold' fill='%2315803d' text-anchor='middle'%3ESEEDS%3C/text%3E%3C/svg%3E";
    case 'fertilizer':
      return "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 150' width='100%25' height='100%25'%3E%3Crect width='200' height='150' fill='%23eff6ff'/%3E%3Cpath d='M75 45 L125 45 L135 110 C135 116 120 122 100 122 C80 122 65 116 65 110 Z' fill='%232563eb' opacity='0.85'/%3E%3Ccircle cx='100' cy='75' r='14' fill='%23dbeafe'/%3E%3Ctext x='100' y='138' font-family='sans-serif' font-size='11' font-weight='bold' fill='%231d4ed8' text-anchor='middle'%3EFERTILIZER%3C/text%3E%3C/svg%3E";
    case 'pesticide':
      return "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 150' width='100%25' height='100%25'%3E%3Crect width='200' height='150' fill='%23fef2f2'/%3E%3Cpath d='M100 35 L135 50 C135 85 120 108 100 120 C80 108 65 85 65 50 Z' fill='%23dc2626' opacity='0.85'/%3E%3Cpath d='M92 65 L108 65 M100 57 L100 73' stroke='%23fee2e2' stroke-width='3.5' stroke-linecap='round'/%3E%3Ctext x='100' y='138' font-family='sans-serif' font-size='11' font-weight='bold' fill='%23b91c1c' text-anchor='middle'%3ECROP PROTECTION%3C/text%3E%3C/svg%3E";
    case 'equipment':
    case 'tools':
    case 'machinery':
      return "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 150' width='100%25' height='100%25'%3E%3Crect width='200' height='150' fill='%23f8fafc'/%3E%3Crect x='80' y='45' width='40' height='55' rx='6' fill='%230284c7' opacity='0.85'/%3E%3Crect x='90' y='32' width='20' height='14' rx='3' fill='%2338bdf8'/%3E%3Cpath d='M120 70 L140 50 L144 54 L124 74 Z' fill='%2364748b'/%3E%3Ctext x='100' y='138' font-family='sans-serif' font-size='11' font-weight='bold' fill='%230369a1' text-anchor='middle'%3EFARM EQUIPMENT%3C/text%3E%3C/svg%3E";
    case 'irrigation':
      return "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 150' width='100%25' height='100%25'%3E%3Crect width='200' height='150' fill='%23f0f9ff'/%3E%3Ccircle cx='100' cy='72' r='32' fill='%230284c7' opacity='0.85'/%3E%3Cpath d='M100 48 C90 62 85 72 85 82 C85 91 91 97 100 97 C109 97 115 91 115 82 C115 72 110 62 100 48 Z' fill='%23e0f2fe'/%3E%3Ctext x='100' y='138' font-family='sans-serif' font-size='11' font-weight='bold' fill='%230369a1' text-anchor='middle'%3EIRRIGATION%3C/text%3E%3C/svg%3E";
    default:
      return "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 150' width='100%25' height='100%25'%3E%3Crect width='200' height='150' fill='%23f1f5f9'/%3E%3Ccircle cx='100' cy='68' r='28' fill='%2316a34a' opacity='0.75'/%3E%3Ctext x='100' y='138' font-family='sans-serif' font-size='11' font-weight='bold' fill='%23334155' text-anchor='middle'%3EAGRICULTURE%3C/text%3E%3C/svg%3E";
  }
};

export default function BuyResourcesPage() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'matrix'

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');

  // Modals & Drawers
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [externalModalOpen, setExternalModalOpen] = useState(false);
  const [externalHandoffData, setExternalHandoffData] = useState(null);
  const [handoffLoading, setHandoffLoading] = useState(false);

  // Comparison State
  const [comparedProductIds, setComparedProductIds] = useState([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // Load Products & Suppliers
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [prodRes, suppRes] = await Promise.all([
        apiRequest('/purchases/products', { token }),
        apiRequest('/purchases/suppliers', { token }),
      ]);
      setProducts(prodRes.products || []);
      setSuppliers(suppRes.suppliers || []);
    } catch (err) {
      setError(err.message || 'Unable to load agricultural supply catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Filtered Products: ONLY display products whose purchase URL is verified and active
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Must have explicit verified link status and working product-detail URL
      const isVerified = Boolean(p.urlVerified) && p.externalProductUrl && !p.externalProductUrl.endsWith('.in') && !p.externalProductUrl.endsWith('.com');
      if (!isVerified) return false;

      const matchesCat = selectedCategory === 'all' || p.category?.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSupp = selectedSupplier === 'all' || p.providerId === selectedSupplier;
      const matchesPrice = !maxPriceFilter || p.unitPriceINR <= Number(maxPriceFilter);
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.specifications?.brand?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSupp && matchesPrice && matchesSearch;
    });
  }, [products, selectedCategory, selectedSupplier, maxPriceFilter, searchQuery]);

  const toggleCompare = (productId) => {
    setComparedProductIds((current) => {
      if (current.includes(productId)) {
        return current.filter((id) => id !== productId);
      }
      if (current.length >= 3) {
        alert('You can compare a maximum of 3 products at a time.');
        return current;
      }
      return [...current, productId];
    });
  };

  const comparedProducts = useMemo(() => {
    return products.filter((p) => comparedProductIds.includes(p.id));
  }, [products, comparedProductIds]);

  // Open Truthful External Handoff for a verified product
  const handleInitiatePurchase = async (product) => {
    if (!product.urlVerified) {
      alert('This product link is unverified and cannot be purchased.');
      return;
    }

    setSelectedProduct(product);
    setHandoffLoading(true);

    try {
      const handoff = await apiRequest('/purchases/checkout', {
        token,
        method: 'POST',
        body: {
          providerId: product.providerId,
          items: [
            {
              productId: product.id,
              name: product.name,
              sku: product.sku,
              category: product.category,
              packSize: product.packSize,
              quantity: 1,
              unitPriceINR: product.unitPriceINR,
              indicativePriceINR: product.indicativePriceINR,
            },
          ],
        },
      });
      setExternalHandoffData(handoff);
      setExternalModalOpen(true);
    } catch (err) {
      alert(`Unable to prepare supplier checkout: ${err.message}`);
    } finally {
      setHandoffLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      <PageHeader
        eyebrow={t('buyResources.eyebrow')}
        title={t('buyResources.title')}
        description={t('buyResources.description')}
        actions={
          <div className="d-flex align-items-center gap-2">
            {comparedProductIds.length > 0 && (
              <Button
                variant="outline-primary"
                className="d-flex align-items-center gap-2"
                onClick={() => setCompareModalOpen(true)}
              >
                <i className="bi bi-arrow-left-right" />
                <span>Compare Selected ({comparedProductIds.length})</span>
              </Button>
            )}
            <Button
              variant="outline-secondary"
              className="d-flex align-items-center gap-2"
              onClick={() => navigate('/purchases')}
            >
              <i className="bi bi-receipt-cutoff" />
              <span>{t('purchases.title')}</span>
            </Button>
          </div>
        }
      />

      {/* Main Tabs */}
      <div className="d-flex align-items-center gap-2 mb-4 border-bottom pb-2">
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'browse' ? 'btn-success' : 'btn-light'}`}
          onClick={() => setActiveTab('browse')}
        >
          <i className="bi bi-shop me-1" /> {t('buyResources.tabBrowse')} ({filteredProducts.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'matrix' ? 'btn-success' : 'btn-light'}`}
          onClick={() => setActiveTab('matrix')}
        >
          <i className="bi bi-shield-check me-1" /> {t('buyResources.tabMatrix')}
        </button>
      </div>

      {/* Verified Link Standard Notice */}
      <div className="alert alert-light border rounded-3 p-3 mb-4 d-flex align-items-start gap-3 shadow-2xs">
        <i className="bi bi-shield-check text-success fs-4 mt-0.5" />
        <div className="small">
          <strong className="d-block text-dark mb-1">{t('buyResources.curatedCatalogueTitle')}</strong>
          <span className="text-secondary">
            {t('buyResources.curatedCatalogueNotice')}
          </span>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={loadData} />}

      {loading ? (
        <LoadingState>{t('buyResources.loadingProducts')}</LoadingState>
      ) : activeTab === 'matrix' ? (
        /* Supplier Capability Matrix Tab */
        <Card className="p-4 mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h3 className="h5 mb-1 text-dark fw-bold">{t('buyResources.supplierIntegrationStatus')}</h3>
              <p className="small text-muted mb-0">
                {t('buyResources.supplierIntegrationDesc')}
              </p>
            </div>
            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 rounded-pill">
              {t('buyResources.verifiedLinksOnly')}
            </span>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr className="small text-secondary text-uppercase">
                  <th>{t('buyResources.thSupplier')}</th>
                  <th>{t('buyResources.thIntegration')}</th>
                  <th>{t('buyResources.thVerification')}</th>
                  <th>{t('buyResources.thPurchasingFlow')}</th>
                  <th>{t('buyResources.thPolicy')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <div className="small text-muted">{s.id}</div>
                    </td>
                    <td>
                      {s.id === 'bighaat' ? (
                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2 py-1">
                          {t('buyResources.activeExternalHandoff')}
                        </span>
                      ) : (
                        <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 rounded-pill px-2 py-1">
                          {t('buyResources.appRetailOnly')}
                        </span>
                      )}
                    </td>
                    <td className="small">
                      {s.id === 'bighaat' ? (
                        <span className="text-success fw-semibold">
                          <i className="bi bi-check-circle-fill me-1" />
                          {t('buyResources.verifiedLiveUrls')}
                        </span>
                      ) : (
                        <span className="text-muted">{t('buyResources.unverifiedDirectLinks')}</span>
                      )}
                    </td>
                    <td className="small">
                      {s.id === 'bighaat' ? (
                        <span>{t('buyResources.verifiedRedirection')}</span>
                      ) : (
                        <span className="text-muted">{t('buyResources.directCheckoutDisabled')}</span>
                      )}
                    </td>
                    <td className="small">
                      {s.id === 'bighaat' ? (
                        <span className="text-success">{t('buyResources.purchasableActive')}</span>
                      ) : (
                        <span className="text-muted">Hidden from purchasable catalogue</span>
                      )}
                    </td>
                    <td>
                      {s.enabled ? (
                        <span className="badge bg-success text-white">{t('common.active')}</span>
                      ) : (
                        <span className="badge bg-secondary">Disabled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Browse Catalogue Tab */
        <>
          {/* Filter Bar */}
          <Card className="p-3 mb-4">
            <div className="row g-3 align-items-center">
              <div className="col-12 col-md-4">
                <div className="input-group">
                  <span className="input-group-text bg-white border-end-0">
                    <i className="bi bi-search text-muted" />
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder={t('buyResources.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="btn btn-outline-secondary border-start-0"
                      type="button"
                      onClick={() => setSearchQuery('')}
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  )}
                </div>
              </div>

              <div className="col-12 col-sm-6 col-md-3">
                <select
                  className="form-select"
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                >
                  <option value="all">{t('common.all') || 'All Verified Suppliers'}</option>
                  {suppliers
                    .filter((s) => s.id === 'bighaat')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Verified Direct Links)
                      </option>
                    ))}
                </select>
              </div>

              <div className="col-12 col-sm-6 col-md-3">
                <input
                  type="number"
                  className="form-control"
                  placeholder={t('buyResources.maxIndicativePrice')}
                  value={maxPriceFilter}
                  onChange={(e) => setMaxPriceFilter(e.target.value)}
                />
              </div>

              <div className="col-12 col-md-2 text-md-end">
                <span className="small text-muted">
                  Showing <strong>{filteredProducts.length}</strong> verified products
                </span>
              </div>
            </div>

            {/* Category Pills */}
            <div className="d-flex flex-wrap gap-2 mt-3 pt-2 border-top">
              {PRODUCT_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`btn btn-sm rounded-pill d-flex align-items-center gap-1.5 ${
                      isActive ? 'btn-success' : 'btn-outline-secondary'
                    }`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <i className={`bi ${cat.icon}`} />
                    <span>{t(cat.labelKey) || cat.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <EmptyState
              icon="bi-basket3"
              title={t('buyResources.noProductsMatchFilter')}
              description="Try adjusting your search keyword, category, or maximum price filter."
              action={
                <Button
                  variant="outline-success"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedSupplier('all');
                    setSearchQuery('');
                    setMaxPriceFilter('');
                  }}
                >
                  Clear All Filters
                </Button>
              }
            />
          ) : (
            <div className="row g-4">
              {filteredProducts.map((product) => {
                const isCompared = comparedProductIds.includes(product.id);

                return (
                  <div key={product.id} className="col-12 col-md-6 col-lg-4">
                    <div className="card h-100 shadow-sm border-0 rounded-3 overflow-hidden d-flex flex-column">
                      {/* Product Image Header with Error Fallback & Supplier Badges */}
                      <div
                        className="position-relative bg-white border-bottom overflow-hidden d-flex align-items-center justify-content-center"
                        style={{ height: '200px', backgroundColor: '#ffffff' }}
                      >
                        <img
                          src={product.imageUrl || getCategoryFallback(product.category)}
                          alt={product.imageAlt || product.name}
                          loading="lazy"
                          className="w-100 h-100"
                          style={{
                            objectFit: 'contain',
                            padding: '14px',
                            transition: 'transform 0.25s ease',
                          }}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = getCategoryFallback(product.category);
                          }}
                        />

                        {/* Top Supplier Ribbon Overlay */}
                        <span className="position-absolute top-0 start-0 m-2 badge bg-white text-dark border shadow-2xs small d-inline-flex align-items-center gap-1">
                          <i className="bi bi-patch-check-fill text-success" />
                          <strong>{product.supplierName}</strong>
                        </span>

                        <span className="position-absolute top-0 end-0 m-2 badge bg-success bg-opacity-95 text-white rounded-pill px-2 py-1 small">
                          <i className="bi bi-shield-check me-1" />
                          Verified Link
                        </span>
                      </div>

                      <div className="card-body p-3 d-flex flex-column flex-grow-1">
                        <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                          <h4 className="card-title h6 fw-bold mb-0 text-dark" style={{ lineHeight: 1.4 }}>
                            {product.name}
                          </h4>
                          <span className="badge bg-success bg-opacity-10 text-success text-capitalize flex-shrink-0">
                            {product.category}
                          </span>
                        </div>

                        <p className="text-secondary small mb-3 flex-grow-1" style={{ fontSize: '0.84rem' }}>
                          {product.description}
                        </p>

                        {/* Specs Chips */}
                        <div className="bg-light rounded p-2 mb-3 small">
                          <div className="d-flex justify-content-between text-muted mb-1">
                            <span>Pack Size:</span>
                            <strong className="text-dark">{product.packSize}</strong>
                          </div>
                          <div className="d-flex justify-content-between text-muted mb-1">
                            <span>Stock Status:</span>
                            <span className="text-secondary">{product.stockStatus || 'Check live listing'}</span>
                          </div>
                          <div className="d-flex justify-content-between text-muted">
                            <span>Estimated Delivery:</span>
                            <span>{product.deliveryEstimate}</span>
                          </div>
                        </div>

                        {/* Indicative Price Display */}
                        <div className="mb-3">
                          <div className="d-flex align-items-baseline gap-2">
                            <span className="h4 fw-bold text-success mb-0">
                              ₹{(product.unitPriceINR || product.indicativePriceINR || 0).toLocaleString('en-IN')}
                            </span>
                            <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-25 small">
                              Indicative Price
                            </span>
                            <span className="small text-muted ms-auto">SKU: {product.sku}</span>
                          </div>
                          <div className="text-muted mt-0.5" style={{ fontSize: '0.73rem' }}>
                            {product.priceNote || 'Price indicative; verify live listing on official supplier website.'}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-auto">
                          <div className="d-flex align-items-center gap-2">
                            <button
                              type="button"
                              className={`btn btn-sm ${isCompared ? 'btn-primary' : 'btn-outline-secondary'}`}
                              onClick={() => toggleCompare(product.id)}
                              title={t('buyResources.addToCompare')}
                            >
                              <i className="bi bi-arrow-left-right" />
                            </button>

                            <Button
                              variant="outline-success"
                              className="btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                              onClick={() => handleInitiatePurchase(product)}
                              disabled={handoffLoading}
                            >
                              <i className="bi bi-box-arrow-up-right" />
                              <span>{t('buyResources.buyNow')} ({product.supplierName.split(' ')[0]})</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TRUTHFUL EXTERNAL REDIRECT HANDOFF MODAL */}
      {/* ------------------------------------------------------------- */}
      {externalModalOpen && selectedProduct && externalHandoffData && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-box-arrow-up-right text-success" />
                  <span>External Supplier Checkout Handoff</span>
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setExternalModalOpen(false)}
                />
              </div>

              <div className="modal-body p-4">
                <div
                  className="alert alert-warning border-0 rounded-3 p-3 mb-3 d-flex align-items-center justify-content-start gap-3"
                  style={{ textAlign: 'left' }}
                >
                  <i
                    className="bi bi-shield-exclamation flex-shrink-0"
                    style={{ fontSize: '1.25rem', color: '#b45309' }}
                    aria-hidden="true"
                  />
                  <p
                    className="mb-0 text-start"
                    style={{
                      fontSize: '0.84rem',
                      lineHeight: '1.45',
                      color: '#78350f',
                      margin: 0,
                    }}
                  >
                    <strong>Important Notice:</strong> AgriTech does not collect payment or create an order record when you click proceed. The entire transaction occurs on {selectedProduct.supplierName}’s official portal.
                  </p>
                </div>

                <div className="p-3 bg-light rounded-3 mb-3 d-flex align-items-center gap-3">
                  <div
                    style={{ width: '64px', height: '64px' }}
                    className="bg-white rounded border p-1 flex-shrink-0 d-flex align-items-center justify-content-center"
                  >
                    <img
                      src={selectedProduct.imageUrl || getCategoryFallback(selectedProduct.category)}
                      alt={selectedProduct.name}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getCategoryFallback(selectedProduct.category);
                      }}
                    />
                  </div>
                  <div>
                    <strong className="d-block text-dark">{selectedProduct.name}</strong>
                    <div className="small text-muted mb-1">
                      Official Supplier: <strong>{selectedProduct.supplierName}</strong> &bull; Pack: {selectedProduct.packSize}
                    </div>
                    <div className="small text-success fw-bold">
                      Indicative Price: ₹{(selectedProduct.unitPriceINR || selectedProduct.indicativePriceINR || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="card p-3 border-dashed bg-white mb-3">
                  <span className="small text-muted d-block mb-1">Verified Supplier Destination:</span>
                  <a
                    href={externalHandoffData.redirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="small text-truncate text-success d-block fw-semibold"
                  >
                    {externalHandoffData.redirectUrl}
                  </a>
                </div>

                <div className="p-3 border rounded-3 bg-light small">
                  <strong className="d-block mb-1.5 text-dark">Purchasing & Invoicing Steps:</strong>
                  <ol className="mb-0 ps-3 text-secondary">
                    <li className="mb-1">Click below to open the verified product page in a new tab.</li>
                    <li className="mb-1">Complete your purchase and payment directly with {selectedProduct.supplierName}.</li>
                    <li className="mb-1">Save your supplier order reference number and download your official tax invoice.</li>
                    <li>Return to AgriTech's <strong>Purchase History</strong> to record your purchase reference and archive your official invoice.</li>
                  </ol>
                </div>
              </div>

              <div className="modal-footer border-top bg-light d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setExternalModalOpen(false)}
                >
                  Cancel
                </button>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm"
                    onClick={() => {
                      setExternalModalOpen(false);
                      navigate('/purchases?action=record&supplier=' + encodeURIComponent(selectedProduct.supplierName));
                    }}
                  >
                    Record Order Details
                  </button>
                  <a
                    href={externalHandoffData.redirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-success btn-sm d-flex align-items-center gap-1.5"
                    onClick={() => setExternalModalOpen(false)}
                  >
                    <span>Proceed to {selectedProduct.supplierName.split(' ')[0]}</span>
                    <i className="bi bi-box-arrow-up-right" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* COMPARISON MODAL */}
      {/* ------------------------------------------------------------- */}
      {compareModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-arrow-left-right text-success" />
                  <span>Agricultural Product Comparison</span>
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setCompareModalOpen(false)}
                />
              </div>

              <div className="modal-body p-4">
                {comparedProducts.length === 0 ? (
                  <p className="text-muted text-center py-4">No products selected for comparison.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-bordered align-middle">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '20%' }}>Attribute</th>
                          {comparedProducts.map((p) => (
                            <th key={p.id} className="text-center" style={{ width: `${80 / comparedProducts.length}%` }}>
                              <div
                                style={{ height: '110px' }}
                                className="d-flex align-items-center justify-content-center mb-2 bg-white rounded border p-1"
                              >
                                <img
                                  src={p.imageUrl || getCategoryFallback(p.category)}
                                  alt={p.name}
                                  className="h-100"
                                  style={{ objectFit: 'contain', maxWidth: '100%' }}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = getCategoryFallback(p.category);
                                  }}
                                />
                              </div>
                              <strong className="d-block text-dark">{p.name}</strong>
                              <span className="badge bg-light text-dark border small mt-1">{p.supplierName}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="fw-semibold text-secondary">Indicative Price</td>
                          {comparedProducts.map((p) => (
                            <td key={p.id} className="text-center text-success fw-bold fs-5">
                              ₹{(p.unitPriceINR || p.indicativePriceINR || 0).toLocaleString('en-IN')}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="fw-semibold text-secondary">Category</td>
                          {comparedProducts.map((p) => (
                            <td key={p.id} className="text-center text-capitalize">
                              {p.category}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="fw-semibold text-secondary">Pack Size</td>
                          {comparedProducts.map((p) => (
                            <td key={p.id} className="text-center">
                              {p.packSize}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="fw-semibold text-secondary">Purchase Link Status</td>
                          {comparedProducts.map((p) => (
                            <td key={p.id} className="text-center">
                              <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                                Verified External Link
                              </span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="fw-semibold text-secondary">Estimated Delivery</td>
                          {comparedProducts.map((p) => (
                            <td key={p.id} className="text-center small">
                              {p.deliveryEstimate}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="fw-semibold text-secondary">Specifications</td>
                          {comparedProducts.map((p) => (
                            <td key={p.id} className="small">
                              {p.specifications ? (
                                <ul className="mb-0 ps-3">
                                  {Object.entries(p.specifications).map(([k, v]) => (
                                    <li key={k}>
                                      <strong className="text-capitalize">{k.replace(/([A-Z])/g, ' $1')}:</strong> {String(v)}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                'Standard'
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="modal-footer border-top bg-light">
                <Button variant="outline-danger" className="btn-sm" onClick={() => setComparedProductIds([])}>
                  Clear Selection
                </Button>
                <Button variant="secondary" className="btn-sm" onClick={() => setCompareModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
