import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

const ORDER_STATUS_TONES = {
  initiated: 'gray',
  confirmed: 'blue',
  processing: 'yellow',
  shipped: 'blue',
  delivered: 'green',
  cancelled: 'red',
};

const PAYMENT_STATUS_TONES = {
  pending: 'yellow',
  authorized: 'blue',
  paid: 'green',
  failed: 'red',
  refunded: 'purple',
};

export default function PurchaseHistoryPage() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [purchases, setPurchases] = useState([]);
  const [stats, setStats] = useState({
    totalPurchases: 0,
    totalSpentINR: 0,
    pendingOrders: 0,
    completedOrders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtering
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [uploadInvoiceModalOpen, setUploadInvoiceModalOpen] = useState(false);
  const [selectedPurchaseForUpload, setSelectedPurchaseForUpload] = useState(null);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [supplierTaxIdInput, setSupplierTaxIdInput] = useState('');
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  // New Purchase Record Form State
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newExternalOrderId, setNewExternalOrderId] = useState('');
  const [newPurchaseDate, setNewPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [newPaymentStatus, setNewPaymentStatus] = useState('paid');
  const [newOrderStatus, setNewOrderStatus] = useState('delivered');
  const [newNotes, setNewNotes] = useState('');
  const [newItems, setNewItems] = useState([
    { name: '', category: 'seeds', packSize: '', quantity: 1, unitPriceINR: 0 },
  ]);
  const [newTaxINR, setNewTaxINR] = useState(0);
  const [newDeliveryINR, setNewDeliveryINR] = useState(0);
  const [newInvoiceFile, setNewInvoiceFile] = useState(null);
  const [savingRecord, setSavingRecord] = useState(false);
  const [creatingTestFixture, setCreatingTestFixture] = useState(false);

  // Check URL query parameters for pre-filling (e.g. ?action=record&supplier=BigHaat)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'record') {
      const supplier = params.get('supplier');
      if (supplier) setNewSupplierName(supplier);
      setRecordModalOpen(true);
    }
  }, [location.search]);

  // Load Purchases
  const loadPurchases = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/purchases', { token });
      setPurchases(res.purchases || []);
      if (res.stats) setStats(res.stats);
    } catch (err) {
      setError(err.message || 'Unable to load purchase records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, [token]);

  // Filtered Purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.orderStatus === statusFilter;
      const matchesSearch =
        !searchQuery ||
        p.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.externalOrderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.items?.some((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [purchases, statusFilter, searchQuery]);

  // Download official invoice file
  const handleDownloadInvoice = async (purchase) => {
    try {
      const response = await fetch(`/api/purchases/${purchase._id || purchase.id}/invoice/file`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Unable to download invoice document.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = purchase.invoice?.documentOriginalName || `invoice-${purchase.externalOrderId || 'record'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Invoice download failed: ${err.message}`);
    }
  };

  // Open invoice upload modal
  const handleOpenUploadInvoiceModal = (purchase) => {
    setSelectedPurchaseForUpload(purchase);
    setInvoiceFile(null);
    setInvoiceNumberInput(purchase.invoice?.invoiceNumber || '');
    setSupplierTaxIdInput(purchase.invoice?.supplierTaxId || '');
    setUploadInvoiceModalOpen(true);
  };

  // Submit invoice upload
  const handleSubmitInvoiceUpload = async (e) => {
    e.preventDefault();
    if (!selectedPurchaseForUpload || !invoiceFile) {
      alert('Please select an invoice file (PDF or image).');
      return;
    }

    setUploadingInvoice(true);
    try {
      const formData = new FormData();
      formData.append('invoice', invoiceFile);
      if (invoiceNumberInput) formData.append('invoiceNumber', invoiceNumberInput);
      if (supplierTaxIdInput) formData.append('supplierTaxId', supplierTaxIdInput);

      await apiRequest(`/purchases/${selectedPurchaseForUpload._id || selectedPurchaseForUpload.id}/invoice`, {
        token,
        method: 'POST',
        body: formData,
      });

      setUploadInvoiceModalOpen(false);
      await loadPurchases();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadingInvoice(false);
    }
  };

  // Delete purchase record
  const handleDeletePurchase = async (purchaseId) => {
    if (!window.confirm('Are you sure you want to delete this purchase record? Any attached invoice will also be removed.')) {
      return;
    }

    try {
      await apiRequest(`/purchases/${purchaseId}`, {
        token,
        method: 'DELETE',
      });
      await loadPurchases();
    } catch (err) {
      alert(`Deletion failed: ${err.message}`);
    }
  };

  // Create Test Purchase Fixture (Dev / Verification Workflow)
  const handleCreateTestFixture = async () => {
    setCreatingTestFixture(true);
    try {
      await apiRequest('/purchases/test-fixture', {
        token,
        method: 'POST',
      });
      await loadPurchases();
    } catch (err) {
      alert(`Unable to create test fixture: ${err.message}`);
    } finally {
      setCreatingTestFixture(false);
    }
  };

  // Add Item Row to New Purchase Form
  const handleAddItemRow = () => {
    setNewItems((current) => [
      ...current,
      { name: '', category: 'seeds', packSize: '', quantity: 1, unitPriceINR: 0 },
    ]);
  };

  // Remove Item Row
  const handleRemoveItemRow = (index) => {
    setNewItems((current) => current.filter((_, i) => i !== index));
  };

  // Update Item Field
  const handleUpdateItem = (index, field, value) => {
    setNewItems((current) => {
      const copy = [...current];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Compute calculated subtotal and total
  const calculatedSubtotal = useMemo(() => {
    return newItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPriceINR) || 0), 0);
  }, [newItems]);

  const calculatedTotal = useMemo(() => {
    return calculatedSubtotal + (Number(newTaxINR) || 0) + (Number(newDeliveryINR) || 0);
  }, [calculatedSubtotal, newTaxINR, newDeliveryINR]);

  // Submit New Purchase Record
  const handleSubmitNewRecord = async (e) => {
    e.preventDefault();
    if (!newSupplierName.trim()) {
      alert('Please enter the supplier name.');
      return;
    }
    if (newItems.length === 0 || !newItems[0].name.trim()) {
      alert('Please add at least one purchased product item.');
      return;
    }

    setSavingRecord(true);
    try {
      const formattedItems = newItems.map((item) => ({
        name: item.name.trim(),
        category: item.category,
        packSize: item.packSize.trim() || 'Standard Unit',
        quantity: Number(item.quantity) || 1,
        unitPriceINR: Number(item.unitPriceINR) || 0,
        subtotalINR: (Number(item.quantity) || 1) * (Number(item.unitPriceINR) || 0),
      }));

      const recordRes = await apiRequest('/purchases', {
        token,
        method: 'POST',
        body: {
          supplierName: newSupplierName.trim(),
          providerId: newSupplierName.toLowerCase().includes('bighaat')
            ? 'bighaat'
            : newSupplierName.toLowerCase().includes('agrostar')
            ? 'agrostar'
            : newSupplierName.toLowerCase().includes('agrim')
            ? 'agrim'
            : 'manual',
          checkoutMode: 'manual_import',
          externalOrderId: newExternalOrderId.trim(),
          idempotencyKey: newExternalOrderId.trim() ? `idemp_${newExternalOrderId.trim()}` : undefined,
          items: formattedItems,
          subtotalINR: calculatedSubtotal,
          taxINR: Number(newTaxINR) || 0,
          deliveryINR: Number(newDeliveryINR) || 0,
          totalINR: calculatedTotal,
          purchaseDate: newPurchaseDate,
          paymentStatus: newPaymentStatus,
          orderStatus: newOrderStatus,
          notes: newNotes.trim(),
          source: newInvoiceFile ? 'supplier_invoice_import' : 'farmer_entered',
        },
      });

      // If invoice document is attached, upload it directly
      if (newInvoiceFile && recordRes.purchase?._id) {
        const formData = new FormData();
        formData.append('invoice', newInvoiceFile);
        if (newExternalOrderId) formData.append('invoiceNumber', newExternalOrderId);

        await apiRequest(`/purchases/${recordRes.purchase._id}/invoice`, {
          token,
          method: 'POST',
          body: formData,
        });
      }

      setRecordModalOpen(false);
      // Reset form
      setNewSupplierName('');
      setNewExternalOrderId('');
      setNewNotes('');
      setNewInvoiceFile(null);
      setNewItems([{ name: '', category: 'seeds', packSize: '', quantity: 1, unitPriceINR: 0 }]);
      await loadPurchases();
    } catch (err) {
      alert(`Failed to save purchase record: ${err.message}`);
    } finally {
      setSavingRecord(false);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="FINANCIAL AUDIT & PROCUREMENT LOG"
        title={t('nav.purchases') || 'Purchase History & Invoices'}
        description="Persistent procurement logs and official invoice storage for seeds, fertilizers, and crop inputs."
        actions={
          <div className="d-flex align-items-center flex-wrap gap-2">
            <Button
              variant="outline-secondary"
              className="d-flex align-items-center gap-2"
              onClick={() => navigate('/resources')}
            >
              <i className="bi bi-shop" />
              <span>Browse Products</span>
            </Button>
            <Button
              variant="outline-primary"
              className="d-flex align-items-center gap-1.5"
              onClick={handleCreateTestFixture}
              disabled={creatingTestFixture}
              title="Generate a marked test purchase record and authentic test invoice for verification"
            >
              <i className="bi bi-flask" />
              <span>{creatingTestFixture ? 'Creating Fixture…' : 'Add Test Fixture'}</span>
            </Button>
            <Button
              variant="success"
              className="d-flex align-items-center gap-2"
              onClick={() => setRecordModalOpen(true)}
            >
              <i className="bi bi-plus-lg" />
              <span>Record Purchase / Add Invoice</span>
            </Button>
          </div>
        }
      />

      {/* Distinction notice */}
      <div className="alert alert-light border rounded-3 p-3 mb-4 d-flex align-items-start gap-3 shadow-2xs">
        <i className="bi bi-info-circle-fill text-success fs-5 mt-0.5" />
        <div className="small">
          <strong className="d-block text-dark mb-0.5">Official Invoices vs. AgriTech Expense Summaries</strong>
          <span className="text-secondary">
            AgriTech purchase records are internal farmer-reported logs for expense tracking and yield cost calculations. Official GST tax invoices are issued exclusively by the respective suppliers (e.g. BigHaat). You can upload and securely store your authentic supplier invoices below for tax and subsidy audits.
          </span>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={loadPurchases} />}

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-lg-3">
          <Card className="p-3">
            <div className="d-flex align-items-center gap-3">
              <div className="p-3 bg-success bg-opacity-10 text-success rounded-3">
                <i className="bi bi-receipt fs-4" />
              </div>
              <div>
                <span className="small text-muted d-block">Total Purchase Records</span>
                <strong className="fs-4 text-dark">{stats.totalPurchases}</strong>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <Card className="p-3">
            <div className="d-flex align-items-center gap-3">
              <div className="p-3 bg-primary bg-opacity-10 text-primary rounded-3">
                <i className="bi bi-currency-rupee fs-4" />
              </div>
              <div>
                <span className="small text-muted d-block">Total Paid Expenses</span>
                <strong className="fs-4 text-dark">₹{stats.totalSpentINR.toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <Card className="p-3">
            <div className="d-flex align-items-center gap-3">
              <div className="p-3 bg-warning bg-opacity-10 text-warning rounded-3">
                <i className="bi bi-truck fs-4" />
              </div>
              <div>
                <span className="small text-muted d-block">Pending & In-Transit</span>
                <strong className="fs-4 text-dark">{stats.pendingOrders}</strong>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <Card className="p-3">
            <div className="d-flex align-items-center gap-3">
              <div className="p-3 bg-info bg-opacity-10 text-info rounded-3">
                <i className="bi bi-building-check fs-4" />
              </div>
              <div>
                <span className="small text-muted d-block">Integrated Suppliers</span>
                <strong className="fs-4 text-dark">{stats.supplierCount || 1}</strong>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3 mb-4">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-6">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search text-muted" />
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search by order ID, item name, or supplier…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="d-flex align-items-center gap-2">
              <span className="small text-muted text-nowrap">Filter Status:</span>
              <select
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Orders</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">In-Transit / Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="initiated">Pending Initiation</option>
              </select>
            </div>
          </div>

          <div className="col-12 col-md-2 text-md-end">
            <span className="small text-muted">
              Showing <strong>{filteredPurchases.length}</strong> records
            </span>
          </div>
        </div>
      </Card>

      {/* Records Table */}
      {loading ? (
        <LoadingState>Loading your persistent purchase records…</LoadingState>
      ) : filteredPurchases.length === 0 ? (
        <EmptyState
          icon="bi-receipt"
          title="No purchase records found"
          description="You haven't recorded any agricultural input purchases yet. Buy resources online or import invoices from external suppliers."
          action={
            <Button variant="success" onClick={() => setRecordModalOpen(true)}>
              Record Your First Purchase
            </Button>
          }
        />
      ) : (
        <div className="table-responsive bg-white rounded-3 shadow-sm border">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr className="small text-secondary text-uppercase">
                <th>Order Ref / Date</th>
                <th>Supplier / Source</th>
                <th>Items Purchased</th>
                <th>Total Confirmed</th>
                <th>Payment</th>
                <th>Fulfillment</th>
                <th>Official Invoice</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((purchase) => {
                const id = purchase._id || purchase.id;
                const dateStr = purchase.purchaseDate
                  ? new Date(purchase.purchaseDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'N/A';

                const hasInvoice = Boolean(purchase.invoice?.documentStorageKey);

                return (
                  <tr key={id}>
                    <td>
                      <strong className="d-block text-dark" style={{ fontFamily: 'monospace' }}>
                        {purchase.externalOrderId || `AGR-${id.slice(-6).toUpperCase()}`}
                      </strong>
                      <span className="small text-muted">{dateStr}</span>
                    </td>

                    <td>
                      <div className="d-flex align-items-center gap-1.5 mb-1">
                        <span className="badge bg-light text-dark border">
                          {purchase.supplierName}
                        </span>
                        {purchase.isTestRecord && (
                          <span className="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25 rounded-pill px-2 py-0.5" style={{ fontSize: '0.68rem' }}>
                            <i className="bi bi-flask me-1" />
                            Test Fixture
                          </span>
                        )}
                      </div>
                      {hasInvoice ? (
                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2 py-0.5" style={{ fontSize: '0.72rem' }}>
                          <i className="bi bi-shield-check me-1" />
                          Invoice Attached
                        </span>
                      ) : (
                        <span className="badge bg-warning bg-opacity-15 text-dark border border-warning border-opacity-50 rounded-pill px-2 py-0.5" style={{ fontSize: '0.72rem' }}>
                          <i className="bi bi-person-lines-fill me-1" />
                          Farmer-Reported
                        </span>
                      )}
                    </td>

                    <td style={{ maxWidth: '280px' }}>
                      <ul className="list-unstyled mb-0 small">
                        {purchase.items?.slice(0, 2).map((item, idx) => (
                          <li key={idx} className="text-truncate">
                            &bull; <strong>{item.name}</strong> ({item.quantity} x {item.packSize || 'unit'})
                          </li>
                        ))}
                        {purchase.items?.length > 2 && (
                          <li className="text-muted fst-italic">
                            +{purchase.items.length - 2} more item(s)
                          </li>
                        )}
                      </ul>
                    </td>

                    <td>
                      <strong className="text-success fs-6">
                        ₹{(purchase.totalINR || 0).toLocaleString('en-IN')}
                      </strong>
                      <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                        Tax: ₹{purchase.taxINR || 0} &bull; Delivery: ₹{purchase.deliveryINR || 0}
                      </div>
                    </td>

                    <td>
                      <Badge tone={PAYMENT_STATUS_TONES[purchase.paymentStatus] || 'gray'}>
                        {purchase.paymentStatus}
                      </Badge>
                    </td>

                    <td>
                      <Badge tone={ORDER_STATUS_TONES[purchase.orderStatus] || 'gray'}>
                        {purchase.orderStatus}
                      </Badge>
                    </td>

                    <td>
                      {hasInvoice ? (
                        <div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success d-flex align-items-center gap-1.5 py-1 px-2 mb-1"
                            onClick={() => handleDownloadInvoice(purchase)}
                            title="Download official supplier PDF/Image invoice"
                          >
                            <i className="bi bi-file-earmark-pdf-fill" />
                            <span>Official Invoice</span>
                          </button>
                          {purchase.invoice?.invoiceNumber && (
                            <span className="text-muted small d-block" style={{ fontSize: '0.72rem' }}>
                              Ref: {purchase.invoice.invoiceNumber}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 rounded-pill px-2 py-0.5 mb-1 d-inline-block" style={{ fontSize: '0.7rem' }}>
                            Pending Invoice
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm btn-light border text-muted d-flex align-items-center gap-1 py-0.5 px-2"
                            onClick={() => handleOpenUploadInvoiceModal(purchase)}
                            title="Attach authentic supplier invoice document"
                            style={{ fontSize: '0.75rem' }}
                          >
                            <i className="bi bi-upload" />
                            <span>Attach Invoice</span>
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger border-0 p-1"
                        onClick={() => handleDeletePurchase(id)}
                        title="Delete record"
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: UPLOAD OFFICIAL INVOICE */}
      {/* ------------------------------------------------------------- */}
      {uploadInvoiceModalOpen && selectedPurchaseForUpload && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <form onSubmit={handleSubmitInvoiceUpload}>
                <div className="modal-header border-bottom">
                  <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-file-earmark-arrow-up text-success" />
                    <span>Attach Official Supplier Invoice</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setUploadInvoiceModalOpen(false)}
                  />
                </div>

                <div className="modal-body p-4">
                  <div className="p-3 bg-light rounded-3 mb-3 small">
                    <span className="d-block text-muted">Purchase Order:</span>
                    <strong className="text-dark">
                      {selectedPurchaseForUpload.supplierName} &bull; Order #
                      {selectedPurchaseForUpload.externalOrderId || selectedPurchaseForUpload._id}
                    </strong>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Select Invoice File (PDF, JPEG, PNG, WebP)
                    </label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      required
                      onChange={(e) => setInvoiceFile(e.target.files[0])}
                    />
                    <span className="small text-muted d-block mt-1">
                      Max file size: 10MB. Magic byte validation enforced.
                    </span>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Invoice Number</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. INV-2026-9812"
                        value={invoiceNumberInput}
                        onChange={(e) => setInvoiceNumberInput(e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Supplier GSTIN / Tax ID</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 07AAAAA0000A1Z5"
                        value={supplierTaxIdInput}
                        onChange={(e) => setSupplierTaxIdInput(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top bg-light">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setUploadInvoiceModalOpen(false)}
                    disabled={uploadingInvoice}
                  >
                    Cancel
                  </button>
                  <Button variant="success" className="btn-sm" type="submit" disabled={uploadingInvoice}>
                    {uploadingInvoice ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        Uploading…
                      </>
                    ) : (
                      'Save Invoice'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: RECORD EXTERNAL OR MANUAL PURCHASE */}
      {/* ------------------------------------------------------------- */}
      {recordModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <form onSubmit={handleSubmitNewRecord}>
                <div className="modal-header border-bottom">
                  <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-pencil-square text-success" />
                    <span>Record Agricultural Purchase & Import Invoice</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setRecordModalOpen(false)}
                  />
                </div>

                <div className="modal-body p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  <div className="alert alert-success bg-opacity-10 border border-success border-opacity-25 small mb-3">
                    <i className="bi bi-shield-check me-2" />
                    <strong>Audit-Proof Financial Records:</strong> Keep your input costs, tax invoices, and supplier details organized for farm budgeting and compliance.
                  </div>

                  {/* Supplier & Reference */}
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Supplier / Merchant Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. BigHaat, AgroStar, AGRIM, Local Fertilizer Depot"
                        required
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Order ID / Bill Number</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. BH-94812, AS-3012, or Cash Memo #"
                        value={newExternalOrderId}
                        onChange={(e) => setNewExternalOrderId(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Dates & Status */}
                  <div className="row g-3 mb-3">
                    <div className="col-6 col-md-4">
                      <label className="form-label small fw-semibold">Purchase Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={newPurchaseDate}
                        onChange={(e) => setNewPurchaseDate(e.target.value)}
                      />
                    </div>
                    <div className="col-6 col-md-4">
                      <label className="form-label small fw-semibold">Payment Status</label>
                      <select
                        className="form-select"
                        value={newPaymentStatus}
                        onChange={(e) => setNewPaymentStatus(e.target.value)}
                      >
                        <option value="paid">Paid (Confirmed)</option>
                        <option value="pending">Pending Payment</option>
                        <option value="authorized">Authorized</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Order / Delivery Status</label>
                      <select
                        className="form-select"
                        value={newOrderStatus}
                        onChange={(e) => setNewOrderStatus(e.target.value)}
                      >
                        <option value="delivered">Delivered / In Possession</option>
                        <option value="shipped">Shipped / In Transit</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="initiated">Initiated</option>
                      </select>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="mb-3">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <label className="form-label small fw-semibold mb-0">Purchased Items *</label>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success py-0.5 px-2 small"
                        onClick={handleAddItemRow}
                      >
                        + Add Another Item
                      </button>
                    </div>

                    {newItems.map((item, idx) => (
                      <div key={idx} className="p-3 bg-light rounded-3 mb-2 border">
                        <div className="row g-2 align-items-center">
                          <div className="col-12 col-md-4">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Product Name (e.g. Urea 45kg)"
                              required
                              value={item.name}
                              onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                            />
                          </div>
                          <div className="col-6 col-md-2">
                            <select
                              className="form-select form-select-sm"
                              value={item.category}
                              onChange={(e) => handleUpdateItem(idx, 'category', e.target.value)}
                            >
                              <option value="seeds">Seeds</option>
                              <option value="fertilizer">Fertilizer</option>
                              <option value="pesticide">Pesticide</option>
                              <option value="equipment">Equipment</option>
                              <option value="irrigation">Irrigation</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div className="col-6 col-md-2">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Pack (e.g. 50kg)"
                              value={item.packSize}
                              onChange={(e) => handleUpdateItem(idx, 'packSize', e.target.value)}
                            />
                          </div>
                          <div className="col-4 col-md-1">
                            <input
                              type="number"
                              min="1"
                              className="form-control form-control-sm"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                            />
                          </div>
                          <div className="col-6 col-md-2">
                            <input
                              type="number"
                              min="0"
                              className="form-control form-control-sm"
                              placeholder="Price ₹"
                              value={item.unitPriceINR}
                              onChange={(e) => handleUpdateItem(idx, 'unitPriceINR', e.target.value)}
                            />
                          </div>
                          <div className="col-2 col-md-1 text-end">
                            {newItems.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger border-0 p-1"
                                onClick={() => handleRemoveItemRow(idx)}
                              >
                                <i className="bi bi-x-lg" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Financial Breakdown */}
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">GST / Tax Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        value={newTaxINR}
                        onChange={(e) => setNewTaxINR(e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Delivery / Transport (₹)</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        value={newDeliveryINR}
                        onChange={(e) => setNewDeliveryINR(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-light rounded-3 d-flex justify-content-between align-items-center mb-3">
                    <span className="fw-semibold text-secondary">Calculated Total (INR):</span>
                    <strong className="fs-5 text-success">₹{calculatedTotal.toLocaleString('en-IN')}</strong>
                  </div>

                  {/* Optional File Upload */}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Attach Official Bill / Tax Invoice (Optional)</label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      onChange={(e) => setNewInvoiceFile(e.target.files[0])}
                    />
                    <span className="small text-muted d-block mt-1">
                      Upload PDF receipt or photograph of paper bill.
                    </span>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Notes / Farm Allocation</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      placeholder="e.g. Applied to North Wheat field, Batch #912"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer border-top bg-light">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setRecordModalOpen(false)}
                    disabled={savingRecord}
                  >
                    Cancel
                  </button>
                  <Button variant="success" className="btn-sm" type="submit" disabled={savingRecord}>
                    {savingRecord ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        Saving Record…
                      </>
                    ) : (
                      'Save Purchase Record'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
