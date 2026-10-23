import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import { formatDate } from '../lib/formatters.js';

const AdminPage = () => {
  const {
    user: currentUser,
    listAdminUsers,
    listPendingRequests,
    approveRoleRequest,
    rejectRoleRequest,
    changeUserRole,
    changeUserStatus,
    listAuditLogs,
  } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'users' | 'audit'
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Pending requests state
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  // Users management state
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);

  // Modal / Confirmation dialog state
  const [modalConfig, setModalConfig] = useState(null);
  const [modalReason, setModalReason] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Load pending requests
  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listPendingRequests();
      setPendingRequests(res.requests || []);
      setPendingCount(res.total || 0);
    } catch (err) {
      setActionError(err.message || 'Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  }, [listPendingRequests]);

  // Load users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAdminUsers({
        role: roleFilter,
        status: statusFilter,
        search: searchQuery,
        page: userPage,
        limit: 25,
      });
      setUsers(res.users || []);
      setUserTotal(res.total || 0);
    } catch (err) {
      setActionError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [listAdminUsers, roleFilter, statusFilter, searchQuery, userPage]);

  // Load audit logs
  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAuditLogs({ limit: 50, page: 1 });
      setAuditLogs(res.logs || []);
      setAuditTotal(res.total || 0);
    } catch (err) {
      setActionError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [listAuditLogs]);

  const handleTabSwitch = (tab) => {
    setActionError('');
    setActionSuccess('');
    setActiveTab(tab);
  };

  // Fetch data on tab change
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        if (activeTab === 'pending') {
          const res = await listPendingRequests();
          if (active) {
            setPendingRequests(res.requests || []);
            setPendingCount(res.total || 0);
          }
        } else if (activeTab === 'users') {
          const res = await listAdminUsers({
            role: roleFilter,
            status: statusFilter,
            search: searchQuery,
            page: userPage,
            limit: 25,
          });
          if (active) {
            setUsers(res.users || []);
            setUserTotal(res.total || 0);
          }
        } else if (activeTab === 'audit') {
          const res = await listAuditLogs({ limit: 50, page: 1 });
          if (active) {
            setAuditLogs(res.logs || []);
            setAuditTotal(res.total || 0);
          }
        }
      } catch (err) {
        if (active) setActionError(err.message || 'Failed to load data');
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [activeTab, listPendingRequests, listAdminUsers, listAuditLogs, roleFilter, statusFilter, searchQuery, userPage]);

  // Also prefetch pending count
  useEffect(() => {
    listPendingRequests().then((res) => {
      setPendingCount(res.total || 0);
    }).catch(() => {});
  }, [listPendingRequests]);

  const openConfirmation = (type, targetUser) => {
    setActionError('');
    setActionSuccess('');
    setModalReason('');
    setModalConfig({ type, targetUser });
  };

  const closeConfirmation = () => {
    setModalConfig(null);
    setModalReason('');
  };

  const handleModalConfirm = async () => {
    if (!modalConfig) return;
    const { type, targetUser } = modalConfig;
    const targetId = targetUser._id || targetUser.id;

    setModalSubmitting(true);
    setActionError('');
    setActionSuccess('');

    try {
      if (type === 'approve') {
        const res = await approveRoleRequest(targetId, modalReason);
        setActionSuccess(res.message || 'Admin role approved successfully.');
        fetchPending();
      } else if (type === 'reject') {
        const res = await rejectRoleRequest(targetId, modalReason);
        setActionSuccess(res.message || 'Role request rejected.');
        fetchPending();
      } else if (type === 'promote') {
        const res = await changeUserRole(targetId, 'admin', modalReason);
        setActionSuccess(res.message || 'User promoted to Administrator.');
        fetchUsers();
      } else if (type === 'demote') {
        const res = await changeUserRole(targetId, 'farmer', modalReason);
        setActionSuccess(res.message || 'Administrator demoted to User.');
        fetchUsers();
      } else if (type === 'suspend') {
        const res = await changeUserStatus(targetId, 'suspended', modalReason);
        setActionSuccess(res.message || 'User account suspended.');
        fetchUsers();
      } else if (type === 'activate') {
        const res = await changeUserStatus(targetId, 'active', modalReason);
        setActionSuccess(res.message || 'User account reactivated.');
        fetchUsers();
      }
      fetchAuditLogs();
      closeConfirmation();
      // Refresh pending count
      listPendingRequests().then((r) => setPendingCount(r.total || 0)).catch(() => {});
    } catch (err) {
      if (err.data?.code === 'LAST_ADMIN_PROTECTION') {
        setActionError(t('admin.lastAdminError'));
      } else {
        setActionError(err.message || 'Operation failed');
      }
    } finally {
      setModalSubmitting(false);
    }
  };

  const isCurrentActor = (targetUser) => {
    const targetId = (targetUser._id || targetUser.id)?.toString();
    const currentId = (currentUser?._id || currentUser?.id)?.toString();
    return targetId === currentId;
  };

  const getActionBadgeClass = (action) => {
    switch (action) {
      case 'ROLE_REQUEST_APPROVED':
      case 'ROLE_CHANGE':
        return 'bg-success text-white';
      case 'ROLE_REQUEST_REJECTED':
        return 'bg-secondary text-white';
      case 'USER_SUSPENDED':
        return 'bg-danger text-white';
      case 'USER_ACTIVATED':
        return 'bg-info text-dark';
      case 'ADMIN_BOOTSTRAP':
        return 'bg-primary text-white';
      default:
        return 'bg-dark text-white';
    }
  };

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-shield-shaded text-primary" />
            {t('admin.title')}
          </h1>
          <p className="text-secondary small mb-0">{t('admin.subtitle')}</p>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 shadow-sm mb-4" role="alert">
          <i className="bi bi-check-circle-fill text-success flex-shrink-0" />
          <div>{actionSuccess}</div>
          <button type="button" className="btn-close ms-auto" aria-label="Close" onClick={() => setActionSuccess('')} />
        </div>
      )}

      {actionError && (
        <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2 shadow-sm mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill text-danger flex-shrink-0" />
          <div>{actionError}</div>
          <button type="button" className="btn-close ms-auto" aria-label="Close" onClick={() => setActionError('')} />
        </div>
      )}

      {/* Tabs */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-header bg-white border-0 pt-3 px-3">
          <ul className="nav nav-tabs card-header-tabs" role="tablist">
            <li className="nav-item" role="presentation">
              <button
                type="button"
                className={`nav-link fw-semibold d-flex align-items-center gap-2 ${activeTab === 'pending' ? 'active text-primary' : 'text-secondary'}`}
                onClick={() => handleTabSwitch('pending')}
              >
                <i className="bi bi-person-exclamation" />
                <span>{t('admin.tabPending')}</span>
                {pendingCount > 0 && (
                  <span className="badge rounded-pill bg-danger" style={{ fontSize: '0.72rem' }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                type="button"
                className={`nav-link fw-semibold d-flex align-items-center gap-2 ${activeTab === 'users' ? 'active text-primary' : 'text-secondary'}`}
                onClick={() => handleTabSwitch('users')}
              >
                <i className="bi bi-people" />
                <span>{t('admin.tabUsers')}</span>
                {userTotal > 0 && (
                  <span className="badge rounded-pill bg-light text-secondary border" style={{ fontSize: '0.72rem' }}>
                    {userTotal}
                  </span>
                )}
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                type="button"
                className={`nav-link fw-semibold d-flex align-items-center gap-2 ${activeTab === 'audit' ? 'active text-primary' : 'text-secondary'}`}
                onClick={() => handleTabSwitch('audit')}
              >
                <i className="bi bi-journal-text" />
                <span>{t('admin.tabAudit')}</span>
                {auditTotal > 0 && (
                  <span className="badge rounded-pill bg-light text-secondary border" style={{ fontSize: '0.72rem' }}>
                    {auditTotal}
                  </span>
                )}
              </button>
            </li>
          </ul>
        </div>

        <div className="card-body p-3 p-md-4">
          {/* TAB 1: PENDING REQUESTS */}
          {activeTab === 'pending' && (
            <div>
              {loading && pendingRequests.length === 0 ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status" />
                  <div className="text-secondary small mt-2">{t('common.loading')}</div>
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-5">
                  <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-light text-muted p-4 mb-3" style={{ width: '80px', height: '80px' }}>
                    <i className="bi bi-shield-check" style={{ fontSize: '2.5rem' }} />
                  </div>
                  <h3 className="h5 fw-bold text-dark mb-1">{t('admin.noPendingTitle')}</h3>
                  <p className="text-secondary small mb-0">{t('admin.noPendingDesc')}</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle table-hover mb-0">
                    <thead className="table-light small text-secondary">
                      <tr>
                        <th scope="col">{t('admin.thUser')}</th>
                        <th scope="col">{t('admin.thEmail')}</th>
                        <th scope="col">{t('admin.requestedRole')}</th>
                        <th scope="col">{t('admin.requestedAt')}</th>
                        <th scope="col" className="text-end">{t('admin.thActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.map((reqUser) => (
                        <tr key={reqUser._id || reqUser.id}>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <span className="avatar avatar-small bg-primary text-white fw-bold">
                                {reqUser.name?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                              <div>
                                <div className="fw-semibold text-dark">{reqUser.name}</div>
                                {reqUser.farmName && (
                                  <small className="text-muted">{reqUser.farmName}</small>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="text-dark">{reqUser.email}</span>
                          </td>
                          <td>
                            <span className="badge bg-warning text-dark fw-bold">
                              <i className="bi bi-shield-lock me-1" />
                              Administrator
                            </span>
                          </td>
                          <td className="small text-secondary">
                            {formatDate(reqUser.roleRequest?.requestedAt || reqUser.createdAt)}
                          </td>
                          <td className="text-end">
                            {isCurrentActor(reqUser) ? (
                              <span className="badge bg-light text-muted border">
                                {t('admin.selfActionBlocked')}
                              </span>
                            ) : (
                              <div className="btn-group btn-group-sm" role="group">
                                <button
                                  type="button"
                                  className="btn btn-outline-success"
                                  onClick={() => openConfirmation('approve', reqUser)}
                                  title="Approve request"
                                >
                                  <i className="bi bi-check-lg me-1" />
                                  {t('common.approve')}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger"
                                  onClick={() => openConfirmation('reject', reqUser)}
                                  title="Reject request"
                                >
                                  <i className="bi bi-x-lg me-1" />
                                  {t('common.reject')}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div>
              {/* Filter and Search Bar */}
              <div className="row g-2 align-items-center mb-3">
                <div className="col-12 col-md-5">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white border-end-0">
                      <i className="bi bi-search text-muted" />
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0"
                      placeholder={t('admin.userSearchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="">{t('admin.filterRoleAll')}</option>
                    <option value="farmer">{t('admin.filterRoleFarmer')}</option>
                    <option value="admin">{t('admin.filterRoleAdmin')}</option>
                  </select>
                </div>
                <div className="col-6 col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">{t('admin.filterStatusAll')}</option>
                    <option value="active">{t('admin.filterStatusActive')}</option>
                    <option value="suspended">{t('admin.filterStatusSuspended')}</option>
                  </select>
                </div>
                <div className="col-12 col-md-1 text-md-end">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm w-100"
                    onClick={fetchUsers}
                    title="Refresh list"
                  >
                    <i className="bi bi-arrow-clockwise" />
                  </button>
                </div>
              </div>

              {loading && users.length === 0 ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status" />
                  <div className="text-secondary small mt-2">{t('common.loading')}</div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle table-hover mb-0">
                    <thead className="table-light small text-secondary">
                      <tr>
                        <th scope="col">{t('admin.thUser')}</th>
                        <th scope="col">{t('admin.thEmail')}</th>
                        <th scope="col">{t('admin.thRole')}</th>
                        <th scope="col">{t('admin.thStatus')}</th>
                        <th scope="col">{t('admin.thJoined')}</th>
                        <th scope="col" className="text-end">{t('admin.thActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((itemUser) => {
                        const isSelf = isCurrentActor(itemUser);
                        const isAdmin = itemUser.role === 'admin';
                        const isSuspended = itemUser.status === 'suspended';

                        return (
                          <tr key={itemUser._id || itemUser.id}>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <span className="avatar avatar-small bg-success text-white fw-bold">
                                  {itemUser.name?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                                <div>
                                  <div className="fw-semibold text-dark d-flex align-items-center gap-1">
                                    <span>{itemUser.name}</span>
                                    {isSelf && (
                                      <span className="badge bg-primary-subtle text-primary border" style={{ fontSize: '0.65rem' }}>
                                        You
                                      </span>
                                    )}
                                  </div>
                                  {itemUser.farmName && (
                                    <small className="text-muted">{itemUser.farmName}</small>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="d-flex align-items-center gap-1">
                                <span className="text-dark small">{itemUser.email}</span>
                                {itemUser.emailVerified && (
                                  <i className="bi bi-check-circle-fill text-success" title="Verified email" style={{ fontSize: '0.85rem' }} />
                                )}
                              </div>
                            </td>
                            <td>
                              {isAdmin ? (
                                <span className="badge bg-primary text-white">
                                  <i className="bi bi-shield-fill me-1" />
                                  Admin
                                </span>
                              ) : (
                                <span className="badge bg-light text-dark border">
                                  <i className="bi bi-person me-1" />
                                  User
                                </span>
                              )}
                            </td>
                            <td>
                              {isSuspended ? (
                                <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                  {t('profile.suspended')}
                                </span>
                              ) : (
                                <span className="badge bg-success-subtle text-success border border-success-subtle">
                                  {t('profile.active')}
                                </span>
                              )}
                            </td>
                            <td className="small text-secondary">
                              {formatDate(itemUser.createdAt)}
                            </td>
                            <td className="text-end">
                              {isSelf ? (
                                <span className="text-muted small fst-italic">No self-actions</span>
                              ) : (
                                <div className="btn-group btn-group-sm" role="group">
                                  {/* Role Toggle Action */}
                                  {isAdmin ? (
                                    <button
                                      type="button"
                                      className="btn btn-outline-warning"
                                      onClick={() => openConfirmation('demote', itemUser)}
                                      title={t('common.demote')}
                                    >
                                      <i className="bi bi-arrow-down-circle me-1" />
                                      {t('common.demote')}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-outline-primary"
                                      onClick={() => openConfirmation('promote', itemUser)}
                                      title={t('common.promote')}
                                    >
                                      <i className="bi bi-arrow-up-circle me-1" />
                                      {t('common.promote')}
                                    </button>
                                  )}

                                  {/* Status Toggle Action */}
                                  {isSuspended ? (
                                    <button
                                      type="button"
                                      className="btn btn-outline-success"
                                      onClick={() => openConfirmation('activate', itemUser)}
                                      title={t('common.activate')}
                                    >
                                      <i className="bi bi-check2-circle me-1" />
                                      {t('common.activate')}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-outline-danger"
                                      onClick={() => openConfirmation('suspend', itemUser)}
                                      title={t('common.suspend')}
                                    >
                                      <i className="bi bi-slash-circle me-1" />
                                      {t('common.suspend')}
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AUDIT LOG */}
          {activeTab === 'audit' && (
            <div>
              {loading && auditLogs.length === 0 ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status" />
                  <div className="text-secondary small mt-2">{t('common.loading')}</div>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-5 text-muted small">
                  No audit logs recorded yet.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle table-hover mb-0">
                    <thead className="table-light small text-secondary">
                      <tr>
                        <th scope="col">{t('admin.auditTime')}</th>
                        <th scope="col">{t('admin.auditAction')}</th>
                        <th scope="col">{t('admin.auditActor')}</th>
                        <th scope="col">{t('admin.auditTarget')}</th>
                        <th scope="col">{t('admin.auditDetails')}</th>
                        <th scope="col">{t('admin.auditReason')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log._id || log.id}>
                          <td className="small text-secondary text-nowrap">
                            {formatDate(log.createdAt)}
                          </td>
                          <td>
                            <span className={`badge ${getActionBadgeClass(log.action)}`}>
                              {log.action}
                            </span>
                          </td>
                          <td>
                            <div className="small fw-semibold text-dark">{log.actorName || 'Admin'}</div>
                            <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>{log.actorEmail}</small>
                          </td>
                          <td>
                            <div className="small fw-semibold text-dark">{log.targetUserName || 'User'}</div>
                            <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>{log.targetUserEmail}</small>
                          </td>
                          <td className="small">
                            {log.previousRole && log.newRole && (
                              <span className="badge bg-light text-dark border">
                                {log.previousRole} &rarr; <strong>{log.newRole}</strong>
                              </span>
                            )}
                            {log.previousStatus && log.newStatus && (
                              <span className="badge bg-light text-dark border ms-1">
                                {log.previousStatus} &rarr; <strong>{log.newStatus}</strong>
                              </span>
                            )}
                          </td>
                          <td className="small text-muted" style={{ maxWidth: '240px' }}>
                            {log.reason || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {modalConfig && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-shield-exclamation text-warning" />
                  {modalConfig.type === 'approve' && t('admin.confirmApproveTitle')}
                  {modalConfig.type === 'reject' && t('admin.confirmRejectTitle')}
                  {modalConfig.type === 'promote' && t('admin.confirmPromoteTitle')}
                  {modalConfig.type === 'demote' && t('admin.confirmDemoteTitle')}
                  {modalConfig.type === 'suspend' && t('admin.confirmSuspendTitle')}
                  {modalConfig.type === 'activate' && t('admin.confirmActivateTitle')}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  disabled={modalSubmitting}
                  onClick={closeConfirmation}
                />
              </div>

              <div className="modal-body py-3">
                <p className="text-secondary small mb-3">
                  {modalConfig.type === 'approve' &&
                    t('admin.confirmApprovePrompt', { name: modalConfig.targetUser.name, email: modalConfig.targetUser.email })}
                  {modalConfig.type === 'reject' &&
                    t('admin.confirmRejectPrompt', { name: modalConfig.targetUser.name, email: modalConfig.targetUser.email })}
                  {modalConfig.type === 'promote' &&
                    t('admin.confirmPromotePrompt', { name: modalConfig.targetUser.name, email: modalConfig.targetUser.email })}
                  {modalConfig.type === 'demote' &&
                    t('admin.confirmDemotePrompt', { name: modalConfig.targetUser.name, email: modalConfig.targetUser.email })}
                  {modalConfig.type === 'suspend' &&
                    t('admin.confirmSuspendPrompt', { name: modalConfig.targetUser.name, email: modalConfig.targetUser.email })}
                  {modalConfig.type === 'activate' &&
                    t('admin.confirmActivatePrompt', { name: modalConfig.targetUser.name, email: modalConfig.targetUser.email })}
                </p>

                <div className="mb-2">
                  <label className="form-label small fw-semibold text-dark mb-1">
                    {t('common.notes')} ({t('common.optional')}):
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder={t('common.reasonPlaceholder')}
                    value={modalReason}
                    onChange={(e) => setModalReason(e.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={modalSubmitting}
                  onClick={closeConfirmation}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${modalConfig.type === 'suspend' || modalConfig.type === 'reject' || modalConfig.type === 'demote' ? 'btn-danger' : 'btn-primary'}`}
                  disabled={modalSubmitting}
                  onClick={handleModalConfirm}
                >
                  {modalSubmitting ? (
                    <><span className="spinner-border spinner-border-sm me-2" />{t('common.saving')}</>
                  ) : (
                    t('common.confirm')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
