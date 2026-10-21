import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { apiRequest } from '../lib/api.js';
import { Card, EmptyState, ErrorState, FormField, LoadingState, PageHeader } from '../components/ui.jsx';

const emptyField = { name: '', areaHectares: '', soilType: '', waterSource: '' };

const FarmDetailPage = () => {
  const { farmId } = useParams();
  const { token } = useAuth();
  const [farm, setFarm] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(emptyField);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyField);
  const [retryCount, setRetryCount] = useState(0);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let active = true;
    const loadFarm = async () => {
      setLoading(true);
      setError('');
      try {
        const [farmData, fieldData] = await Promise.all([
          apiRequest(`/farms/${farmId}`, { token }),
          apiRequest(`/farms/${farmId}/fields`, { token }),
        ]);
        if (active) {
          setFarm(farmData.farm);
          setFields(fieldData.fields);
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadFarm();
    return () => {
      active = false;
    };
  }, [farmId, token, retryCount]);

  const submitField = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        name: form.name.trim(),
        areaHectares: Number(form.areaHectares),
        ...(form.soilType.trim() ? { soilType: form.soilType.trim() } : {}),
        ...(form.waterSource.trim() ? { waterSource: form.waterSource.trim() } : {}),
      };
      const data = await apiRequest(`/farms/${farmId}/fields`, {
        method: 'POST',
        token,
        body: payload,
      });
      setFields((current) => [data.field, ...current]);
      setForm(emptyField);
      setNotice('Field added successfully.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const saveField = async (fieldId) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const data = await apiRequest(`/farms/fields/${fieldId}`, {
        method: 'PATCH',
        token,
        body: {
          name: editForm.name.trim(),
          areaHectares: Number(editForm.areaHectares),
          soilType: editForm.soilType.trim(),
          waterSource: editForm.waterSource.trim(),
        },
      });
      setFields((current) => current.map((field) => field._id === fieldId ? data.field : field));
      setEditingId(null);
      setNotice('Field details updated.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (field) => {
    if (!window.confirm(`Delete field “${field.name}”?`)) return;
    setError('');
    setNotice('');
    setDeletingId(field._id);
    try {
      await apiRequest(`/farms/fields/${field._id}`, { method: 'DELETE', token });
      setFields((current) => current.filter((item) => item._id !== field._id));
      setNotice('Field deleted.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <section className="page-shell">
        <LoadingState>Loading farm and fields…</LoadingState>
      </section>
    );
  }

  if (error && !farm) {
    return (
      <section className="page-shell">
        <Link to="/farms" className="back-link"><i className="bi bi-arrow-left me-2" aria-hidden="true" />All farms</Link>
        <div className="mt-3">
          <ErrorState message={error} onRetry={() => {
            setLoading(true);
            setRetryCount((count) => count + 1);
          }} />
        </div>
      </section>
    );
  }

  return (
    <section className="page-shell">
      <Link to="/farms" className="back-link"><i className="bi bi-arrow-left me-2" aria-hidden="true" />All farms</Link>
      <PageHeader
        eyebrow="Farm overview"
        title={farm?.name}
        description={[farm?.location?.region, farm?.location?.country].filter(Boolean).join(', ') || 'Location not specified'}
        actions={<Link className="btn btn-outline-secondary" to="/farms"><i className="bi bi-arrow-left me-2" aria-hidden="true" />All farms</Link>}
      />

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <div className="row g-4 align-items-start">
        <div className="col-12 col-xl-7">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Field records</span>
              <h2>Fields <span className="count-chip">{fields.length}</span></h2>
            </div>
          </div>
          {fields.length ? (
            <div className="field-list">
              {fields.map((field) => (
                <Card className="field-card" key={field._id}>
                  <div className="field-card-top">
                    <div className="farm-icon field-icon" aria-hidden="true"><i className="bi bi-bounding-box" /></div>
                    {editingId === field._id ? (
                      <form
                        className="field-edit-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          saveField(field._id);
                        }}
                      >
                        <div className="field-edit-grid">
                          <div>
                            <label className="form-label" htmlFor={`field-name-${field._id}`}>Field name</label>
                            <input
                              id={`field-name-${field._id}`}
                              className="form-control"
                              value={editForm.name}
                              onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                              maxLength={100}
                              required
                            />
                          </div>
                          <div>
                            <label className="form-label" htmlFor={`field-area-${field._id}`}>Area (ha)</label>
                            <input
                              id={`field-area-${field._id}`}
                              className="form-control"
                              type="number"
                              min="0.01"
                              max="1000000"
                              step="0.01"
                              value={editForm.areaHectares}
                              onChange={(event) => setEditForm((current) => ({ ...current, areaHectares: event.target.value }))}
                              required
                            />
                          </div>
                          <div>
                            <label className="form-label" htmlFor={`field-soil-${field._id}`}>Soil type</label>
                            <input
                              id={`field-soil-${field._id}`}
                              className="form-control"
                              value={editForm.soilType}
                              onChange={(event) => setEditForm((current) => ({ ...current, soilType: event.target.value }))}
                              maxLength={100}
                            />
                          </div>
                          <div>
                            <label className="form-label" htmlFor={`field-water-${field._id}`}>Water source</label>
                            <input
                              id={`field-water-${field._id}`}
                              className="form-control"
                              value={editForm.waterSource}
                              onChange={(event) => setEditForm((current) => ({ ...current, waterSource: event.target.value }))}
                              maxLength={100}
                            />
                          </div>
                        </div>
                        <div className="field-actions">
                          <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
                            {saving ? 'Saving…' : 'Save changes'}
                          </button>
                          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setEditingId(null)} disabled={saving}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div className="field-card-content">
                        <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                          <div>
                            <h3>{field.name}</h3>
                            <p className="field-area">{field.areaHectares} hectares</p>
                          </div>
                          <div className="field-card-actions">
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              type="button"
                              onClick={() => {
                                setEditingId(field._id);
                                setEditForm({
                                  name: field.name,
                                  areaHectares: String(field.areaHectares),
                                  soilType: field.soilType || '',
                                  waterSource: field.waterSource || '',
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => deleteField(field)} disabled={deletingId === field._id}>
                              {deletingId === field._id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </div>
                        {(field.soilType || field.waterSource) && (
                          <dl className="field-details">
                            {field.soilType && <><dt>Soil</dt><dd>{field.soilType}</dd></>}
                            {field.waterSource && <><dt>Water source</dt><dd>{field.waterSource}</dd></>}
                          </dl>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card><EmptyState
              icon="bi-bounding-box"
              title="No fields yet"
              description="Add a field when you’re ready. Only the records you enter will appear here."
              action={<a className="btn btn-primary" href="#add-field">Add your first field</a>}
            /></Card>
          )}
        </div>

        <div className="col-12 col-xl-5">
          <Card className="form-card" id="add-field">
            <span className="eyebrow">Field details</span>
            <h2>Add a field</h2>
            <form onSubmit={submitField}>
              <FormField
                  id="field-name"
                  label="Field name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  maxLength={100}
                  required
                />
              <FormField
                  id="field-area"
                  label="Area in hectares"
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  value={form.areaHectares}
                  onChange={(event) => setForm((current) => ({ ...current, areaHectares: event.target.value }))}
                  required
                />
              <FormField
                  id="field-soil"
                  label="Soil type"
                  optional
                  value={form.soilType}
                  onChange={(event) => setForm((current) => ({ ...current, soilType: event.target.value }))}
                  maxLength={100}
                />
              <FormField
                  id="field-water"
                  label="Water source"
                  optional
                  value={form.waterSource}
                  onChange={(event) => setForm((current) => ({ ...current, waterSource: event.target.value }))}
                  maxLength={100}
                />
              <button className="btn btn-primary w-100" type="submit" disabled={saving}>
                {saving ? (
                  <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Saving…</>
                ) : <><i className="bi bi-plus-lg me-2" aria-hidden="true" />Add field</>}
              </button>
            </form>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default FarmDetailPage;
