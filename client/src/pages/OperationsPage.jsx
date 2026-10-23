import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth.js';
import { apiRequest } from '../lib/api.js';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../components/ui.jsx';

const PRIORITY_INFO = {
  urgent: { label: 'Urgent', badgeClass: 'priority-urgent' },
  high: { label: 'High', badgeClass: 'priority-high' },
  medium: { label: 'Medium', badgeClass: 'priority-medium' },
  low: { label: 'Low', badgeClass: 'priority-low' },
};

const ACTIVITY_INFO = {
  irrigation: { label: 'Irrigation', icon: 'bi-droplet-fill', color: 'text-primary' },
  fertilizer: { label: 'Fertilizer', icon: 'bi-capsule', color: 'text-success' },
  treatment: { label: 'Treatment / Spray', icon: 'bi-shield-check', color: 'text-info' },
  pest_observation: { label: 'Pest Observation', icon: 'bi-bug', color: 'text-danger' },
  inspection: { label: 'Inspection', icon: 'bi-clipboard-check', color: 'text-secondary' },
  labor: { label: 'Labor / Weeding', icon: 'bi-people', color: 'text-warning' },
  planting: { label: 'Planting', icon: 'bi-sprout', color: 'text-success' },
  harvesting: { label: 'Harvesting', icon: 'bi-basket2-fill', color: 'text-warning' },
};

const OperationsPage = () => {
  const { token } = useAuth();
  const [farms, setFarms] = useState([]);
  const [fields, setFields] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [cropCycles, setCropCycles] = useState([]);
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'activities'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Filters
  const [selectedFarmId, setSelectedFarmId] = useState('all');
  const [taskFilter, setTaskFilter] = useState('all'); // all, today, upcoming, overdue, completed
  const [activityTypeFilter, setActivityTypeFilter] = useState('all');

  // Modals & form state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Today dates initialized cleanly outside render loops
  const [todayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [todayStartMs] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    type: 'general',
    dueDate: '',
    priority: 'medium',
    assignee: '',
    farmId: '',
    fieldId: '',
    cropCycleId: '',
    notes: '',
  });

  const [editingTask, setEditingTask] = useState(null);
  const [editTaskForm, setEditTaskForm] = useState({
    title: '',
    type: 'general',
    dueDate: '',
    priority: 'medium',
    assignee: '',
    farmId: '',
    fieldId: '',
    cropCycleId: '',
    notes: '',
  });

  const [activityForm, setActivityForm] = useState({
    type: 'irrigation',
    date: '',
    farmId: '',
    fieldId: '',
    cropCycleId: '',
    notes: '',
    performedBy: '',
    cost: '',
  });

  useEffect(() => {
    let active = true;
    const fetchOperationsData = async () => {
      try {
        const [farmRes, taskRes, actRes, cycleRes] = await Promise.all([
          apiRequest('/farms', { token }),
          apiRequest('/farms/tasks', { token }),
          apiRequest('/farms/activities', { token }),
          apiRequest('/farms/crop-cycles', { token }),
        ]);

        if (!active) return;
        const farmList = farmRes.farms || [];
        setFarms(farmList);
        setTasks(taskRes.tasks || []);
        setActivities(actRes.activities || []);
        setCropCycles(cycleRes.cropCycles || []);

        if (farmList.length > 0) {
          const fieldResults = await Promise.allSettled(
            farmList.map((f) => apiRequest(`/farms/${f._id}/fields`, { token }))
          );
          if (!active) return;
          const allLoadedFields = fieldResults.flatMap((r, i) =>
            r.status === 'fulfilled'
              ? r.value.fields.map((fld) => ({ ...fld, farmName: farmList[i].name }))
              : []
          );
          setFields(allLoadedFields);
        }
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to load operations data.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchOperationsData();
    return () => {
      active = false;
    };
  }, [token, retryCount]);

  // Task actions
  const handleToggleTaskStatus = async (task) => {
    const isCompleted = task.status === 'completed';
    setActionLoadingId(task._id);
    try {
      if (!isCompleted) {
        const res = await apiRequest(`/farms/tasks/${task._id}/complete`, {
          method: 'POST',
          token,
        });
        setTasks((cur) => cur.map((t) => (t._id === task._id ? res.task : t)));
        setNotice(`Task “${task.title}” marked as completed.`);
      } else {
        const res = await apiRequest(`/farms/tasks/${task._id}`, {
          method: 'PATCH',
          token,
          body: { status: 'in_progress' },
        });
        setTasks((cur) => cur.map((t) => (t._id === task._id ? res.task : t)));
        setNotice(`Task “${task.title}” reopened.`);
      }
    } catch (err) {
      setError(err.message || 'Failed to update task.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    setActionLoadingId(taskId);
    try {
      await apiRequest(`/farms/tasks/${taskId}`, { method: 'DELETE', token });
      setTasks((cur) => cur.filter((t) => t._id !== taskId));
      setNotice('Task deleted.');
    } catch (err) {
      setError(err.message || 'Failed to delete task.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartEditTask = (task) => {
    setEditingTask(task);
    setEditTaskForm({
      title: task.title || '',
      type: task.type || 'general',
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : todayDate,
      priority: task.priority || 'medium',
      assignee: task.assignee || '',
      farmId: task.farmId || '',
      fieldId: task.fieldId || '',
      cropCycleId: task.cropCycleId || '',
      notes: task.notes || '',
    });
    setShowEditTaskModal(true);
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!editingTask || !editTaskForm.title.trim()) return;
    setSaving(true);
    try {
      const res = await apiRequest(`/farms/tasks/${editingTask._id}`, {
        method: 'PATCH',
        token,
        body: {
          title: editTaskForm.title.trim(),
          type: editTaskForm.type,
          dueDate: editTaskForm.dueDate || todayDate,
          priority: editTaskForm.priority,
          assignee: editTaskForm.assignee.trim(),
          farmId: editTaskForm.farmId || undefined,
          fieldId: editTaskForm.fieldId || undefined,
          cropCycleId: editTaskForm.cropCycleId || undefined,
          notes: editTaskForm.notes.trim(),
        },
      });
      setTasks((cur) => cur.map((t) => (t._id === editingTask._id ? res.task : t)));
      setShowEditTaskModal(false);
      setEditingTask(null);
      setNotice('Task updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update task.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setSaving(true);
    try {
      const res = await apiRequest('/farms/tasks', {
        method: 'POST',
        token,
        body: {
          title: taskForm.title.trim(),
          type: taskForm.type,
          dueDate: taskForm.dueDate || todayDate,
          priority: taskForm.priority,
          assignee: taskForm.assignee.trim(),
          farmId: taskForm.farmId || undefined,
          fieldId: taskForm.fieldId || undefined,
          cropCycleId: taskForm.cropCycleId || undefined,
          notes: taskForm.notes.trim(),
        },
      });
      setTasks((cur) => [res.task, ...cur]);
      setShowTaskModal(false);
      setNotice('Task created successfully.');
      setTaskForm({
        title: '',
        type: 'general',
        dueDate: todayDate,
        priority: 'medium',
        assignee: '',
        farmId: '',
        fieldId: '',
        cropCycleId: '',
        notes: '',
      });
    } catch (err) {
      setError(err.message || 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  };

  // Activity actions
  const handleDeleteActivity = async (activityId) => {
    if (!window.confirm('Delete this activity record?')) return;
    setActionLoadingId(activityId);
    try {
      await apiRequest(`/farms/activities/${activityId}`, { method: 'DELETE', token });
      setActivities((cur) => cur.filter((a) => a._id !== activityId));
      setNotice('Activity record deleted.');
    } catch (err) {
      setError(err.message || 'Failed to delete activity.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateActivity = async (e) => {
    e.preventDefault();
    if (!activityForm.farmId) {
      setError('Please select a farm for this activity.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest('/farms/activities', {
        method: 'POST',
        token,
        body: {
          type: activityForm.type,
          date: activityForm.date || todayDate,
          farmId: activityForm.farmId,
          fieldId: activityForm.fieldId || undefined,
          cropCycleId: activityForm.cropCycleId || undefined,
          notes: activityForm.notes.trim(),
          performedBy: activityForm.performedBy.trim(),
          cost: activityForm.cost ? Number(activityForm.cost) : undefined,
        },
      });
      setActivities((cur) => [res.activity, ...cur]);
      setShowActivityModal(false);
      setNotice('Field activity logged successfully.');
      setActivityForm({
        type: 'irrigation',
        date: todayDate,
        farmId: '',
        fieldId: '',
        cropCycleId: '',
        notes: '',
        performedBy: '',
        cost: '',
      });
    } catch (err) {
      setError(err.message || 'Failed to log activity.');
    } finally {
      setSaving(false);
    }
  };

  // Filtering
  const filteredTasks = tasks.filter((t) => {
    if (selectedFarmId !== 'all' && String(t.farmId) !== String(selectedFarmId)) return false;
    const dueTime = new Date(t.dueDate).getTime();
    const isCompleted = t.status === 'completed';

    if (taskFilter === 'completed') return isCompleted;
    if (taskFilter === 'overdue') return !isCompleted && dueTime < todayStartMs;
    if (taskFilter === 'today') return !isCompleted && dueTime >= todayStartMs && dueTime < todayStartMs + 86400000;
    if (taskFilter === 'upcoming') return !isCompleted && dueTime >= todayStartMs + 86400000;
    return true;
  });

  const filteredActivities = activities.filter((act) => {
    if (selectedFarmId !== 'all' && String(act.farmId) !== String(selectedFarmId)) return false;
    if (activityTypeFilter !== 'all' && act.type !== activityTypeFilter) return false;
    return true;
  });

  const pendingTaskCount = tasks.filter((t) => t.status !== 'completed').length;
  const overdueCount = tasks.filter((t) => t.status !== 'completed' && new Date(t.dueDate).getTime() < todayStartMs).length;

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow="Farm Operations"
        title="Operations & Tasks"
        description="Unified management for your daily farm tasks, schedules, and field activity logs."
        actions={
          <div className="d-flex align-items-center gap-2">
            {activeTab === 'tasks' ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setTaskForm((prev) => ({ ...prev, dueDate: todayDate }));
                  setShowTaskModal(true);
                }}
              >
                <i className="bi bi-plus-lg me-2" aria-hidden="true" />
                Add task
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setActivityForm((prev) => ({
                    ...prev,
                    date: todayDate,
                    farmId: farms[0]?._id || '',
                  }));
                  setShowActivityModal(true);
                }}
              >
                <i className="bi bi-journal-plus me-2" aria-hidden="true" />
                Log activity
              </button>
            )}
          </div>
        }
      />

      {error && (
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            setError('');
            setRetryCount((c) => c + 1);
          }}
          retrying={loading}
        />
      )}

      {notice && (
        <div className="alert alert-success d-flex align-items-center justify-content-between mb-4" role="status">
          <span><i className="bi bi-check-circle me-2" />{notice}</span>
          <button type="button" className="btn-close" aria-label="Dismiss notice" onClick={() => setNotice('')} />
        </div>
      )}

      {/* Structured Nav Tabs & Farm Selector */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-2 border-bottom">
        <div className="btn-group" role="tablist" aria-label="Operations views">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tasks'}
            className={`btn ${activeTab === 'tasks' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
            onClick={() => setActiveTab('tasks')}
          >
            <i className="bi bi-check2-square me-2" />
            Tasks & Schedule
            {pendingTaskCount > 0 && (
              <span className={`badge ms-2 ${overdueCount > 0 ? 'bg-danger text-white' : 'bg-light text-dark'}`}>
                {pendingTaskCount}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'activities'}
            className={`btn ${activeTab === 'activities' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
            onClick={() => setActiveTab('activities')}
          >
            <i className="bi bi-journal-text me-2" />
            Activity Log
            <span className="badge bg-light text-dark ms-2">{activities.length}</span>
          </button>
        </div>

        {farms.length > 1 && (
          <div className="d-flex align-items-center gap-2">
            <label htmlFor="farm-filter-select" className="small text-muted text-nowrap">Filter Farm:</label>
            <select
              id="farm-filter-select"
              className="form-select form-select-sm"
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              style={{ minWidth: '180px' }}
            >
              <option value="all">All Farms ({farms.length})</option>
              {farms.map((f) => (
                <option key={f._id} value={f._id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingState label="Loading operations..." />
      ) : activeTab === 'tasks' ? (
        /* ================== TASKS TAB ================== */
        <div>
          {/* Quick Sub-filters */}
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            {[
              { id: 'all', label: 'All Tasks', count: tasks.length },
              { id: 'today', label: 'Due Today', count: tasks.filter((t) => t.status !== 'completed' && new Date(t.dueDate).getTime() >= todayStartMs && new Date(t.dueDate).getTime() < todayStartMs + 86400000).length },
              { id: 'overdue', label: 'Overdue', count: overdueCount },
              { id: 'upcoming', label: 'Upcoming', count: tasks.filter((t) => t.status !== 'completed' && new Date(t.dueDate).getTime() >= todayStartMs + 86400000).length },
              { id: 'completed', label: 'Completed', count: tasks.filter((t) => t.status === 'completed').length },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`btn btn-sm ${taskFilter === f.id ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => setTaskFilter(f.id)}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {filteredTasks.length === 0 ? (
            <Card className="p-4 text-center">
              <EmptyState
                eyebrow="Tasks"
                title="No tasks found"
                description={taskFilter === 'all' ? 'You have no operational tasks recorded yet.' : `No tasks matching the "${taskFilter}" filter.`}
                action={
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setTaskForm((prev) => ({ ...prev, dueDate: todayDate }));
                      setShowTaskModal(true);
                    }}
                  >
                    <i className="bi bi-plus-lg me-1" /> Create first task
                  </button>
                }
              />
            </Card>
          ) : (
            <div className="d-flex flex-column gap-2">
              {filteredTasks.map((task) => {
                const isCompleted = task.status === 'completed';
                const dueTime = new Date(task.dueDate).getTime();
                const isOverdue = !isCompleted && dueTime < todayStartMs;
                const isToday = !isCompleted && dueTime >= todayStartMs && dueTime < todayStartMs + 86400000;
                const priorityMeta = PRIORITY_INFO[task.priority] || PRIORITY_INFO.medium;
                const farmObj = farms.find((f) => String(f._id) === String(task.farmId));
                const fieldObj = fields.find((fld) => String(fld._id) === String(task.fieldId));

                return (
                  <Card key={task._id} className="p-3">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                      <div className="d-flex align-items-center gap-3">
                        <button
                          type="button"
                          className={`btn btn-sm p-1 ${isCompleted ? 'text-success' : 'text-muted'}`}
                          title={isCompleted ? 'Mark as in-progress' : 'Mark as complete'}
                          disabled={actionLoadingId === task._id}
                          onClick={() => handleToggleTaskStatus(task)}
                        >
                          <i className={`bi ${isCompleted ? 'bi-check-circle-fill fs-5' : 'bi-circle fs-5'}`} />
                        </button>
                        <div>
                          <strong className={`d-block text-dark ${isCompleted ? 'text-decoration-line-through text-muted' : ''}`}>
                            {task.title}
                          </strong>
                          <div className="d-flex flex-wrap align-items-center gap-2 small text-muted mt-1">
                            <span className={isOverdue ? 'text-danger fw-semibold' : isToday ? 'text-warning fw-semibold' : ''}>
                              <i className="bi bi-calendar-event me-1" />
                              {new Date(task.dueDate).toLocaleDateString()}
                              {isOverdue && ' (Overdue)'}
                              {isToday && ' (Today)'}
                            </span>
                            {farmObj && (
                              <span className="badge bg-light text-secondary border">
                                {farmObj.name}{fieldObj ? ` • ${fieldObj.name}` : ''}
                              </span>
                            )}
                            {task.cropCycleId && (() => {
                              const cycle = cropCycles.find((c) => String(c._id) === String(task.cropCycleId));
                              return cycle ? (
                                <span className="badge bg-success-subtle text-success border">
                                  <i className="bi bi-sprout me-1" />{cycle.cropName}
                                </span>
                              ) : null;
                            })()}
                            {task.assignee && (
                              <span><i className="bi bi-person me-1" />{task.assignee}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-2">
                        <span className={`badge ${priorityMeta.badgeClass}`}>
                          {priorityMeta.label}
                        </span>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm p-1 px-2"
                          title="Edit task"
                          disabled={actionLoadingId === task._id}
                          onClick={() => handleStartEditTask(task)}
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm p-1 px-2"
                          title="Delete task"
                          disabled={actionLoadingId === task._id}
                          onClick={() => handleDeleteTask(task._id)}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </div>
                    {task.notes && (
                      <p className="small text-muted mb-0 mt-2 pt-2 border-top">
                        {task.notes}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================== ACTIVITIES TAB ================== */
        <div>
          {/* Activity Filters */}
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            {[
              { id: 'all', label: 'All Operations' },
              { id: 'irrigation', label: 'Irrigation' },
              { id: 'fertilizer', label: 'Fertilizer' },
              { id: 'treatment', label: 'Treatment / Spray' },
              { id: 'pest_observation', label: 'Pest Observation' },
              { id: 'harvesting', label: 'Harvesting' },
              { id: 'labor', label: 'Labor' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`btn btn-sm ${activityTypeFilter === f.id ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => setActivityTypeFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredActivities.length === 0 ? (
            <Card className="p-4 text-center">
              <EmptyState
                eyebrow="Activity Log"
                title="No activities recorded"
                description="Keep a structured historical record of your irrigation, fertilizer applications, and field treatments."
                action={
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setActivityForm((prev) => ({
                        ...prev,
                        date: todayDate,
                        farmId: farms[0]?._id || '',
                      }));
                      setShowActivityModal(true);
                    }}
                  >
                    <i className="bi bi-journal-plus me-1" /> Log first activity
                  </button>
                }
              />
            </Card>
          ) : (
            <div className="d-flex flex-column gap-2">
              {filteredActivities.map((act) => {
                const info = ACTIVITY_INFO[act.type] || { label: act.type, icon: 'bi-journal-check', color: 'text-dark' };
                const farmObj = farms.find((f) => String(f._id) === String(act.farmId));
                const fieldObj = fields.find((fld) => String(fld._id) === String(act.fieldId));

                return (
                  <Card key={act._id} className="p-3">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                      <div className="d-flex align-items-center gap-3">
                        <span className={`fs-4 ${info.color}`}>
                          <i className={`bi ${info.icon}`} />
                        </span>
                        <div>
                          <strong className="d-block text-dark">{info.label}</strong>
                          <div className="d-flex flex-wrap align-items-center gap-2 small text-muted mt-1">
                            <span>
                              <i className="bi bi-calendar3 me-1" />
                              {new Date(act.date).toLocaleDateString()}
                            </span>
                            {farmObj && (
                              <span className="badge bg-light text-secondary border">
                                {farmObj.name}{fieldObj ? ` • ${fieldObj.name}` : ''}
                              </span>
                            )}
                            {act.cropCycleId && (() => {
                              const cycle = cropCycles.find((c) => String(c._id) === String(act.cropCycleId));
                              return cycle ? (
                                <span className="badge bg-success-subtle text-success border">
                                  <i className="bi bi-sprout me-1" />{cycle.cropName}
                                </span>
                              ) : null;
                            })()}
                            {act.performedBy && (
                              <span><i className="bi bi-person me-1" />{act.performedBy}</span>
                            )}
                            {act.cost && (
                              <span className="fw-semibold text-dark">Cost: ₹{act.cost}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm p-1 px-2"
                        title="Delete activity record"
                        disabled={actionLoadingId === act._id}
                        onClick={() => handleDeleteActivity(act._id)}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>

                    {act.notes && (
                      <p className="small text-muted mb-0 mt-2 pt-2 border-top">
                        {act.notes}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {showTaskModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Create Operational Task</h5>
                <button type="button" className="btn-close" onClick={() => setShowTaskModal(false)} />
              </div>
              <form onSubmit={handleCreateTask}>
                <div className="modal-body d-flex flex-column gap-3">
                  <div>
                    <label className="form-label small fw-semibold">Task Title *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., Check drip irrigation line in Block A"
                      required
                      value={taskForm.title}
                      onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    />
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Due Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={taskForm.dueDate}
                        onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Priority</label>
                      <select
                        className="form-select"
                        value={taskForm.priority}
                        onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Farm</label>
                      <select
                        className="form-select"
                        value={taskForm.farmId}
                        onChange={(e) => setTaskForm({ ...taskForm, farmId: e.target.value, fieldId: '' })}
                      >
                        <option value="">(Optional - General Farm)</option>
                        {farms.map((f) => (
                          <option key={f._id} value={f._id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Field / Plot</label>
                      <select
                        className="form-select"
                        value={taskForm.fieldId}
                        onChange={(e) => setTaskForm({ ...taskForm, fieldId: e.target.value })}
                      >
                        <option value="">(Optional)</option>
                        {fields
                          .filter((f) => !taskForm.farmId || String(f.farmId) === String(taskForm.farmId))
                          .map((fld) => (
                            <option key={fld._id} value={fld._id}>{fld.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                  {taskForm.fieldId && (
                    <div>
                      <label className="form-label small fw-semibold">Associated Crop Cycle</label>
                      <select
                        className="form-select"
                        value={taskForm.cropCycleId}
                        onChange={(e) => setTaskForm({ ...taskForm, cropCycleId: e.target.value })}
                      >
                        <option value="">(Optional - General Field Task)</option>
                        {cropCycles
                          .filter((c) => String(c.fieldId) === String(taskForm.fieldId))
                          .map((cycle) => (
                            <option key={cycle._id} value={cycle._id}>
                              {cycle.cropName} ({cycle.stage.toUpperCase()}) {cycle.status === 'active' ? '• Active' : `• ${cycle.status}`}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="form-label small fw-semibold">Assignee</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., Farm Worker, Ramesh"
                      value={taskForm.assignee}
                      onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label small fw-semibold">Notes</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="Specific instructions or notes..."
                      value={taskForm.notes}
                      onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TASK MODAL */}
      {showEditTaskModal && editingTask && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Operational Task</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowEditTaskModal(false);
                    setEditingTask(null);
                  }}
                />
              </div>
              <form onSubmit={handleUpdateTask}>
                <div className="modal-body d-flex flex-column gap-3">
                  <div>
                    <label className="form-label small fw-semibold">Task Title *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={editTaskForm.title}
                      onChange={(e) => setEditTaskForm({ ...editTaskForm, title: e.target.value })}
                    />
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Due Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={editTaskForm.dueDate}
                        onChange={(e) => setEditTaskForm({ ...editTaskForm, dueDate: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Priority</label>
                      <select
                        className="form-select"
                        value={editTaskForm.priority}
                        onChange={(e) => setEditTaskForm({ ...editTaskForm, priority: e.target.value })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Farm</label>
                      <select
                        className="form-select"
                        value={editTaskForm.farmId}
                        onChange={(e) => setEditTaskForm({ ...editTaskForm, farmId: e.target.value, fieldId: '', cropCycleId: '' })}
                      >
                        <option value="">(Optional - General Farm)</option>
                        {farms.map((f) => (
                          <option key={f._id} value={f._id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Field / Plot</label>
                      <select
                        className="form-select"
                        value={editTaskForm.fieldId}
                        onChange={(e) => setEditTaskForm({ ...editTaskForm, fieldId: e.target.value, cropCycleId: '' })}
                      >
                        <option value="">(Optional)</option>
                        {fields
                          .filter((f) => !editTaskForm.farmId || String(f.farmId) === String(editTaskForm.farmId))
                          .map((fld) => (
                            <option key={fld._id} value={fld._id}>{fld.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                  {editTaskForm.fieldId && (
                    <div>
                      <label className="form-label small fw-semibold">Associated Crop Cycle</label>
                      <select
                        className="form-select"
                        value={editTaskForm.cropCycleId}
                        onChange={(e) => setEditTaskForm({ ...editTaskForm, cropCycleId: e.target.value })}
                      >
                        <option value="">(Optional - General Field Task)</option>
                        {cropCycles
                          .filter((c) => String(c.fieldId) === String(editTaskForm.fieldId))
                          .map((cycle) => (
                            <option key={cycle._id} value={cycle._id}>
                              {cycle.cropName} ({cycle.stage.toUpperCase()}) {cycle.status === 'active' ? '• Active' : `• ${cycle.status}`}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="form-label small fw-semibold">Assignee</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., Farm Worker, Ramesh"
                      value={editTaskForm.assignee}
                      onChange={(e) => setEditTaskForm({ ...editTaskForm, assignee: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label small fw-semibold">Notes</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="Specific instructions or notes..."
                      value={editTaskForm.notes}
                      onChange={(e) => setEditTaskForm({ ...editTaskForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowEditTaskModal(false);
                      setEditingTask(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* LOG ACTIVITY MODAL */}
      {showActivityModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Log Field Activity</h5>
                <button type="button" className="btn-close" onClick={() => setShowActivityModal(false)} />
              </div>
              <form onSubmit={handleCreateActivity}>
                <div className="modal-body d-flex flex-column gap-3">
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Activity Type *</label>
                      <select
                        className="form-select"
                        value={activityForm.type}
                        onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
                      >
                        <option value="irrigation">Irrigation</option>
                        <option value="fertilizer">Fertilizer Application</option>
                        <option value="treatment">Treatment / Spraying</option>
                        <option value="pest_observation">Pest Observation</option>
                        <option value="inspection">Field Inspection</option>
                        <option value="labor">Labor / Weeding</option>
                        <option value="harvesting">Harvesting</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={activityForm.date}
                        onChange={(e) => setActivityForm({ ...activityForm, date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Farm *</label>
                      <select
                        className="form-select"
                        required
                        value={activityForm.farmId}
                        onChange={(e) => setActivityForm({ ...activityForm, farmId: e.target.value, fieldId: '', cropCycleId: '' })}
                      >
                        <option value="">Select farm...</option>
                        {farms.map((f) => (
                          <option key={f._id} value={f._id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Field / Plot</label>
                      <select
                        className="form-select"
                        value={activityForm.fieldId}
                        onChange={(e) => setActivityForm({ ...activityForm, fieldId: e.target.value, cropCycleId: '' })}
                      >
                        <option value="">(Optional - Whole Farm)</option>
                        {fields
                          .filter((f) => !activityForm.farmId || String(f.farmId) === String(activityForm.farmId))
                          .map((fld) => (
                            <option key={fld._id} value={fld._id}>{fld.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                  {activityForm.fieldId && (
                    <div>
                      <label className="form-label small fw-semibold">Associated Crop Cycle</label>
                      <select
                        className="form-select"
                        value={activityForm.cropCycleId}
                        onChange={(e) => setActivityForm({ ...activityForm, cropCycleId: e.target.value })}
                      >
                        <option value="">(Optional - General Field Activity)</option>
                        {cropCycles
                          .filter((c) => String(c.fieldId) === String(activityForm.fieldId))
                          .map((cycle) => (
                            <option key={cycle._id} value={cycle._id}>
                              {cycle.cropName} ({cycle.stage.toUpperCase()}) {cycle.status === 'active' ? '• Active' : `• ${cycle.status}`}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Performed By</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g., Farm operator"
                        value={activityForm.performedBy}
                        onChange={(e) => setActivityForm({ ...activityForm, performedBy: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Cost (₹)</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        placeholder="0"
                        value={activityForm.cost}
                        onChange={(e) => setActivityForm({ ...activityForm, cost: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label small fw-semibold">Notes / Details</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="e.g., Drip run for 2 hours, applied NPK 19-19-19..."
                      value={activityForm.notes}
                      onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowActivityModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Logging...' : 'Log Activity'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default OperationsPage;
