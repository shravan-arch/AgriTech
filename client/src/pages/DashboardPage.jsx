import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { apiRequest } from '../lib/api.js';
import { Badge, Card, DataTable, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui.jsx';

const DashboardPage = () => {
  const { token, user } = useAuth();
  const [farms, setFarms] = useState([]);
  const [fieldCounts, setFieldCounts] = useState({});
  const [fieldCount, setFieldCount] = useState(null);
  const [area, setArea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fieldsError, setFieldsError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        const data = await apiRequest('/farms', { token });
        if (!active) return;
        const farmRecords = data.farms;
        setFarms(farmRecords);

        if (!farmRecords.length) {
          setFieldCount(0);
          setArea(0);
          return;
        }

        const fieldResults = await Promise.allSettled(
          farmRecords.map((farm) => apiRequest(`/farms/${farm._id}/fields`, { token }))
        );
        if (!active) return;
        setFieldCounts(Object.fromEntries(fieldResults.flatMap((result, index) =>
          result.status === 'fulfilled' ? [[farmRecords[index]._id, result.value.fields.length]] : []
        )));
        if (fieldResults.some((result) => result.status === 'rejected')) {
          setFieldsError('Field totals are unavailable because some field records could not be loaded.');
          return;
        }

        const records = fieldResults.flatMap((result) => result.value.fields);
        setFieldCount(records.length);
        const areas = records.map((field) => Number(field.areaHectares));
        setArea(areas.every(Number.isFinite) ? areas.reduce((sum, value) => sum + value, 0) : null);
      } catch (requestError) {
        if (active) {
          setFarms([]);
          setError(requestError.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDashboard();
    return () => { active = false; };
  }, [retryCount, token]);

  const formatMetric = (value, suffix = '') => value === null
    ? 'Unavailable'
    : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}${suffix}`;

  const retryDashboard = () => {
    setError('');
    setFieldsError('');
    setFieldCount(null);
    setArea(null);
    setFieldCounts({});
    setLoading(true);
    setRetryCount((count) => count + 1);
  };

  return (
    <section className="page-shell dashboard-page">
      <PageHeader
        eyebrow="Your workspace"
        title={`Good to see you${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description="A clear view of the farms and field records you’ve added."
        actions={<Link className="btn btn-primary" to="/farms#add-farm"><i className="bi bi-plus-lg me-2" aria-hidden="true" />Add a farm</Link>}
      />

      {error && <ErrorState message={error} retrying={loading} onRetry={retryDashboard} />}

      <div className="dashboard-metrics" aria-label="Farm record summary">
        <Card className="metric-card">
          <div className="metric-card-top"><span>Farms</span><span className="metric-icon"><i className="bi bi-houses" aria-hidden="true" /></span></div>
          {loading ? <span className="metric-value metric-loading">—</span> : <strong className="metric-value">{error ? 'Unavailable' : farms.length}</strong>}
          <span className="metric-note">Farms in your workspace</span>
        </Card>
        <Card className="metric-card">
          <div className="metric-card-top"><span>Fields</span><span className="metric-icon metric-icon-sage"><i className="bi bi-bounding-box" aria-hidden="true" /></span></div>
          {loading ? <span className="metric-value metric-loading">—</span> : <strong className="metric-value">{error ? 'Unavailable' : formatMetric(fieldCount)}</strong>}
          <span className="metric-note">Fields recorded across your farms</span>
        </Card>
        <Card className="metric-card">
          <div className="metric-card-top"><span>Recorded area</span><span className="metric-icon metric-icon-gold"><i className="bi bi-aspect-ratio" aria-hidden="true" /></span></div>
          {loading ? <span className="metric-value metric-loading">—</span> : <strong className="metric-value">{error ? 'Unavailable' : formatMetric(area, ' ha')}</strong>}
          <span className="metric-note">Total area of recorded fields</span>
        </Card>
      </div>

      {fieldsError && (
        <div className="alert alert-warning" role="alert">
          <span>{fieldsError}</span>
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={retryDashboard}>Retry</button>
        </div>
      )}

      <div className="dashboard-lower">
        <Card className="dashboard-records">
          <div className="card-section-heading">
            <div><span className="eyebrow">Your land</span><h2>Recent farms</h2></div>
            <Link className="text-link" to="/farms">View all <i className="bi bi-arrow-right ms-1" aria-hidden="true" /></Link>
          </div>
          {loading && <LoadingState>Loading your farm records…</LoadingState>}
          {!loading && !error && !farms.length && (
            <EmptyState
              icon="bi-map"
              title="Your workspace starts here"
              description="Add your first farm to keep its location and fields in one place."
              action={<Link className="btn btn-primary" to="/farms#add-farm">Create your first farm</Link>}
            />
          )}
          {!loading && !error && farms.length > 0 && (
            <DataTable headers={['Farm', 'Location', 'Fields']} label="Your recent farms">
              {farms.slice(0, 5).map((farm) => (
                <tr key={farm._id}>
                  <th scope="row"><Link className="table-primary-link" to={`/farms/${farm._id}`}>{farm.name}</Link></th>
                  <td>{[farm.location?.region, farm.location?.country].filter(Boolean).join(', ') || <span className="text-muted">Not specified</span>}</td>
                  <td><Badge tone={fieldCounts[farm._id] === undefined ? 'neutral' : 'green'}>
                    {fieldCounts[farm._id] === undefined ? 'Unavailable' : fieldCounts[farm._id]}
                  </Badge></td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <Card className="quick-actions">
          <span className="eyebrow">Get started</span>
          <h2>Keep your records moving</h2>
          <p>Manage farms and fields using information from your own operation.</p>
          <Link className="quick-action-link" to="/farms#add-farm">
            <span className="quick-action-icon"><i className="bi bi-house-add" aria-hidden="true" /></span>
            <span><strong>Add a farm</strong><small>Record its name and location</small></span>
            <i className="bi bi-arrow-right" aria-hidden="true" />
          </Link>
          {farms.length > 0 && (
            <Link className="quick-action-link" to={`/farms/${farms[0]._id}#add-field`}>
              <span className="quick-action-icon quick-action-icon-sage"><i className="bi bi-bounding-box-circles" aria-hidden="true" /></span>
              <span><strong>Add a field</strong><small>Start with {farms[0].name}</small></span>
              <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
          )}
          {farms.length === 0 && !loading && !error && (
            <div className="quick-action-hint"><i className="bi bi-info-circle me-2" aria-hidden="true" />Add a farm before recording its fields.</div>
          )}
          <Link className="btn btn-outline-secondary quick-view-button" to="/farms">Browse all farms</Link>
        </Card>
      </div>
    </section>
  );
};

export default DashboardPage;
