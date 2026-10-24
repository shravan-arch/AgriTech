import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import { apiRequest } from '../lib/api.js';
import { Badge, Card, DataTable, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui.jsx';

const ACTIVITY_INFO = {
  planting: { label: 'Planting', icon: 'bi-sprout', className: 'activity-node-planting' },
  irrigation: { label: 'Irrigation', icon: 'bi-droplet-fill', className: 'activity-node-irrigation' },
  fertilizer: { label: 'Fertilizer', icon: 'bi-capsule', className: 'activity-node-fertilizer' },
  pest_observation: { label: 'Pest observation', icon: 'bi-bug', className: 'activity-node-pest_observation' },
  treatment: { label: 'Treatment', icon: 'bi-shield-check', className: 'activity-node-treatment' },
  inspection: { label: 'Inspection', icon: 'bi-clipboard-check', className: 'activity-node-inspection' },
  labor: { label: 'Labor', icon: 'bi-people', className: 'activity-node-labor' },
  harvesting: { label: 'Harvesting', icon: 'bi-basket2-fill', className: 'activity-node-harvesting' },
};

const TASK_TYPE_ICONS = {
  planting: 'bi-sprout',
  irrigation: 'bi-droplet-half',
  fertilizer: 'bi-capsule',
  pest_observation: 'bi-bug',
  treatment: 'bi-shield-plus',
  inspection: 'bi-search',
  labor: 'bi-people',
  harvesting: 'bi-basket2',
  general: 'bi-check2-square',
};

const DashboardPage = () => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [farms, setFarms] = useState([]);
  const [fieldCounts, setFieldCounts] = useState({});
  const [fieldCount, setFieldCount] = useState(null);
  const [area, setArea] = useState(null);
  const [activeCrops, setActiveCrops] = useState([]);
  const [allFields, setAllFields] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fieldsError, setFieldsError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Phase 2 state
  const [tasks, setTasks] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [taskFilter, setTaskFilter] = useState('today');
  const [taskNotice, setTaskNotice] = useState('');
  const [taskActionLoading, setTaskActionLoading] = useState(null);
  const [now] = useState(() => Date.now());
  const [todayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [summaryData, setSummaryData] = useState(null);
  const [primaryWeather, setPrimaryWeather] = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        const [farmData, cropData, taskData, activityData, summaryRes, notifRes] = await Promise.all([
          apiRequest('/farms', { token }),
          apiRequest('/farms/crop-cycles?status=active', { token }),
          apiRequest('/farms/tasks', { token }),
          apiRequest('/farms/activities?limit=15', { token }),
          apiRequest('/analytics/summary', { token }).catch(() => ({ data: null })),
          apiRequest('/notifications?limit=5', { token }).catch(() => ({ data: [] })),
        ]);

        if (!active) return;
        const farmRecords = farmData.farms;
        setFarms(farmRecords);
        setActiveCrops(cropData.cropCycles || []);
        setTasks(taskData.tasks || []);
        setRecentActivities(activityData.activities || []);
        setSummaryData(summaryRes.data || null);
        setNotifications(notifRes.data || []);

        if (farmRecords.length > 0) {
          apiRequest(`/weather/farms/${farmRecords[0]._id}`, { token })
            .then((res) => {
              if (active && res?.data?.connected) setPrimaryWeather(res.data);
            })
            .catch(() => {});
        }

        if (!farmRecords.length) {
          setFieldCount(0);
          setArea(0);
          setAllFields([]);
          return;
        }

        const fieldResults = await Promise.allSettled(
          farmRecords.map((farm) => apiRequest(`/farms/${farm._id}/fields`, { token }))
        );
        if (!active) return;

        setFieldCounts(
          Object.fromEntries(
            fieldResults.flatMap((result, index) =>
              result.status === 'fulfilled'
                ? [[farmRecords[index]._id, result.value.fields.length]]
                : []
            )
          )
        );

        if (fieldResults.some((result) => result.status === 'rejected')) {
          setFieldsError('Field totals are unavailable because some field records could not be loaded.');
          return;
        }

        const combinedFields = fieldResults.flatMap((result, index) =>
          result.status === 'fulfilled'
            ? result.value.fields.map((f) => ({
                ...f,
                farmName: farmRecords[index].name,
                farmId: farmRecords[index]._id,
              }))
            : []
        );

        setAllFields(combinedFields);
        setFieldCount(combinedFields.length);
        const areas = combinedFields.map((field) => Number(field.areaHectares));
        setArea(areas.every(Number.isFinite) ? areas.reduce((sum, value) => sum + value, 0) : null);
      } catch (requestError) {
        if (active) {
          setFarms([]);
          setAllFields([]);
          setActiveCrops([]);
          setTasks([]);
          setRecentActivities([]);
          setError(requestError.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [retryCount, token]);

  const formatMetric = (value, suffix = '') =>
    value === null
      ? 'Unavailable'
      : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}${suffix}`;

  const retryDashboard = () => {
    setError('');
    setFieldsError('');
    setFieldCount(null);
    setArea(null);
    setFieldCounts({});
    setAllFields([]);
    setActiveCrops([]);
    setTasks([]);
    setRecentActivities([]);
    setLoading(true);
    setRetryCount((count) => count + 1);
  };

  const getDaysInGround = (plantingDate) => {
    if (!plantingDate) return null;
    const diff = Math.floor((now - new Date(plantingDate).getTime()) / 86400000);
    return Math.max(0, diff);
  };

  const handleToggleTask = async (task) => {
    setTaskActionLoading(task._id);
    setTaskNotice('');
    try {
      const willComplete = task.status !== 'completed';
      const updated = willComplete
        ? await apiRequest(`/farms/tasks/${task._id}/complete`, {
            method: 'POST',
            token,
          })
        : await apiRequest(`/farms/tasks/${task._id}`, {
            method: 'PATCH',
            token,
            body: { status: 'pending' },
          });
      setTasks((current) =>
        current.map((t) => (t._id === task._id ? updated.task : t))
      );
      setTaskNotice(
        willComplete
          ? `Task “${task.title}” marked as completed. (Scheduled tasks remain distinct from logged activities.)`
          : `Task “${task.title}” reopened.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setTaskActionLoading(null);
    }
  };

  // Classify tasks
  const overdueTasks = tasks.filter((t) => {
    if (t.status === 'completed' || t.status === 'cancelled') return false;
    const dueDay = t.dueDate ? t.dueDate.split('T')[0] : '';
    return dueDay < todayDate;
  });

  const dueTodayTasks = tasks.filter((t) => {
    if (t.status === 'completed' || t.status === 'cancelled') return false;
    const dueDay = t.dueDate ? t.dueDate.split('T')[0] : '';
    return dueDay === todayDate;
  });

  const upcomingTasks = tasks.filter((t) => {
    if (t.status === 'completed' || t.status === 'cancelled') return false;
    const dueDay = t.dueDate ? t.dueDate.split('T')[0] : '';
    return dueDay > todayDate;
  });

  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const visibleTasks =
    taskFilter === 'today'
      ? dueTodayTasks
      : taskFilter === 'overdue'
      ? overdueTasks
      : taskFilter === 'upcoming'
      ? upcomingTasks
      : taskFilter === 'completed'
      ? completedTasks
      : tasks;

  const filteredFields =
    selectedFarmId === 'all'
      ? allFields
      : allFields.filter((f) => f.farmId === selectedFarmId);

  return (
    <section className="page-shell dashboard-page">
      <PageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.title')}
        description={t('dashboard.description')}
        actions={
          <div className="d-flex align-items-center gap-2">
            {notifications.filter((n) => !n.read).length > 0 && (
              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2">
                <i className="bi bi-bell-fill me-1" />
                {notifications.filter((n) => !n.read).length} alerts
              </span>
            )}
            {user?.role === 'admin' ? (
              <Link className="btn btn-primary" to="/admin">
                <i className="bi bi-shield-shaded me-2" aria-hidden="true" />
                Admin Dashboard
              </Link>
            ) : (
              <Link className="btn btn-primary" to="/farms#add-farm">
                <i className="bi bi-plus-lg me-2" aria-hidden="true" />
                {t('dashboard.quickAddFarm')}
              </Link>
            )}
          </div>
        }
      />

      {user?.role === 'admin' && (
        <div className="alert alert-primary border-0 rounded-3 shadow-sm d-flex flex-wrap align-items-center justify-content-between p-3 mb-4" role="alert">
          <div className="d-flex align-items-center gap-3">
            <i className="bi bi-shield-lock-fill fs-3 text-primary flex-shrink-0" />
            <div>
              <h4 className="h6 fw-bold mb-1 text-primary">Administrator Platform Workspace</h4>
              <p className="small mb-0 text-secondary">
                You are authenticated with Administrator governance privileges. Administrators manage platform settings, user profiles, and security audit logs, and do not maintain a personal farm workspace.
              </p>
            </div>
          </div>
          <Link to="/admin" className="btn btn-primary btn-sm fw-semibold text-nowrap ms-auto mt-2 mt-md-0">
            Open Dedicated Admin Dashboard <i className="bi bi-arrow-right ms-1" />
          </Link>
        </div>
      )}

      {error && <ErrorState message={error} retrying={loading} onRetry={retryDashboard} />}

      {/* In-App Reminders / Notifications */}
      {!loading && !error && overdueTasks.length > 0 && (
        <div className="task-alert-banner alert-overdue" role="alert">
          <div className="alert-banner-content">
            <i className="bi bi-exclamation-triangle-fill alert-banner-icon" aria-hidden="true" />
            <div>
              <strong>Action required:</strong> You have {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} past due date.
            </div>
          </div>
          <button
            className="btn btn-sm btn-outline-danger"
            type="button"
            onClick={() => setTaskFilter('overdue')}
          >
            Review overdue tasks <i className="bi bi-arrow-right ms-1" />
          </button>
        </div>
      )}

      {!loading && !error && dueTodayTasks.length > 0 && (
        <div className="task-alert-banner alert-today" role="alert">
          <div className="alert-banner-content">
            <i className="bi bi-clock-fill alert-banner-icon" aria-hidden="true" />
            <div>
              <strong>Scheduled today:</strong> You have {dueTodayTasks.length} task{dueTodayTasks.length > 1 ? 's' : ''} due today.
            </div>
          </div>
          <button
            className="btn btn-sm btn-outline-warning"
            type="button"
            onClick={() => setTaskFilter('today')}
          >
            View today’s work <i className="bi bi-arrow-right ms-1" />
          </button>
        </div>
      )}

      {/* Low stock alert banner */}
      {!loading && !error && summaryData?.inventory?.lowStockCount > 0 && (
        <div className="task-alert-banner alert-overdue" role="alert">
          <div className="alert-banner-content">
            <i className="bi bi-box-seam alert-banner-icon" aria-hidden="true" />
            <div>
              <strong>Low Inventory Notice:</strong> {summaryData.inventory.lowStockCount} supply item{summaryData.inventory.lowStockCount > 1 ? 's are' : ' is'} at or below minimum threshold.
            </div>
          </div>
          <Link className="btn btn-sm btn-outline-danger" to="/inventory">
            Manage supplies <i className="bi bi-arrow-right ms-1" />
          </Link>
        </div>
      )}

      {/* Live Farm Weather Banner */}
      {!loading && !error && primaryWeather?.connected && (
        <Card className="p-3 mb-4 bg-light border-success-subtle">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div className="d-flex align-items-center gap-3">
              <span className="p-2 rounded bg-success-subtle text-success fs-3">
                <i className="bi bi-cloud-sun" />
              </span>
              <div>
                <span className="text-muted small d-block">
                  Live Farm Weather: <strong>{primaryWeather.farmName}</strong>
                </span>
                <strong className="fs-5 text-success">
                  {Math.round(primaryWeather.current.temperature)}°C
                </strong>
                <span className="text-muted small ms-2 text-capitalize">
                  {primaryWeather.current.condition} · Humidity: {primaryWeather.current.humidity}% · Rain: {primaryWeather.current.precipitation} mm · Wind: {primaryWeather.current.windSpeed} km/h
                </span>
              </div>
            </div>
            <Link to="/monitoring" className="btn btn-sm btn-outline-success">
              Live telemetry & forecast <i className="bi bi-arrow-right ms-1" />
            </Link>
          </div>
        </Card>
      )}

      <div className="dashboard-metrics" aria-label="Farm record summary">
        <Card className="metric-card">
          <div className="metric-card-top">
            <span>{t('dashboard.metricFarms')}</span>
            <span className="metric-icon">
              <i className="bi bi-houses" aria-hidden="true" />
            </span>
          </div>
          {loading ? (
            <span className="metric-value metric-loading">—</span>
          ) : (
            <strong className="metric-value">{error ? t('common.unavailable') : farms.length}</strong>
          )}
          <span className="metric-note">{t('dashboard.metricFarmsNote')}</span>
        </Card>

        <Card className="metric-card">
          <div className="metric-card-top">
            <span>{t('dashboard.metricFields')}</span>
            <span className="metric-icon metric-icon-sage">
              <i className="bi bi-bounding-box" aria-hidden="true" />
            </span>
          </div>
          {loading ? (
            <span className="metric-value metric-loading">—</span>
          ) : (
            <strong className="metric-value">{error ? t('common.unavailable') : formatMetric(fieldCount)}</strong>
          )}
          <span className="metric-note">{t('dashboard.metricFieldsNote')}</span>
        </Card>

        <Card className="metric-card">
          <div className="metric-card-top">
            <span>{t('dashboard.metricArea')}</span>
            <span className="metric-icon metric-icon-gold">
              <i className="bi bi-aspect-ratio" aria-hidden="true" />
            </span>
          </div>
          {loading ? (
            <span className="metric-value metric-loading">—</span>
          ) : (
            <strong className="metric-value">{error ? t('common.unavailable') : formatMetric(area, ' ha')}</strong>
          )}
          <span className="metric-note">{t('dashboard.metricAreaNote')}</span>
        </Card>

        <Card className="metric-card">
          <div className="metric-card-top">
            <span>{t('dashboard.metricCrops')}</span>
            <span className="metric-icon metric-icon-sage">
              <i className="bi bi-leaf" aria-hidden="true" />
            </span>
          </div>
          {loading ? (
            <span className="metric-value metric-loading">—</span>
          ) : (
            <strong className="metric-value">{error ? t('common.unavailable') : activeCrops.length}</strong>
          )}
          <span className="metric-note">{t('dashboard.metricCropsNote')}</span>
        </Card>

        <Card className="metric-card">
          <div className="metric-card-top">
            <span>{t('dashboard.metricProfit')}</span>
            <span className="metric-icon metric-icon-sage">
              <i className="bi bi-currency-rupee" />
            </span>
          </div>
          {loading ? (
            <span className="metric-value metric-loading">—</span>
          ) : (
            <strong className="metric-value" style={{ color: (summaryData?.finances?.netProfit || 0) >= 0 ? '#285d43' : '#b94a48' }}>
              {error ? t('common.unavailable') : `₹${new Intl.NumberFormat('en-IN').format(summaryData?.finances?.netProfit || 0)}`}
            </strong>
          )}
          <Link to="/analytics" className="metric-note text-decoration-none">
            {t('dashboard.metricRevenue')}: ₹{new Intl.NumberFormat('en-IN').format(summaryData?.finances?.totalIncome || 0)} <i className="bi bi-arrow-right" />
          </Link>
        </Card>

        <Card className="metric-card">
          <div className="metric-card-top">
            <span>{t('dashboard.metricInventory')}</span>
            <span className="metric-icon">
              <i className="bi bi-boxes" />
            </span>
          </div>
          {loading ? (
            <span className="metric-value metric-loading">—</span>
          ) : (
            <strong className="metric-value">{error ? t('common.unavailable') : summaryData?.inventory?.totalItems || 0}</strong>
          )}
          <Link to="/inventory" className="metric-note text-decoration-none">
            {summaryData?.inventory?.lowStockCount || 0} {t('dashboard.metricLowStock')} <i className="bi bi-arrow-right" />
          </Link>
        </Card>
      </div>

      {/* Active Crop Stages Summary Chips */}
      {!loading && !error && activeCrops.length > 0 && (
        <div className="p-3 bg-white rounded border mb-4 d-flex align-items-center gap-3 flex-wrap">
          <strong className="small text-muted text-uppercase">
            <i className="bi bi-diagram-3 me-1 text-success" /> Active Crop Stages:
          </strong>
          {['sowing', 'germination', 'vegetative', 'flowering', 'fruiting', 'harvesting'].map((stg) => {
            const count = activeCrops.filter((c) => c.stage === stg).length;
            if (count === 0) return null;
            const toneMap = {
              sowing: 'sowing',
              germination: 'sowing',
              vegetative: 'vegetative',
              flowering: 'flowering',
              fruiting: 'ripening',
              harvesting: 'harvested',
            };
            return (
              <span key={stg} className={`status-badge status-badge-${toneMap[stg] || 'neutral'} py-1 px-3`}>
                <strong>{stg}:</strong> {count} field{count > 1 ? 's' : ''}
              </span>
            );
          })}
        </div>
      )}

      {fieldsError && (
        <div className="alert alert-warning" role="alert">
          <span>{fieldsError}</span>
          <button className="btn btn-outline-secondary btn-sm ms-2" type="button" onClick={retryDashboard}>
            Retry
          </button>
        </div>
      )}

      {/* Operational Tasks & Planning Section */}
      <div className="mt-4">
        <Card className="p-4">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <span className="eyebrow">{t('operations.eyebrow')}</span>
              <h2 className="h4 mb-0">{t('operations.title')}</h2>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <Link to="/operations" className="btn btn-outline-secondary btn-sm">
                {t('operations.tabTasks')} <i className="bi bi-arrow-right ms-1" />
              </Link>
              <div className="segment-tabs" role="tablist" aria-label="Task filter tabs">
              <button
                type="button"
                className={`segment-tab ${taskFilter === 'today' ? 'active' : ''}`}
                onClick={() => setTaskFilter('today')}
              >
                {t('operations.filterToday')} ({dueTodayTasks.length})
              </button>
              <button
                type="button"
                className={`segment-tab ${taskFilter === 'overdue' ? 'active' : ''}`}
                onClick={() => setTaskFilter('overdue')}
              >
                {t('operations.filterOverdue')} ({overdueTasks.length})
              </button>
              <button
                type="button"
                className={`segment-tab ${taskFilter === 'upcoming' ? 'active' : ''}`}
                onClick={() => setTaskFilter('upcoming')}
              >
                {t('operations.filterUpcoming')} ({upcomingTasks.length})
              </button>
              <button
                type="button"
                className={`segment-tab ${taskFilter === 'completed' ? 'active' : ''}`}
                onClick={() => setTaskFilter('completed')}
              >
                {t('operations.filterCompleted')} ({completedTasks.length})
              </button>
              <button
                type="button"
                className={`segment-tab ${taskFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTaskFilter('all')}
              >
                {t('operations.filterAll')} ({tasks.length})
              </button>
              </div>
            </div>
          </div>

          {taskNotice && (
            <div className="alert alert-success alert-dismissible py-2 px-3 small mb-3" role="status">
              <span>{taskNotice}</span>
              <button
                type="button"
                className="btn-close py-2"
                aria-label="Dismiss notice"
                onClick={() => setTaskNotice('')}
              />
            </div>
          )}

          {loading && <LoadingState>Loading operational tasks…</LoadingState>}

          {!loading && !error && visibleTasks.length === 0 && (
            <div className="p-4 text-center text-muted">
              <i className="bi bi-check2-circle fs-2 mb-2 d-block text-success" aria-hidden="true" />
              {taskFilter === 'today'
                ? 'No tasks due today. All caught up for today!'
                : taskFilter === 'overdue'
                ? 'No overdue tasks. Operations are running smoothly!'
                : taskFilter === 'upcoming'
                ? 'No upcoming tasks scheduled.'
                : taskFilter === 'completed'
                ? 'No completed tasks yet.'
                : 'No operational tasks recorded yet. Plan tasks directly from your farm pages.'}
            </div>
          )}

          {!loading && !error && visibleTasks.length > 0 && (
            <div className="task-list">
              {visibleTasks.map((t) => {
                const isCompleted = t.status === 'completed';
                const dueDay = t.dueDate ? t.dueDate.split('T')[0] : '';
                const isOverdue = !isCompleted && dueDay < todayDate;
                const isToday = !isCompleted && dueDay === todayDate;
                const farmObj = farms.find((f) => f._id === t.farmId);
                const fieldObj = allFields.find((f) => f._id === t.fieldId);

                return (
                  <div key={t._id} className={`task-card ${isCompleted ? 'is-completed' : ''}`}>
                    <div className="task-left">
                      <button
                        type="button"
                        className={`task-checkbox-btn ${isCompleted ? 'checked' : ''}`}
                        title={isCompleted ? 'Reopen task' : 'Mark task completed'}
                        disabled={taskActionLoading === t._id}
                        onClick={() => handleToggleTask(t)}
                      >
                        {isCompleted && <i className="bi bi-check" />}
                      </button>
                      <div>
                        <div className="task-title">
                          <i className={`bi ${TASK_TYPE_ICONS[t.type] || 'bi-check2-square'} me-1 text-secondary`} />
                          {t.title}
                        </div>
                        <div className="task-meta">
                          {isOverdue && (
                            <span className="due-overdue">
                              <i className="bi bi-exclamation-circle-fill" /> Overdue ({new Date(t.dueDate).toLocaleDateString()})
                            </span>
                          )}
                          {isToday && (
                            <span className="due-today">
                              <i className="bi bi-clock-fill" /> Due today
                            </span>
                          )}
                          {!isOverdue && !isToday && t.dueDate && (
                            <span className="due-upcoming">
                              <i className="bi bi-calendar3" /> Due {new Date(t.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          <span className={`priority-${t.priority || 'medium'}`}>
                            {t.priority}
                          </span>
                          {farmObj && (
                            <span>
                              <i className="bi bi-geo-alt me-1" />
                              <Link to={`/farms/${farmObj._id}`} className="text-secondary text-decoration-none">
                                {farmObj.name}{fieldObj ? ` • ${fieldObj.name}` : ''}
                              </Link>
                            </span>
                          )}
                          {t.assignee && (
                            <span>
                              <i className="bi bi-person me-1" />{t.assignee}
                            </span>
                          )}
                          {t.notes && <span className="text-truncate" style={{ maxWidth: '240px' }}>“{t.notes}”</span>}
                        </div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className={`btn btn-sm ${isCompleted ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                        disabled={taskActionLoading === t._id}
                        onClick={() => handleToggleTask(t)}
                      >
                        {isCompleted ? 'Reopen' : '✓ Complete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Field Status Overview */}
      <div className="mt-4">
        <Card className="p-4">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <span className="eyebrow">Field operations</span>
              <h2 className="h4 mb-0">Field status overview</h2>
            </div>
            {farms.length > 1 && (
              <div className="d-flex align-items-center gap-2">
                <label htmlFor="farm-filter" className="small text-muted fw-semibold">Filter farm:</label>
                <select
                  id="farm-filter"
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  value={selectedFarmId}
                  onChange={(e) => setSelectedFarmId(e.target.value)}
                >
                  <option value="all">All farms ({allFields.length} fields)</option>
                  {farms.map((f) => (
                    <option key={f._id} value={f._id}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loading && <LoadingState>Loading field operational statuses…</LoadingState>}

          {!loading && !error && filteredFields.length === 0 && (
            <div className="p-4 text-center text-muted">
              <i className="bi bi-bounding-box fs-2 mb-2 d-block" aria-hidden="true" />
              {farms.length === 0
                ? 'No farms or fields created yet. Create a farm to start managing field operations.'
                : 'No fields recorded for this selection.'}
            </div>
          )}

          {!loading && !error && filteredFields.length > 0 && (
            <div className="dashboard-field-grid">
              {filteredFields.map((field) => {
                const activeCycle = activeCrops.find((c) => c.fieldId === field._id);
                const daysInGround = activeCycle ? getDaysInGround(activeCycle.plantingDate) : null;

                return (
                  <div className="field-status-card" key={field._id}>
                    <div>
                      <div className="field-status-top">
                        <div>
                          <Link className="field-status-title" to={`/farms/${field.farmId}`}>
                            {field.name}
                          </Link>
                          <div className="field-status-farm">
                            <i className="bi bi-geo-alt me-1" />
                            {field.farmName}
                          </div>
                        </div>
                        <Badge tone="neutral">{field.areaHectares} ha</Badge>
                      </div>

                      {activeCycle ? (
                        <div>
                          <div className="field-status-crop-info">
                            <i className="bi bi-leaf text-success" />
                            <span className="field-status-crop-name">{activeCycle.cropName}</span>
                            {activeCycle.variety && (
                              <span className="small text-muted">({activeCycle.variety})</span>
                            )}
                          </div>
                          <div className="d-flex align-items-center gap-2 mt-1">
                            <Badge tone={activeCycle.stage || 'sowing'}>
                              {activeCycle.stage}
                            </Badge>
                            {daysInGround !== null && (
                              <span className="field-status-days">
                                <i className="bi bi-clock-history" />
                                Day {daysInGround}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="field-status-crop-info text-muted small">
                            <i className="bi bi-circle" />
                            <span>No active crop</span>
                          </div>
                          <span className="small text-secondary">Fallow / Available for planting</span>
                        </div>
                      )}
                    </div>

                    <div className="field-status-bottom">
                      <span className="small text-muted">
                        {field.soilType || 'Soil not specified'}
                      </span>
                      <Link className="text-link small" to={`/farms/${field.farmId}`}>
                        Open field <i className="bi bi-arrow-right ms-1" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Lower Dashboard: Recent Field Activities & Farms */}
      <div className="row g-4 mt-2">
        <div className="col-12 col-xl-7">
          <Card className="p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div>
                <span className="eyebrow">{t('operations.tabActivities')}</span>
                <h2 className="h4 mb-0">{t('dashboard.recentActivities')}</h2>
              </div>
              <Link to="/operations" className="btn btn-outline-secondary btn-sm">
                {t('operations.tabActivities')} <i className="bi bi-arrow-right ms-1" />
              </Link>
            </div>

            {loading && <LoadingState>Loading activity log…</LoadingState>}

            {!loading && !error && recentActivities.length === 0 && (
              <div className="p-4 text-center text-muted">
                <i className="bi bi-activity fs-2 mb-2 d-block" aria-hidden="true" />
                No actual field activities logged yet. Log irrigation, fertilizers, or treatments directly on your fields.
              </div>
            )}

            {!loading && !error && recentActivities.length > 0 && (
              <div className="activity-timeline">
                {recentActivities.map((act) => {
                  const info = ACTIVITY_INFO[act.type] || {
                    label: act.type,
                    icon: 'bi-dot',
                    className: '',
                  };
                  const farmObj = farms.find((f) => f._id === act.farmId);
                  const fieldObj = allFields.find((f) => f._id === act.fieldId);

                  return (
                    <div key={act._id} className="activity-timeline-item">
                      <div className={`activity-node ${info.className}`} aria-hidden="true">
                        <i className={`bi ${info.icon}`} />
                      </div>
                      <div className="activity-card">
                        <div className="activity-card-header">
                          <span className="activity-title">
                            {info.label}
                          </span>
                          <span className="small text-muted">
                            <i className="bi bi-calendar-event me-1" />
                            {new Date(act.date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="small text-muted mb-1">
                          {farmObj?.name && (
                            <Link to={`/farms/${farmObj._id}`} className="text-secondary text-decoration-none fw-medium me-2">
                              <i className="bi bi-geo-alt me-1" />
                              {farmObj.name}{fieldObj ? ` • ${fieldObj.name}` : ''}
                            </Link>
                          )}
                          {act.performedBy && <span>• By {act.performedBy}</span>}
                          {act.cost !== undefined && act.cost !== null && (
                            <span className="ms-2 badge bg-light text-dark border">
                              ${Number(act.cost).toFixed(2)}
                            </span>
                          )}
                        </div>
                        {act.notes && <p className="small text-secondary mb-1">“{act.notes}”</p>}
                        {act.inputs && act.inputs.length > 0 && (
                          <div>
                            {act.inputs.map((inp, idx) => (
                              <span key={idx} className="activity-input-tag">
                                <i className="bi bi-box-seam me-1" />
                                {inp.quantity} {inp.unit} {inp.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="col-12 col-xl-5">
          <Card className="dashboard-records p-4 h-100">
            <div className="card-section-heading">
              <div>
                <span className="eyebrow">{t('farms.eyebrow')}</span>
                <h2>{t('farms.title')}</h2>
              </div>
              <Link className="text-link" to="/farms">
                {t('common.view')} {t('common.all')} <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
              </Link>
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
                    <th scope="row">
                      <Link className="table-primary-link" to={`/farms/${farm._id}`}>{farm.name}</Link>
                    </th>
                    <td>
                      {[farm.location?.region, farm.location?.country].filter(Boolean).join(', ') || (
                        <span className="text-muted">Not specified</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={fieldCounts[farm._id] === undefined ? 'neutral' : 'green'}>
                        {fieldCounts[farm._id] === undefined ? 'Unavailable' : fieldCounts[farm._id]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
};

export default DashboardPage;
