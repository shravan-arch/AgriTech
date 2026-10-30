import React, { useState } from 'react';
import { useLanguage } from '../../context/useLanguage.js';

export function WeatherHistoryChart({ data = [], timeRange = '24h' }) {
  const { t } = useLanguage();
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-center text-muted bg-light rounded border border-dashed">
        <i className="bi bi-cloud-sun fs-2 d-block mb-2 text-secondary" />
        <strong>{t('monitoring.noHistoricalWeather')}</strong>
        <p className="small mb-0 mt-1">
          {t('monitoring.refreshWeatherHint')}
        </p>
      </div>
    );
  }

  const width = 600;
  const height = 240;
  const paddingLeft = 50;
  const paddingRight = 45;
  const paddingTop = 30;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const temps = data.map((d) => Number(d.temperature) || 0);
  const rains = data.map((d) => Number(d.rain || d.precipitation) || 0);

  const minTemp = Math.floor(Math.min(...temps, 10));
  const maxTemp = Math.ceil(Math.max(...temps, 35));
  const tempRange = Math.max(maxTemp - minTemp, 5);

  const maxRain = Math.max(...rains, 5);

  const getX = (idx) => {
    if (data.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (idx / (data.length - 1)) * chartWidth;
  };

  const getTempY = (val) => paddingTop + chartHeight - ((val - minTemp) / tempRange) * chartHeight;

  const tempPoints = data.map((d, i) => `${getX(i)},${getTempY(Number(d.temperature) || 0)}`).join(' ');
  const areaPoints = `${getX(0)},${paddingTop + chartHeight} ${tempPoints} ${getX(data.length - 1)},${paddingTop + chartHeight}`;

  return (
    <div className="w-100 position-relative">
      <div className="d-flex justify-content-between align-items-center mb-2 px-1">
        <div className="d-flex align-items-center gap-3 small">
          <span className="d-flex align-items-center gap-1">
            <span style={{ width: 12, height: 4, background: '#f59e0b', borderRadius: 2 }} />
            <strong className="text-secondary">{t('monitoring.tempLegend')}</strong>
          </span>
          <span className="d-flex align-items-center gap-1">
            <span style={{ width: 10, height: 10, background: '#3b82f6', borderRadius: 2 }} />
            <strong className="text-secondary">{t('monitoring.rainLegend')}</strong>
          </span>
        </div>
        <span className="badge bg-light text-secondary border">
          {data.length} {data.length === 1 ? 'Snapshot' : 'Snapshots'} ({timeRange})
        </span>
      </div>

      <div className="chart-svg-wrap">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={t('monitoring.weatherChartAria')}
        >
          <defs>
            <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = paddingTop + chartHeight * (1 - ratio);
            const tempVal = Math.round(minTemp + tempRange * ratio);
            const rainVal = (maxRain * ratio).toFixed(1);
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeDasharray={ratio === 0 ? 'none' : '3,3'}
                />
                {/* Temp Axis Label (Left) */}
                <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                  {tempVal}°C
                </text>
                {/* Rain Axis Label (Right) */}
                <text x={width - paddingRight + 8} y={y + 4} textAnchor="start" fontSize="9" fill="#93c5fd">
                  {rainVal}mm
                </text>
              </g>
            );
          })}

          {/* Rainfall Bars */}
          {data.map((d, idx) => {
            const x = getX(idx);
            const rVal = Number(d.rain || d.precipitation) || 0;
            if (rVal <= 0) return null;
            const barHeight = (rVal / maxRain) * (chartHeight * 0.7);
            const barY = paddingTop + chartHeight - barHeight;
            const barW = Math.max(3, Math.min(14, chartWidth / data.length - 2));

            return (
              <rect
                key={`rain-${idx}`}
                x={x - barW / 2}
                y={barY}
                width={barW}
                height={barHeight}
                fill="#3b82f6"
                opacity={hoveredIdx === idx ? 0.9 : 0.6}
                rx="2"
              />
            );
          })}

          {/* Area fill under temperature line */}
          {data.length > 1 && <polygon fill="url(#tempGradient)" points={areaPoints} />}

          {/* Temperature Polyline */}
          <polyline
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={tempPoints}
          />

          {/* Hover points and guides */}
          {data.map((d, idx) => {
            const x = getX(idx);
            const ty = getTempY(Number(d.temperature) || 0);
            const isHovered = hoveredIdx === idx;
            const timeLabel = new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <g
                key={`point-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={paddingTop + chartHeight}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                  />
                )}
                <circle
                  cx={x}
                  cy={ty}
                  r={isHovered ? 6 : 3.5}
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth="2"
                />

                {/* X-axis time label (show subset to avoid clutter) */}
                {(data.length <= 8 || idx % Math.ceil(data.length / 6) === 0 || idx === data.length - 1) && (
                  <text
                    x={x}
                    y={height - 10}
                    textAnchor="middle"
                    fontSize="9"
                    fill={isHovered ? '#1e293b' : '#94a3b8'}
                    fontWeight={isHovered ? 'bold' : 'normal'}
                  >
                    {timeLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Floating Tooltip Card */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div
          className="position-absolute bg-white shadow-sm border rounded p-2 small"
          style={{
            top: 40,
            left: Math.min(Math.max(getX(hoveredIdx) - 70, 10), width - 150),
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: 140,
          }}
        >
          <div className="fw-bold text-dark border-bottom pb-1 mb-1">
            {new Date(data[hoveredIdx].timestamp).toLocaleString()}
          </div>
          <div className="d-flex justify-content-between text-warning fw-semibold">
            <span>{t('monitoring.tempLabel')}</span>
            <span>{data[hoveredIdx].temperature}°C</span>
          </div>
          <div className="d-flex justify-content-between text-primary">
            <span>{t('monitoring.rainLabel')}</span>
            <span>{data[hoveredIdx].rain || data[hoveredIdx].precipitation || 0} mm</span>
          </div>
          <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.75rem' }}>
            <span>{t('monitoring.conditionLabel')}</span>
            <span>{data[hoveredIdx].condition || 'Clear'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function SoilTelemetryChart({ readings = [], sensors = [], timeRange = '24h' }) {
  const { t } = useLanguage();
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!readings || readings.length === 0) {
    return (
      <div className="p-4 text-center text-muted bg-light rounded border border-dashed">
        <i className="bi bi-moisture fs-2 d-block mb-2 text-secondary" />
        <strong>{t('monitoring.noSoilReadings')}</strong>
        <p className="small mb-0 mt-1">
          {t('monitoring.developerSimulatorHint')}
        </p>
      </div>
    );
  }

  // Filter moisture and soil temperature readings
  const moistureReadings = readings.filter((r) => {
    const s = sensors.find((sen) => sen._id === r.sensorId);
    return s?.type === 'soil_moisture' || r.unit === '%';
  });

  const soilTempReadings = readings.filter((r) => {
    const s = sensors.find((sen) => sen._id === r.sensorId);
    return s?.type === 'soil_temperature' || (r.unit === '°C' && r.value < 45);
  });

  const hasSimulated = readings.some((r) => r.isSimulated || r.source === 'simulated');
  const allSimulated = readings.every((r) => r.isSimulated || r.source === 'simulated');

  const width = 600;
  const height = 240;
  const paddingLeft = 50;
  const paddingRight = 45;
  const paddingTop = 30;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // X scale across all chronological readings
  const getX = (idx, total) => {
    if (total <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (idx / (total - 1)) * chartWidth;
  };

  // Moisture scale: 0 - 100%
  const getMoistureY = (val) => paddingTop + chartHeight - (Math.max(0, Math.min(100, val)) / 100) * chartHeight;

  // Temperature scale: 0 - 50°C
  const getTempY = (val) => paddingTop + chartHeight - (Math.max(0, Math.min(50, val)) / 50) * chartHeight;

  const moisturePoints = moistureReadings.map((r, i) => `${getX(i, moistureReadings.length)},${getMoistureY(r.value)}`).join(' ');
  const tempPoints = soilTempReadings.map((r, i) => `${getX(i, soilTempReadings.length)},${getTempY(r.value)}`).join(' ');

  return (
    <div className="w-100 position-relative">
      <div className="d-flex justify-content-between align-items-center mb-2 px-1 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3 small">
          <span className="d-flex align-items-center gap-1">
            <span style={{ width: 12, height: 4, background: '#10b981', borderRadius: 2 }} />
            <strong className="text-secondary">{t('monitoring.soilMoistureLegend')}</strong>
          </span>
          <span className="d-flex align-items-center gap-1">
            <span style={{ width: 12, height: 4, background: '#f97316', borderRadius: 2 }} />
            <strong className="text-secondary">{t('monitoring.soilTempLegend')}</strong>
          </span>
          <span className="d-flex align-items-center gap-1">
            <span style={{ width: 14, height: 0, borderTop: '2px dashed #ef4444' }} />
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>{t('monitoring.thresholds2570')}</span>
          </span>
        </div>

        <div className="d-flex align-items-center gap-2">
          {hasSimulated && (
            <span className="badge bg-warning-subtle text-dark border border-warning">
              <i className="bi bi-cpu me-1" />
              {allSimulated ? 'ALL DATA SIMULATED' : 'CONTAINS SIMULATED DATA'}
            </span>
          )}
          <span className="badge bg-light text-secondary border">
            {readings.length} {readings.length === 1 ? 'Reading' : 'Readings'} ({timeRange})
          </span>
        </div>
      </div>

      <div className="chart-svg-wrap">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={t('monitoring.soilTelemetryChartAria')}
        >
          {/* Reference Threshold Lines */}
          {/* Min moisture threshold (25%) */}
          <line
            x1={paddingLeft}
            y1={getMoistureY(25)}
            x2={width - paddingRight}
            y2={getMoistureY(25)}
            stroke="#ef4444"
            strokeDasharray="4,3"
            strokeWidth="1.2"
          />
          {/* Max moisture threshold (70%) */}
          <line
            x1={paddingLeft}
            y1={getMoistureY(70)}
            x2={width - paddingRight}
            y2={getMoistureY(70)}
            stroke="#ef4444"
            strokeDasharray="4,3"
            strokeWidth="1.2"
          />

          {/* Grid lines and tick marks */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = paddingTop + chartHeight * (1 - ratio);
            const moistVal = Math.round(ratio * 100);
            const tempVal = Math.round(ratio * 50);

            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeDasharray={ratio === 0 ? 'none' : '3,3'}
                />
                {/* Moisture Label (Left) */}
                <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#10b981">
                  {moistVal}%
                </text>
                {/* Temp Label (Right) */}
                <text x={width - paddingRight + 8} y={y + 4} textAnchor="start" fontSize="10" fill="#f97316">
                  {tempVal}°C
                </text>
              </g>
            );
          })}

          {/* Soil Moisture Polyline */}
          {moistureReadings.length > 0 && (
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={moisturePoints}
            />
          )}

          {/* Soil Temperature Polyline */}
          {soilTempReadings.length > 0 && (
            <polyline
              fill="none"
              stroke="#f97316"
              strokeWidth="2"
              strokeDasharray="5,2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={tempPoints}
            />
          )}

          {/* Data Points */}
          {readings.map((r, idx) => {
            const isMoisture = r.unit === '%' || r.value > 45;
            const x = getX(idx, readings.length);
            const y = isMoisture ? getMoistureY(r.value) : getTempY(r.value);
            const color = isMoisture ? '#10b981' : '#f97316';
            const isHovered = hoveredIdx === idx;
            const timeLabel = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <g
                key={`reading-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={paddingTop + chartHeight}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 6 : 3.5}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {(readings.length <= 8 || idx % Math.ceil(readings.length / 6) === 0 || idx === readings.length - 1) && (
                  <text
                    x={x}
                    y={height - 10}
                    textAnchor="middle"
                    fontSize="9"
                    fill={isHovered ? '#1e293b' : '#94a3b8'}
                    fontWeight={isHovered ? 'bold' : 'normal'}
                  >
                    {timeLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Floating Tooltip Card */}
      {hoveredIdx !== null && readings[hoveredIdx] && (
        <div
          className="position-absolute bg-white shadow-sm border rounded p-2 small"
          style={{
            top: 40,
            left: Math.min(Math.max(getX(hoveredIdx, readings.length) - 70, 10), width - 160),
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: 150,
          }}
        >
          <div className="fw-bold text-dark border-bottom pb-1 mb-1">
            {new Date(readings[hoveredIdx].timestamp).toLocaleString()}
          </div>
          <div className="d-flex justify-content-between">
            <span className="text-muted">{t('monitoring.readingLabel')}</span>
            <strong>
              {readings[hoveredIdx].value} {readings[hoveredIdx].unit}
            </strong>
          </div>
          <div className="d-flex justify-content-between mt-1">
            <span className="text-muted">{t('monitoring.sourceLabel')}</span>
            <span
              className={`badge ${
                readings[hoveredIdx].isSimulated || readings[hoveredIdx].source === 'simulated'
                  ? 'bg-warning text-dark'
                  : 'bg-success text-white'
              }`}
              style={{ fontSize: '0.7rem' }}
            >
              {readings[hoveredIdx].isSimulated || readings[hoveredIdx].source === 'simulated'
                ? 'SIMULATED'
                : 'PHYSICAL'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
