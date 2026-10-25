import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import { apiRequest } from '../lib/api.js';
import { FieldMapEditor } from '../components/FieldMapEditor.jsx';
import { Card, LoadingState, ErrorState, EmptyState } from '../components/ui.jsx';

const SOIL_OPTIONS = [
  'Alluvial Soil',
  'Black Cotton Soil',
  'Red & Yellow Soil',
  'Laterite Soil',
  'Clayey Loam',
  'Sandy Loam',
];

const IRRIGATION_OPTIONS = [
  'Drip Micro-Irrigation',
  'Sprinkler System',
  'Canal Flow',
  'Deep Tube-well',
  'Rainfed / Monsoon',
];

const FieldMappingPage = () => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [farms, setFarms] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Selected Farm & Field
  const [selectedFarmId, setSelectedFarmId] = useState(() => searchParams.get('farmId') || '');
  const [selectedFieldId, setSelectedFieldId] = useState(() => searchParams.get('fieldId') || '');

  // Active Boundary state being edited in FieldMapEditor
  const [currentDrawnBoundary, setCurrentDrawnBoundary] = useState(null);
  const [currentDrawnMetrics, setCurrentDrawnMetrics] = useState(null);

  // Field Save Modal / Drawer Form State
  const [savingField, setSavingField] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const [fieldModalOpen, setFieldModalOpen] = useState(false);

  const [fieldForm, setFieldForm] = useState({
    name: '',
    soilType: 'Alluvial Soil',
    waterSource: 'Drip Micro-Irrigation',
    irrigationDetails: '',
    cadastralSurveyNumber: '',
    notes: '',
  });

  // Load Farms and Fields
  useEffect(() => {
    let active = true;
    const fetchFarmsAndFields = async () => {
      try {
        setLoading(true);
        setError('');
        const [farmsData, fieldsData] = await Promise.all([
          apiRequest('/farms', { token }),
          apiRequest('/farms/fields', { token }),
        ]);

        if (!active) return;
        const loadedFarms = farmsData.farms || [];
        const loadedFields = fieldsData.fields || [];

        setFarms(loadedFarms);
        setFields(loadedFields);

        // Auto-select first farm if none in URL
        if (!selectedFarmId && loadedFarms.length > 0) {
          const firstId = loadedFarms[0]._id;
          setSelectedFarmId(firstId);
        }
      } catch (err) {
        if (active) setError(err.message || 'Failed to load farm and field data.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchFarmsAndFields();
    return () => {
      active = false;
    };
  }, [token]);

  // Selected farm object
  const activeFarm = useMemo(() => {
    return farms.find((f) => f._id === selectedFarmId) || null;
  }, [farms, selectedFarmId]);

  // Fields belonging to active farm
  const farmFields = useMemo(() => {
    if (!selectedFarmId) return fields;
    return fields.filter((fld) => fld.farmId === selectedFarmId);
  }, [fields, selectedFarmId]);

  // Selected field object
  const activeField = useMemo(() => {
    return fields.find((f) => f._id === selectedFieldId) || null;
  }, [fields, selectedFieldId]);

  // Handle switching farm
  const handleSelectFarm = (farmId) => {
    setSelectedFarmId(farmId);
    setSelectedFieldId('');
    setCurrentDrawnBoundary(null);
    setCurrentDrawnMetrics(null);
    setSearchParams(farmId ? { farmId } : {});
  };

  // Handle selecting a field to reopen / view boundary
  const handleSelectField = (field) => {
    setSelectedFieldId(field._id);
    if (field.farmId && field.farmId !== selectedFarmId) {
      setSelectedFarmId(field.farmId);
    }
    setCurrentDrawnBoundary(field.boundary || null);
    setCurrentDrawnMetrics(field.calculatedMetrics || null);
    setSearchParams({ farmId: field.farmId, fieldId: field._id });

    // Pre-populate form with existing field data in case user wants to update it
    setFieldForm({
      name: field.name || '',
      soilType: field.soilType || 'Alluvial Soil',
      waterSource: field.waterSource || 'Drip Micro-Irrigation',
      irrigationDetails: field.irrigationDetails || '',
      cadastralSurveyNumber: field.boundaryMetadata?.cadastralReference?.surveyNumber || '',
      notes: '',
    });
  };

  // Callback when user draws or edits a boundary in the map editor
  const handleBoundaryChange = (geoJSON, metrics) => {
    setCurrentDrawnBoundary(geoJSON);
    setCurrentDrawnMetrics(metrics);
  };

  // Open Save Form (either to update selected field or create a new field)
  const handleOpenSaveForm = () => {
    setSaveError('');
    setSaveSuccess('');
    if (activeField) {
      setFieldForm({
        name: activeField.name || '',
        soilType: activeField.soilType || 'Alluvial Soil',
        waterSource: activeField.waterSource || 'Drip Micro-Irrigation',
        irrigationDetails: activeField.irrigationDetails || '',
        cadastralSurveyNumber: activeField.boundaryMetadata?.cadastralReference?.surveyNumber || '',
        notes: '',
      });
    } else {
      setFieldForm({
        name: `Field ${farmFields.length + 1}`,
        soilType: 'Alluvial Soil',
        waterSource: 'Drip Micro-Irrigation',
        irrigationDetails: '',
        cadastralSurveyNumber: '',
        notes: '',
      });
    }
    setFieldModalOpen(true);
  };

  // Save boundary (POST new field or PATCH existing field)
  const handleSaveFieldBoundary = async (e) => {
    e.preventDefault();
    if (!currentDrawnBoundary) {
      setSaveError('Please draw a field boundary on the satellite map before saving.');
      return;
    }

    if (!selectedFarmId) {
      setSaveError('Please select a farm to assign this field to.');
      return;
    }

    setSavingField(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const payload = {
        name: fieldForm.name.trim(),
        soilType: fieldForm.soilType,
        waterSource: fieldForm.waterSource,
        irrigationDetails: fieldForm.irrigationDetails.trim(),
        boundary: currentDrawnBoundary,
        ...(fieldForm.cadastralSurveyNumber
          ? {
              boundaryMetadata: {
                source: 'user_drawn_approximate',
                verificationStatus: 'unverified_approximate',
                cadastralReference: {
                  surveyNumber: fieldForm.cadastralSurveyNumber.trim(),
                },
              },
            }
          : {}),
      };

      let savedField = null;

      if (activeField) {
        // Updating existing field boundary
        const res = await apiRequest(`/farms/fields/${activeField._id}`, {
          method: 'PATCH',
          token,
          body: payload,
        });
        savedField = res.field;
        setSaveSuccess(`Field boundary for "${savedField.name}" updated successfully!`);
      } else {
        // Creating new field with boundary
        const res = await apiRequest(`/farms/${selectedFarmId}/fields`, {
          method: 'POST',
          token,
          body: payload,
        });
        savedField = res.field;
        setSaveSuccess(`New field "${savedField.name}" mapped and saved successfully!`);
      }

      // Refresh fields list
      const refreshedFields = await apiRequest('/farms/fields', { token });
      setFields(refreshedFields.fields || []);
      if (savedField) {
        setSelectedFieldId(savedField._id);
      }
      setTimeout(() => setFieldModalOpen(false), 1500);
    } catch (err) {
      setSaveError(err.message || 'Failed to save field boundary.');
    } finally {
      setSavingField(false);
    }
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <LoadingState message="Loading satellite basemaps and farm field boundaries…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-fluid py-4">
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <div className="container-fluid px-0 px-md-3 py-3">
      {/* Top Header: Title, Farm Selector & Status */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-2 border-bottom">
        <div>
          <span className="topbar-breadcrumb">AgriTech / Farm Operations</span>
          <h1 className="h3 fw-bold topbar-heading mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-map-fill text-success" />
            Field Boundary Mapping
          </h1>
          <p className="text-muted small mb-0">
            Draw, inspect, and calculate approximate field boundaries using satellite imagery and Terra Draw.
          </p>
        </div>

        {/* Farm Selector Pill */}
        <div className="d-flex align-items-center flex-wrap gap-2">
          {farms.length > 0 && (
            <div className="d-flex align-items-center gap-2 bg-white px-3 py-1-5 rounded-pill shadow-sm border">
              <i className="bi bi-houses text-success" />
              <label htmlFor="farm-select-dropdown" className="small fw-semibold text-muted mb-0">
                Active Farm:
              </label>
              <select
                id="farm-select-dropdown"
                className="form-select form-select-sm border-0 bg-transparent fw-bold text-dark py-0"
                style={{ width: 'auto', cursor: 'pointer' }}
                value={selectedFarmId}
                onChange={(e) => handleSelectFarm(e.target.value)}
              >
                {farms.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name} {f.location?.region ? `(${f.location.region})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Link to="/farms" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-arrow-left me-1" />
            Farms List
          </Link>
        </div>
      </div>

      {notice && (
        <div className="alert alert-success alert-dismissible fade show py-2 px-3 small mb-3" role="alert">
          {notice}
          <button type="button" className="btn-close" onClick={() => setNotice('')} />
        </div>
      )}

      {farms.length === 0 ? (
        <div className="p-4 bg-white rounded-4 shadow-sm text-center">
          <i className="bi bi-houses display-4 text-muted mb-3" />
          <h2 className="h5 fw-bold text-dark">No Farms Registered Yet</h2>
          <p className="text-secondary small mb-3">
            You need at least one registered farm before mapping fields and boundaries.
          </p>
          <Link to="/farms" className="btn btn-primary btn-sm">
            <i className="bi bi-plus-lg me-1" /> Create Your First Farm
          </Link>
        </div>
      ) : (
        <div className="row g-3">
          {/* Main Column: Interactive Satellite Map & Terra Draw Canvas */}
          <div className="col-12 col-xl-9">
            <FieldMapEditor
              key={`map-${selectedFieldId || 'new'}-${selectedFarmId}`}
              initialBoundary={activeField?.boundary || null}
              initialCenter={
                activeField?.coordinates?.latitude && activeField?.coordinates?.longitude
                  ? [activeField.coordinates.latitude, activeField.coordinates.longitude]
                  : activeFarm?.location?.latitude && activeFarm?.location?.longitude
                  ? [activeFarm.location.latitude, activeFarm.location.longitude]
                  : null
              }
              activeFieldName={activeField?.name || 'New Field'}
              onBoundaryChange={handleBoundaryChange}
              height="580px"
            />

            {/* Quick Action Bar under map */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3 p-3 bg-white rounded-4 shadow-sm border">
              <div>
                <span className="small text-muted d-block">Boundary Status</span>
                <span className="fw-bold text-dark">
                  {currentDrawnBoundary ? (
                    <span className="text-success d-inline-flex align-items-center gap-1">
                      <i className="bi bi-check-circle-fill" />
                      {activeField ? `Boundary Drawn for "${activeField.name}"` : 'New Boundary Drawn (Unsaved)'}
                    </span>
                  ) : (
                    <span className="text-secondary">Click "Draw Boundary" on the map to outline a field</span>
                  )}
                </span>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-success fw-semibold px-4 d-flex align-items-center gap-2"
                  onClick={handleOpenSaveForm}
                  disabled={!currentDrawnBoundary}
                >
                  <i className="bi bi-cloud-arrow-up-fill" />
                  <span>{activeField ? 'Update Field Boundary' : 'Save as Field'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Fields List & Boundary Overview */}
          <div className="col-12 col-xl-3">
            <div className="card shadow-sm border-0 rounded-4 overflow-hidden h-100 bg-white">
              <div className="card-header bg-white border-bottom py-3 px-3 d-flex align-items-center justify-content-between">
                <div>
                  <h2 className="h6 fw-bold mb-0 text-dark">Mapped Fields</h2>
                  <small className="text-muted">{farmFields.length} field(s) in {activeFarm?.name}</small>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm"
                  onClick={() => {
                    setSelectedFieldId('');
                    setCurrentDrawnBoundary(null);
                    setCurrentDrawnMetrics(null);
                    setSearchParams({ farmId: selectedFarmId });
                  }}
                  title="Start drawing a new field"
                >
                  <i className="bi bi-plus-lg me-1" />
                  New
                </button>
              </div>

              <div className="card-body p-2" style={{ maxHeight: '560px', overflowY: 'auto' }}>
                {farmFields.length === 0 ? (
                  <div className="p-4 text-center text-muted small">
                    <i className="bi bi-bounding-box fs-2 mb-2 d-block text-secondary opacity-50" />
                    No fields mapped for this farm yet. Click <strong>Draw Boundary</strong> on the satellite map to begin.
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {farmFields.map((fld) => {
                      const isSelected = fld._id === selectedFieldId;
                      const hasBoundary = Boolean(fld.boundary?.coordinates);
                      const areaHa = fld.calculatedMetrics?.approximateAreaHectares || fld.areaHectares;

                      return (
                        <div
                          key={fld._id}
                          className={`p-3 rounded-3 border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-success bg-success bg-opacity-10 shadow-sm'
                              : 'bg-light hover-bg-white'
                          }`}
                          onClick={() => handleSelectField(fld)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                            <span className="fw-bold text-dark text-truncate">{fld.name}</span>
                            {hasBoundary ? (
                              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0-5 small" style={{ fontSize: '0.68rem' }}>
                                <i className="bi bi-polygon me-1" />
                                Mapped
                              </span>
                            ) : (
                              <span className="badge bg-secondary-subtle text-secondary px-2 py-0-5 small" style={{ fontSize: '0.68rem' }}>
                                No Boundary
                              </span>
                            )}
                          </div>

                          <div className="d-flex align-items-center justify-content-between text-muted small" style={{ fontSize: '0.78rem' }}>
                            <span>
                              <strong>{areaHa ? `${areaHa} ha` : '—'}</strong>
                              {fld.calculatedMetrics?.approximateAreaAcres && ` (${fld.calculatedMetrics.approximateAreaAcres} ac)`}
                            </span>
                            <span>{fld.soilType || 'Soil not specified'}</span>
                          </div>

                          {fld.boundaryMetadata?.cadastralReference?.surveyNumber && (
                            <div className="mt-1 pt-1 border-top border-secondary border-opacity-10 text-muted" style={{ fontSize: '0.72rem' }}>
                              Survey No: <strong className="text-dark">{fld.boundaryMetadata.cadastralReference.surveyNumber}</strong>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Field Modal / Offcanvas Drawer */}
      {fieldModalOpen && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3 px-4">
                <h3 className="modal-title h6 fw-bold text-dark d-flex align-items-center gap-2 mb-0">
                  <i className="bi bi-cloud-arrow-up-fill text-success" />
                  {activeField ? `Update Field "${activeField.name}"` : 'Save Mapped Field'}
                </h3>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setFieldModalOpen(false)}
                />
              </div>

              <form onSubmit={handleSaveFieldBoundary}>
                <div className="modal-body p-4">
                  {saveSuccess && (
                    <div className="alert alert-success d-flex align-items-center gap-2 small py-2 px-3 mb-3">
                      <i className="bi bi-check-circle-fill flex-shrink-0" />
                      <div>{saveSuccess}</div>
                    </div>
                  )}

                  {saveError && (
                    <div className="alert alert-danger d-flex align-items-center gap-2 small py-2 px-3 mb-3">
                      <i className="bi bi-exclamation-circle-fill flex-shrink-0" />
                      <div>{saveError}</div>
                    </div>
                  )}

                  {/* Summary of drawn measurements */}
                  {currentDrawnMetrics && (
                    <div className="p-3 bg-light rounded-3 mb-3 border">
                      <div className="row g-2 text-center">
                        <div className="col-4">
                          <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Calculated Area</span>
                          <strong className="text-success">{currentDrawnMetrics.hectares} ha</strong>
                        </div>
                        <div className="col-4 border-start">
                          <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Acres</span>
                          <strong className="text-dark">{currentDrawnMetrics.acres} ac</strong>
                        </div>
                        <div className="col-4 border-start">
                          <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Perimeter</span>
                          <strong className="text-dark">{currentDrawnMetrics.perimeterMeters} m</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">
                      Field Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. North Canal Plot"
                      value={fieldForm.name}
                      onChange={(e) => setFieldForm((p) => ({ ...p, name: e.target.value }))}
                      required
                      maxLength={100}
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-dark">Soil Type</label>
                      <select
                        className="form-select form-select-sm"
                        value={fieldForm.soilType}
                        onChange={(e) => setFieldForm((p) => ({ ...p, soilType: e.target.value }))}
                      >
                        {SOIL_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-6">
                      <label className="form-label small fw-semibold text-dark">Water Source</label>
                      <select
                        className="form-select form-select-sm"
                        value={fieldForm.waterSource}
                        onChange={(e) => setFieldForm((p) => ({ ...p, waterSource: e.target.value }))}
                      >
                        {IRRIGATION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Cadastral Reference Extensibility Field */}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">
                      Cadastral Survey / Khasra Reference <span className="text-muted fw-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Khasra No. 142/2, Plot 8B"
                      value={fieldForm.cadastralSurveyNumber}
                      onChange={(e) =>
                        setFieldForm((p) => ({ ...p, cadastralSurveyNumber: e.target.value }))
                      }
                      maxLength={100}
                    />
                    <small className="text-muted d-block mt-1" style={{ fontSize: '0.72rem' }}>
                      Stored for farm record-keeping and future cadastral survey alignment.
                    </small>
                  </div>

                  {/* Legal Caution Callout */}
                  <div className="p-2 bg-warning bg-opacity-10 rounded-3 border border-warning border-opacity-25 small text-secondary" style={{ fontSize: '0.75rem' }}>
                    <i className="bi bi-info-circle-fill text-warning me-1" />
                    <strong>Notice:</strong> This boundary is saved as a user-defined approximate estimate for operational management. It does not replace official cadastral surveys or revenue deeds.
                  </div>
                </div>

                <div className="modal-footer border-top py-2 px-4">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setFieldModalOpen(false)}
                    disabled={savingField}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success btn-sm fw-semibold d-flex align-items-center gap-1"
                    disabled={savingField || !fieldForm.name.trim()}
                  >
                    {savingField ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                        Saving to Atlas…
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2 me-1" />
                        Confirm &amp; Save
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldMappingPage;
