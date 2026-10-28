import { useState } from 'react';
import { useLanguage } from '../../context/useLanguage.js';
import { formatINR, formatKg } from '../../lib/formatters.js';

// Empty State for Charts
export function ChartEmptyState({ icon = 'bi-bar-chart', title, message }) {
  return (
    <div className="chart-empty-container">
      <div className="chart-empty-icon">
        <i className={`bi ${icon}`} />
      </div>
      <div className="chart-empty-title">{title}</div>
      <p className="chart-empty-desc">{message}</p>
    </div>
  );
}

// ==================== 1. REVENUE VS EXPENSES GROUPED BAR CHART ====================
export function RevenueExpensesBarChart({ data = [] }) {
  const { t } = useLanguage();
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) {
    return (
      <ChartEmptyState
        icon="bi-cash-coin"
        title={t('analytics.noFinancialRecords')}
        message={t('analytics.noFinancialRecordsDesc')}
      />
    );
  }

  // Find max value for Y-axis scale
  const maxVal = Math.max(
    ...data.map((d) => Math.max(Number(d.revenue) || 0, Number(d.expense) || 0)),
    1000
  );

  // SVG Dimensions
  const width = 500;
  const height = 240;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 45;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const barGroupWidth = chartWidth / data.length;
  const barWidth = Math.min(Math.max(barGroupWidth * 0.32, 10), 32);

  return (
    <div className="w-100">
      <div className="chart-svg-wrap">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={t('analytics.revenueExpensesBarAria')}
        >
          {/* Gridlines & Y-Axis Labels */}
          {yTicks.map((tickRatio, i) => {
            const y = paddingTop + chartHeight * (1 - tickRatio);
            const val = Math.round(maxVal * tickRatio);
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#e6ede5"
                  strokeDasharray={tickRatio === 0 ? 'none' : '3,3'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#718274"
                  fontFamily="sans-serif"
                >
                  {val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((item, idx) => {
            const groupX = paddingLeft + idx * barGroupWidth;
            const revVal = Number(item.revenue) || 0;
            const expVal = Number(item.expense) || 0;

            const revHeight = (revVal / maxVal) * chartHeight;
            const expHeight = (expVal / maxVal) * chartHeight;

            const revX = groupX + barGroupWidth / 2 - barWidth - 2;
            const expX = groupX + barGroupWidth / 2 + 2;

            const revY = paddingTop + chartHeight - revHeight;
            const expY = paddingTop + chartHeight - expHeight;

            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Hover Background Highlight */}
                {isHovered && (
                  <rect
                    x={groupX + 2}
                    y={paddingTop}
                    width={barGroupWidth - 4}
                    height={chartHeight}
                    fill="rgba(40, 93, 67, 0.05)"
                    rx="6"
                  />
                )}

                {/* Revenue Bar (Green) */}
                <rect
                  x={revX}
                  y={revY}
                  width={barWidth}
                  height={Math.max(revHeight, 2)}
                  fill={isHovered ? '#1e4933' : '#285d43'}
                  rx="4"
                />

                {/* Expense Bar (Terracotta Gold) */}
                <rect
                  x={expX}
                  y={expY}
                  width={barWidth}
                  height={Math.max(expHeight, 2)}
                  fill={isHovered ? '#b45309' : '#d97706'}
                  rx="4"
                />

                {/* Month Label */}
                <text
                  x={groupX + barGroupWidth / 2}
                  y={height - 15}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  fill={isHovered ? '#1e3228' : '#576859'}
                  fontFamily="sans-serif"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Details */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div
            className="chart-tooltip-box position-absolute"
            style={{
              top: '10px',
              right: '15px',
            }}
          >
            <strong>{data[hoveredIdx].label}</strong>
            <div className="d-flex gap-3 mt-1">
              <span className="text-success">Rev: {formatINR(data[hoveredIdx].revenue)}</span>
              <span style={{ color: '#f59e0b' }}>Exp: {formatINR(data[hoveredIdx].expense)}</span>
              <span className="text-light">
                Net: {formatINR(Number(data[hoveredIdx].revenue) - Number(data[hoveredIdx].expense))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="chart-legend justify-content-center">
        <div className="chart-legend-item">
          <span className="chart-legend-dot" style={{ background: '#285d43' }} />
          <span>{t('analytics.farmRevenueLegend')}</span>
        </div>
        <div className="chart-legend-item">
          <span className="chart-legend-dot" style={{ background: '#d97706' }} />
          <span>{t('analytics.operatingExpensesLegend')}</span>
        </div>
      </div>
    </div>
  );
}

// ==================== 2. EXPENSE BREAKDOWN DONUT CHART ====================
export function ExpenseBreakdownDonut({ data = [] }) {
  const { t } = useLanguage();
  const [hoveredCat, setHoveredCat] = useState(null);

  const totalExpense = data.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  if (!data || data.length === 0 || totalExpense === 0) {
    return (
      <ChartEmptyState
        icon="bi-pie-chart"
        title={t('analytics.noOperationalExpenses')}
        message={t('analytics.noOperationalExpensesDesc')}
      />
    );
  }

  const PALETTE = [
    '#15803d', // Fertilizer: emerald
    '#0284c7', // Irrigation: sky
    '#d97706', // Labor: amber
    '#10b981', // Seeds: light green
    '#ea580c', // Equipment: orange
    '#047857', // Chemicals: forest green
    '#7c3aed', // Maintenance: purple
    '#475569', // Other: slate
  ];

  // SVG parameters
  const size = 260;
  const radius = 90;
  const strokeWidth = 36;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const slices = data.reduce((acc, item, idx) => {
    const fraction = totalExpense > 0 ? (Number(item.amount) || 0) / totalExpense : 0;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -acc.cumulativeAngle * circumference;
    acc.list.push({
      ...item,
      color: PALETTE[idx % PALETTE.length],
      strokeDasharray,
      strokeDashoffset,
      fraction,
    });
    acc.cumulativeAngle += fraction;
    return acc;
  }, { list: [], cumulativeAngle: 0 }).list;

  const activeSlice = hoveredCat ? slices.find((s) => s.category === hoveredCat) : null;

  return (
    <div className="w-100">
      <div className="d-flex flex-column flex-md-row align-items-center justify-content-center gap-4">
        {/* SVG Donut */}
        <div style={{ width: '220px', height: '220px', position: 'relative' }}>
          <svg
            viewBox={`0 0 ${size} ${size}`}
            style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
            role="img"
            aria-label={t('analytics.expenseDonutAria')}
          >
            {/* Background ring */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="#eaf1e9"
              strokeWidth={strokeWidth}
            />

            {/* Slices */}
            {slices.map((slice, idx) => {
              const isHovered = hoveredCat === slice.category;
              return (
                <circle
                  key={idx}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                  strokeDasharray={slice.strokeDasharray}
                  strokeDashoffset={slice.strokeDashoffset}
                  strokeLinecap="butt"
                  style={{
                    cursor: 'pointer',
                    transition: 'stroke-width 180ms ease, opacity 180ms ease',
                    opacity: hoveredCat && !isHovered ? 0.45 : 1,
                  }}
                  onMouseEnter={() => setHoveredCat(slice.category)}
                  onMouseLeave={() => setHoveredCat(null)}
                />
              );
            })}
          </svg>

          {/* Center text */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#67766b', fontWeight: 700 }}>
              {activeSlice ? activeSlice.label : 'Total Inputs'}
            </span>
            <strong style={{ fontSize: '1.25rem', color: '#1e3228', fontWeight: 800 }}>
              {formatINR(activeSlice ? activeSlice.amount : totalExpense)}
            </strong>
            <span style={{ fontSize: '0.72rem', color: '#88988b' }}>
              {activeSlice ? `${(activeSlice.fraction * 100).toFixed(1)}%` : 'Operating Costs'}
            </span>
          </div>
        </div>

        {/* Legend List */}
        <div className="d-flex flex-column gap-2" style={{ minWidth: '190px' }}>
          {slices.map((slice, idx) => {
            const isHovered = hoveredCat === slice.category;
            return (
              <div
                key={idx}
                className="d-flex align-items-center justify-content-between p-1 rounded"
                style={{
                  cursor: 'pointer',
                  backgroundColor: isHovered ? '#f0f5ef' : 'transparent',
                  transition: 'background-color 140ms ease',
                }}
                onMouseEnter={() => setHoveredCat(slice.category)}
                onMouseLeave={() => setHoveredCat(null)}
              >
                <div className="d-flex align-items-center gap-2">
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: slice.color,
                      flexShrink: 0,
                    }}
                  />
                  <small style={{ fontSize: '0.78rem', color: isHovered ? '#1e3228' : '#45594b', fontWeight: isHovered ? 700 : 500 }}>
                    {slice.label}
                  </small>
                </div>
                <div className="text-end">
                  <small className="fw-bold" style={{ fontSize: '0.78rem' }}>
                    {formatINR(slice.amount)}
                  </small>
                  <span className="text-muted ms-1" style={{ fontSize: '0.7rem' }}>
                    ({(slice.fraction * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==================== 3. CROP PRODUCTION COMPARISON BAR CHART ====================
export function CropProductionBarChart({ data = [] }) {
  const { t } = useLanguage();
  if (!data || data.length === 0) {
    return (
      <ChartEmptyState
        icon="bi-basket2"
        title={t('analytics.noHarvestYields')}
        message={t('analytics.noHarvestYieldsDesc')}
      />
    );
  }

  const maxKg = Math.max(...data.map((d) => Number(d.totalKg) || 0), 100);

  return (
    <div className="w-100">
      <div className="d-flex flex-column gap-3 py-2">
        {data.map((item, idx) => {
          const kg = Number(item.totalKg) || 0;
          const pct = Math.min(Math.max((kg / maxKg) * 100, 2), 100);
          const quintals = (kg / 100).toFixed(1);

          return (
            <div key={idx}>
              <div className="d-flex justify-content-between align-items-baseline mb-1">
                <div>
                  <strong style={{ fontSize: '0.88rem', color: '#1e3228' }}>{item.cropName}</strong>
                  <span className="text-muted ms-2" style={{ fontSize: '0.73rem' }}>
                    ({item.harvestCount} {item.harvestCount === 1 ? 'harvest' : 'harvests'})
                  </span>
                </div>
                <div className="text-end">
                  <strong className="text-success" style={{ fontSize: '0.92rem' }}>
                    {formatKg(kg)}
                  </strong>
                  <span className="text-muted ms-1" style={{ fontSize: '0.75rem' }}>
                    ({quintals} Qtl)
                  </span>
                </div>
              </div>
              <div
                style={{
                  height: '14px',
                  backgroundColor: '#edf2ec',
                  borderRadius: '7px',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #285d43 0%, #408562 100%)',
                    borderRadius: '7px',
                    transition: 'width 300ms ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-muted small mt-2 pt-2 border-top d-flex justify-content-between">
        <span>{t('analytics.normalizedUnitsNote')}</span>
        <span>{t('analytics.quintalNote')}</span>
      </div>
    </div>
  );
}

// ==================== 4. FIELD PRODUCTIVITY (KG / HECTARE) BAR CHART ====================
export function FieldProductivityBarChart({ data = [] }) {
  const { t } = useLanguage();
  if (!data || data.length === 0) {
    return (
      <ChartEmptyState
        icon="bi-speedometer2"
        title={t('analytics.fieldAcreageNeeded')}
        message={t('analytics.fieldAcreageNeededDesc')}
      />
    );
  }

  const maxYieldPerHa = Math.max(...data.map((d) => Number(d.yieldPerHectare) || 0), 100);
  const avgYieldPerHa = Math.round(
    data.reduce((sum, d) => sum + (Number(d.yieldPerHectare) || 0), 0) / (data.length || 1)
  );

  return (
    <div className="w-100">
      <div className="d-flex justify-content-between align-items-center mb-2 px-1">
        <span className="badge bg-light text-success border">
          {t('analytics.averageProductivity')}: {avgYieldPerHa.toLocaleString('en-IN')} kg/ha
        </span>
        <span className="text-muted small">{t('analytics.productivityCalculationNote')}</span>
      </div>

      <div className="d-flex flex-column gap-3 py-2">
        {data.map((item, idx) => {
          const yph = Number(item.yieldPerHectare) || 0;
          const pct = Math.min(Math.max((yph / maxYieldPerHa) * 100, 2), 100);

          return (
            <div key={idx}>
              <div className="d-flex justify-content-between align-items-baseline mb-1">
                <div>
                  <strong style={{ fontSize: '0.88rem', color: '#1e3228' }}>{item.fieldName}</strong>
                  <span className="badge bg-light text-muted ms-2" style={{ fontSize: '0.7rem' }}>
                    {item.cropName} ({item.areaHectares} ha)
                  </span>
                </div>
                <strong style={{ color: '#1e4933', fontSize: '0.92rem' }}>
                  {yph.toLocaleString('en-IN')} kg/ha
                </strong>
              </div>
              <div
                style={{
                  height: '14px',
                  backgroundColor: '#edf2ec',
                  borderRadius: '7px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #15803d 0%, #22c55e 100%)',
                    borderRadius: '7px',
                    transition: 'width 300ms ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 5. FINANCIAL CASH FLOW & NET PROFIT TREND LINE CHART ====================
export function FinancialTrendLineChart({ data = [] }) {
  const { t } = useLanguage();
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length < 2) {
    return (
      <ChartEmptyState
        icon="bi-graph-up"
        title={t('analytics.insufficientTransactions')}
        message={t('analytics.insufficientTransactionsDesc')}
      />
    );
  }

  const width = 520;
  const height = 230;
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const allVals = data.flatMap((d) => [Number(d.revenue) || 0, Number(d.expense) || 0, Number(d.netProfit) || 0]);
  const maxVal = Math.max(...allVals, 1000);
  const minVal = Math.min(...allVals, 0); // Include zero or negative profit
  const valRange = maxVal - minVal || 1;

  const getY = (val) => paddingTop + chartHeight - ((val - minVal) / valRange) * chartHeight;
  const getX = (idx) => paddingLeft + (idx / (data.length - 1)) * chartWidth;

  const zeroY = getY(0);

  // Generate SVG path points
  const revPoints = data.map((d, i) => `${getX(i)},${getY(Number(d.revenue) || 0)}`).join(' ');
  const expPoints = data.map((d, i) => `${getX(i)},${getY(Number(d.expense) || 0)}`).join(' ');
  const netPoints = data.map((d, i) => `${getX(i)},${getY(Number(d.netProfit) || 0)}`).join(' ');

  return (
    <div className="w-100">
      <div className="chart-svg-wrap">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={t('analytics.profitLineAria')}
        >
          {/* Zero baseline */}
          <line
            x1={paddingLeft}
            y1={zeroY}
            x2={width - paddingRight}
            y2={zeroY}
            stroke="#94a3b8"
            strokeDasharray="4,4"
          />
          <text
            x={paddingLeft - 8}
            y={zeroY + 4}
            textAnchor="end"
            fontSize="9"
            fill="#64748b"
            fontWeight="bold"
          >
            ₹0
          </text>

          {/* Max value gridline */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={width - paddingRight}
            y2={paddingTop}
            stroke="#e2e8f0"
            strokeDasharray="2,2"
          />
          <text
            x={paddingLeft - 8}
            y={paddingTop + 4}
            textAnchor="end"
            fontSize="9"
            fill="#718274"
          >
            {formatINR(maxVal)}
          </text>

          {/* Revenue Line (Green) */}
          <polyline fill="none" stroke="#16a34a" strokeWidth="2.5" points={revPoints} />

          {/* Expense Line (Amber Red) */}
          <polyline fill="none" stroke="#ef4444" strokeWidth="2.5" points={expPoints} />

          {/* Net Profit Line (Blue Gold) */}
          <polyline fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="5,2" points={netPoints} />

          {/* Data Points */}
          {data.map((d, idx) => {
            const x = getX(idx);
            const ry = getY(Number(d.revenue) || 0);
            const ey = getY(Number(d.expense) || 0);
            const ny = getY(Number(d.netProfit) || 0);
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Vertical hover guide */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={height - paddingBottom}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                  />
                )}

                <circle cx={x} cy={ry} r={isHovered ? 5 : 3.5} fill="#16a34a" stroke="#fff" strokeWidth="1.5" />
                <circle cx={x} cy={ey} r={isHovered ? 5 : 3.5} fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
                <circle cx={x} cy={ny} r={isHovered ? 5 : 3.5} fill="#2563eb" stroke="#fff" strokeWidth="1.5" />

                {/* X-axis Label */}
                <text
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  fill={isHovered ? '#1e3228' : '#64748b'}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="chart-tooltip-box position-absolute" style={{ top: '8px', right: '12px' }}>
            <strong>{data[hoveredIdx].label}</strong>
            <div className="d-flex gap-2 mt-1">
              <span className="text-success">Rev: {formatINR(data[hoveredIdx].revenue)}</span>
              <span className="text-danger">Exp: {formatINR(data[hoveredIdx].expense)}</span>
              <span style={{ color: '#60a5fa' }}>Net: {formatINR(data[hoveredIdx].netProfit)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="chart-legend justify-content-center">
        <div className="chart-legend-item">
          <span className="chart-legend-dot" style={{ background: '#16a34a' }} />
          <span>{t('analytics.revenueLegend')}</span>
        </div>
        <div className="chart-legend-item">
          <span className="chart-legend-dot" style={{ background: '#ef4444' }} />
          <span>{t('analytics.expensesLegend')}</span>
        </div>
        <div className="chart-legend-item">
          <span className="chart-legend-dot" style={{ background: '#2563eb' }} />
          <span>{t('analytics.netProfitLegend')}</span>
        </div>
      </div>
    </div>
  );
}

// ==================== 6. COMMODITY MARKET BENCHMARK PRICE COMPARISON ====================
export function MarketPriceComparisonChart({ data = [] }) {
  const { t } = useLanguage();
  if (!data || data.length === 0) {
    return (
      <ChartEmptyState
        icon="bi-shop"
        title={t('analytics.marketDataUnavailable')}
        message={t('analytics.marketDataUnavailableDesc')}
      />
    );
  }

  const maxPrice = Math.max(...data.map((d) => Number(d.modalPrice) || 0), 2000);

  return (
    <div className="w-100">
      <div className="d-flex flex-column gap-2 py-1">
        {data.slice(0, 7).map((m, idx) => {
          const price = Number(m.modalPrice) || 0;
          const pct = Math.min(Math.max((price / maxPrice) * 100, 5), 100);

          return (
            <div key={idx} className="p-2 rounded" style={{ backgroundColor: '#fcfdfb', border: '1px solid #edf1eb' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#1e3228' }}>{m.commodity}</strong>
                  <span className="text-muted ms-2" style={{ fontSize: '0.72rem' }}>
                    {m.marketCenter}
                  </span>
                </div>
                <div className="text-end">
                  <strong style={{ fontSize: '0.88rem', color: '#15803d' }}>
                    ₹{price.toLocaleString('en-IN')} / Qtl
                  </strong>
                  <span
                    className={`badge ms-2 ${
                      m.change?.startsWith('+')
                        ? 'bg-success-subtle text-success'
                        : m.change?.startsWith('-')
                        ? 'bg-danger-subtle text-danger'
                        : 'bg-light text-muted'
                    }`}
                    style={{ fontSize: '0.68rem' }}
                  >
                    {m.change}
                  </span>
                </div>
              </div>
              <div
                style={{
                  height: '8px',
                  backgroundColor: '#edf2ec',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                    borderRadius: '4px',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-muted small mt-2 pt-2 border-top d-flex justify-content-between align-items-center">
        <span>
          <i className="bi bi-shield-check text-success me-1" />
          Official Agmarknet public benchmark series
        </span>
        <span>{t('analytics.updatedDaily')}</span>
      </div>
    </div>
  );
}
