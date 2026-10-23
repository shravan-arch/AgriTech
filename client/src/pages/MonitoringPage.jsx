import { useEffect, useState } from 'react';
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

const SENSOR_TYPES = [
  { id: 'soil_moisture', label: 'Soil Moisture', unit: '%', icon: 'bi-droplet-half' },
  { id: 'soil_temperature', label: 'Soil Temperature', unit: '°C', icon: 'bi-thermometer-half' },
  { id: 'air_temperature', label: 'Air Temperature', unit: '°C', icon: 'bi-thermometer-sun' },
  { id: 'humidity', label: 'Ambient Humidity', unit: '%', icon: 'bi-moisture' },
  { id: 'rainfall', label: 'Rain Gauge', unit: 'mm', icon: 'bi-cloud-rain' },
];

export default function MonitoringPage() {
  const { token } = useAuth();
  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [fields, setFields] = useState([]);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');

  // Modals & Readouts
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [sensorReadings, setSensorReadings] = useState([]);
  const [readingsLoading, setReadingsLoading] = useState(false);

  // Sensor Form
  const [sensorForm, setSensorForm] = useState({
    farmId: '',
    fieldId: '',
    name: '',
    type: 'soil_moisture',
    deviceUid: '',
    thresholdMin: 20,
    thresholdMax: 80,
    unit: '%',
  });

  // Telemetry Ingest Form (for field telemetry test)
  const [ingestForm, setIngestForm] = useState({
    value: 35,
    unit: '%',
    batteryLevel: 95,
  });

  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Initial load: farms & sensors
  const loadFarmsAndSensors = async () => {
    setLoading(true);
    setError('');
    try {
      const [farmRes, sensorRes] = await Promise.all([
        apiRequest('/farms', { token }),
        apiRequest('/sensors', { token }),
      ]);
      const farmList = farmRes.farms || [];
      setFarms(farmList);
      setSensors(sensorRes.data || []);

      if (farmList.length > 0) {
        const initialFarmId = selectedFarmId || farmList[0]._id;
        setSelectedFarmId(initialFarmId);
        setSensorForm((prev) => ({ ...prev, farmId: initialFarmId }));
        void loadWeather(initialFarmId);
        void loadFields(initialFarmId);
      }
    } catch (err) {
      setError(err.message || 'Failed to load monitoring data.');
    } finally {
      setLoading(false);
    }
  };

  const loadFields = async (farmId) => {
    if (!farmId) return;
    try {
      const res = await apiRequest(`/farms/${farmId}/fields`, { token });
      setFields(res.fields || []);
    } catch {
      setFields([]);
    }
  };

  const loadWeather = async (farmId) => {
    if (!farmId) return;
    setWeatherLoading(true);
    try {
      const res = await apiRequest(`/weather/farms/${farmId}`, { token });
      setWeather(res.data);
    } catch {
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    void loadFarmsAndSensors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleFarmChange = (newFarmId) => {
    setSelectedFarmId(newFarmId);
    setSensorForm((prev) => ({ ...prev, farmId: newFarmId, fieldId: '' }));
    void loadWeather(newFarmId);
    void loadFields(newFarmId);
  };

  const handleOpenRegister = () => {
    setSensorForm({
      farmId: selectedFarmId || (farms[0]?._id || ''),
      fieldId: '',
      name: '',
      type: 'soil_moisture',
      deviceUid: `SN-IOT-${Math.floor(1000 + Math.random() * 9000)}`,
      thresholdMin: 20,
      thresholdMax: 80,
      unit: '%',
    });
    setModalError('');
    setShowRegisterModal(true);
  };

  const handleSaveSensor = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError('');
    try {
      await apiRequest('/sensors', {
        method: 'POST',
        token,
        body: {
          farmId: sensorForm.farmId,
          fieldId: sensorForm.fieldId || undefined,
          name: sensorForm.name,
          type: sensorForm.type,
          deviceUid: sensorForm.deviceUid,
          thresholds: {
            min: Number(sensorForm.thresholdMin),
            max: Number(sensorForm.thresholdMax),
            unit: sensorForm.unit,
          },
        },
      });
      setShowRegisterModal(false);
      setActionNotice(`Sensor "${sensorForm.name}" registered successfully.`);
      const sensorRes = await apiRequest('/sensors', { token });
      setSensors(sensorRes.data || []);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSensor = async (sensor) => {
    if (!window.confirm(`Are you sure you want to unregister sensor "${sensor.name}"?`)) return;
    try {
      await apiRequest(`/sensors/${sensor._id}`, {
        method: 'DELETE',
        token,
      });
      setActionNotice(`Sensor "${sensor.name}" unregistered.`);
      const sensorRes = await apiRequest('/sensors', { token });
      setSensors(sensorRes.data || []);
      if (selectedSensor?._id === sensor._id) {
        setSelectedSensor(null);
        setSensorReadings([]);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSelectSensor = async (sensor) => {
    setSelectedSensor(sensor);
    setReadingsLoading(true);
    try {
      const res = await apiRequest(`/sensors/${sensor._id}/readings?limit=50`, { token });
      setSensorReadings(res.data || []);
    } catch {
      setSensorReadings([]);
    } finally {
      setReadingsLoading(false);
    }
  };

  const handleOpenIngest = (sensor) => {
    setSelectedSensor(sensor);
    setIngestForm({
      value: (sensor.thresholds?.min ? sensor.thresholds.min + 5 : 30),
      unit: sensor.thresholds?.unit || '%',
      batteryLevel: 98,
    });
    setModalError('');
    setShowIngestModal(true);
  };

  const handleSendTelemetry = async (e) => {
    e.preventDefault();
    if (!selectedSensor) return;
    setSubmitting(true);
    setModalError('');
    try {
      await apiRequest(`/sensors/${selectedSensor._id}/readings`, {
        method: 'POST',
        token,
        body: ingestForm,
      });
      setShowIngestModal(false);
      setActionNotice(`Telemetry packet recorded for "${selectedSensor.name}".`);

      // Refresh readings and sensors
      const [sensorRes, readingRes] = await Promise.all([
        apiRequest('/sensors', { token }),
        apiRequest(`/sensors/${selectedSensor._id}/readings?limit=50`, { token }),
      ]);
      setSensors(sensorRes.data || []);
      setSensorReadings(readingRes.data || []);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedFarmObj = farms.find((f) => f._id === selectedFarmId);

  return (
    <div className="monitoring-page-wrap">
      <PageHeader
        eyebrow="Precision Agriculture & Telemetry"
        title="Field Monitoring & Conditions"
        description="Live meteorological observations and soil telemetry sensors connected directly to your agricultural fields."
        actions={
          <div className="d-flex gap-2 align-items-center">
            {farms.length > 0 && (
              <select
                className="form-select"
                style={{ width: 'auto' }}
                value={selectedFarmId}
                onChange={(e) => handleFarmChange(e.target.value)}
              >
                {farms.map((f) => (
                  <option key={f._id} value={f._id}>
                    Farm: {f.name}
                  </option>
                ))}
              </select>
            )}
            <Button variant="primary" onClick={handleOpenRegister}>
              <i className="bi bi-plus-lg me-1" /> Register Sensor Device
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

      {error && <ErrorState message={error} onRetry={loadFarmsAndSensors} />}

      {/* LIVE WEATHER WIDGET SECTION */}
      <div className="mb-4">
        <h2 className="h5 mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-cloud-sun text-success" />
          <span>Live Farm Weather & Atmospheric Conditions</span>
          {weather?.connected && (
            <span className="badge bg-success-subtle text-success border border-success-subtle ms-2">
              <i className="bi bi-broadcast me-1" /> Live Connected
            </span>
          )}
        </h2>

        {weatherLoading ? (
          <Card className="p-4">
            <LoadingState>Retrieving genuine meteorological observations…</LoadingState>
          </Card>
        ) : weather?.connected ? (
          <Card className="p-4">
            <div className="row g-4 align-items-center">
              <div className="col-12 col-md-4 border-end">
                <span className="text-muted small d-block">
                  {selectedFarmObj?.name} (Lat: {weather.location?.latitude?.toFixed(2)}°, Lon:{' '}
                  {weather.location?.longitude?.toFixed(2)}°)
                </span>
                <div className="d-flex align-items-center gap-3 my-2">
                  <span className="display-4 fw-bold text-success mb-0">
                    {weather.current?.temperature !== undefined ? `${Math.round(weather.current.temperature)}°C` : '—'}
                  </span>
                  <div>
                    <strong className="d-block text-capitalize fs-5">{weather.current?.condition}</strong>
                    <small className="text-muted">
                      Feels like {Math.round(weather.current?.apparentTemperature || weather.current?.temperature || 0)}°C
                    </small>
                  </div>
                </div>
                <div className="text-muted small">
                  Observed: {weather.current?.observedAt ? new Date(weather.current.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                </div>
              </div>

              <div className="col-12 col-md-8">
                <div className="row g-3 text-center mb-3">
                  <div className="col-3">
                    <div className="p-2 bg-light rounded">
                      <small className="text-muted d-block">Humidity</small>
                      <strong>{weather.current?.humidity}%</strong>
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="p-2 bg-light rounded">
                      <small className="text-muted d-block">Wind Speed</small>
                      <strong>{weather.current?.windSpeed} km/h</strong>
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="p-2 bg-light rounded">
                      <small className="text-muted d-block">Rainfall</small>
                      <strong>{weather.current?.precipitation} mm</strong>
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="p-2 bg-light rounded">
                      <small className="text-muted d-block">Elevation</small>
                      <strong>{weather.location?.elevation || 0} m</strong>
                    </div>
                  </div>
                </div>

                {/* 5-day forecast mini cards */}
                {weather.forecast && weather.forecast.length > 0 && (
                  <div className="d-flex gap-2 overflow-auto pt-2">
                    {weather.forecast.map((day) => {
                      const dayName = new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' });
                      return (
                        <div
                          key={day.date}
                          className="p-2 border rounded text-center flex-fill"
                          style={{ minWidth: '85px', background: '#fafbfc' }}
                        >
                          <small className="fw-bold d-block text-muted">{dayName}</small>
                          <div className="my-1">
                            <span className="text-success fw-bold">{Math.round(day.maxTemp)}°</span>{' '}
                            <span className="text-muted small">{Math.round(day.minTemp)}°</span>
                          </div>
                          <small className="d-block text-truncate" style={{ fontSize: '0.7rem' }}>
                            {day.condition}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2 border-top d-flex justify-content-between align-items-center flex-wrap small text-muted">
              <span>
                <i className="bi bi-shield-check text-success me-1" />
                Data Source: <strong>{weather.source}</strong>
              </span>
              <span>Updated: {new Date(weather.updatedAt).toLocaleTimeString()}</span>
            </div>
          </Card>
        ) : (
          <Card className="p-4 bg-light">
            <div className="d-flex align-items-center gap-3">
              <i className="bi bi-geo-alt-fill fs-2 text-warning" />
              <div>
                <strong className="d-block">Weather Geolocation Notice</strong>
                <p className="mb-0 text-muted small">
                  {weather?.message ||
                    'Coordinates are unconfigured for this farm. Edit farm details to provide latitude and longitude coordinates for genuine live local meteorological data.'}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* SENSORS & TELEMETRY SECTION */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <span className="eyebrow">Field IoT Telemetry</span>
            <h2 className="h5 mb-0">Registered Soil & Field Sensors ({sensors.length})</h2>
          </div>
          <Button variant="outline-success" onClick={handleOpenRegister}>
            <i className="bi bi-plus-lg me-1" /> Register New Gateway / Sensor
          </Button>
        </div>

        {loading ? (
          <LoadingState>Loading sensor devices…</LoadingState>
        ) : sensors.length === 0 ? (
          <Card className="p-4">
            <EmptyState
              icon="bi-broadcast-pin"
              title="No field sensors connected yet"
              description="Connect LoRaWAN gateways, soil moisture probes, or field weather stations. Registered sensors record timestamped readings and alert you when thresholds are breached."
              action={
                <Button variant="primary" onClick={handleOpenRegister}>
                  <i className="bi bi-plus-lg me-1" /> Register First Field Sensor
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="row g-3">
            {sensors.map((sensor) => {
              const sensorTypeInfo = SENSOR_TYPES.find((t) => t.id === sensor.type) || SENSOR_TYPES[0];
              const isSelected = selectedSensor?._id === sensor._id;
              const farmObj = farms.find((f) => f._id === sensor.farmId);
              const fieldObj = fields.find((f) => f._id === sensor.fieldId);

              return (
                <div key={sensor._id} className="col-12 col-md-6 col-lg-4">
                  <Card
                    className={`p-3 h-100 ${isSelected ? 'border-success shadow-sm' : ''}`}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onClick={() => handleSelectSensor(sensor)}
                  >
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className="p-2 rounded bg-success-subtle text-success">
                          <i className={`bi ${sensorTypeInfo.icon} fs-5`} />
                        </span>
                        <div>
                          <strong className="d-block">{sensor.name}</strong>
                          <small className="text-muted">{sensorTypeInfo.label}</small>
                        </div>
                      </div>
                      <span className={`badge ${sensor.status === 'active' ? 'bg-success' : 'bg-secondary'}`}>
                        {sensor.status}
                      </span>
                    </div>

                    <div className="bg-light p-2 rounded small mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Device UID:</span>
                        <code>{sensor.deviceUid}</code>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Assigned Farm/Field:</span>
                        <span>{farmObj?.name || 'Farm'}{fieldObj ? ` / ${fieldObj.name}` : ''}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Thresholds:</span>
                        <span>
                          {sensor.thresholds?.min ?? '—'} - {sensor.thresholds?.max ?? '—'} {sensor.thresholds?.unit}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Last Transmission:</span>
                        <span>
                          {sensor.lastReadingAt
                            ? new Date(sensor.lastReadingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Awaiting packet'}
                        </span>
                      </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                      <div className="d-flex gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success"
                          title="Simulate / Record Telemetry Packet"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenIngest(sensor);
                          }}
                        >
                          <i className="bi bi-send-check me-1" /> Ingest
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title="Unregister Sensor"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSensor(sensor);
                          }}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                      <small className="text-muted">
                        <i className="bi bi-battery-charging me-1 text-success" />
                        {sensor.batteryLevel || 100}%
                      </small>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SELECTED SENSOR TELEMETRY READINGS TIMELINE */}
      {selectedSensor && (
        <Card className="p-4 mb-4">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <span className="eyebrow">Telemetry Data Stream</span>
              <h3 className="h5 mb-0">Recent Readings for: {selectedSensor.name}</h3>
              <small className="text-muted">UID: {selectedSensor.deviceUid}</small>
            </div>
            <div className="d-flex gap-2">
              <Button variant="outline-success" className="btn-sm" onClick={() => handleOpenIngest(selectedSensor)}>
                <i className="bi bi-send me-1" /> Send Test Reading
              </Button>
              <Button variant="outline-secondary" className="btn-sm" onClick={() => setSelectedSensor(null)}>
                Close Panel
              </Button>
            </div>
          </div>

          {readingsLoading ? (
            <LoadingState>Loading sensor telemetry time-series…</LoadingState>
          ) : sensorReadings.length === 0 ? (
            <div className="p-4 text-center text-muted bg-light rounded">
              <i className="bi bi-broadcast fs-2 mb-2 d-block text-secondary" />
              <strong>No readings recorded yet for this sensor.</strong>
              <p className="small mb-2">Use the "Send Test Reading" button or transmit genuine LoRaWAN payload to:</p>
              <code>POST /api/sensors/{selectedSensor._id}/readings</code>
            </div>
          ) : (
            <DataTable
              headers={['Timestamp', 'Value Recorded', 'Unit', 'Threshold Status']}
              label="Sensor readings log"
            >
              {sensorReadings.map((r) => {
                const isOutOfRange =
                  selectedSensor.thresholds &&
                  ((selectedSensor.thresholds.min !== undefined && r.value < selectedSensor.thresholds.min) ||
                    (selectedSensor.thresholds.max !== undefined && r.value > selectedSensor.thresholds.max));

                return (
                  <tr key={r._id}>
                    <td>{new Date(r.timestamp).toLocaleString()}</td>
                    <td>
                      <strong className="fs-6">{r.value}</strong>
                    </td>
                    <td>{r.unit}</td>
                    <td>
                      {isOutOfRange ? (
                        <Badge tone="amber">
                          <i className="bi bi-exclamation-triangle-fill me-1" /> Anomaly / Threshold Exceeded
                        </Badge>
                      ) : (
                        <Badge tone="green">Normal Range</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>
      )}

      {/* REGISTER SENSOR MODAL */}
      {showRegisterModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-broadcast me-2" />
                  Register Telemetry Device / Gateway
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowRegisterModal(false)}
                />
              </div>
              <form onSubmit={handleSaveSensor}>
                <div className="modal-body">
                  {modalError && <div className="alert alert-danger py-2 small">{modalError}</div>}

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" htmlFor="sns-farm">
                        Farm *
                      </label>
                      <select
                        id="sns-farm"
                        className="form-select"
                        value={sensorForm.farmId}
                        required
                        onChange={(e) => {
                          const fId = e.target.value;
                          setSensorForm({ ...sensorForm, farmId: fId });
                          void loadFields(fId);
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
                      <label className="form-label" htmlFor="sns-field">
                        Field (Optional)
                      </label>
                      <select
                        id="sns-field"
                        className="form-select"
                        value={sensorForm.fieldId}
                        onChange={(e) => setSensorForm({ ...sensorForm, fieldId: e.target.value })}
                      >
                        <option value="">Farm General</option>
                        {fields.map((fld) => (
                          <option key={fld._id} value={fld._id}>
                            {fld.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label" htmlFor="sns-name">
                      Sensor / Station Name *
                    </label>
                    <input
                      id="sns-name"
                      type="text"
                      className="form-control"
                      placeholder="e.g. South Field Soil Probe 1"
                      value={sensorForm.name}
                      required
                      onChange={(e) => setSensorForm({ ...sensorForm, name: e.target.value })}
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" htmlFor="sns-type">
                        Telemetry Type *
                      </label>
                      <select
                        id="sns-type"
                        className="form-select"
                        value={sensorForm.type}
                        required
                        onChange={(e) => {
                          const typeId = e.target.value;
                          const tInfo = SENSOR_TYPES.find((t) => t.id === typeId);
                          setSensorForm({
                            ...sensorForm,
                            type: typeId,
                            unit: tInfo ? tInfo.unit : '%',
                          });
                        }}
                      >
                        {SENSOR_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label} ({t.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label" htmlFor="sns-uid">
                        Device UID / Serial *
                      </label>
                      <input
                        id="sns-uid"
                        type="text"
                        className="form-control"
                        placeholder="e.g. SN-SOIL-1049"
                        value={sensorForm.deviceUid}
                        required
                        onChange={(e) => setSensorForm({ ...sensorForm, deviceUid: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-4">
                      <label className="form-label" htmlFor="sns-min">
                        Min Threshold
                      </label>
                      <input
                        id="sns-min"
                        type="number"
                        step="any"
                        className="form-control"
                        value={sensorForm.thresholdMin}
                        onChange={(e) => setSensorForm({ ...sensorForm, thresholdMin: e.target.value })}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label" htmlFor="sns-max">
                        Max Threshold
                      </label>
                      <input
                        id="sns-max"
                        type="number"
                        step="any"
                        className="form-control"
                        value={sensorForm.thresholdMax}
                        onChange={(e) => setSensorForm({ ...sensorForm, thresholdMax: e.target.value })}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label" htmlFor="sns-unit">
                        Unit
                      </label>
                      <input
                        id="sns-unit"
                        type="text"
                        className="form-control"
                        value={sensorForm.unit}
                        onChange={(e) => setSensorForm({ ...sensorForm, unit: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Button variant="outline-secondary" type="button" onClick={() => setShowRegisterModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={submitting}>
                    {submitting ? 'Registering…' : 'Register Sensor'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* INGEST TEST TELEMETRY MODAL */}
      {showIngestModal && selectedSensor && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-send-check me-2" />
                  Record Telemetry Reading: {selectedSensor.name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowIngestModal(false)}
                />
              </div>
              <form onSubmit={handleSendTelemetry}>
                <div className="modal-body">
                  {modalError && <div className="alert alert-danger py-2 small">{modalError}</div>}

                  <p className="text-muted small">
                    Record or simulate incoming telemetry readings for Device UID{' '}
                    <code>{selectedSensor.deviceUid}</code>. If reading falls outside the configured thresholds (
                    {selectedSensor.thresholds?.min} - {selectedSensor.thresholds?.max} {selectedSensor.thresholds?.unit}), an
                    automated alert is logged.
                  </p>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label" htmlFor="ing-val">
                        Reading Value *
                      </label>
                      <input
                        id="ing-val"
                        type="number"
                        step="any"
                        className="form-control"
                        value={ingestForm.value}
                        required
                        onChange={(e) => setIngestForm({ ...ingestForm, value: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label" htmlFor="ing-unit">
                        Unit
                      </label>
                      <input
                        id="ing-unit"
                        type="text"
                        className="form-control"
                        value={ingestForm.unit}
                        onChange={(e) => setIngestForm({ ...ingestForm, unit: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label" htmlFor="ing-batt">
                      Battery Level (%)
                    </label>
                    <input
                      id="ing-batt"
                      type="number"
                      min="0"
                      max="100"
                      className="form-control"
                      value={ingestForm.batteryLevel}
                      onChange={(e) => setIngestForm({ ...ingestForm, batteryLevel: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <Button variant="outline-secondary" type="button" onClick={() => setShowIngestModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={submitting}>
                    {submitting ? 'Recording…' : 'Record Reading'}
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
