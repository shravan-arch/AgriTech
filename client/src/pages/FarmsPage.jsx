import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { apiRequest } from '../lib/api.js';
import { Card, EmptyState, ErrorState, FormField, LoadingState, PageHeader } from '../components/ui.jsx';

const FarmsPage = () => {
  const { token } = useAuth();
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ name: '', region: '', country: '' });
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let active = true;
    const loadFarms = async () => {
      try {
        const data = await apiRequest('/farms', { token });
        if (active) {
          setFarms(data.farms);
          setError('');
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadFarms();
    return () => {
      active = false;
    };
  }, [token, retryCount]);

  const createFarm = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const location = {
        ...(form.region.trim() ? { region: form.region.trim() } : {}),
        ...(form.country.trim() ? { country: form.country.trim() } : {}),
      };
      const data = await apiRequest('/farms', {
        method: 'POST',
        token,
        body: {
          name: form.name.trim(),
          ...(Object.keys(location).length ? { location } : {}),
        },
      });
      setFarms((current) => [data.farm, ...current]);
      setForm({ name: '', region: '', country: '' });
      setNotice('Farm added successfully.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const saveFarmName = async (farmId) => {
    setError('');
    setNotice('');
    setBusyId(farmId);
    try {
      const data = await apiRequest(`/farms/${farmId}`, {
        method: 'PATCH',
        token,
        body: { name: editName.trim() },
      });
      setFarms((current) => current.map((farm) => farm._id === farmId ? data.farm : farm));
      setEditingId(null);
      setNotice('Farm name updated.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  const deleteFarm = async (farm) => {
    if (!window.confirm(`Delete “${farm.name}”? Farms with fields must be cleared first.`)) return;
    setError('');
    setNotice('');
    setBusyId(farm._id);
    try {
      await apiRequest(`/farms/${farm._id}`, { method: 'DELETE', token });
      setFarms((current) => current.filter((item) => item._id !== farm._id));
      setNotice('Farm deleted.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow="Your land"
        title="My farms"
        description="Keep your farm locations and field records together."
        actions={<a className="btn btn-primary" href="#add-farm"><i className="bi bi-plus-lg me-2" aria-hidden="true" />Add a farm</a>}
      />

      {error && <ErrorState message={error} retrying={loading} onRetry={() => {
            setLoading(true);
            setRetryCount((count) => count + 1);
          }} />}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <div className="row g-4 align-items-start">
        <div className="col-12 col-xl-7">
          {loading ? (
            <LoadingState>Loading your farms…</LoadingState>
          ) : farms.length ? (
            <div className="farm-list">
              {farms.map((farm) => (
                <Card className="farm-card" key={farm._id}>
                  <div className="farm-icon" aria-hidden="true"><i className="bi bi-house-heart" /></div>
                  <div className="farm-card-content">
                    {editingId === farm._id ? (
                      <form
                        className="farm-edit-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          saveFarmName(farm._id);
                        }}
                      >
                        <label className="visually-hidden" htmlFor={`farm-name-${farm._id}`}>Farm name</label>
                        <input
                          id={`farm-name-${farm._id}`}
                          className="form-control"
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          maxLength={100}
                          required
                        />
                        <button className="btn btn-primary btn-sm" type="submit" disabled={busyId === farm._id}>
                          {busyId === farm._id ? 'Saving…' : 'Save'}
                        </button>
                        <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setEditingId(null)} disabled={busyId === farm._id}>Cancel</button>
                      </form>
                    ) : (
                      <>
                        <Link className="farm-card-title" to={`/farms/${farm._id}`}>{farm.name}</Link>
                        <p className="text-secondary mb-0">
                          {[farm.location?.region, farm.location?.country].filter(Boolean).join(', ') || 'Location not specified'}
                        </p>
                      </>
                    )}
                    <div className="farm-card-actions">
                      <Link className="btn btn-outline-primary btn-sm" to={`/farms/${farm._id}`}>
                        View fields <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                      </Link>
                      {editingId !== farm._id && (
                        <>
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            type="button"
                            disabled={busyId === farm._id}
                            onClick={() => {
                              setEditName(farm.name);
                              setEditingId(farm._id);
                            }}
                          >
                            Rename
                          </button>
                          <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => deleteFarm(farm)} disabled={busyId === farm._id}>
                            {busyId === farm._id ? 'Deleting…' : 'Delete'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : !error ? (
            <Card><EmptyState
              icon="bi-map"
              title="No farms added yet"
              description="Add a farm to start keeping its fields and records in one place."
              action={<a className="btn btn-primary" href="#add-farm">Add your first farm</a>}
            /></Card>
          ) : null}
        </div>

        <div className="col-12 col-xl-5">
          <Card className="form-card" id="add-farm">
            <span className="eyebrow">Farm details</span>
            <h2>Add a farm</h2>
            <form onSubmit={createFarm}>
              <FormField
                  id="farm-name"
                  label="Farm name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  maxLength={100}
                  autoComplete="organization"
                  required
                />
              <FormField
                  id="farm-region"
                  label="Region"
                  optional
                  value={form.region}
                  onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))}
                  maxLength={100}
                />
              <FormField
                  id="farm-country"
                  label="Country"
                  optional
                  value={form.country}
                  onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))}
                  maxLength={100}
                  autoComplete="country-name"
                />
              <button className="btn btn-primary w-100" type="submit" disabled={submitting}>
                {submitting ? (
                  <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Saving…</>
                ) : <><i className="bi bi-plus-lg me-2" aria-hidden="true" />Add farm</>}
              </button>
            </form>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default FarmsPage;
