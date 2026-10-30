import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import { apiRequest } from '../lib/api.js';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '../components/ui.jsx';

const CATEGORIES = [
  { id: 'all', label: 'All Items' },
  { id: 'seeds', label: 'Seeds' },
  { id: 'fertilizer', label: 'Fertilizers' },
  { id: 'chemical', label: 'Crop Protection' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'tools', label: 'Tools & Parts' },
  { id: 'feed', label: 'Feed & Fodder' },
  { id: 'other', label: 'Other Supplies' },
];

const UNITS = ['kg', 'liters', 'bags', 'tonnes', 'packets', 'units'];

const MOVEMENT_REASONS = [
  { id: 'purchase', label: 'Fresh Purchase / Delivery' },
  { id: 'application', label: 'Field Application' },
  { id: 'sale', label: 'Sale / Dispensed' },
  { id: 'spoilage', label: 'Spoilage / Damaged' },
  { id: 'adjustment', label: 'Inventory Audit / Adjustment' },
];

const getTodayDate = () => new Date().toISOString().split('T')[0];

const createEmptyMoveData = () => ({
  type: 'out',
  quantity: 1,
  reason: 'application',
  date: getTodayDate(),
  notes: '',
});

export default function InventoryPage() {
  const { token } = useAuth();
  const { t } = useLanguage();

  const categories = [
    { id: 'all', label: t('inventory.catAll') || 'All Items' },
    { id: 'seeds', label: t('inventory.catSeeds') || 'Seeds' },
    { id: 'fertilizer', label: t('inventory.catFertilizers') || 'Fertilizers' },
    { id: 'chemical', label: t('inventory.catChemicals') || 'Crop Protection' },
    { id: 'fuel', label: t('inventory.catFuel') || 'Fuel' },
    { id: 'tools', label: t('inventory.catTools') || 'Tools & Parts' },
    { id: 'feed', label: t('inventory.catFeed') || 'Feed & Fodder' },
    { id: 'other', label: t('inventory.catOther') || 'Other Supplies' },
  ];

  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'movements'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFarmFilter, setSelectedFarmFilter] = useState('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [activeItemForMove, setActiveItemForMove] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    farmId: '',
    name: '',
    category: 'fertilizer',
    quantity: 0,
    unit: 'kg',
    minThreshold: 10,
    costPerUnit: 0,
    location: '',
    notes: '',
  });

  const [moveData, setMoveData] = useState(createEmptyMoveData);

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionNotice, setActionNotice] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [itemRes, farmRes, moveRes] = await Promise.all([
        apiRequest('/inventory', { token }),
        apiRequest('/farms', { token }),
        apiRequest('/inventory/movements', { token }),
      ]);
      setItems(itemRes.data || []);
      setFarms(farmRes.farms || []);
      setMovements(moveRes.data || []);
      if (farmRes.farms && farmRes.farms.length > 0 && !formData.farmId) {
        setFormData((prev) => ({ ...prev, farmId: farmRes.farms[0]._id }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load inventory data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      farmId: farms[0]?._id || '',
      name: '',
      category: 'fertilizer',
      quantity: '',
      unit: 'kg',
      minThreshold: '10',
      costPerUnit: '',
      location: '',
      notes: '',
    });
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      farmId: item.farmId,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      minThreshold: item.minThreshold,
      costPerUnit: item.costPerUnit || 0,
      location: item.location || '',
      notes: item.notes || '',
    });
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenMove = (item, preferredType = 'out') => {
    setActiveItemForMove(item);
    setMoveData({
      type: preferredType,
      quantity: 1,
      reason: preferredType === 'in' ? 'purchase' : 'application',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setFormError('');
    setShowMoveModal(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');
    try {
      const payload = {
        ...formData,
        quantity: formData.quantity === '' ? 0 : Number(formData.quantity),
        minThreshold: formData.minThreshold === '' ? 0 : Number(formData.minThreshold),
        costPerUnit: formData.costPerUnit === '' ? 0 : Number(formData.costPerUnit),
      };
      if (editingItem) {
        await apiRequest(`/inventory/${editingItem._id}`, {
          method: 'PATCH',
          token,
          body: payload,
        });
        setActionNotice(`Supply item "${formData.name}" updated successfully.`);
      } else {
        await apiRequest('/inventory', {
          method: 'POST',
          token,
          body: payload,
        });
        setActionNotice(`Supply item "${formData.name}" added to inventory.`);
      }
      setShowAddModal(false);
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSaveMovement = async (e) => {
    e.preventDefault();
    if (!activeItemForMove) return;
    setFormSubmitting(true);
    setFormError('');
    try {
      await apiRequest('/inventory/movements', {
        method: 'POST',
        token,
        body: {
          itemId: activeItemForMove._id,
          ...moveData,
          quantity: Number(moveData.quantity),
        },
      });
      setShowMoveModal(false);
      setActionNotice(
        `Recorded ${moveData.type === 'in' ? 'stock inflow' : 'application/usage'} of ${moveData.quantity} ${activeItemForMove.unit} for "${activeItemForMove.name}".`
      );
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.name}" from inventory?`)) return;
    try {
      await apiRequest(`/inventory/${item._id}`, {
        method: 'DELETE',
        token,
      });
      setActionNotice(`Item "${item.name}" deleted.`);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (selectedFarmFilter !== 'all' && String(item.farmId) !== selectedFarmFilter) return false;
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.location && item.location.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const lowStockItems = items.filter((i) => i.isLowStock);
  const totalValue = items.reduce(
    (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.costPerUnit) || 0),
    0
  );

  return (
    <div className="inventory-page-wrap">
      <PageHeader
        eyebrow={t('inventory.eyebrow')}
        title={t('inventory.title')}
        description={t('inventory.description')}
        actions={
          <div className="d-flex gap-2 flex-wrap flex-grow-1 flex-sm-grow-0">
            <Button
              variant="outline-secondary"
              className="flex-grow-1 flex-sm-grow-0"
              onClick={() => setActiveTab(activeTab === 'catalog' ? 'movements' : 'catalog')}
            >
              <i className={`bi ${activeTab === 'catalog' ? 'bi-clock-history' : 'bi-boxes'} me-1`} />
              {activeTab === 'catalog' ? t('inventory.movementHistory') : t('inventory.stockCatalog')}
            </Button>
            <Button variant="primary" className="flex-grow-1 flex-sm-grow-0" onClick={handleOpenAdd}>
              <i className="bi bi-plus-lg me-1" /> {t('inventory.addItem')}
            </Button>
          </div>
        }
      />

      {actionNotice && (
        <div className="alert alert-success alert-dismissible py-2 px-3 small mb-3" role="status">
          <span>{actionNotice}</span>
          <button
            type="button"
            className="btn-close py-2"
            aria-label="Dismiss notice"
            onClick={() => setActionNotice('')}
          />
        </div>
      )}

      {error && <ErrorState message={error} onRetry={loadData} />}

      {/* KPI Cards */}
      <div className="dashboard-metrics mb-4">
        <Card className="metric-card">
          <div className="metric-card-top">
            <span>{t('inventory.totalItems')}</span>
            <span className="metric-icon">
              <i className="bi bi-box-seam" />
            </span>
          </div>
          <strong className="metric-value">{loading ? '—' : items.length}</strong>
          <span className="metric-note">{t('inventory.suppliesRegistered')}</span>
        </Card>

        <Card className="metric-card">
          <div className="metric-card-top">
            <span>{t('inventory.lowStock')}</span>
            <span className="metric-icon metric-icon-gold">
              <i className="bi bi-exclamation-triangle" />
            </span>
          </div>
          <strong className="metric-value" style={{ color: lowStockItems.length > 0 ? '#b94a48' : 'inherit' }}>
            {loading ? '—' : lowStockItems.length}
          </strong>
          <span className="metric-note">{t('inventory.itemsAtOrBelow')}</span>
        </Card>

        <Card className="metric-card">
          <div className="metric-card-top">
            <span>{t('inventory.estimatedStockValue')}</span>
            <span className="metric-icon metric-icon-sage">
              <i className="bi bi-currency-rupee" />
            </span>
          </div>
          <strong className="metric-value">
            {loading ? '—' : `₹${new Intl.NumberFormat('en-IN').format(Math.round(totalValue))}`}
          </strong>
          <span className="metric-note">{t('inventory.basedOnUnitCosts')}</span>
        </Card>

        <Card className="metric-card">
          <div className="metric-card-top">
            <span>{t('inventory.movementEvents')}</span>
            <span className="metric-icon">
              <i className="bi bi-arrow-left-right" />
            </span>
          </div>
          <strong className="metric-value">{loading ? '—' : movements.length}</strong>
          <span className="metric-note">{t('inventory.auditedMovements')}</span>
        </Card>
      </div>

      {/* Low Stock Banner */}
      {!loading && lowStockItems.length > 0 && (
        <div className="task-alert-banner alert-overdue mb-4" role="alert">
          <div className="alert-banner-content">
            <i className="bi bi-exclamation-octagon-fill alert-banner-icon" />
            <div>
              <strong>{t('inventory.lowInventoryWarning')}:</strong>{' '}
              {lowStockItems.map((i) => `${i.name} (${i.quantity} ${i.unit} left)`).join(', ')}.
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div className="segment-tabs" role="tablist">
          <button
            type="button"
            className={`segment-tab ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            <i className="bi bi-boxes me-1" /> {t('inventory.stockCatalog')} ({items.length})
          </button>
          <button
            type="button"
            className={`segment-tab ${activeTab === 'movements' ? 'active' : ''}`}
            onClick={() => setActiveTab('movements')}
          >
            <i className="bi bi-clock-history me-1" /> {t('inventory.movementAudit')} ({movements.length})
          </button>
        </div>

        {/* Filters */}
        <div className="d-flex gap-2 align-items-center flex-wrap">
          {farms.length > 1 && (
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={selectedFarmFilter}
              onChange={(e) => setSelectedFarmFilter(e.target.value)}
            >
              <option value="all">{t('operations.allFarms') || 'All Farms'}</option>
              {farms.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}

          {activeTab === 'catalog' && (
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder={t('inventory.searchSupplyOrStorage') || 'Search supply or storage…'}
              style={{ minWidth: '160px', maxWidth: '280px', width: 'auto' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Category Pills (only in catalog mode) */}
      {activeTab === 'catalog' && (
        <div className="d-flex gap-1 flex-nowrap overflow-x-auto mb-3 pb-1 no-scrollbar">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`btn btn-sm flex-shrink-0 text-nowrap ${selectedCategory === c.id ? 'btn-success' : 'btn-outline-secondary'}`}
              style={{ borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => setSelectedCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {loading && <LoadingState>{t('inventory.loadingInventory')}</LoadingState>}

      {/* CATALOG VIEW */}
      {!loading && activeTab === 'catalog' && (
        <Card className="p-0 overflow-hidden">
          {filteredItems.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon="bi-box-seam"
                title={t('inventory.noSuppliesFound')}
                description={
                  searchQuery || selectedCategory !== 'all'
                    ? t('inventory.noSuppliesDesc')
                    : t('inventory.noSuppliesEmpty')
                }
                action={
                  <Button variant="primary" onClick={handleOpenAdd}>
                    <i className="bi bi-plus-lg me-1" /> {t('inventory.addFirstSupply')}
                  </Button>
                }
              />
            </div>
          ) : (
            <DataTable
              headers={[
                t('inventory.thSupplyNameCategory'),
                t('inventory.thStockLevel'),
                t('inventory.thStorageLocation'),
                t('inventory.thUnitCost'),
                t('inventory.thEstimatedTotal'),
                t('inventory.thActions'),
              ]}
              label={t('inventory.stockCatalog')}
            >
              {filteredItems.map((item) => {
                const farmObj = farms.find((f) => f._id === item.farmId);
                const estValue = (Number(item.quantity) || 0) * (Number(item.costPerUnit) || 0);

                return (
                  <tr key={item._id}>
                    <td>
                      <div>
                        <strong>{item.name}</strong>
                        <div className="d-flex gap-2 align-items-center mt-1">
                          <span className="badge bg-light text-dark border text-capitalize">
                            {item.category}
                          </span>
                          {farmObj && <small className="text-muted">{farmObj.name}</small>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong className="fs-6">
                          {item.quantity} {item.unit}
                        </strong>
                        <div className="mt-1">
                          {item.isLowStock ? (
                            <Badge tone="amber">
                              <i className="bi bi-exclamation-triangle-fill me-1" /> {t('inventory.lowStock')} (Min: {item.minThreshold})
                            </Badge>
                          ) : (
                            <Badge tone="green">{t('inventory.adequateStock')} (Min: {item.minThreshold})</Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-muted">{item.location || t('inventory.warehouseFarmShed')}</span>
                    </td>
                    <td>{item.costPerUnit > 0 ? `₹${item.costPerUnit} / ${item.unit}` : '—'}</td>
                    <td>
                      <strong>{estValue > 0 ? `₹${new Intl.NumberFormat('en-IN').format(Math.round(estValue))}` : '—'}</strong>
                    </td>
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success"
                          title={t('inventory.titleStockIn')}
                          onClick={() => handleOpenMove(item, 'in')}
                        >
                          <i className="bi bi-plus-circle" /> {t('inventory.btnIn')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          title={t('inventory.titleStockOut')}
                          onClick={() => handleOpenMove(item, 'out')}
                        >
                          <i className="bi bi-dash-circle" /> {t('inventory.btnOut')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          title={t('common.edit')}
                          onClick={() => handleOpenEdit(item)}
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title={t('common.delete')}
                          onClick={() => handleDeleteItem(item)}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>
      )}

      {/* MOVEMENTS AUDIT VIEW */}
      {!loading && activeTab === 'movements' && (
        <Card className="p-0 overflow-hidden">
          {movements.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon="bi-clock-history"
                title={t('inventory.noMovementsRecorded')}
                description={t('inventory.noMovementsDesc')}
              />
            </div>
          ) : (
            <DataTable
              headers={[
                t('inventory.thDateTime'),
                t('inventory.itemName'),
                t('inventory.thMovementType'),
                t('inventory.thQuantity'),
                t('inventory.thReason'),
                t('inventory.thNotes'),
              ]}
              label={t('inventory.movementAudit')}
            >
              {movements.map((move) => {
                const itemObj = items.find((i) => i._id === move.itemId);
                const isIn = move.type === 'in';
                const formattedDate = move.date
                  ? new Date(move.date).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—';

                return (
                  <tr key={move._id}>
                    <td>
                      <small className="text-muted">{formattedDate}</small>
                    </td>
                    <td>
                      <strong>{itemObj ? itemObj.name : 'Catalog Item'}</strong>
                    </td>
                    <td>
                      <span className={`badge ${isIn ? 'bg-success' : 'bg-primary'}`}>
                        {isIn ? <i className="bi bi-arrow-down-left me-1" /> : <i className="bi bi-arrow-up-right me-1" />}
                        {isIn ? t('inventory.stockInflow') : t('inventory.stockOutflow')}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {move.quantity} {itemObj ? itemObj.unit : ''}
                      </strong>
                    </td>
                    <td>
                      <span className="text-capitalize text-muted">{move.reason?.replace('_', ' ')}</span>
                    </td>
                    <td>
                      <small className="text-muted">{move.notes || '—'}</small>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>
      )}

      {/* ADD / EDIT ITEM MODAL */}
      {showAddModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-box-seam me-2" />
                  {editingItem ? t('inventory.editSupplyItem') : t('inventory.addSupplyToInventory')}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowAddModal(false)}
                />
              </div>
              <form onSubmit={handleSaveItem}>
                <div className="modal-body">
                  {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

                  <div className="mb-3">
                    <label className="form-label" htmlFor="inv-farmId">
                      {t('farms.title')} *
                    </label>
                    <select
                      id="inv-farmId"
                      className="form-select"
                      value={formData.farmId}
                      required
                      onChange={(e) => setFormData({ ...formData, farmId: e.target.value })}
                    >
                      {farms.map((f) => (
                        <option key={f._id} value={f._id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label" htmlFor="inv-name">
                      {t('inventory.itemName')} *
                    </label>
                    <input
                      id="inv-name"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Urea 46%, Basmati Seeds, Glyphosate"
                      value={formData.name}
                      required
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" htmlFor="inv-category">
                        {t('inventory.category')} *
                      </label>
                      <select
                        id="inv-category"
                        className="form-select"
                        value={formData.category}
                        required
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      >
                        {categories.filter((c) => c.id !== 'all').map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label" htmlFor="inv-unit">
                        Unit of Measure *
                      </label>
                      <select
                        id="inv-unit"
                        className="form-select"
                        value={formData.unit}
                        required
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" htmlFor="inv-quantity">
                        {t('inventory.quantity')} *
                      </label>
                      <input
                        id="inv-quantity"
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        placeholder="0"
                        className="form-control"
                        value={formData.quantity}
                        required
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label" htmlFor="inv-threshold">
                        {t('inventory.reorderLevel')}
                      </label>
                      <input
                        id="inv-threshold"
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        placeholder="0"
                        className="form-control"
                        value={formData.minThreshold}
                        onChange={(e) => setFormData({ ...formData, minThreshold: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" htmlFor="inv-cost">
                        {t('inventory.thUnitCost')} (₹)
                      </label>
                      <input
                        id="inv-cost"
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="form-control"
                        value={formData.costPerUnit}
                        onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label" htmlFor="inv-location">
                        {t('inventory.thStorageLocation')}
                      </label>
                      <input
                        id="inv-location"
                        type="text"
                        className="form-control"
                        placeholder="e.g. Barn 2, North Shed"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label" htmlFor="inv-notes">
                      {t('common.notes')}
                    </label>
                    <textarea
                      id="inv-notes"
                      rows={2}
                      className="form-control"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <Button variant="outline-secondary" type="button" onClick={() => setShowAddModal(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" type="submit" disabled={formSubmitting}>
                    {formSubmitting ? t('common.saving') : editingItem ? t('inventory.updateSupply') : t('inventory.addToInventory')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* LOG MOVEMENT MODAL */}
      {showMoveModal && activeItemForMove && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-arrow-left-right me-2" />
                  {t('inventory.logMovement')}: {activeItemForMove.name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowMoveModal(false)}
                />
              </div>
              <form onSubmit={handleSaveMovement}>
                <div className="modal-body">
                  {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

                  <div className="p-3 bg-light rounded mb-3 d-flex justify-content-between align-items-center">
                    <div>
                      <small className="text-muted d-block">{t('inventory.currentStockLevel')}</small>
                      <strong className="fs-5">
                        {activeItemForMove.quantity} {activeItemForMove.unit}
                      </strong>
                    </div>
                    <Badge tone={activeItemForMove.isLowStock ? 'amber' : 'green'}>
                      {activeItemForMove.isLowStock ? t('inventory.lowStock') : t('inventory.adequateStock')}
                    </Badge>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" htmlFor="mov-type">
                        {t('inventory.actionType')} *
                      </label>
                      <select
                        id="mov-type"
                        className="form-select"
                        value={moveData.type}
                        required
                        onChange={(e) => {
                          const val = e.target.value;
                          setMoveData({
                            ...moveData,
                            type: val,
                            reason: val === 'in' ? 'purchase' : 'application',
                          });
                        }}
                      >
                        <option value="out">{t('inventory.stockOutOption')}</option>
                        <option value="in">{t('inventory.stockInOption')}</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label" htmlFor="mov-qty">
                        {t('inventory.thQuantity')} ({activeItemForMove.unit}) *
                      </label>
                      <input
                        id="mov-qty"
                        type="number"
                        step="any"
                        min="0.001"
                        inputMode="decimal"
                        max={moveData.type === 'out' ? activeItemForMove.quantity : undefined}
                        className="form-control"
                        value={moveData.quantity}
                        required
                        onChange={(e) => setMoveData({ ...moveData, quantity: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" htmlFor="mov-reason">
                        {t('inventory.thReason')} *
                      </label>
                      <select
                        id="mov-reason"
                        className="form-select"
                        value={moveData.reason}
                        required
                        onChange={(e) => setMoveData({ ...moveData, reason: e.target.value })}
                      >
                        {MOVEMENT_REASONS.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label" htmlFor="mov-date">
                        {t('common.date')} *
                      </label>
                      <input
                        id="mov-date"
                        type="date"
                        className="form-control"
                        value={moveData.date}
                        required
                        onChange={(e) => setMoveData({ ...moveData, date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label" htmlFor="mov-notes">
                      {t('common.notes')}
                    </label>
                    <textarea
                      id="mov-notes"
                      rows={2}
                      className="form-control"
                      placeholder="e.g. Applied across Field A for wheat top-dressing"
                      value={moveData.notes}
                      onChange={(e) => setMoveData({ ...moveData, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <Button variant="outline-secondary" type="button" onClick={() => setShowMoveModal(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" type="submit" disabled={formSubmitting}>
                    {formSubmitting ? t('common.saving') : t('inventory.recordMovement')}
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
