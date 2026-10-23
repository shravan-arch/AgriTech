import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/useAuth.js';
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
import {
  RevenueExpensesBarChart,
  ExpenseBreakdownDonut,
  CropProductionBarChart,
  FieldProductivityBarChart,
  FinancialTrendLineChart,
  MarketPriceComparisonChart,
} from '../components/charts/AnalyticsCharts.jsx';
import { formatINR, formatKg, normalizeYieldToKg } from '../lib/formatters.js';

const FINANCE_CATEGORIES = [
  { id: 'seeds', label: 'Seeds & Planting Stock' },
  { id: 'fertilizer', label: 'Fertilizers & Nutrients' },
  { id: 'chemical', label: 'Crop Protection & Chemicals' },
  { id: 'labor', label: 'Labor & Wages' },
  { id: 'irrigation', label: 'Irrigation & Pumping' },
  { id: 'equipment', label: 'Machinery & Fuel' },
  { id: 'harvest_sale', label: 'Harvest Crop Sales' },
  { id: 'maintenance', label: 'Farm Repairs & Maintenance' },
  { id: 'other', label: 'Other Operational Inputs' },
];

const getTodayStr = () => new Date().toISOString().split('T')[0];

const createInitialTxForm = () => ({
  farmId: '',
  fieldId: '',
  cropCycleId: '',
  type: 'expense',
  category: 'fertilizer',
  amount: '',
  currency: 'INR',
  date: getTodayStr(),
  description: '',
  receiptNumber: '',
});

export default function AnalyticsPage() {
  const { token } = useAuth();
  const [farms, setFarms] = useState([]);
  const [fields, setFields] = useState([]);
  const [cropCycles, setCropCycles] = useState([]);
  const [summary, setSummary] = useState(null);
  const [financeRecords, setFinanceRecords] = useState([]);
  const [marketPrices, setMarketPrices] = useState([]);

  // Filters State
  const [selectedFarmId, setSelectedFarmId] = useState('all');
  const [selectedFieldId, setSelectedFieldId] = useState('all');
  const [selectedCrop, setSelectedCrop] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all'); // 'all' | '30d' | '90d' | 'year'

  // Loading & Section Errors
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState('');
  const [sectionErrors, setSectionErrors] = useState({
    summary: '',
    finances: '',
    cycles: '',
    farms: '',
  });

  // Active Ledger Tab ('finances' | 'yields' | 'market')
  const [activeSection, setActiveSection] = useState('finances');

  // Modal State (Add & Edit)
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [txForm, setTxForm] = useState(createInitialTxForm);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Calculate Date Filters
  const getDateRangeBounds = useCallback(() => {
    if (selectedDateRange === 'all') return {};
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    let startDate;

    if (selectedDateRange === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString().split('T')[0];
    } else if (selectedDateRange === '90d') {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      startDate = d.toISOString().split('T')[0];
    } else if (selectedDateRange === 'year') {
      startDate = `${now.getFullYear()}-01-01`;
    }
    return { startDate, endDate };
  }, [selectedDateRange]);

  const [reloadKey, setReloadKey] = useState(0);
  const handleReload = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  // Load All Data Independently (Failure in one section does not break others)
  useEffect(() => {
    let active = true;

    const fetchAnalytics = async () => {
      const newErrors = { summary: '', finances: '', cycles: '', farms: '' };

      const { startDate, endDate } = getDateRangeBounds();
      const params = new URLSearchParams();
      if (selectedFarmId !== 'all') params.append('farmId', selectedFarmId);
      if (selectedFieldId !== 'all') params.append('fieldId', selectedFieldId);
      if (selectedCrop !== 'all') params.append('crop', selectedCrop);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const queryString = params.toString() ? `?${params.toString()}` : '';

      try {
        const [farmRes, summaryRes, finRes, cyclesRes] = await Promise.allSettled([
          apiRequest('/farms', { token }),
          apiRequest(`/analytics/summary${queryString}`, { token }),
          apiRequest(`/finances${queryString}`, { token }),
          apiRequest(`/farms/crop-cycles${selectedFarmId !== 'all' ? `?farmId=${selectedFarmId}` : ''}`, { token }),
        ]);

        if (!active) return;

        // 1. Farms
        if (farmRes.status === 'fulfilled') {
          const farmList = farmRes.value.farms || [];
          setFarms(farmList);
          if (farmList.length > 0 && !txForm.farmId) {
            setTxForm((prev) => ({ ...prev, farmId: farmList[0]._id }));
          }
        } else {
          newErrors.farms = farmRes.reason?.message || 'Could not load farms.';
        }

        // 2. Summary & Market Prices
        if (summaryRes.status === 'fulfilled') {
          setSummary(summaryRes.value.data);
          if (summaryRes.value.data?.marketPrices) {
            setMarketPrices(summaryRes.value.data.marketPrices);
          }
        } else {
          newErrors.summary = summaryRes.reason?.message || 'Failed to calculate analytics summary.';
        }

        // 3. Financial Ledger Records
        if (finRes.status === 'fulfilled') {
          setFinanceRecords(finRes.value.data || []);
        } else {
          newErrors.finances = finRes.reason?.message || 'Could not load financial transactions.';
        }

        // 4. Crop Cycles
        if (cyclesRes.status === 'fulfilled') {
          setCropCycles(cyclesRes.value.cropCycles || []);
        } else {
          newErrors.cycles = cyclesRes.reason?.message || 'Could not load crop cycles.';
        }

        setSectionErrors(newErrors);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchAnalytics();
    return () => {
      active = false;
    };
  }, [token, selectedFarmId, selectedFieldId, selectedCrop, getDateRangeBounds, txForm.farmId, reloadKey]);

  // Load Fields when selected farm changes
  useEffect(() => {
    let active = true;
    const fetchFields = async () => {
      if (selectedFarmId === 'all') {
        setFields([]);
        setSelectedFieldId('all');
        return;
      }
      try {
        const res = await apiRequest(`/farms/${selectedFarmId}/fields`, { token });
        if (active) {
          setFields(res.fields || []);
        }
      } catch {
        if (active) setFields([]);
      }
    };
    void fetchFields();
    return () => {
      active = false;
    };
  }, [selectedFarmId, token]);

  // List of unique crops from records for filter
  const availableCrops = useMemo(() => {
    const cropSet = new Set();
    cropCycles.forEach((c) => {
      if (c.cropName) cropSet.add(c.cropName);
    });
    return Array.from(cropSet);
  }, [cropCycles]);

  // Handle Open Add Modal
  const handleOpenAdd = () => {
    setEditingTxId(null);
    setTxForm({
      farmId: selectedFarmId !== 'all' ? selectedFarmId : (farms[0]?._id || ''),
      fieldId: selectedFieldId !== 'all' ? selectedFieldId : '',
      cropCycleId: '',
      type: 'expense',
      category: 'fertilizer',
      amount: '',
      currency: 'INR',
      date: getTodayStr(),
      description: '',
      receiptNumber: '',
    });
    setModalError('');
    setShowTxModal(true);
  };

  // Handle Open Edit Modal
  const handleOpenEdit = (rec) => {
    setEditingTxId(rec._id);
    const dateStr = rec.date ? new Date(rec.date).toISOString().split('T')[0] : getTodayStr();
    setTxForm({
      farmId: rec.farmId?._id || rec.farmId || '',
      fieldId: rec.fieldId?._id || rec.fieldId || '',
      cropCycleId: rec.cropCycleId?._id || rec.cropCycleId || '',
      type: rec.type || 'expense',
      category: rec.category || 'fertilizer',
      amount: String(rec.amount || ''),
      currency: rec.currency || 'INR',
      date: dateStr,
      description: rec.description || '',
      receiptNumber: rec.receiptNumber || '',
    });
    setModalError('');
    setShowTxModal(true);
  };

  // Handle Save (Create or Update)
  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError('');

    try {
      if (editingTxId) {
        await apiRequest(`/finances/${editingTxId}`, {
          method: 'PATCH',
          token,
          body: {
            ...txForm,
            amount: Number(txForm.amount),
            fieldId: txForm.fieldId || undefined,
            cropCycleId: txForm.cropCycleId || undefined,
          },
        });
        setActionNotice(`Financial record of ₹${txForm.amount} updated successfully.`);
      } else {
        await apiRequest('/finances', {
          method: 'POST',
          token,
          body: {
            ...txForm,
            amount: Number(txForm.amount),
            fieldId: txForm.fieldId || undefined,
            cropCycleId: txForm.cropCycleId || undefined,
          },
        });
        setActionNotice(`Financial record of ₹${txForm.amount} logged successfully.`);
      }
      setShowTxModal(false);
      handleReload();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDeleteTransaction = async (record) => {
    if (!window.confirm('Are you sure you want to delete this financial record?')) return;
    try {
      await apiRequest(`/finances/${record._id}`, {
        method: 'DELETE',
        token,
      });
      setActionNotice('Financial record deleted successfully.');
      handleReload();
    } catch (err) {
      setActionNotice(`Could not delete record: ${err.message}`);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedFarmId('all');
    setSelectedFieldId('all');
    setSelectedCrop('all');
    setSelectedDateRange('all');
  };

  const hasActiveFilters =
    selectedFarmId !== 'all' ||
    selectedFieldId !== 'all' ||
    selectedCrop !== 'all' ||
    selectedDateRange !== 'all';

  // Metrics from summary with safe fallbacks
  const metrics = summary?.summaryMetrics || {
    totalRevenue: summary?.finances?.totalIncome || 0,
    totalExpense: summary?.finances?.totalExpense || 0,
    netProfit: summary?.finances?.netProfit || 0,
    profitMargin: 0,
    totalHarvestedKg: 0,
    productivityKgPerHa: null,
    completedHarvestsCount: 0,
    activeCyclesCount: 0,
  };

  // Chart Data with real fallbacks
  const monthlyFinancesData = summary?.monthlyFinances || [];
  const expensesByCategoryData = summary?.expensesByCategory || [];
  const cropProductionData = summary?.cropProduction || [];
  const fieldProductivityData = summary?.fieldProductivity || [];

  // Completed Harvest Cycles
  const completedHarvests = cropCycles.filter(
    (c) => c.status === 'completed' && c.yieldQuantity && Number(c.yieldQuantity) > 0
  );

  return (
    <section className="page-shell analytics-page">
      {/* Page Header */}
      <PageHeader
        eyebrow="Financial Intelligence & Yield Performance"
        title="Farm Finances & Production Analytics"
        description="Database-backed double-entry ledger, input cost categorization, yield metrics normalized to kilograms, and verifiable national commodity market rates."
        actions={
          <div className="d-flex gap-2 align-items-center">
            <Button variant="primary" onClick={handleOpenAdd}>
              <i className="bi bi-plus-lg me-1" /> Log Income / Expense
            </Button>
          </div>
        }
      />

      {/* Global Notice Alert */}
      {actionNotice && (
        <div className="alert alert-success alert-dismissible py-2 px-3 small mb-4" role="status">
          <span>{actionNotice}</span>
          <button
            type="button"
            className="btn-close py-2"
            aria-label="Dismiss notice"
            onClick={() => setActionNotice('')}
          />
        </div>
      )}

      {/* Global / Section Error Alerts */}
      {sectionErrors.summary && (
        <ErrorState
          message={`Analytics Engine: ${sectionErrors.summary}`}
          onRetry={handleReload}
        />
      )}

      {/* Interactive Global Filters Bar */}
      <div className="analytics-filter-card">
        <div className="filter-group-wrap">
          {/* Farm Filter */}
          <div className="filter-item">
            <label htmlFor="filter-farm">Farm Location</label>
            <select
              id="filter-farm"
              className="form-select"
              value={selectedFarmId}
              onChange={(e) => {
                setSelectedFarmId(e.target.value);
                setSelectedFieldId('all');
              }}
            >
              <option value="all">All Farms ({farms.length})</option>
              {farms.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Field Filter */}
          <div className="filter-item">
            <label htmlFor="filter-field">Plot / Field</label>
            <select
              id="filter-field"
              className="form-select"
              value={selectedFieldId}
              disabled={selectedFarmId === 'all'}
              onChange={(e) => setSelectedFieldId(e.target.value)}
            >
              <option value="all">
                {selectedFarmId === 'all' ? 'Select farm first' : `All Fields (${fields.length})`}
              </option>
              {fields.map((fld) => (
                <option key={fld._id} value={fld._id}>
                  {fld.name} ({fld.areaHectares || '—'} ha)
                </option>
              ))}
            </select>
          </div>

          {/* Crop Filter */}
          <div className="filter-item">
            <label htmlFor="filter-crop">Crop Type</label>
            <select
              id="filter-crop"
              className="form-select"
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
            >
              <option value="all">All Crops</option>
              {availableCrops.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="filter-item">
            <label htmlFor="filter-dates">Date Horizon</label>
            <select
              id="filter-dates"
              className="form-select"
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
            >
              <option value="all">All Historical Records</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="year">Current Year (2026)</option>
            </select>
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <div className="d-flex align-items-end">
              <Button variant="outline-secondary" className="btn-sm" onClick={handleResetFilters}>
                <i className="bi bi-x-circle me-1" /> Reset Filters
              </Button>
            </div>
          )}
        </div>
      </div>

      {loading && <LoadingState>Calculating farm economics and field intelligence…</LoadingState>}

      {/* Database-Backed Summary Metrics Grid */}
      <div className="dashboard-metrics">
        {/* Metric 1: Total Revenue */}
        <Card className="metric-card">
          <div className="metric-card-top">
            <span>Total Farm Revenue</span>
            <span className="metric-icon metric-icon-sage">
              <i className="bi bi-graph-up-arrow" />
            </span>
          </div>
          <strong className="metric-value text-success">
            {loading ? '—' : formatINR(metrics.totalRevenue)}
          </strong>
          <span className="metric-note">Recorded crop harvest sales & revenue</span>
        </Card>

        {/* Metric 2: Operating Expenses */}
        <Card className="metric-card">
          <div className="metric-card-top">
            <span>Operating Expenses</span>
            <span className="metric-icon metric-icon-gold">
              <i className="bi bi-receipt" />
            </span>
          </div>
          <strong className="metric-value text-danger">
            {loading ? '—' : formatINR(metrics.totalExpense)}
          </strong>
          <span className="metric-note">Seeds, fertilizers, chemicals, labor & fuel</span>
        </Card>

        {/* Metric 3: Net Operating Profit / Loss */}
        <Card className="metric-card">
          <div className="metric-card-top">
            <span>Net Operating Margin</span>
            <span className="metric-icon">
              <i className="bi bi-wallet2" />
            </span>
          </div>
          <strong
            className="metric-value"
            style={{ color: metrics.netProfit >= 0 ? '#1e4933' : '#b94a48' }}
          >
            {loading ? '—' : formatINR(metrics.netProfit)}
          </strong>
          <span className="metric-note">
            {metrics.netProfit >= 0 ? 'Operating profit (Revenue - Expenses)' : 'Operating loss incurred'}
          </span>
        </Card>

        {/* Metric 4: Profit Margin % */}
        <Card className="metric-card">
          <div className="metric-card-top">
            <span>Operating Margin</span>
            <span className="metric-icon metric-icon-sage">
              <i className="bi bi-pie-chart" />
            </span>
          </div>
          <strong
            className="metric-value"
            style={{ color: metrics.profitMargin >= 0 ? '#1e4933' : '#b94a48' }}
          >
            {loading
              ? '—'
              : metrics.totalRevenue > 0
              ? `${metrics.profitMargin}%`
              : metrics.totalExpense > 0
              ? '-100%'
              : '0%'}
          </strong>
          <span className="metric-note">Calculation: Net Profit ÷ Revenue × 100%</span>
        </Card>

        {/* Metric 5: Total Production */}
        <Card className="metric-card">
          <div className="metric-card-top">
            <span>Total Production</span>
            <span className="metric-icon metric-icon-sage">
              <i className="bi bi-basket2-fill" />
            </span>
          </div>
          <strong className="metric-value">
            {loading ? '—' : formatKg(metrics.totalHarvestedKg)}
          </strong>
          <span className="metric-note">
            {metrics.totalHarvestedKg > 0
              ? `${(metrics.totalHarvestedKg / 100).toFixed(1)} Quintals across harvests`
              : 'Completed crop cycle yields'}
          </span>
        </Card>

        {/* Metric 6: Field Productivity */}
        <Card className="metric-card">
          <div className="metric-card-top">
            <span>Yield Productivity</span>
            <span className="metric-icon metric-icon-gold">
              <i className="bi bi-speedometer2" />
            </span>
          </div>
          <strong className="metric-value">
            {loading
              ? '—'
              : metrics.productivityKgPerHa !== null
              ? `${metrics.productivityKgPerHa.toLocaleString('en-IN')} kg/ha`
              : 'Area required'}
          </strong>
          <span className="metric-note">
            {metrics.productivityKgPerHa !== null
              ? 'Average harvested yield per hectare'
              : 'Specify field acreage to compute kg/ha'}
          </span>
        </Card>
      </div>

      {/* ==================== 6 REQUIRED CHARTS GRID ==================== */}
      <div className="charts-grid">
        {/* Chart 1: Revenue vs Expenses Grouped Bar Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <span className="eyebrow">Cash Flow Analysis</span>
              <h3>Revenue vs. Operating Expenses</h3>
              <p>Grouped monthly comparison of farm receipts and operational disbursements.</p>
            </div>
            <Badge tone="green">Monthly</Badge>
          </div>
          <RevenueExpensesBarChart data={monthlyFinancesData} />
        </div>

        {/* Chart 2: Expense Breakdown Donut Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <span className="eyebrow">Input Cost Allocation</span>
              <h3>Operating Expense Distribution</h3>
              <p>Breakdown of farm investments into seeds, nutrients, labor, irrigation and fuel.</p>
            </div>
            <Badge tone="gold">Category</Badge>
          </div>
          <ExpenseBreakdownDonut data={expensesByCategoryData} />
        </div>

        {/* Chart 3: Crop Production Comparison Bar Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <span className="eyebrow">Production Volume</span>
              <h3>Crop Harvest Production Comparison</h3>
              <p>Total harvested yield by crop variety, normalized to standard Kilograms (kg).</p>
            </div>
            <Badge tone="green">Normalized kg</Badge>
          </div>
          <CropProductionBarChart data={cropProductionData} />
        </div>

        {/* Chart 4: Field Productivity Bar Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <span className="eyebrow">Land Efficiency</span>
              <h3>Field Productivity (kg / Hectare)</h3>
              <p>Harvest yield per unit area across cultivated plots with documented acreage.</p>
            </div>
            <Badge tone="neutral">kg / ha</Badge>
          </div>
          <FieldProductivityBarChart data={fieldProductivityData} />
        </div>

        {/* Chart 5: Financial Trend Multi-Line Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <span className="eyebrow">Economic Trajectory</span>
              <h3>Financial Trend & Net Operating Profit</h3>
              <p>Chronological trajectory of revenue, operating expenses, and net profit margin.</p>
            </div>
            <Badge tone="green">Trajectory</Badge>
          </div>
          <FinancialTrendLineChart data={monthlyFinancesData} />
        </div>

        {/* Chart 6: Commodity Market Benchmark Rates Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <span className="eyebrow">Official APMC Benchmarks</span>
              <h3>Commodity Market Benchmark Prices</h3>
              <p>Official modal prices from Ministry of Agriculture & Farmers Welfare price series.</p>
            </div>
            <Badge tone="gold">₹ / Quintal</Badge>
          </div>
          <MarketPriceComparisonChart data={marketPrices} />
        </div>
      </div>

      {/* ==================== DETAILED RECORDS SECTION ==================== */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="segment-tabs" role="tablist">
          <button
            type="button"
            className={`segment-tab ${activeSection === 'finances' ? 'active' : ''}`}
            onClick={() => setActiveSection('finances')}
          >
            <i className="bi bi-cash-coin" /> Financial Ledger ({financeRecords.length})
          </button>
          <button
            type="button"
            className={`segment-tab ${activeSection === 'yields' ? 'active' : ''}`}
            onClick={() => setActiveSection('yields')}
          >
            <i className="bi bi-bar-chart-line" /> Harvest Yields ({completedHarvests.length})
          </button>
          <button
            type="button"
            className={`segment-tab ${activeSection === 'market' ? 'active' : ''}`}
            onClick={() => setActiveSection('market')}
          >
            <i className="bi bi-shop" /> Market Price Series ({marketPrices.length})
          </button>
        </div>

        {activeSection === 'finances' && (
          <Button variant="primary" className="btn-sm" onClick={handleOpenAdd}>
            <i className="bi bi-plus-lg me-1" /> Add Transaction
          </Button>
        )}
      </div>

      {/* TAB 1: FINANCIAL LEDGER */}
      {activeSection === 'finances' && (
        <Card className="p-0 overflow-hidden mb-5">
          <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
            <div>
              <h3 className="h6 mb-0">Farm Operational Transactions Ledger</h3>
              <small className="text-muted">
                Showing {financeRecords.length} database-backed entries for selected filters.
              </small>
            </div>
          </div>

          {sectionErrors.finances && (
            <div className="p-3">
              <ErrorState message={sectionErrors.finances} onRetry={handleReload} />
            </div>
          )}

          {financeRecords.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon="bi-journal-text"
                title="No financial transactions recorded"
                description="Keep your operational ledger accurate by logging seed purchases, fertilizers, fuel, labor wages, and crop harvest sales."
                action={
                  <Button variant="primary" onClick={handleOpenAdd}>
                    <i className="bi bi-plus-lg me-1" /> Log First Transaction
                  </Button>
                }
              />
            </div>
          ) : (
            <DataTable
              headers={['Date', 'Type & Category', 'Farm / Field', 'Description', 'Receipt / Ref', 'Amount (₹)', 'Actions']}
              label="Farm financial records"
            >
              {financeRecords.map((r) => {
                const isRev = r.type === 'revenue';
                const catObj = FINANCE_CATEGORIES.find((c) => c.id === r.category);
                const farmObj = farms.find((f) => String(f._id || f.id) === String(r.farmId));
                return (
                  <tr key={r._id}>
                    <td>
                      <small className="text-muted">
                        {new Date(r.date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </small>
                    </td>
                    <td>
                      <div>
                        <span className={`badge ${isRev ? 'bg-success' : 'bg-danger'} me-1`}>
                          {isRev ? 'Revenue' : 'Expense'}
                        </span>
                        <small className="fw-bold">{catObj ? catObj.label : r.category}</small>
                      </div>
                    </td>
                    <td>
                      <small className="text-muted">
                        {farmObj?.name || 'General Farm'}
                      </small>
                    </td>
                    <td>{r.description || '—'}</td>
                    <td>
                      <code>{r.receiptNumber || '—'}</code>
                    </td>
                    <td>
                      <strong className={isRev ? 'text-success' : 'text-danger'}>
                        {isRev ? '+' : '-'}₹{new Intl.NumberFormat('en-IN').format(r.amount)}
                      </strong>
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-0 px-2"
                          title="Edit transaction"
                          onClick={() => handleOpenEdit(r)}
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger py-0 px-2"
                          title="Delete transaction"
                          onClick={() => handleDeleteTransaction(r)}
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

      {/* TAB 2: CROP YIELDS */}
      {activeSection === 'yields' && (
        <Card className="p-0 overflow-hidden mb-5">
          <div className="p-4 border-bottom">
            <span className="eyebrow">Crop Yield Performance</span>
            <h3 className="h5 mb-1">Harvested Yields by Crop Variety</h3>
            <p className="text-muted small mb-0">
              Recorded yields from completed field cultivation cycles, with unit normalization to kilograms.
            </p>
          </div>

          {sectionErrors.cycles && (
            <div className="p-3">
              <ErrorState message={sectionErrors.cycles} onRetry={handleReload} />
            </div>
          )}

          {completedHarvests.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon="bi-basket2"
                title="No completed crop harvest yields recorded"
                description="When a crop cycle is harvested and marked as completed, record its harvest yield quantity and unit to view production analytics here."
              />
            </div>
          ) : (
            <DataTable
              headers={[
                'Crop & Variety',
                'Farm & Field',
                'Planting Date',
                'Harvest Date',
                'Harvest Yield',
                'Normalized (kg)',
                'Productivity (kg/ha)',
                'Status',
              ]}
              label="Crop harvest yields ledger"
            >
              {completedHarvests.map((c) => {
                const farmObj = farms.find((f) => String(f._id || f.id) === String(c.farmId));
                const fldObj = fields.find((fld) => String(fld._id || fld.id) === String(c.fieldId));
                const kg = normalizeYieldToKg(c.yieldQuantity, c.yieldUnit);
                const area = fldObj ? Number(fldObj.areaHectares) || 0 : 0;
                const productivity = area > 0 ? Math.round((kg / area) * 100) / 100 : null;

                return (
                  <tr key={c._id}>
                    <td>
                      <strong>{c.cropName}</strong>
                      {c.variety && <small className="d-block text-muted">Variety: {c.variety}</small>}
                    </td>
                    <td>
                      <div>{farmObj?.name || 'Farm Field'}</div>
                      {fldObj && <small className="text-muted">{fldObj.name} ({area} ha)</small>}
                    </td>
                    <td>
                      <small className="text-muted">
                        {c.plantingDate ? new Date(c.plantingDate).toLocaleDateString() : '—'}
                      </small>
                    </td>
                    <td>
                      <small className="text-muted">
                        {c.harvestDate ? new Date(c.harvestDate).toLocaleDateString() : '—'}
                      </small>
                    </td>
                    <td>
                      <strong className="fs-6 text-success">
                        {c.yieldQuantity} {c.yieldUnit || 'kg'}
                      </strong>
                    </td>
                    <td>
                      <strong>{kg.toLocaleString('en-IN')} kg</strong>
                    </td>
                    <td>
                      {productivity !== null ? (
                        <span className="badge bg-light text-success border">
                          {productivity.toLocaleString('en-IN')} kg/ha
                        </span>
                      ) : (
                        <span className="text-muted small">Acreage needed</span>
                      )}
                    </td>
                    <td>
                      <Badge tone="green">Completed Harvest</Badge>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>
      )}

      {/* TAB 3: BENCHMARK MARKET PRICES */}
      {activeSection === 'market' && (
        <Card className="p-0 overflow-hidden mb-5">
          <div className="p-4 border-bottom">
            <span className="eyebrow">Agmarknet / Agricultural Price Network</span>
            <h3 className="h5 mb-1">Verifiable Commodity Market Benchmark Rates</h3>
            <p className="text-muted small mb-0">
              Official public modal prices from representative agricultural primary markets and APMCs.
            </p>
          </div>

          <DataTable
            headers={[
              'Commodity & Quality',
              'Representative Market Center',
              'Modal Benchmark Price',
              '24h Price Trend',
              'Official Source & Attribution',
            ]}
            label="Commodity price series"
          >
            {marketPrices.map((m, idx) => (
              <tr key={idx}>
                <td>
                  <strong>{m.commodity}</strong>
                  <small className="d-block text-muted">{m.variety}</small>
                </td>
                <td>
                  <span className="text-muted">{m.marketCenter}</span>
                </td>
                <td>
                  <strong className="fs-6 text-success">
                    ₹{m.modalPrice.toLocaleString('en-IN')} {m.unit}
                  </strong>
                </td>
                <td>
                  <span
                    className={`badge ${
                      m.change?.startsWith('+')
                        ? 'bg-success-subtle text-success'
                        : m.change?.startsWith('-')
                        ? 'bg-danger-subtle text-danger'
                        : 'bg-light text-muted'
                    }`}
                  >
                    {m.change}
                  </span>
                </td>
                <td>
                  <small className="text-muted">
                    <i className="bi bi-shield-check text-success me-1" />
                    {m.source}
                  </small>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}

      {/* ==================== ADD / EDIT TRANSACTION MODAL ==================== */}
      {showTxModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-cash-coin me-2" />
                  {editingTxId ? 'Edit Financial Transaction' : 'Log Financial Transaction'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowTxModal(false)}
                />
              </div>
              <form onSubmit={handleSaveTransaction}>
                <div className="modal-body">
                  {modalError && <div className="alert alert-danger py-2 small">{modalError}</div>}

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" htmlFor="tx-type">
                        Transaction Type *
                      </label>
                      <select
                        id="tx-type"
                        className="form-select"
                        value={txForm.type}
                        required
                        onChange={(e) => {
                          const val = e.target.value;
                          setTxForm({
                            ...txForm,
                            type: val,
                            category: val === 'revenue' ? 'harvest_sale' : 'fertilizer',
                          });
                        }}
                      >
                        <option value="expense">Operating Expense</option>
                        <option value="revenue">Farm Revenue / Sale</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label" htmlFor="tx-cat">
                        Category *
                      </label>
                      <select
                        id="tx-cat"
                        className="form-select"
                        value={txForm.category}
                        required
                        onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}
                      >
                        {FINANCE_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" htmlFor="tx-amount">
                        Amount (₹) *
                      </label>
                      <input
                        id="tx-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="form-control"
                        placeholder="e.g. 5000"
                        value={txForm.amount}
                        required
                        onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label" htmlFor="tx-date">
                        Transaction Date *
                      </label>
                      <input
                        id="tx-date"
                        type="date"
                        className="form-control"
                        value={txForm.date}
                        required
                        onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" htmlFor="tx-farm">
                        Farm *
                      </label>
                      <select
                        id="tx-farm"
                        className="form-select"
                        value={txForm.farmId}
                        required
                        onChange={(e) => {
                          const fId = e.target.value;
                          setTxForm({ ...txForm, farmId: fId, fieldId: '' });
                        }}
                      >
                        {farms.map((f) => (
                          <option key={f._id} value={f._id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label" htmlFor="tx-field">
                        Field (Optional)
                      </label>
                      <select
                        id="tx-field"
                        className="form-select"
                        value={txForm.fieldId}
                        onChange={(e) => setTxForm({ ...txForm, fieldId: e.target.value })}
                      >
                        <option value="">Farm General</option>
                        {fields.map((f) => (
                          <option key={f._id} value={f._id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label" htmlFor="tx-receipt">
                      Receipt / Bill Ref
                    </label>
                    <input
                      id="tx-receipt"
                      type="text"
                      className="form-control"
                      placeholder="e.g. INV-2026-88"
                      value={txForm.receiptNumber}
                      onChange={(e) => setTxForm({ ...txForm, receiptNumber: e.target.value })}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label" htmlFor="tx-desc">
                      Description / Vendor Notes
                    </label>
                    <textarea
                      id="tx-desc"
                      rows={2}
                      className="form-control"
                      placeholder="e.g. Purchased 10 bags DAP fertilizer from Kisan Kendra"
                      value={txForm.description}
                      onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <Button variant="outline-secondary" type="button" onClick={() => setShowTxModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : editingTxId ? 'Update Record' : 'Save Transaction'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
