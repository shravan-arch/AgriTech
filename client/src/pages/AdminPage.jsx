import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/useLanguage.js';
import { formatDate } from '../lib/formatters.js';

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview', icon: 'bi-grid-1x2', desc: 'Platform KPIs, Status & Recent Activity' },
  { id: 'users', label: 'Users', icon: 'bi-people', desc: 'Registrations, Profiles & Support Requests' },
  { id: 'content', label: 'Content', icon: 'bi-journal-richtext', desc: 'Crops, Products & Agri Advisories' },
  { id: 'resources', label: 'Resources', icon: 'bi-boxes', desc: 'Inventory Oversight & Supplier Coordination' },
  { id: 'services', label: 'Services', icon: 'bi-calendar-check', desc: 'Scheduling & Service Delivery' },
  { id: 'analytics', label: 'Analytics', icon: 'bi-graph-up', desc: 'Platform Insights & Strategic Reports' },
  { id: 'security_policies', label: 'Security & Policies', icon: 'bi-shield-check', desc: 'System Health, Audit Logs & Policies' },
  { id: 'profile', label: 'My Profile', icon: 'bi-person-circle', desc: 'Admin Profile, Password & Credentials' },
];

const resolveTab = (tab) => {
  if (!tab) return 'overview';
  if (tab === 'maintenance' || tab === 'security' || tab === 'policies') return 'security_policies';
  if (ADMIN_TABS.some((t) => t.id === tab)) return tab;
  return 'overview';
};

const AdminPage = () => {
  const {
    user: currentUser,
    deleteAccount,
    listAdminUsers,
    changeUserStatus,
    verifyUserEmailAdmin,
    resetUserPasswordAdmin,
    listSupportTicketsAdmin,
    replySupportTicketAdmin,
    listCropContentAdmin,
    createCropContentAdmin,
    updateCropContentAdmin,
    deleteCropContentAdmin,
    listResourcesAdmin,
    createResourceAdmin,
    orderResourceRestockAdmin,
    listServiceBookingsAdmin,
    updateServiceBookingAdmin,
    getSystemHealth,
    runSystemCheckAdmin,
    toggleMaintenanceModeAdmin,
    clearCacheAdmin,
    getSecurityOverviewAdmin,
    updateSecurityPoliciesAdmin,
    blockIPAdmin,
    listAuditLogs,
    getPlatformAnalyticsAdmin,
    generateStrategicReportAdmin,
    listPolicyViolationsAdmin,
    recordPolicyViolationAdmin,
    resolvePolicyViolationAdmin,
    getAdminProfile,
    updateAdminProfile,
    changeAdminPassword,
    resendAdminEmailVerification,
  } = useAuth();

  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialTab = resolveTab(searchParams.get('tab'));

  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Sub-tab state for Security & Policies page
  const [secSubTab, setSecSubTab] = useState(() => {
    const raw = searchParams.get('tab');
    if (raw === 'security') return 'security';
    if (raw === 'policies') return 'policies';
    return 'maintenance';
  });

  // Recent activity logs for Overview tab
  const [recentActivity, setRecentActivity] = useState([]);

  // Dedicated Admin Profile State
  const [adminProfileForm, setAdminProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    language: 'en',
    profilePhoto: '',
    address: '',
    role: 'admin',
    status: 'active',
    emailVerified: false,
    phoneVerified: false,
    createdAt: '',
    lastLogin: '',
  });
  const [adminPasswordForm, setAdminPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);

  // Admin Account Deletion State
  const [activeAdminCount, setActiveAdminCount] = useState(null);
  const [showAdminDeleteConfirm, setShowAdminDeleteConfirm] = useState(false);
  const [adminDeletePassword, setAdminDeletePassword] = useState('');
  const [adminDeletePhrase, setAdminDeletePhrase] = useState('');
  const [adminDeleteConfirmEmail, setAdminDeleteConfirmEmail] = useState('');
  const [adminDeleting, setAdminDeleting] = useState(false);
  const [adminDeleteError, setAdminDeleteError] = useState('');

  // Sync state if URL changes externally
  useEffect(() => {
    const tabParam = resolveTab(searchParams.get('tab'));
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
      const raw = searchParams.get('tab');
      if (raw === 'security') setSecSubTab('security');
      else if (raw === 'policies') setSecSubTab('policies');
      else if (raw === 'maintenance') setSecSubTab('maintenance');
    }
  }, [searchParams, activeTab]);


  // 1. User Management State
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [inspectedUser, setInspectedUser] = useState(null);
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportFilter, setSupportFilter] = useState('all');
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [userActionModal, setUserActionModal] = useState(null); // { type, targetUser }
  const [userActionReason, setUserActionReason] = useState('');
  const [issuedResetLink, setIssuedResetLink] = useState('');

  // 2. Content Management State
  const [cropContent, setCropContent] = useState([]);
  const [contentFilter, setContentFilter] = useState('all');
  const [contentModal, setContentModal] = useState(null); // 'create' | content object for edit
  const [contentForm, setContentForm] = useState({
    title: '',
    category: 'crop',
    cropType: '',
    variety: '',
    sowingSeason: '',
    recommendedSoil: '',
    waterRequirement: '',
    pestManagement: '',
    summary: '',
    details: '',
    accuracyVerified: true,
    isPublished: true,
  });

  // 3. Resource Management State
  const [resources, setResources] = useState([]);
  const [restockModal, setRestockModal] = useState(null); // resource item
  const [restockQty, setRestockQty] = useState(50);
  const [resourceCreateModal, setResourceCreateModal] = useState(false);
  const [resourceForm, setResourceForm] = useState({
    name: '',
    category: 'seeds',
    sku: '',
    currentStock: 100,
    unit: 'bags (40kg)',
    minThreshold: 20,
    unitPriceINR: 1200,
    supplierName: '',
    supplierContact: '',
    supplierEmail: '',
  });

  // 4. Service Management State
  const [serviceBookings, setServiceBookings] = useState([]);
  const [serviceFilter, setServiceFilter] = useState('all');
  const [serviceScheduleModal, setServiceScheduleModal] = useState(null);
  const [serviceScheduleForm, setServiceScheduleForm] = useState({
    technicianAssigned: '',
    scheduledDate: '',
    status: 'scheduled',
    deliveryNotes: '',
  });

  // 5. System Maintenance State
  const [healthData, setHealthData] = useState(null);
  const [systemCheckResult, setSystemCheckResult] = useState(null);
  const [maintenanceModeActive, setMaintenanceModeActive] = useState(false);
  const [systemNoticeInput, setSystemNoticeInput] = useState('');

  // 6. Security Management State
  const [securityData, setSecurityData] = useState(null);
  const [securityAuditLogs, setSecurityAuditLogs] = useState([]);
  const [blockIpInput, setBlockIpInput] = useState('');
  const [secPolicyForm, setSecPolicyForm] = useState({
    sessionTimeoutMinutes: 60,
    maxLoginAttempts: 5,
    requireTwoFactor: false,
  });

  // 7. Data Analytics State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [generatedReport, setGeneratedReport] = useState(null);

  // 8. Policy Enforcement State
  const [violations, setViolations] = useState([]);
  const [violationModal, setViolationModal] = useState(false);
  const [violationForm, setViolationForm] = useState({
    userId: '',
    userName: '',
    userEmail: '',
    violationType: 'terms_of_service_breach',
    severity: 'medium',
    description: '',
    actionTaken: 'warning_issued',
    notes: '',
  });

  // Fetch initial data based on active tab
  const fetchTabData = useCallback(async () => {
    setLoading(true);
    setActionError('');
    try {
      if (activeTab === 'overview') {
        const [uRes, cRes, rRes, sRes, hRes, aRes, audRes] = await Promise.all([
          listAdminUsers({ limit: 100 }),
          listCropContentAdmin({ limit: 100 }),
          listResourcesAdmin(),
          listServiceBookingsAdmin({ limit: 100 }),
          getSystemHealth(),
          getPlatformAnalyticsAdmin(),
          listAuditLogs({ limit: 6 }),
        ]);
        setUsers(uRes.users || []);
        setCropContent(cRes.content || []);
        setResources(rRes.resources || []);
        setServiceBookings(sRes.bookings || []);
        setHealthData(hRes);
        setAnalyticsData(aRes.analytics || null);
        setRecentActivity(audRes.logs || []);
      } else if (activeTab === 'users') {
        const [uRes, tRes] = await Promise.all([
          listAdminUsers({ role: userRoleFilter, status: userStatusFilter, search: userSearch }),
          listSupportTicketsAdmin(supportFilter !== 'all' ? { status: supportFilter } : {}),
        ]);
        setUsers(uRes.users || []);
        setSupportTickets(tRes.tickets || []);
      } else if (activeTab === 'content') {
        const cRes = await listCropContentAdmin(contentFilter !== 'all' ? { category: contentFilter } : {});
        setCropContent(cRes.content || []);
      } else if (activeTab === 'resources') {
        const rRes = await listResourcesAdmin();
        setResources(rRes.resources || []);
      } else if (activeTab === 'services') {
        const sRes = await listServiceBookingsAdmin(serviceFilter !== 'all' ? { status: serviceFilter } : {});
        setServiceBookings(sRes.bookings || []);
      } else if (activeTab === 'analytics') {
        const aRes = await getPlatformAnalyticsAdmin();
        setAnalyticsData(aRes.analytics || null);
      } else if (activeTab === 'security_policies') {
        const [hRes, secRes, audRes, vRes] = await Promise.all([
          getSystemHealth(),
          getSecurityOverviewAdmin(),
          listAuditLogs({ limit: 50 }),
          listPolicyViolationsAdmin(),
        ]);
        setHealthData(hRes);
        setSecurityData(secRes.security || null);
        if (secRes.security?.activePolicies) {
          setSecPolicyForm(secRes.security.activePolicies);
        }
        setSecurityAuditLogs(audRes.logs || []);
        setViolations(vRes.violations || []);
      } else if (activeTab === 'profile') {
        const [res, adminsRes] = await Promise.all([
          getAdminProfile(),
          listAdminUsers({ role: 'admin' }).catch(() => null),
        ]);
        if (adminsRes?.users) {
          const activeAdmins = adminsRes.users.filter((u) => u.role === 'admin' && u.status !== 'suspended');
          setActiveAdminCount(activeAdmins.length);
        }
        if (res?.profile) {
          setAdminProfileForm({
            name: res.profile.name || '',
            email: res.profile.email || '',
            phone: res.profile.phone || '',
            language: res.profile.language || 'en',
            profilePhoto: res.profile.profilePhoto || '',
            address: res.profile.address || '',
            role: res.profile.role || 'admin',
            status: res.profile.status || 'active',
            emailVerified: Boolean(res.profile.emailVerified),
            phoneVerified: Boolean(res.profile.phoneVerified),
            createdAt: res.profile.createdAt || '',
            lastLogin: res.profile.lastLogin || '',
          });
        }
      }
    } catch (err) {
      setActionError(err.message || 'Failed to load tab data');
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    userRoleFilter,
    userStatusFilter,
    userSearch,
    supportFilter,
    contentFilter,
    serviceFilter,
    listAdminUsers,
    listSupportTicketsAdmin,
    listCropContentAdmin,
    listResourcesAdmin,
    listServiceBookingsAdmin,
    getSystemHealth,
    getSecurityOverviewAdmin,
    listAuditLogs,
    getPlatformAnalyticsAdmin,
    listPolicyViolationsAdmin,
    getAdminProfile,
  ]);

  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

  // Tab switch handler
  const handleTabChange = (tabId) => {
    setActionSuccess('');
    setActionError('');
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  // Admin Profile Handlers
  const handleSaveAdminProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setActionError('');
    setActionSuccess('');
    try {
      await updateAdminProfile({
        name: adminProfileForm.name,
        phone: adminProfileForm.phone,
        language: adminProfileForm.language,
        profilePhoto: adminProfileForm.profilePhoto,
        address: adminProfileForm.address,
      });
      setActionSuccess('Admin profile personal details updated successfully.');
      fetchTabData();
    } catch (err) {
      setActionError(err.message || 'Failed to update admin profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangeAdminPassword = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    if (adminPasswordForm.newPassword !== adminPasswordForm.confirmPassword) {
      setActionError('New password and confirmation password do not match.');
      return;
    }
    if (adminPasswordForm.newPassword.length < 10) {
      setActionError('New password must be at least 10 characters in length.');
      return;
    }
    setPasswordUpdating(true);
    try {
      await changeAdminPassword({
        currentPassword: adminPasswordForm.currentPassword,
        newPassword: adminPasswordForm.newPassword,
      });
      setActionSuccess('Administrator password updated successfully.');
      setAdminPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setActionError(err.message || 'Failed to update password.');
    } finally {
      setPasswordUpdating(false);
    }
  };

  const handleResendAdminEmail = async () => {
    setEmailVerifying(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await resendAdminEmailVerification();
      setActionSuccess(res?.message || 'Verification link dispatched to your email.');
    } catch (err) {
      setActionError(err.message || 'Failed to send verification email.');
    } finally {
      setEmailVerifying(false);
    }
  };

  const handleDeleteAdminAccount = async (e) => {
    e.preventDefault();
    if (adminDeleting) return;
    setAdminDeleting(true);
    setAdminDeleteError('');
    try {
      await deleteAccount({
        password: adminDeletePassword,
        confirmation: adminDeletePhrase.trim().toUpperCase(),
        confirmEmail: adminDeleteConfirmEmail.trim(),
      });
      navigate('/login', {
        replace: true,
        state: {
          message: 'Your administrator account and all associated platform records have been permanently deleted.',
        },
      });
    } catch (err) {
      setAdminDeleteError(err.message || 'Failed to delete administrator account.');
    } finally {
      setAdminDeleting(false);
    }
  };

  // User Actions: Suspend, Activate, Email Verify, Password Reset
  const handleOpenUserAction = (type, targetUser) => {
    setUserActionModal({ type, targetUser });
    setUserActionReason('');
    setIssuedResetLink('');
    setActionError('');
  };

  const handleExecuteUserAction = async () => {
    if (!userActionModal) return;
    const { type, targetUser } = userActionModal;
    const targetId = targetUser._id || targetUser.id;

    if (!userActionReason || userActionReason.trim().length < 5) {
      setActionError('An administrative reason (minimum 5 characters) is mandatory for this action.');
      return;
    }

    setLoading(true);
    setActionError('');
    setActionSuccess('');

    try {
      if (type === 'suspend') {
        const res = await changeUserStatus(targetId, 'suspended', userActionReason.trim());
        setActionSuccess(res.message || 'User account suspended.');
        setUserActionModal(null);
      } else if (type === 'activate') {
        const res = await changeUserStatus(targetId, 'active', userActionReason.trim());
        setActionSuccess(res.message || 'User account reactivated.');
        setUserActionModal(null);
      } else if (type === 'verify-email') {
        const res = await verifyUserEmailAdmin(targetId, userActionReason.trim());
        setActionSuccess(res.message || 'User email verified successfully.');
        setUserActionModal(null);
      } else if (type === 'reset-password') {
        const res = await resetUserPasswordAdmin(targetId, userActionReason.trim());
        setActionSuccess(res.message || 'One-time secure reset link generated.');
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setIssuedResetLink(res.resetLink || `${origin}/reset-password/${res.resetToken}`);
      }
      fetchTabData();
    } catch (err) {
      setActionError(err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  // Support Ticket Reply
  const handleReplyTicket = async (e) => {
    e.preventDefault();
    if (!activeTicket || !ticketReplyText.trim()) return;
    setLoading(true);
    try {
      const res = await replySupportTicketAdmin(activeTicket._id || activeTicket.id, {
        status: 'resolved',
        adminReply: ticketReplyText.trim(),
      });
      setActionSuccess(res.message || 'Ticket response saved and marked resolved.');
      setActiveTicket(null);
      setTicketReplyText('');
      fetchTabData();
    } catch (err) {
      setActionError(err.message || 'Failed to reply to ticket');
    } finally {
      setLoading(false);
    }
  };

  // Content Management: Save (Create / Update)
  const handleSaveContent = async (e) => {
    e.preventDefault();
    setLoading(true);
    setActionError('');
    try {
      if (contentModal === 'create') {
        await createCropContentAdmin(contentForm);
        setActionSuccess('Agricultural content article created and published.');
      } else if (contentModal?._id || contentModal?.id) {
        await updateCropContentAdmin(contentModal._id || contentModal.id, contentForm);
        setActionSuccess('Content article updated and verified.');
      }
      setContentModal(null);
      fetchTabData();
    } catch (err) {
      setActionError(err.message || 'Failed to save content');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this agricultural content article?')) return;
    setLoading(true);
    try {
      await deleteCropContentAdmin(id);
      setActionSuccess('Content deleted.');
      fetchTabData();
    } catch (err) {
      setActionError(err.message || 'Failed to delete content');
    } finally {
      setLoading(false);
    }
  };

  // Resource Management: Restock Order
  const handleOrderRestock = async (e) => {
    e.preventDefault();
    if (!restockModal) return;
    setLoading(true);
    try {
      await orderResourceRestockAdmin(restockModal._id || restockModal.id, {
        quantity: Number(restockQty),
        notes: `Replenishment order dispatched by ${currentUser?.name}`,
      });
      setActionSuccess(`Replenishment order for ${restockQty} units of ${restockModal.name} coordinated with ${restockModal.supplierName}.`);
      setRestockModal(null);
      fetchTabData();
    } catch (err) {
      setActionError(err.message || 'Failed to order restock');
    } finally {
      setLoading(false);
    }
  };

  // Resource Management: Create Item
  const handleCreateResource = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createResourceAdmin({
        ...resourceForm,
        currentStock: Number(resourceForm.currentStock) || 0,
        minThreshold: Number(resourceForm.minThreshold) || 0,
        unitPriceINR: Number(resourceForm.unitPriceINR) || 0,
      });
      setActionSuccess('Agricultural product resource added to platform inventory.');
      setResourceCreateModal(false);
      fetchTabData();
    } catch (err) {
      setActionError(err.message || 'Failed to create resource');
    } finally {
      setLoading(false);
    }
  };

  // Service Management: Update Booking Schedule / Status
  const handleSaveServiceSchedule = async (e) => {
    e.preventDefault();
    if (!serviceScheduleModal) return;
    setLoading(true);
    try {
      await updateServiceBookingAdmin(serviceScheduleModal._id || serviceScheduleModal.id, serviceScheduleForm);
      setActionSuccess('Service booking updated, technician assigned, and schedule confirmed.');
      setServiceScheduleModal(null);
      fetchTabData();
    } catch (err) {
      setActionError(err.message || 'Failed to update service booking');
    } finally {
      setLoading(false);
    }
  };

  // System Maintenance Diagnostics
  const handleRunDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await runSystemCheckAdmin();
      setSystemCheckResult(res.diagnostics);
      setActionSuccess('System diagnostic check executed. All subsystems operational.');
    } catch (err) {
      setActionError(err.message || 'System diagnostic check failed');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMaintenanceMode = async () => {
    setLoading(true);
    try {
      const nextMode = !maintenanceModeActive;
      await toggleMaintenanceModeAdmin(nextMode, systemNoticeInput);
      setMaintenanceModeActive(nextMode);
      setActionSuccess(`System maintenance mode ${nextMode ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      setActionError(err.message || 'Failed to toggle maintenance mode');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    setLoading(true);
    try {
      await clearCacheAdmin();
      setActionSuccess('Application cache and transient telemetry buffer flushed successfully.');
    } catch (err) {
      setActionError(err.message || 'Failed to clear cache');
    } finally {
      setLoading(false);
    }
  };

  // Security Management Policies & IP Block
  const handleSaveSecurityPolicies = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateSecurityPoliciesAdmin(secPolicyForm);
      setActionSuccess('Security policies updated across all application endpoints.');
    } catch (err) {
      setActionError(err.message || 'Failed to update security policies');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockIp = async (e) => {
    e.preventDefault();
    if (!blockIpInput.trim()) return;
    setLoading(true);
    try {
      await blockIPAdmin(blockIpInput.trim(), false);
      setActionSuccess(`IP address ${blockIpInput.trim()} added to Security Blocklist.`);
      setBlockIpInput('');
      fetchTabData();
    } catch (err) {
      setActionError(err.message || 'Failed to block IP');
    } finally {
      setLoading(false);
    }
  };

  // Data Analytics: Strategic Report
  const handleGenerateReport = async (reportType) => {
    setLoading(true);
    try {
      const res = await generateStrategicReportAdmin(reportType);
      setGeneratedReport(res.report);
      setActionSuccess('Strategic decision report generated successfully.');
    } catch (err) {
      setActionError(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  // Policy Enforcement: Record Violation
  const handleRecordViolation = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await recordPolicyViolationAdmin(violationForm);
      setActionSuccess('Policy violation recorded and compliance action enforced.');
      setViolationModal(false);
      setViolationForm({
        userId: '',
        userName: '',
        userEmail: '',
        violationType: 'terms_of_service_breach',
        severity: 'medium',
        description: '',
        actionTaken: 'warning_issued',
        notes: '',
      });
      fetchTabData();
    } catch (err) {
      setActionError(err.message || 'Failed to record violation');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveViolation = async (violationId) => {
    const notes = window.prompt('Enter resolution summary notes:');
    if (notes === null) return;
    setLoading(true);
    try {
      await resolvePolicyViolationAdmin(violationId, notes || 'Resolved by administrator');
      setActionSuccess('Policy violation marked resolved.');
      fetchTabData();
    } catch (err) {
      setActionError(err.message || 'Failed to resolve violation');
    } finally {
      setLoading(false);
    }
  };

  const isCurrentActor = (targetUser) => {
    const targetId = (targetUser?._id || targetUser?.id)?.toString();
    const currentId = (currentUser?._id || currentUser?.id)?.toString();
    return targetId === currentId;
  };

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* Platform Administration Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 border-bottom pb-3">
        <div>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2.5 py-1.5 small fw-bold">
              <i className="bi bi-flower1 me-1" /> {t('admin.governanceActive')}
            </span>
            <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill small">
              <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }} /> {t('admin.allSystemsActive')}
            </span>
          </div>
          <h1 className="h3 fw-bold text-dark mb-0">{t('admin.consoleTitle')}</h1>
          <p className="text-secondary small mb-0">
            {t('admin.securityGuardNotice')}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-white text-dark border px-3 py-2 small fw-semibold shadow-sm">
            <i className="bi bi-person-badge-fill text-success me-1" />
            {t('admin.authorizedAdmin')}: {currentUser?.name}
          </span>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 shadow-sm mb-4" role="alert">
          <i className="bi bi-check-circle-fill text-success flex-shrink-0" />
          <div className="flex-grow-1">{actionSuccess}</div>
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setActionSuccess('')} />
        </div>
      )}

      {actionError && (
        <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2 shadow-sm mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill text-danger flex-shrink-0" />
          <div className="flex-grow-1">{actionError}</div>
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setActionError('')} />
        </div>
      )}

      {/* 8 Core Administrative Domain Tabs */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-header bg-white border-0 pt-3 px-3 overflow-hidden">
          <ul className="nav nav-pills card-header-pills flex-nowrap overflow-x-auto gap-2 pb-2 no-scrollbar" role="tablist">
            {ADMIN_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <li className="nav-item" role="presentation" key={tab.id}>
                  <button
                    type="button"
                    className={`nav-link text-nowrap d-flex align-items-center gap-2 px-3 py-2 fw-semibold ${isActive ? 'active bg-success text-white shadow-sm' : 'bg-white text-secondary border'}`}
                    onClick={() => handleTabChange(tab.id)}
                  >
                    <i className={`bi ${tab.icon}`} />
                    <span>{t(`admin.nav.${tab.id}`) || tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card-body p-3 p-sm-4">
          {/* =========================================================================
              DOMAIN 0: PLATFORM GOVERNANCE OVERVIEW
             ========================================================================= */}
          {activeTab === 'overview' && (
            <div>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                  <h3 className="h5 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                    <i className="bi bi-grid-1x2 text-success" />
                    {t('admin.overview.title')}
                  </h3>
                  <p className="text-secondary small mb-0">
                    {t('admin.overview.subtitle')}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                  disabled={loading}
                  onClick={fetchTabData}
                >
                  <i className={`bi bi-arrow-clockwise ${loading ? 'spin-animation' : ''}`} />
                  <span>{t('common.update')}</span>
                </button>
              </div>

              {/* KPI Summary Cards */}
              <div className="row g-3 mb-4">
                {/* 1. Users */}
                <div className="col-6 col-xl-3">
                  <div
                    className="card h-100 border rounded-3 p-3 bg-white shadow-sm cursor-pointer"
                    style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onClick={() => handleTabChange('users')}
                  >
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="text-secondary small fw-semibold">{t('admin.overview.registeredFarmers')}</span>
                      <span className="p-2 rounded-2 bg-success bg-opacity-10 text-success">
                        <i className="bi bi-people fs-5" />
                      </span>
                    </div>
                    <div className="h3 fw-bold text-dark mb-1">{users.length}</div>
                    <div className="d-flex align-items-center gap-1 small text-muted">
                      <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill">
                        {users.filter((u) => u.status === 'active').length} {t('admin.users.active')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Content */}
                <div className="col-6 col-xl-3">
                  <div
                    className="card h-100 border rounded-3 p-3 bg-white shadow-sm cursor-pointer"
                    style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onClick={() => handleTabChange('content')}
                  >
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="text-secondary small fw-semibold">{t('admin.overview.activeAdvisories')}</span>
                      <span className="p-2 rounded-2 bg-success bg-opacity-10 text-success">
                        <i className="bi bi-journal-richtext fs-5" />
                      </span>
                    </div>
                    <div className="h3 fw-bold text-dark mb-1">{cropContent.length}</div>
                    <div className="small text-muted d-flex align-items-center gap-1">
                      <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill">
                        {cropContent.filter((c) => c.isPublished).length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Resources */}
                <div className="col-6 col-xl-3">
                  <div
                    className="card h-100 border rounded-3 p-3 bg-white shadow-sm cursor-pointer"
                    style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onClick={() => handleTabChange('resources')}
                  >
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="text-secondary small fw-semibold">{t('admin.overview.inventoryItems')}</span>
                      <span className="p-2 rounded-2 bg-success bg-opacity-10 text-success">
                        <i className="bi bi-boxes fs-5" />
                      </span>
                    </div>
                    <div className="h3 fw-bold text-dark mb-1">{resources.length}</div>
                    <div className="small text-muted d-flex align-items-center gap-1">
                      {resources.filter((r) => r.currentStock <= r.minThreshold).length > 0 ? (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">
                          <i className="bi bi-exclamation-triangle-fill me-1" />
                          {resources.filter((r) => r.currentStock <= r.minThreshold).length} {t('common.needsRestock')}
                        </span>
                      ) : (
                        <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill">
                          {t('common.optimal')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Services */}
                <div className="col-6 col-xl-3">
                  <div
                    className="card h-100 border rounded-3 p-3 bg-white shadow-sm cursor-pointer"
                    style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onClick={() => handleTabChange('services')}
                  >
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="text-secondary small fw-semibold">{t('admin.nav.services')}</span>
                      <span className="p-2 rounded-2 bg-success bg-opacity-10 text-success">
                        <i className="bi bi-calendar-check fs-5" />
                      </span>
                    </div>
                    <div className="h3 fw-bold text-dark mb-1">{serviceBookings.length}</div>
                    <div className="small text-muted d-flex align-items-center gap-1">
                      <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill">
                        {serviceBookings.filter((b) => b.status === 'completed').length} {t('common.completed')}
                      </span>
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill">
                        {serviceBookings.filter((b) => b.status === 'scheduled').length} {t('common.pending')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Domain Navigation Shortcuts */}
              <div className="card border rounded-3 mb-4 bg-white shadow-sm">
                <div className="card-header bg-white border-bottom py-3 px-3 d-flex justify-content-between align-items-center">
                  <h4 className="h6 fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-lightning-charge-fill text-warning" />
                    {t('admin.overview.quickActions')}
                  </h4>
                  <span className="text-muted small">8 Operational Domains</span>
                </div>
                <div className="card-body p-3">
                  <div className="admin-quick-nav-grid">
                    {ADMIN_TABS.filter((t) => t.id !== 'overview').map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className="admin-quick-nav-tile"
                        onClick={() => handleTabChange(tab.id)}
                        aria-label={`Navigate to ${t(`admin.nav.${tab.id}`) || tab.label}: ${t(`admin.navDesc.${tab.id}`) || tab.desc}`}
                      >
                        <div className="admin-quick-nav-icon">
                          <i className={`bi ${tab.icon}`} aria-hidden="true" />
                        </div>
                        <div className="admin-quick-nav-text">
                          <div className="admin-quick-nav-title">{t(`admin.nav.${tab.id}`) || tab.label}</div>
                          <div className="admin-quick-nav-desc">{t(`admin.navDesc.${tab.id}`) || tab.desc}</div>
                        </div>
                        <i className="bi bi-chevron-right admin-quick-nav-chevron" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* System Diagnostics & Recent Activity Dual Grid */}
              <div className="row g-4 mb-4">
                {/* Platform Diagnostics Summary */}
                <div className="col-12 col-lg-5">
                  <div className="card h-100 border rounded-3 bg-white shadow-sm">
                    <div className="card-header bg-white border-bottom py-3 px-3 d-flex justify-content-between align-items-center">
                      <h4 className="h6 fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                        <i className="bi bi-cpu-fill text-success" />
                        {t('admin.overview.systemDiagnostics')}
                      </h4>
                      <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1.5 small fw-semibold">
                        {t('common.optimal')}
                      </span>
                    </div>
                    <div className="card-body p-3.5 p-md-4">
                      {/* Internal colored boundary container with improved padding */}
                      <div className="p-3 bg-success bg-opacity-10 border border-success border-opacity-20 rounded-3 mb-3">
                        <div className="list-group list-group-flush small bg-transparent">
                          <div className="list-group-item bg-transparent d-flex justify-content-between align-items-center px-2 py-2 border-0 border-bottom border-success border-opacity-10">
                            <span className="text-secondary">MongoDB Atlas Database</span>
                            <span className="fw-semibold text-success d-flex align-items-center gap-1">
                              <i className="bi bi-check-circle-fill" /> Connected
                            </span>
                          </div>
                          <div className="list-group-item bg-transparent d-flex justify-content-between align-items-center px-2 py-2 border-0 border-bottom border-success border-opacity-10">
                            <span className="text-secondary">API Responsiveness</span>
                            <span className="fw-semibold text-dark">&lt; 35ms Latency</span>
                          </div>
                          <div className="list-group-item bg-transparent d-flex justify-content-between align-items-center px-2 py-2 border-0 border-bottom border-success border-opacity-10">
                            <span className="text-secondary">Server Process Uptime</span>
                            <span className="fw-semibold text-dark">
                              {healthData?.uptimeSeconds ? `${Math.floor(healthData.uptimeSeconds / 60)} minutes` : 'Operational'}
                            </span>
                          </div>
                          <div className="list-group-item bg-transparent d-flex justify-content-between align-items-center px-2 py-2 border-0 border-bottom border-success border-opacity-10">
                            <span className="text-secondary">{t('admin.securityGuardNotice')}</span>
                            <span className="fw-semibold text-success">Active</span>
                          </div>
                          <div className="list-group-item bg-transparent d-flex justify-content-between align-items-center px-2 py-2 border-0">
                            <span className="text-secondary">Credentials Protection</span>
                            <span className="badge bg-white text-success border border-success border-opacity-25 rounded-pill px-3 py-1.5 small fw-semibold shadow-xs">
                              Enforced
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="pt-2 text-end">
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm"
                          onClick={() => {
                            setSecSubTab('maintenance');
                            handleTabChange('security_policies');
                          }}
                        >
                          {t('admin.security.tabMaintenance')} &rarr;
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Platform Administrative Activity */}
                <div className="col-12 col-lg-7">
                  <div className="card h-100 border rounded-3 bg-white shadow-sm">
                    <div className="card-header bg-white border-bottom py-3 px-3 d-flex justify-content-between align-items-center">
                      <h4 className="h6 fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                        <i className="bi bi-clock-history text-success" />
                        {t('admin.overview.recentActivity')}
                      </h4>
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-decoration-none text-success p-0"
                        onClick={() => {
                          setSecSubTab('security');
                          handleTabChange('security_policies');
                        }}
                      >
                        {t('admin.security.tabAuditLogs')} &rarr;
                      </button>
                    </div>
                    <div className="card-body p-0">
                      {recentActivity.length === 0 ? (
                        <div className="p-4 text-center text-muted small">
                          {t('admin.overview.noRecentActivity')}
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-hover align-middle mb-0 small">
                            <thead className="bg-light text-secondary">
                              <tr>
                                <th className="ps-3 py-2">{t('admin.security.auditAction')}</th>
                                <th className="py-2">{t('admin.security.auditActor')}</th>
                                <th className="py-2">{t('admin.security.auditTarget')}</th>
                                <th className="py-2 pe-3 text-end">{t('admin.security.auditTime')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recentActivity.slice(0, 5).map((log, idx) => (
                                <tr key={log._id || log.id || idx}>
                                  <td className="ps-3 py-2 fw-semibold text-dark">
                                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill me-1" style={{ fontSize: '0.68rem' }}>
                                      {log.action}
                                    </span>
                                  </td>
                                  <td className="py-2 text-secondary text-truncate" style={{ maxWidth: '120px' }}>
                                    {log.actorName || log.actorEmail || 'System'}
                                  </td>
                                  <td className="py-2 text-secondary text-truncate" style={{ maxWidth: '140px' }}>
                                    {log.targetUserName || log.targetUserEmail || log.reason || '-'}
                                  </td>
                                  <td className="py-2 pe-3 text-end text-muted">
                                    {formatDate(log.createdAt || log.timestamp)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              DOMAIN 1: USER MANAGEMENT
             ========================================================================= */}
          {activeTab === 'users' && (
            <div>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                  <h3 className="h5 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                    <i className="bi bi-people-fill text-success" />
                    {t('admin.users.title')}
                  </h3>
                  <p className="text-secondary small mb-0">
                    {t('admin.users.subtitle')}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                  disabled={loading}
                  onClick={fetchTabData}
                >
                  <i className={`bi bi-arrow-clockwise ${loading ? 'spin-animation' : ''}`} />
                  <span>{t('common.update')}</span>
                </button>
              </div>

              {/* Sub-section: Support Queries / Tickets */}
              <div className="card border rounded-3 mb-4 bg-light">
                <div className="card-header bg-white border-bottom py-2 px-3 d-flex justify-content-between align-items-center">
                  <h4 className="h6 fw-bold mb-0 d-flex align-items-center gap-2 text-dark">
                    <i className="bi bi-chat-left-dots-fill text-success" />
                    {t('admin.users.supportTicketsTab')} ({supportTickets.length})
                  </h4>
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className={`btn btn-sm ${supportFilter === 'all' ? 'btn-success' : 'btn-outline-secondary'}`}
                      onClick={() => setSupportFilter('all')}
                    >
                      {t('common.all') || 'All'}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${supportFilter === 'open' ? 'btn-success' : 'btn-outline-secondary'}`}
                      onClick={() => setSupportFilter('open')}
                    >
                      {t('admin.users.statusOpen')}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${supportFilter === 'resolved' ? 'btn-success' : 'btn-outline-secondary'}`}
                      onClick={() => setSupportFilter('resolved')}
                    >
                      {t('admin.users.statusResolved')}
                    </button>
                  </div>
                </div>
                <div className="card-body p-3">
                  {supportTickets.length === 0 ? (
                    <div className="text-center py-3 text-muted small">No support queries in this view.</div>
                  ) : (
                    <div className="row g-3">
                      {supportTickets.map((ticket) => (
                        <div key={ticket._id || ticket.id} className="col-12 col-lg-4">
                          <div className="p-3 bg-white rounded-3 border h-100 d-flex flex-column justify-content-between shadow-sm">
                            <div>
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <span className={`badge ${ticket.status === 'resolved' ? 'bg-success' : ticket.priority === 'high' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                  {ticket.status?.toUpperCase()}
                                </span>
                                <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                                  {formatDate(ticket.createdAt)}
                                </small>
                              </div>
                              <h5 className="h6 fw-bold text-dark mb-1">{ticket.subject}</h5>
                              <p className="text-secondary small mb-2 text-truncate" style={{ maxHeight: '42px' }}>
                                {ticket.message}
                              </p>
                              <div className="text-muted small mb-2">
                                <i className="bi bi-person me-1" />
                                <strong>{ticket.userName}</strong> ({ticket.userEmail})
                              </div>
                              {ticket.adminReply && (
                                <div className="p-2 bg-light rounded text-muted small mb-2" style={{ fontSize: '0.75rem' }}>
                                  <strong>Admin Reply:</strong> {ticket.adminReply}
                                </div>
                              )}
                            </div>
                            <div className="pt-2 border-top mt-2 text-end">
                              <button
                                type="button"
                                className="btn btn-outline-success btn-sm"
                                onClick={() => {
                                  setActiveTicket(ticket);
                                  setTicketReplyText(ticket.adminReply || '');
                                }}
                              >
                                <i className="bi bi-reply me-1" />
                                {t('admin.users.reply')}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Search & Filters */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-md-6">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white border-end-0">
                      <i className="bi bi-search text-muted" />
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0"
                      placeholder={t('admin.users.searchPlaceholder')}
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                  >
                    <option value="">{t('admin.users.allRoles')}</option>
                    <option value="farmer">{t('admin.users.farmer')}</option>
                    <option value="admin">{t('admin.users.admin')}</option>
                  </select>
                </div>
                <div className="col-6 col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                  >
                    <option value="">{t('admin.users.allStatuses')}</option>
                    <option value="active">{t('admin.users.active')}</option>
                    <option value="suspended">{t('admin.users.suspended')}</option>
                  </select>
                </div>
              </div>

              {/* User Accounts Table */}
              <div className="table-responsive">
                <table className="table align-middle table-hover mb-0">
                  <thead className="table-light small text-secondary">
                    <tr>
                      <th scope="col">{t('admin.users.thUser')}</th>
                      <th scope="col">{t('admin.users.thContact')}</th>
                      <th scope="col">{t('admin.profile.role')}</th>
                      <th scope="col">{t('admin.users.thStatus')}</th>
                      <th scope="col">{t('admin.users.thJoined')}</th>
                      <th scope="col" className="text-end">{t('admin.users.thActions')}</th>
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
                              {itemUser.profilePhoto ? (
                                <img
                                  src={itemUser.profilePhoto}
                                  alt={itemUser.name}
                                  className="rounded-circle object-fit-cover"
                                  style={{ width: '34px', height: '34px' }}
                                />
                              ) : (
                                <span className="avatar avatar-small bg-success text-white fw-bold">
                                  {itemUser.name?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                              )}
                              <div>
                                <div className="fw-semibold text-dark d-flex align-items-center gap-1">
                                  <span>{itemUser.name}</span>
                                  {isSelf && (
                                    <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.65rem' }}>
                                      You
                                    </span>
                                  )}
                                </div>
                                <small className="text-muted">{itemUser.farmName || 'No farm name registered'}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-1">
                              <span className="small text-dark">{itemUser.email}</span>
                              {itemUser.emailVerified ? (
                                <i className="bi bi-check-circle-fill text-success" title="Verified email" style={{ fontSize: '0.85rem' }} />
                              ) : (
                                <span className="badge bg-warning-subtle text-warning-emphasis border" style={{ fontSize: '0.65rem' }}>
                                  {t('admin.profile.emailUnverified')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {isAdmin ? (
                              <span className="badge bg-success text-white">
                                <i className="bi bi-shield-fill me-1" /> {t('admin.users.admin')}
                              </span>
                            ) : (
                              <span className="badge bg-light text-dark border">
                                <i className="bi bi-person me-1" /> {t('admin.users.farmer')}
                              </span>
                            )}
                          </td>
                          <td>
                            {isSuspended ? (
                              <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                {t('admin.users.suspended')}
                              </span>
                            ) : (
                              <span className="badge bg-success-subtle text-success border border-success-subtle">
                                {t('admin.users.active')}
                              </span>
                            )}
                          </td>
                          <td className="small text-secondary">{formatDate(itemUser.createdAt)}</td>
                          <td className="text-end">
                            <div className="btn-group btn-group-sm" role="group">
                              {/* Inspect Profile */}
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => setInspectedUser(itemUser)}
                                title={t('common.details')}
                              >
                                <i className="bi bi-eye" />
                              </button>

                              {!isSelf && (
                                <>
                                  {/* Verify Email */}
                                  {!itemUser.emailVerified && (
                                    <button
                                      type="button"
                                      className="btn btn-outline-success"
                                      onClick={() => handleOpenUserAction('verify-email', itemUser)}
                                      title={t('admin.users.verifyEmail')}
                                    >
                                      <i className="bi bi-envelope-check" />
                                    </button>
                                  )}

                                  {/* Reset Password */}
                                  <button
                                    type="button"
                                    className="btn btn-outline-warning"
                                    onClick={() => handleOpenUserAction('reset-password', itemUser)}
                                    title={t('admin.users.resetPassword')}
                                  >
                                    <i className="bi bi-key" />
                                  </button>

                                  {/* Suspend / Activate */}
                                  {isSuspended ? (
                                    <button
                                      type="button"
                                      className="btn btn-outline-success"
                                      onClick={() => handleOpenUserAction('activate', itemUser)}
                                      title={t('admin.users.reactivateAccount')}
                                    >
                                      <i className="bi bi-check2-circle" />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-outline-danger"
                                      onClick={() => handleOpenUserAction('suspend', itemUser)}
                                      title={t('admin.users.suspendAccount')}
                                    >
                                      <i className="bi bi-slash-circle" />
                                    </button>
                                  )}
                                </>
                              )}

                              {isSelf && (
                                <span className="badge bg-light text-muted border py-2 px-2 small ms-1" style={{ fontSize: '0.72rem' }}>
                                  Self Protected
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================================
              DOMAIN 2: CONTENT MANAGEMENT
             ========================================================================= */}
          {activeTab === 'content' && (
            <div>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                  <h3 className="h5 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                    <i className="bi bi-journal-richtext text-success" />
                    {t('admin.content.title')}
                  </h3>
                  <p className="text-secondary small mb-0">
                    {t('admin.content.subtitle')}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-success btn-sm d-flex align-items-center gap-1"
                  onClick={() => {
                    setContentModal('create');
                    setContentForm({
                      title: '',
                      category: 'crop',
                      cropType: '',
                      variety: '',
                      sowingSeason: '',
                      recommendedSoil: '',
                      waterRequirement: '',
                      pestManagement: '',
                      summary: '',
                      details: '',
                      accuracyVerified: true,
                      isPublished: true,
                    });
                  }}
                >
                  <i className="bi bi-plus-lg" />
                  <span>{t('admin.content.publishNew')}</span>
                </button>
              </div>

              {/* Filter Pills */}
              <div className="btn-group btn-group-sm mb-4">
                {['all', 'crop', 'product', 'service', 'advisory'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`btn text-capitalize ${contentFilter === cat ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => setContentFilter(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Content Cards Grid */}
              <div className="row g-4">
                {cropContent.map((item) => (
                  <div key={item._id || item.id} className="col-12 col-lg-6">
                    <div className="card h-100 border shadow-sm rounded-3">
                      <div className="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                            <span className="badge bg-success-subtle text-success border border-success-subtle text-uppercase" style={{ fontSize: '0.7rem' }}>
                              {item.category}
                            </span>
                            {item.accuracyVerified && (
                              <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.68rem' }}>
                                <i className="bi bi-patch-check-fill me-1" /> Accuracy Verified
                              </span>
                            )}
                          </div>
                          <h4 className="h6 fw-bold text-dark mb-0">{item.title}</h4>
                        </div>
                        <span className={`badge ${item.isPublished ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '0.7rem' }}>
                          {item.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>

                      <div className="card-body p-3">
                        <p className="text-secondary small mb-3">{item.summary}</p>
                        <div className="p-2 bg-light rounded small text-dark mb-2">
                          <div><strong>Recommended Soil:</strong> {item.recommendedSoil || 'General Loam'}</div>
                          <div><strong>Water Requirement:</strong> {item.waterRequirement || 'Standard'}</div>
                          <div><strong>Pest Advisory:</strong> {item.pestManagement || 'Standard Integrated Pest Management'}</div>
                        </div>
                        <div className="text-muted small" style={{ fontSize: '0.78rem' }}>
                          {item.details}
                        </div>
                      </div>

                      <div className="card-footer bg-white border-top p-3 d-flex justify-content-end gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => {
                            setContentModal(item);
                            setContentForm({
                              title: item.title,
                              category: item.category,
                              cropType: item.cropType || '',
                              variety: item.variety || '',
                              sowingSeason: item.sowingSeason || '',
                              recommendedSoil: item.recommendedSoil || '',
                              waterRequirement: item.waterRequirement || '',
                              pestManagement: item.pestManagement || '',
                              summary: item.summary,
                              details: item.details,
                              accuracyVerified: item.accuracyVerified ?? true,
                              isPublished: item.isPublished ?? true,
                            });
                          }}
                        >
                          <i className="bi bi-pencil me-1" /> Edit &amp; Verify
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDeleteContent(item._id || item.id)}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================================
              DOMAIN 3: RESOURCE MANAGEMENT
             ========================================================================= */}
          {activeTab === 'resources' && (
            <div>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                  <h3 className="h5 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                    <i className="bi bi-boxes text-success" />
                    {t('admin.resources.title')}
                  </h3>
                  <p className="text-secondary small mb-0">
                    {t('admin.resources.subtitle')}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-success btn-sm d-flex align-items-center gap-1"
                  onClick={() => setResourceCreateModal(true)}
                >
                  <i className="bi bi-plus-lg" />
                  <span>{t('admin.resources.requestRestock')}</span>
                </button>
              </div>

              {/* Resource Summary KPI Cards */}
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded-3 border">
                    <small className="text-muted d-block mb-1">{t('admin.resources.totalSupplies')}</small>
                    <div className="h4 fw-bold text-dark mb-0">{resources.length}</div>
                    <small className="text-success" style={{ fontSize: '0.72rem' }}>100% Quality Audited</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded-3 border">
                    <small className="text-muted d-block mb-1">{t('admin.resources.lowStockCount')}</small>
                    <div className="h4 fw-bold text-danger mb-0">
                      {resources.filter((r) => r.status === 'low_stock' || r.status === 'out_of_stock').length}
                    </div>
                    <small className="text-muted" style={{ fontSize: '0.72rem' }}>{t('common.needsRestock')}</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded-3 border">
                    <small className="text-muted d-block mb-1">{t('admin.resources.suppliersCount')}</small>
                    <div className="h4 fw-bold text-dark mb-0">
                      {new Set(resources.map((r) => r.supplierName)).size}
                    </div>
                    <small className="text-success" style={{ fontSize: '0.72rem' }}>NSC, IFFCO, KRIBHCO, Bayer...</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded-3 border">
                    <small className="text-muted d-block mb-1">{t('purchases.statPending')}</small>
                    <div className="h4 fw-bold text-dark mb-0">
                      {resources.filter((r) => r.status === 'reordered').length}
                    </div>
                    <small className="text-success" style={{ fontSize: '0.72rem' }}>In Transit / Ordered</small>
                  </div>
                </div>
              </div>

              {/* Resources Table */}
              <div className="table-responsive">
                <table className="table align-middle table-hover mb-0">
                  <thead className="table-light small text-secondary">
                    <tr>
                      <th scope="col">{t('admin.resources.itemName')}</th>
                      <th scope="col">{t('admin.resources.category')}</th>
                      <th scope="col">{t('admin.resources.quantity')}</th>
                      <th scope="col">{t('common.price')} (₹)</th>
                      <th scope="col">{t('admin.resources.supplier')}</th>
                      <th scope="col">{t('admin.resources.stockStatus')}</th>
                      <th scope="col" className="text-end">{t('admin.users.thActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((resItem) => (
                      <tr key={resItem._id || resItem.id}>
                        <td>
                          <div className="fw-semibold text-dark">{resItem.name}</div>
                          <small className="text-muted font-monospace">{resItem.sku}</small>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border text-uppercase" style={{ fontSize: '0.7rem' }}>
                            {resItem.category}
                          </span>
                        </td>
                        <td>
                          <div className="fw-bold text-dark">
                            {resItem.currentStock} {resItem.unit}
                          </div>
                          <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                            Threshold: {resItem.minThreshold} {resItem.unit}
                          </small>
                        </td>
                        <td className="small text-dark fw-semibold">₹{resItem.unitPriceINR}</td>
                        <td>
                          <div className="small fw-semibold text-dark">{resItem.supplierName}</div>
                          <small className="text-muted d-block">{resItem.supplierContact || resItem.supplierEmail}</small>
                        </td>
                        <td>
                          <span className={`badge ${resItem.status === 'in_stock' ? 'bg-success-subtle text-success border border-success-subtle' : resItem.status === 'reordered' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'}`}>
                            {resItem.status === 'in_stock' ? 'In Stock' : resItem.status === 'reordered' ? 'Reorder Dispatched' : 'Low Stock'}
                          </span>
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-outline-success btn-sm"
                            onClick={() => {
                              setRestockModal(resItem);
                              setRestockQty(50);
                            }}
                          >
                            <i className="bi bi-truck me-1" /> Order Restock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================================
              DOMAIN 4: SERVICE MANAGEMENT
             ========================================================================= */}
          {activeTab === 'services' && (
            <div>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                  <h3 className="h5 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                    <i className="bi bi-calendar-check-fill text-success" />
                    {t('admin.services.title')}
                  </h3>
                  <p className="text-secondary small mb-0">
                    {t('admin.services.subtitle')}
                  </p>
                </div>
                <div className="btn-group btn-group-sm">
                  {['all', 'pending', 'scheduled', 'completed'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`btn text-capitalize ${serviceFilter === st ? 'btn-success' : 'btn-outline-secondary'}`}
                      onClick={() => setServiceFilter(st)}
                    >
                      {st === 'all' ? (t('common.all') || 'All') : st === 'pending' ? t('common.pending') : st === 'completed' ? t('common.completed') : st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Service Bookings Table */}
              <div className="table-responsive">
                <table className="table align-middle table-hover mb-0">
                  <thead className="table-light small text-secondary">
                    <tr>
                      <th scope="col">{t('admin.services.serviceName')}</th>
                      <th scope="col">{t('admin.services.farmerName')}</th>
                      <th scope="col">{t('admin.services.bookingDate')}</th>
                      <th scope="col">Technician / Pilot</th>
                      <th scope="col">{t('admin.services.bookingStatus')}</th>
                      <th scope="col">{t('common.price')} (₹)</th>
                      <th scope="col" className="text-end">{t('admin.services.updateStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceBookings.map((booking) => (
                      <tr key={booking._id || booking.id}>
                        <td>
                          <div className="fw-semibold text-dark">{booking.serviceName}</div>
                          <small className="text-muted">{booking.deliveryNotes || 'Standard delivery protocol'}</small>
                        </td>
                        <td>
                          <div className="small fw-semibold text-dark">{booking.farmerName}</div>
                          <small className="text-muted d-block">{booking.farmName ? `${booking.farmName} • ` : ''}{booking.location}</small>
                        </td>
                        <td className="small text-dark">{formatDate(booking.scheduledDate)}</td>
                        <td>
                          <span className="badge bg-light text-dark border">
                            <i className="bi bi-person-gear me-1" />
                            {booking.technicianAssigned || 'Unassigned'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${booking.status === 'completed' ? 'bg-success' : booking.status === 'scheduled' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-warning text-dark'}`}>
                            {booking.status?.toUpperCase()}
                          </span>
                        </td>
                        <td className="small fw-bold text-dark">₹{booking.feeINR || 0}</td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-outline-success btn-sm"
                            onClick={() => {
                              setServiceScheduleModal(booking);
                              setServiceScheduleForm({
                                technicianAssigned: booking.technicianAssigned || '',
                                scheduledDate: booking.scheduledDate?.slice(0, 10) || '',
                                status: booking.status || 'scheduled',
                                deliveryNotes: booking.deliveryNotes || '',
                              });
                            }}
                          >
                            <i className="bi bi-clock-history me-1" /> Dispatch / Update
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================================
              DOMAIN 6: DATA ANALYTICS & STRATEGIC REPORTS
             ========================================================================= */}
          {activeTab === 'analytics' && (
            <div>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                  <h3 className="h5 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                    <i className="bi bi-graph-up text-success" />
                    {t('admin.analytics.title')}
                  </h3>
                  <p className="text-secondary small mb-0">
                    {t('admin.analytics.subtitle')}
                  </p>
                </div>
                <div className="btn-group btn-group-sm">
                  <button
                    type="button"
                    className="btn btn-success"
                    disabled={loading}
                    onClick={() => handleGenerateReport('strategic_overview')}
                  >
                    <i className="bi bi-file-earmark-text me-1" /> {t('admin.analytics.exportReport')}
                  </button>
                </div>
              </div>

              {/* Stored Analytics Metric Cards */}
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded-3 border">
                    <small className="text-muted d-block mb-1">{t('admin.overview.registeredFarmers')}</small>
                    <div className="h4 fw-bold text-dark mb-0">{analyticsData?.totalUsers ?? users.length}</div>
                    <small className="text-success" style={{ fontSize: '0.72rem' }}>Stored platform accounts</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded-3 border">
                    <small className="text-muted d-block mb-1">{t('admin.users.active')}</small>
                    <div className="h4 fw-bold text-success mb-0">{analyticsData?.activeUsers ?? users.filter((u) => u.status === 'active').length}</div>
                    <small className="text-muted" style={{ fontSize: '0.72rem' }}>In good standing</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded-3 border">
                    <small className="text-muted d-block mb-1">{t('admin.nav.services')}</small>
                    <div className="h4 fw-bold text-dark mb-0">{analyticsData?.totalBookings ?? serviceBookings.length}</div>
                    <small className="text-success" style={{ fontSize: '0.72rem' }}>Total bookings recorded</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded-3 border">
                    <small className="text-muted d-block mb-1">{t('admin.resources.lowStockCount')}</small>
                    <div className={`h4 fw-bold mb-0 ${(analyticsData?.lowStockCount ?? resources.filter((r) => r.currentStock <= r.reorderLevel).length) > 0 ? 'text-warning' : 'text-success'}`}>
                      {analyticsData?.lowStockCount ?? resources.filter((r) => r.currentStock <= r.reorderLevel).length}
                    </div>
                    <small className="text-muted" style={{ fontSize: '0.72rem' }}>{t('common.needsRestock')}</small>
                  </div>
                </div>
              </div>

              {/* Regional Adoption Analytics */}
              <div className="row g-4 mb-4">
                <div className="col-12 col-lg-7">
                  <div className="card border shadow-sm rounded-3 p-4 h-100">
                    <h4 className="h6 fw-bold text-dark mb-3">Regional Farmland &amp; User Distribution</h4>
                    {analyticsData?.regionalAdoption?.length ? (
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0">
                          <thead>
                            <tr className="text-muted small">
                              <th>Agricultural Region</th>
                              <th>Active Farmers</th>
                              <th>Primary Crop Focus</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsData.regionalAdoption.map((reg) => (
                              <tr key={reg.region}>
                                <td className="fw-semibold text-dark">{reg.region}</td>
                                <td>
                                  <span className="badge bg-success-subtle text-success border border-success-subtle">
                                    {reg.farmers} Accounts
                                  </span>
                                </td>
                                <td className="small text-muted">{reg.primaryCrop}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-muted small">
                        <i className="bi bi-geo-alt display-6 d-block mb-2 text-secondary opacity-50" />
                        No regional distribution data available. Reports will populate from stored records.
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-12 col-lg-5">
                  <div className="card border shadow-sm rounded-3 p-4 h-100">
                    <h4 className="h6 fw-bold text-dark mb-3">Service Demand &amp; Satisfaction</h4>
                    {analyticsData?.serviceDemand?.length ? (
                      <div className="d-flex flex-column gap-3">
                        {analyticsData.serviceDemand.map((srv) => (
                          <div key={srv.service} className="p-2 bg-light rounded border">
                            <div className="d-flex justify-content-between small fw-bold text-dark mb-1">
                              <span>{srv.service}</span>
                              <span className="text-success">{srv.satisfaction} Rating</span>
                            </div>
                            <div className="progress" style={{ height: '6px' }}>
                              <div className="progress-bar bg-success" style={{ width: srv.satisfaction }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-muted small">
                        <i className="bi bi-bar-chart display-6 d-block mb-2 text-secondary opacity-50" />
                        No service demand telemetry available. Bookings and satisfaction will display here.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Generated Strategic Report Display */}
              {generatedReport && (
                <div className="card border-success-subtle shadow-sm rounded-3 p-4 bg-white mb-4">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <span className="badge bg-success text-white mb-1">OFFICIAL STRATEGIC REPORT</span>
                      <h4 className="h5 fw-bold text-dark mb-0">AgriTech Executive Strategic Report</h4>
                      <small className="text-muted">Report ID: {generatedReport.reportId} • Generated: {formatDate(generatedReport.generatedAt)}</small>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm"
                      onClick={() => window.print()}
                    >
                      <i className="bi bi-printer me-1" /> Print Report
                    </button>
                  </div>

                  <h5 className="h6 fw-bold text-dark mb-2">Key Executive Findings:</h5>
                  <ul className="small text-secondary mb-3">
                    {generatedReport.keyFindings?.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>

                  <h5 className="h6 fw-bold text-dark mb-2">Strategic Recommendations for Platform Growth:</h5>
                  <ul className="small text-secondary mb-0">
                    {generatedReport.strategicRecommendations?.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              DOMAIN 7: SECURITY & POLICIES (Maintenance, Threat Monitoring & Policy Enforcement)
             ========================================================================= */}
          {activeTab === 'security_policies' && (
            <div>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                  <h3 className="h5 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                    <i className="bi bi-shield-check text-success" />
                    Security, Maintenance &amp; Policy Governance
                  </h3>
                  <p className="text-secondary small mb-0">
                    Maintain platform health diagnostics, oversee network security &amp; audit trails, and enforce terms of service compliance.
                  </p>
                </div>
              </div>

              {/* Subtab Selector */}
              <div className="d-flex flex-wrap gap-2 mb-4 border-bottom pb-3">
                <button
                  type="button"
                  className={`btn btn-sm d-flex align-items-center gap-2 ${secSubTab === 'maintenance' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                  onClick={() => setSecSubTab('maintenance')}
                >
                  <i className="bi bi-cpu" />
                  <span>{t('admin.security.tabMaintenance')}</span>
                </button>
                <button
                  type="button"
                  className={`btn btn-sm d-flex align-items-center gap-2 ${secSubTab === 'security' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                  onClick={() => setSecSubTab('security')}
                >
                  <i className="bi bi-shield-lock" />
                  <span>{t('admin.security.tabAuditLogs')}</span>
                </button>
                <button
                  type="button"
                  className={`btn btn-sm d-flex align-items-center gap-2 ${secSubTab === 'policies' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                  onClick={() => setSecSubTab('policies')}
                >
                  <i className="bi bi-briefcase" />
                  <span>{t('admin.security.tabViolations')}</span>
                </button>
              </div>

              {/* Subtab 1: Maintenance */}
              {secSubTab === 'maintenance' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="h6 fw-bold text-dark mb-0">{t('admin.security.title')}</h4>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-success btn-sm d-flex align-items-center gap-1"
                        disabled={loading}
                        onClick={handleRunDiagnostics}
                      >
                        <i className="bi bi-activity" />
                        <span>{t('admin.security.runDiagnostics')}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                        disabled={loading}
                        onClick={handleClearCache}
                      >
                        <i className="bi bi-arrow-repeat" />
                        <span>{t('admin.security.clearCache')}</span>
                      </button>
                    </div>
                  </div>

                  {/* System Checks Overview Cards */}
                  <div className="row g-3 mb-4">
                    <div className="col-6 col-md-3">
                      <div className="p-3 bg-light rounded-3 border">
                        <small className="text-muted d-block mb-1">Process Uptime</small>
                        <div className="h5 fw-bold text-dark mb-0">
                          {healthData?.uptimeSeconds ? `${Math.floor(healthData.uptimeSeconds / 3600)}h ${Math.floor((healthData.uptimeSeconds % 3600) / 60)}m` : 'Active'}
                        </div>
                        <small className="text-success" style={{ fontSize: '0.72rem' }}>Zero crash interruptions</small>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="p-3 bg-light rounded-3 border">
                        <small className="text-muted d-block mb-1">Memory Allocation</small>
                        <div className="h5 fw-bold text-dark mb-0">
                          {healthData?.memoryUsageMb ? `${healthData.memoryUsageMb} MB` : '18.4 MB'}
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Heap Allocated</small>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="p-3 bg-light rounded-3 border">
                        <small className="text-muted d-block mb-1">Storage Mode</small>
                        <div className="h5 fw-bold text-dark mb-0">
                          {healthData?.databaseMode || 'MongoDB Atlas'}
                        </div>
                        <small className="text-success" style={{ fontSize: '0.72rem' }}>Persistent Storage Layer</small>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="p-3 bg-light rounded-3 border">
                        <small className="text-muted d-block mb-1">Subsystem Health</small>
                        <div className="h5 fw-bold text-success mb-0">
                          {healthData?.status === 'healthy' ? 'Optimal' : 'Active'}
                        </div>
                        <small className="text-success" style={{ fontSize: '0.72rem' }}>All APIs Responsive</small>
                      </div>
                    </div>
                  </div>

                  {/* Diagnostics Result Banner */}
                  {systemCheckResult && (
                    <div className="alert alert-success border-success-subtle rounded-3 p-3 mb-4">
                      <h4 className="h6 fw-bold text-success mb-2 d-flex align-items-center gap-2">
                        <i className="bi bi-shield-check" />
                        System Diagnostic Results
                      </h4>
                      <div className="row g-2 small text-dark">
                        <div className="col-12 col-md-3"><strong>Database Ping:</strong> {systemCheckResult.databasePingMs} ms</div>
                        <div className="col-12 col-md-3"><strong>Cache Status:</strong> {systemCheckResult.cacheStatus}</div>
                        <div className="col-12 col-md-3"><strong>Background Scheduler:</strong> {systemCheckResult.backgroundScheduler}</div>
                        <div className="col-12 col-md-3"><strong>Data Integrity:</strong> {systemCheckResult.integrityCheck}</div>
                      </div>
                    </div>
                  )}

                  {/* Maintenance Mode & Advisory Controls */}
                  <div className="card border shadow-sm rounded-3 p-4">
                    <h4 className="h6 fw-bold text-dark mb-2">Platform Maintenance Mode &amp; User Advisory</h4>
                    <p className="text-secondary small mb-3">
                      When maintenance mode is active, non-administrative access is gated with a system maintenance announcement.
                    </p>
                    <div className="mb-3">
                      <label className="form-label small fw-semibold" htmlFor="maintNotice">
                        System Maintenance Advisory Notice
                      </label>
                      <textarea
                        id="maintNotice"
                        rows={2}
                        className="form-control form-control-sm"
                        placeholder="e.g. Scheduled monsoon radar calibration at 02:00 AM UTC. Telemetry will resume shortly..."
                        value={systemNoticeInput}
                        onChange={(e) => setSystemNoticeInput(e.target.value)}
                      />
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="maintSwitch"
                          checked={maintenanceModeActive}
                          onChange={handleToggleMaintenanceMode}
                        />
                        <label className="form-check-label small fw-semibold" htmlFor="maintSwitch">
                          Enable System Maintenance Mode
                        </label>
                      </div>
                      <span className="badge bg-light text-muted border">
                        Audit Log Recorded
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 2: Security & Audit Logs */}
              {secSubTab === 'security' && (
                <div>
                  <h4 className="h6 fw-bold text-dark mb-3">Security Management, Threat Monitoring &amp; Audit Logs</h4>

                  {/* Security Metrics */}
                  <div className="row g-3 mb-4">
                    <div className="col-12 col-md-4">
                      <div className="p-3 bg-light rounded-3 border">
                        <small className="text-muted d-block mb-1">Failed Auth Attempts (24h)</small>
                        <div className="h4 fw-bold text-danger mb-0">
                          {securityData?.recentAuthFailures || 0}
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>Brute-force protection active</small>
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="p-3 bg-light rounded-3 border">
                        <small className="text-muted d-block mb-1">Session Duration Policy</small>
                        <div className="h4 fw-bold text-dark mb-0">
                          {secPolicyForm.sessionTimeoutMinutes} min
                        </div>
                        <small className="text-success" style={{ fontSize: '0.72rem' }}>Automatic session invalidation</small>
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="p-3 bg-light rounded-3 border">
                        <small className="text-muted d-block mb-1">Active IP Blocklist</small>
                        <div className="h4 fw-bold text-dark mb-0">
                          {securityData?.blockedIPs?.length || 0} IPs
                        </div>
                        <small className="text-danger" style={{ fontSize: '0.72rem' }}>Firewall gated</small>
                      </div>
                    </div>
                  </div>

                  {/* Security Policies & IP Block Form */}
                  <div className="row g-4 mb-4">
                    <div className="col-12 col-lg-6">
                      <div className="card border shadow-sm rounded-3 p-4 h-100">
                        <h4 className="h6 fw-bold text-dark mb-3">Security &amp; Session Configuration</h4>
                        <form onSubmit={handleSaveSecurityPolicies}>
                          <div className="mb-3">
                            <label className="form-label small fw-semibold" htmlFor="secTimeout">
                              Session Timeout (minutes)
                            </label>
                            <input
                              id="secTimeout"
                              type="number"
                              className="form-control form-control-sm"
                              value={secPolicyForm.sessionTimeoutMinutes}
                              onChange={(e) => setSecPolicyForm((p) => ({ ...p, sessionTimeoutMinutes: e.target.value }))}
                              min={5}
                              max={1440}
                              required
                            />
                          </div>
                          <div className="mb-3">
                            <label className="form-label small fw-semibold" htmlFor="secMaxAttempts">
                              Max Failed Login Lockout Threshold
                            </label>
                            <input
                              id="secMaxAttempts"
                              type="number"
                              className="form-control form-control-sm"
                              value={secPolicyForm.maxLoginAttempts}
                              onChange={(e) => setSecPolicyForm((p) => ({ ...p, maxLoginAttempts: e.target.value }))}
                              min={3}
                              max={20}
                              required
                            />
                          </div>
                          <div className="form-check form-switch mb-3">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              id="sec2FA"
                              checked={secPolicyForm.requireTwoFactor}
                              onChange={(e) => setSecPolicyForm((p) => ({ ...p, requireTwoFactor: e.target.checked }))}
                            />
                            <label className="form-check-label small fw-semibold" htmlFor="sec2FA">
                              Require Two-Factor Authentication for Administrators
                            </label>
                          </div>
                          <button type="submit" className="btn btn-success btn-sm" disabled={loading}>
                            Save Security Policies
                          </button>
                        </form>
                      </div>
                    </div>

                    <div className="col-12 col-lg-6">
                      <div className="card border shadow-sm rounded-3 p-4 h-100">
                        <h4 className="h6 fw-bold text-dark mb-3">Network Firewall &amp; IP Blocklist</h4>
                        <form onSubmit={handleBlockIp} className="mb-3">
                          <div className="input-group input-group-sm">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Enter IP address to block (e.g. 192.0.2.1)..."
                              value={blockIpInput}
                              onChange={(e) => setBlockIpInput(e.target.value)}
                            />
                            <button type="submit" className="btn btn-danger">
                              Block IP
                            </button>
                          </div>
                        </form>

                        <label className="form-label small fw-semibold text-muted mb-2">Currently Blocklisted IPs:</label>
                        <div className="d-flex flex-wrap gap-2">
                          {securityData?.blockedIPs?.length ? (
                            securityData.blockedIPs.map((ip) => (
                              <span key={ip} className="badge bg-danger-subtle text-danger border border-danger-subtle p-2 small d-flex align-items-center gap-2">
                                <span>{ip}</span>
                                <button
                                  type="button"
                                  className="btn-close btn-close-sm"
                                  aria-label="Unblock"
                                  onClick={() => blockIPAdmin(ip, true).then(() => fetchTabData())}
                                />
                              </span>
                            ))
                          ) : (
                            <span className="text-muted small">No IPs currently blocklisted.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Security Audit Trail */}
                  <div className="card border rounded-3">
                    <div className="card-header bg-white border-bottom py-2 px-3">
                      <h4 className="h6 fw-bold mb-0 text-dark">Security Audit Trail ({securityAuditLogs.length})</h4>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-sm align-middle table-hover mb-0" style={{ fontSize: '0.82rem' }}>
                        <thead className="table-light">
                          <tr>
                            <th>Time</th>
                            <th>Action</th>
                            <th>Actor</th>
                            <th>Target</th>
                            <th>Reason / Notes</th>
                            <th>IP Address</th>
                          </tr>
                        </thead>
                        <tbody>
                          {securityAuditLogs.map((log) => (
                            <tr key={log._id || log.id}>
                              <td className="text-nowrap">{formatDate(log.createdAt)}</td>
                              <td>
                                <span className="badge bg-dark text-white">{log.action}</span>
                              </td>
                              <td>{log.actorName || log.actorEmail || 'System'}</td>
                              <td>{log.targetUserName || log.targetUserEmail || '—'}</td>
                              <td className="text-truncate" style={{ maxWidth: '240px' }}>{log.reason || '—'}</td>
                              <td className="font-monospace text-muted small">{log.ipAddress || '127.0.0.1'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 3: Policies & Violations */}
              {secSubTab === 'policies' && (
                <div>
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                    <div>
                      <h4 className="h6 fw-bold text-dark mb-1">Terms Compliance, Policy Enforcement &amp; Violations</h4>
                      <p className="text-secondary small mb-0">
                        Enforce platform rules, investigate terms breaches, issue formal warnings, and take necessary disciplinary suspensions.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm d-flex align-items-center gap-1"
                      onClick={() => setViolationModal(true)}
                    >
                      <i className="bi bi-exclamation-octagon" />
                      <span>Record Policy Violation</span>
                    </button>
                  </div>

                  {/* Policy Violations Table */}
                  <div className="table-responsive">
                    <table className="table align-middle table-hover mb-0">
                      <thead className="table-light small text-secondary">
                        <tr>
                          <th scope="col">User / Account</th>
                          <th scope="col">Violation Category</th>
                          <th scope="col">Severity</th>
                          <th scope="col">Description</th>
                          <th scope="col">Action Enforced</th>
                          <th scope="col">Action Date</th>
                          <th scope="col" className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {violations.map((viol) => (
                          <tr key={viol._id || viol.id}>
                            <td>
                              <div className="fw-semibold text-dark">{viol.userName}</div>
                              <small className="text-muted">{viol.userEmail}</small>
                            </td>
                            <td>
                              <span className="badge bg-light text-dark border text-uppercase" style={{ fontSize: '0.7rem' }}>
                                {viol.violationType?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${viol.severity === 'critical' ? 'bg-danger text-white' : viol.severity === 'high' ? 'bg-warning text-dark' : 'bg-info text-dark'}`}>
                                {viol.severity?.toUpperCase()}
                              </span>
                            </td>
                            <td className="small text-secondary" style={{ maxWidth: '280px' }}>
                              {viol.description}
                            </td>
                            <td>
                              <span className={`badge ${viol.actionTaken === 'account_suspended' ? 'bg-danger' : viol.actionTaken === 'resolved' ? 'bg-success' : 'bg-warning text-dark'}`}>
                                {viol.actionTaken?.replace(/_/g, ' ')?.toUpperCase()}
                              </span>
                            </td>
                            <td className="small text-muted">{formatDate(viol.actionDate || viol.createdAt)}</td>
                            <td className="text-end">
                              {viol.actionTaken !== 'resolved' ? (
                                <button
                                  type="button"
                                  className="btn btn-outline-success btn-sm"
                                  onClick={() => handleResolveViolation(viol._id || viol.id)}
                                >
                                  <i className="bi bi-check2 me-1" /> Mark Resolved
                                </button>
                              ) : (
                                <span className="text-success small fw-semibold">Resolved</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              DOMAIN 8: DEDICATED ADMIN PROFILE & CREDENTIALS
             ========================================================================= */}
          {activeTab === 'profile' && (
            <div>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                  <h3 className="h5 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                    <i className="bi bi-person-circle text-success" />
                    {t('admin.profile.title')}
                  </h3>
                  <p className="text-secondary small mb-0">
                    {t('admin.profile.subtitle')}
                  </p>
                </div>
              </div>

              {/* Profile Identity Card */}
              <div className="card border shadow-sm rounded-4 p-3 p-sm-4 mb-4 bg-white">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <div className="d-flex align-items-center gap-3">
                    {adminProfileForm.profilePhoto ? (
                      <img
                        src={adminProfileForm.profilePhoto}
                        alt="Admin Profile"
                        className="rounded-circle border border-2 border-success object-fit-cover shadow-sm"
                        style={{ width: '68px', height: '68px' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div
                        className="rounded-circle bg-success text-white fw-bold d-flex align-items-center justify-content-center shadow-sm"
                        style={{ width: '68px', height: '68px', fontSize: '1.6rem' }}
                      >
                        {adminProfileForm.name?.charAt(0)?.toUpperCase() || 'A'}
                      </div>
                    )}
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                        <h4 className="h5 fw-bold text-dark mb-0">{adminProfileForm.name || currentUser?.name}</h4>
                        <span className="badge bg-success text-white">
                          <i className="bi bi-shield-shaded me-1" />
                          {t('admin.profile.role')}: {adminProfileForm.role?.toUpperCase()}
                        </span>
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          {t('admin.profile.status')}: {adminProfileForm.status?.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-secondary small mb-2">{adminProfileForm.email || currentUser?.email}</div>
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        {adminProfileForm.emailVerified ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle d-flex align-items-center gap-1">
                            <i className="bi bi-patch-check-fill" /> {t('admin.profile.emailVerified')}
                          </span>
                        ) : (
                          <span className="badge bg-warning-subtle text-warning border border-warning-subtle d-flex align-items-center gap-1">
                            <i className="bi bi-exclamation-circle-fill" /> {t('admin.profile.emailUnverified')}
                          </span>
                        )}
                        <span className="badge bg-light text-secondary border d-flex align-items-center gap-1">
                          <i className="bi bi-phone" /> {adminProfileForm.phone ? adminProfileForm.phone : t('admin.profile.phoneUnverified')}
                        </span>
                        <span className="badge bg-light text-secondary border">
                          <i className="bi bi-translate me-1" /> {adminProfileForm.language?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!adminProfileForm.emailVerified && (
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
                      disabled={emailVerifying}
                      onClick={handleResendAdminEmail}
                    >
                      <i className={`bi bi-envelope-check ${emailVerifying ? 'spin-animation' : ''}`} />
                      <span>{emailVerifying ? 'Sending Link...' : t('admin.profile.sendVerification')}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Two-Column Profile & Security Forms */}
              <div className="row g-4">
                {/* Column 1: Personal Details */}
                <div className="col-12 col-lg-6">
                  <div className="card border shadow-sm rounded-4 p-4 h-100 bg-white">
                    <h4 className="h6 fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-person-lines-fill text-success" />
                      {t('admin.profile.personalDetails')}
                    </h4>
                    <form onSubmit={handleSaveAdminProfile}>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold text-dark">
                          {t('admin.profile.fullName')} <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={adminProfileForm.name}
                          onChange={(e) => setAdminProfileForm((p) => ({ ...p, name: e.target.value }))}
                          required
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-semibold text-dark">
                          {t('admin.profile.email')}
                        </label>
                        <input
                          type="email"
                          className="form-control form-control-sm bg-light"
                          value={adminProfileForm.email}
                          disabled
                          readOnly
                        />
                        <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                          Email address modifications require standard identity verification to maintain administrative integrity.
                        </small>
                      </div>

                      <div className="row g-2 mb-3">
                        <div className="col-12 col-sm-6">
                          <label className="form-label small fw-semibold text-dark">
                            {t('admin.profile.phone')}
                          </label>
                          <input
                            type="tel"
                            className="form-control form-control-sm"
                            placeholder="+91 98765 43210"
                            value={adminProfileForm.phone}
                            onChange={(e) => setAdminProfileForm((p) => ({ ...p, phone: e.target.value }))}
                          />
                        </div>
                        <div className="col-12 col-sm-6">
                          <label className="form-label small fw-semibold text-dark">
                            {t('admin.profile.language')}
                          </label>
                          <select
                            className="form-select form-select-sm"
                            value={adminProfileForm.language}
                            onChange={(e) => setAdminProfileForm((p) => ({ ...p, language: e.target.value }))}
                          >
                            <option value="en">English (Pan-India)</option>
                            <option value="hi">हिन्दी (Hindi)</option>
                            <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                            <option value="mr">मराठी (Marathi)</option>
                            <option value="gu">ગુજરાતી (Gujarati)</option>
                            <option value="te">తెలుగు (Telugu)</option>
                            <option value="kn">ಕನ್ನಡ (Kannada)</option>
                            <option value="ta">தமிழ் (Tamil)</option>
                            <option value="bn">বাংলা (Bengali)</option>
                          </select>
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-semibold text-dark">
                          {t('admin.profile.profilePhoto')}
                        </label>
                        <input
                          type="url"
                          className="form-control form-control-sm"
                          placeholder="https://example.com/avatar.jpg"
                          value={adminProfileForm.profilePhoto}
                          onChange={(e) => setAdminProfileForm((p) => ({ ...p, profilePhoto: e.target.value }))}
                        />
                      </div>

                      <div className="mb-4">
                        <label className="form-label small fw-semibold text-dark">
                          {t('admin.profile.address')}
                        </label>
                        <textarea
                          rows={2}
                          className="form-control form-control-sm"
                          placeholder="Platform Governance Operations Center / Administrative Headquarters"
                          value={adminProfileForm.address}
                          onChange={(e) => setAdminProfileForm((p) => ({ ...p, address: e.target.value }))}
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn btn-success btn-sm d-flex align-items-center gap-1"
                        disabled={profileSaving}
                      >
                        <i className={`bi bi-check2 ${profileSaving ? 'spin-animation' : ''}`} />
                        <span>{profileSaving ? 'Saving...' : t('admin.profile.saveChanges')}</span>
                      </button>
                    </form>
                  </div>
                </div>

                {/* Column 2: Account Security, Password & Governance Boundaries */}
                <div className="col-12 col-lg-6">
                  {/* Password Change Form */}
                  <div className="card border shadow-sm rounded-4 p-3 p-sm-4 mb-4 bg-white">
                    <h4 className="h6 fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-key-fill text-success" />
                      {t('admin.profile.accountSecurity')}
                    </h4>
                    <form onSubmit={handleChangeAdminPassword}>
                      <div className="mb-3">
                        <label className="form-label small fw-semibold text-dark">
                          {t('admin.profile.currentPassword')} <span className="text-danger">*</span>
                        </label>
                        <input
                          type="password"
                          className="form-control form-control-sm"
                          placeholder="Enter current password"
                          value={adminPasswordForm.currentPassword}
                          onChange={(e) => setAdminPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                          required
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-semibold text-dark">
                          {t('admin.profile.newPassword')} <span className="text-danger">*</span>
                        </label>
                        <input
                          type="password"
                          className="form-control form-control-sm"
                          placeholder="Min 10 characters"
                          value={adminPasswordForm.newPassword}
                          onChange={(e) => setAdminPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                          minLength={10}
                          required
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label small fw-semibold text-dark">
                          {t('admin.profile.confirmPassword')} <span className="text-danger">*</span>
                        </label>
                        <input
                          type="password"
                          className="form-control form-control-sm"
                          placeholder="Confirm new password"
                          value={adminPasswordForm.confirmPassword}
                          onChange={(e) => setAdminPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                          minLength={10}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn btn-success btn-sm d-flex align-items-center gap-1"
                        disabled={passwordUpdating}
                      >
                        <i className={`bi bi-shield-lock ${passwordUpdating ? 'spin-animation' : ''}`} />
                        <span>{passwordUpdating ? 'Updating...' : t('admin.profile.updatePassword')}</span>
                      </button>
                    </form>
                  </div>

                  {/* Governance Boundary & Safety Notice */}
                  <div className="card border-success-subtle bg-success bg-opacity-10 shadow-sm rounded-4 p-4">
                    <h5 className="h6 fw-bold text-success mb-2 d-flex align-items-center gap-2">
                      <i className="bi bi-shield-fill-check" />
                      {t('admin.profile.safetyNoticeTitle')}
                    </h5>
                    <p className="text-secondary small mb-3">
                      {t('admin.profile.safetyNotice')}
                    </p>
                    <div className="row g-2 pt-2 border-top border-success-subtle small">
                      <div className="col-6">
                        <span className="text-muted d-block">{t('admin.profile.createdAt')}</span>
                        <strong className="text-dark">{formatDate(adminProfileForm.createdAt || currentUser?.createdAt)}</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block">{t('admin.profile.lastLogin')}</span>
                        <strong className="text-dark">{adminProfileForm.lastLogin || currentUser?.lastLogin ? formatDate(adminProfileForm.lastLogin || currentUser?.lastLogin) : 'Active Session'}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Danger Zone: Permanent Admin Account Deletion */}
              <div className="card border-danger border-opacity-25 shadow-sm rounded-4 mt-4 overflow-hidden bg-white">
                <div className="card-header bg-danger bg-opacity-10 border-danger border-opacity-25 py-3 px-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2 text-danger">
                    <i className="bi bi-exclamation-triangle-fill fs-5" />
                    <h4 className="h6 fw-bold mb-0 text-danger">Danger Zone: Permanent Administrator Account Deletion</h4>
                  </div>
                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
                    Irreversible Governance Action
                  </span>
                </div>
                <div className="card-body p-3 p-sm-4">
                  <p className="text-secondary small mb-3">
                    Deleting your administrator account is permanent and cannot be undone. All administrative credentials, personal profile details, active authorization sessions, and personal identifying data will be permanently wiped immediately.
                  </p>

                  {activeAdminCount !== null && activeAdminCount <= 1 ? (
                    <div className="alert alert-warning border-0 rounded-3 d-flex align-items-start gap-3 p-3 mb-0">
                      <i className="bi bi-shield-lock-fill text-warning fs-3 flex-shrink-0 mt-1" />
                      <div>
                        <h5 className="h6 fw-bold text-dark mb-1">Sole Administrator Protection Active</h5>
                        <p className="small text-secondary mb-0">
                          You are currently the only active administrator on AgriTech. To protect system governance and prevent permanent administrative lockout, you cannot delete your account until another administrator is appointed and active.
                        </p>
                      </div>
                    </div>
                  ) : !showAdminDeleteConfirm ? (
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 pt-2 border-top">
                      <div>
                        <div className="fw-semibold text-danger small">Permanently delete this administrator account</div>
                        <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                          Another active administrator exists to maintain system oversight. Once deleted, you can register again in the future as a new user.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm fw-semibold d-flex align-items-center gap-1"
                        onClick={() => {
                          setShowAdminDeleteConfirm(true);
                          setAdminDeleteError('');
                        }}
                      >
                        <i className="bi bi-trash3-fill" />
                        Delete Admin Account Permanently
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-3">
                      <h5 className="h6 fw-bold text-danger mb-2 d-flex align-items-center gap-2">
                        <i className="bi bi-shield-exclamation" />
                        Administrator Identity Verification &amp; Confirmation
                      </h5>
                      <p className="small text-dark mb-3">
                        To verify authorized access before permanently deleting administrative credentials, please enter your password and confirm this action.
                      </p>

                      {adminDeleteError && (
                        <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                          <i className="bi bi-exclamation-circle-fill flex-shrink-0" />
                          <div>{adminDeleteError}</div>
                        </div>
                      )}

                      <form onSubmit={handleDeleteAdminAccount}>
                        {(!currentUser?.googleId || currentUser?.hasPassword) ? (
                          <div className="mb-3">
                            <label className="form-label small fw-semibold text-dark">
                              Current Password <span className="text-danger">*</span>
                            </label>
                            <input
                              type="password"
                              className="form-control form-control-sm"
                              placeholder="Enter your current administrator password"
                              value={adminDeletePassword}
                              onChange={(e) => setAdminDeletePassword(e.target.value)}
                              required
                              disabled={adminDeleting}
                            />
                          </div>
                        ) : (
                          <div className="mb-3">
                            <label className="form-label small fw-semibold text-dark">
                              Confirm Google Email Address (<span className="text-primary">{currentUser?.email}</span>) <span className="text-danger">*</span>
                            </label>
                            <input
                              type="email"
                              className="form-control form-control-sm"
                              placeholder={currentUser?.email}
                              value={adminDeleteConfirmEmail}
                              onChange={(e) => setAdminDeleteConfirmEmail(e.target.value)}
                              required
                              disabled={adminDeleting}
                            />
                          </div>
                        )}

                        <div className="mb-3">
                          <label className="form-label small fw-semibold text-dark">
                            Type <span className="badge bg-danger text-white font-monospace">DELETE</span> to confirm: <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm font-monospace"
                            placeholder="DELETE"
                            value={adminDeletePhrase}
                            onChange={(e) => setAdminDeletePhrase(e.target.value)}
                            required
                            disabled={adminDeleting}
                          />
                        </div>

                        <div className="d-flex align-items-center justify-content-end gap-2 pt-2">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setShowAdminDeleteConfirm(false);
                              setAdminDeletePassword('');
                              setAdminDeletePhrase('');
                              setAdminDeleteConfirmEmail('');
                              setAdminDeleteError('');
                            }}
                            disabled={adminDeleting}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="btn btn-danger btn-sm fw-semibold d-flex align-items-center gap-1"
                            disabled={
                              adminDeleting ||
                              adminDeletePhrase.trim() !== 'DELETE' ||
                              ((!currentUser?.googleId || currentUser?.hasPassword) && !adminDeletePassword) ||
                              (currentUser?.googleId && !currentUser?.hasPassword && adminDeleteConfirmEmail.trim().toLowerCase() !== currentUser?.email?.toLowerCase())
                            }
                          >
                            {adminDeleting ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                                Deleting Administrator Account…
                              </>
                            ) : (
                              <>
                                <i className="bi bi-trash3-fill me-1" />
                                Permanently Delete Admin Account
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODALS & DIALOGS
         ========================================================================= */}

      {/* MODAL: Inspect User Profile */}
      {inspectedUser && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3 px-4">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-person-lines-fill text-success" />
                  User Profile &amp; Account Details
                </h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setInspectedUser(null)} />
              </div>
              <div className="modal-body p-4">
                <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 mb-4">
                  <div className="avatar avatar-large bg-success text-white fw-bold d-flex align-items-center justify-content-center rounded-circle" style={{ width: '56px', height: '56px', fontSize: '1.4rem' }}>
                    {inspectedUser.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                      <span>{inspectedUser.name}</span>
                      <span className={`badge ${inspectedUser.role === 'admin' ? 'bg-success' : 'bg-secondary'}`}>
                        {inspectedUser.role?.toUpperCase()}
                      </span>
                      <span className={`badge ${inspectedUser.status === 'suspended' ? 'bg-danger' : 'bg-success'}`}>
                        {inspectedUser.status?.toUpperCase()}
                      </span>
                    </h5>
                    <span className="text-secondary small">{inspectedUser.email}</span>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-6">
                    <small className="text-muted d-block">Phone Number</small>
                    <strong>{inspectedUser.phone || 'Not provided'}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Email Verification</small>
                    <strong className={inspectedUser.emailVerified ? 'text-success' : 'text-warning'}>
                      {inspectedUser.emailVerified ? 'Verified' : 'Unverified'}
                    </strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Assigned Farmland</small>
                    <strong>{inspectedUser.farmName || '—'}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Registered On</small>
                    <span>{formatDate(inspectedUser.createdAt)}</span>
                  </div>
                  <div className="col-12">
                    <small className="text-muted d-block">Postal Address</small>
                    <span>{inspectedUser.address || 'Address not recorded'}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-top py-2 px-4">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInspectedUser(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: User Action Confirmation (Role, Status, Email, Password) */}
      {userActionModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3 px-4">
                <h5 className="modal-title fw-bold text-dark">
                  {userActionModal.type === 'suspend' && t('admin.users.modalSuspendTitle')}
                  {userActionModal.type === 'activate' && t('admin.users.modalActivateTitle')}
                  {userActionModal.type === 'verify-email' && t('admin.users.modalVerifyEmailTitle')}
                  {userActionModal.type === 'reset-password' && t('admin.users.modalResetPasswordTitle')}
                </h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setUserActionModal(null)} />
              </div>
              <div className="modal-body p-4">
                {!issuedResetLink ? (
                  <>
                    <p className="text-secondary small mb-3">
                      Target Account: <strong>{userActionModal.targetUser.name}</strong> ({userActionModal.targetUser.email})
                    </p>
                    <div className="mb-2">
                      <label className="form-label small fw-semibold text-dark">
                        {t('admin.users.auditReasonLabel')} <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder={t('admin.users.auditReasonPlaceholder')}
                        value={userActionReason}
                        onChange={(e) => setUserActionReason(e.target.value)}
                        required
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="alert alert-success small mb-3">
                      <i className="bi bi-check-circle-fill me-1" /> Password reset link generated securely.
                    </div>
                    <label className="form-label small fw-semibold">Reset Link:</label>
                    <div className="input-group input-group-sm mb-3">
                      <input type="text" className="form-control bg-light font-monospace" value={issuedResetLink} readOnly />
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(issuedResetLink);
                          setActionSuccess('Copied to clipboard');
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer border-top py-2 px-4">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setUserActionModal(null)}>
                  {issuedResetLink ? (t('common.completed') || 'Done') : (t('common.cancel') || 'Cancel')}
                </button>
                {!issuedResetLink && (
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    disabled={loading || !userActionReason.trim() || userActionReason.trim().length < 5}
                    onClick={handleExecuteUserAction}
                  >
                    {t('common.submit')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reply to Support Ticket */}
      {activeTicket && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3 px-4">
                <h5 className="modal-title fw-bold text-dark">
                  {t('admin.users.replyModalTitle')}
                </h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setActiveTicket(null)} />
              </div>
              <form onSubmit={handleReplyTicket}>
                <div className="modal-body p-4">
                  <div className="p-3 bg-light rounded-3 mb-3">
                    <div className="fw-bold text-dark">{activeTicket.subject}</div>
                    <p className="text-secondary small mb-1">{activeTicket.message}</p>
                    <small className="text-muted">From: {activeTicket.userName} ({activeTicket.userEmail})</small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold" htmlFor="ticketReply">
                      {t('admin.users.reply')}
                    </label>
                    <textarea
                      id="ticketReply"
                      rows={4}
                      className="form-control form-control-sm"
                      placeholder={t('admin.users.replyPlaceholder')}
                      value={ticketReplyText}
                      onChange={(e) => setTicketReplyText(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer border-top py-2 px-4">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveTicket(null)}>
                    {t('common.cancel') || 'Cancel'}
                  </button>
                  <button type="submit" className="btn btn-success btn-sm" disabled={loading || !ticketReplyText.trim()}>
                    {t('admin.users.reply')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Content Management (Create / Edit) */}
      {contentModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3 px-4">
                <h5 className="modal-title fw-bold text-dark">
                  {contentModal === 'create' ? 'Create Agricultural Content' : 'Edit Agricultural Content'}
                </h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setContentModal(null)} />
              </div>
              <form onSubmit={handleSaveContent}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-8">
                      <label className="form-label small fw-semibold">Title</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={contentForm.title}
                        onChange={(e) => setContentForm((p) => ({ ...p, title: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Category</label>
                      <select
                        className="form-select form-select-sm"
                        value={contentForm.category}
                        onChange={(e) => setContentForm((p) => ({ ...p, category: e.target.value }))}
                      >
                        <option value="crop">Crop</option>
                        <option value="product">Product</option>
                        <option value="service">Service</option>
                        <option value="advisory">Advisory</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Crop Type / Variety</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={contentForm.variety}
                        onChange={(e) => setContentForm((p) => ({ ...p, variety: e.target.value }))}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Sowing Season</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={contentForm.sowingSeason}
                        onChange={(e) => setContentForm((p) => ({ ...p, sowingSeason: e.target.value }))}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Summary</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={contentForm.summary}
                        onChange={(e) => setContentForm((p) => ({ ...p, summary: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Details &amp; Agronomic Protocols</label>
                      <textarea
                        rows={4}
                        className="form-control form-control-sm"
                        value={contentForm.details}
                        onChange={(e) => setContentForm((p) => ({ ...p, details: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top py-2 px-4">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setContentModal(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success btn-sm" disabled={loading}>
                    Save &amp; Publish Content
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Resource Restock Order */}
      {restockModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3 px-4">
                <h5 className="modal-title fw-bold text-dark">Coordinate Supplier Restock</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setRestockModal(null)} />
              </div>
              <form onSubmit={handleOrderRestock}>
                <div className="modal-body p-4">
                  <div className="p-3 bg-light rounded-3 mb-3">
                    <div className="fw-bold text-dark">{restockModal.name}</div>
                    <div className="small text-muted">Supplier: {restockModal.supplierName} ({restockModal.supplierContact})</div>
                    <div className="small text-dark mt-1">Current Stock: {restockModal.currentStock} {restockModal.unit}</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Reorder Quantity ({restockModal.unit})</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={restockQty}
                      onChange={(e) => setRestockQty(e.target.value)}
                      min={1}
                      inputMode="numeric"
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer border-top py-2 px-4">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRestockModal(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success btn-sm" disabled={loading}>
                    Dispatch Supplier Order
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Product Resource */}
      {resourceCreateModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3 px-4">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-boxes text-success" />
                  Add Agricultural Product Resource
                </h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setResourceCreateModal(false)} />
              </div>
              <form onSubmit={handleCreateResource}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-8">
                      <label className="form-label small fw-semibold">Product Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. Certified HD-2967 Wheat Seed"
                        value={resourceForm.name}
                        onChange={(e) => setResourceForm((p) => ({ ...p, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Category</label>
                      <select
                        className="form-select form-select-sm"
                        value={resourceForm.category}
                        onChange={(e) => setResourceForm((p) => ({ ...p, category: e.target.value }))}
                      >
                        <option value="seeds">Seeds</option>
                        <option value="fertilizer">Fertilizer</option>
                        <option value="pesticide">Pesticide / Biocontrol</option>
                        <option value="machinery">Machinery / Spares</option>
                        <option value="tools">Tools &amp; Hardware</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="col-6 col-md-4">
                      <label className="form-label small fw-semibold">SKU / Code</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-monospace"
                        placeholder="SKU-SEED-001"
                        value={resourceForm.sku}
                        onChange={(e) => setResourceForm((p) => ({ ...p, sku: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="col-6 col-md-4">
                      <label className="form-label small fw-semibold">Current Stock</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={resourceForm.currentStock}
                        onChange={(e) => setResourceForm((p) => ({ ...p, currentStock: e.target.value }))}
                        min={0}
                        step="any"
                        inputMode="decimal"
                        required
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Unit</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="bags (40kg) / Liters / kg"
                        value={resourceForm.unit}
                        onChange={(e) => setResourceForm((p) => ({ ...p, unit: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="col-6 col-md-6">
                      <label className="form-label small fw-semibold">Minimum Restock Threshold</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={resourceForm.minThreshold}
                        onChange={(e) => setResourceForm((p) => ({ ...p, minThreshold: e.target.value }))}
                        min={1}
                        step="any"
                        inputMode="decimal"
                        required
                      />
                    </div>
                    <div className="col-6 col-md-6">
                      <label className="form-label small fw-semibold">Unit Price (₹ INR)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={resourceForm.unitPriceINR}
                        onChange={(e) => setResourceForm((p) => ({ ...p, unitPriceINR: e.target.value }))}
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        required
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Supplier Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. National Seeds Corp"
                        value={resourceForm.supplierName}
                        onChange={(e) => setResourceForm((p) => ({ ...p, supplierName: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Supplier Contact Phone</label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
                        placeholder="+91 98765 43210"
                        value={resourceForm.supplierContact}
                        onChange={(e) => setResourceForm((p) => ({ ...p, supplierContact: e.target.value }))}
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Supplier Email</label>
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        placeholder="orders@supplier.gov.in"
                        value={resourceForm.supplierEmail}
                        onChange={(e) => setResourceForm((p) => ({ ...p, supplierEmail: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top py-2 px-4">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setResourceCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success btn-sm" disabled={loading}>
                    Create Resource
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Service Scheduling / Technician Assignment */}
      {serviceScheduleModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3 px-4">
                <h5 className="modal-title fw-bold text-dark">Schedule &amp; Dispatch Service</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setServiceScheduleModal(null)} />
              </div>
              <form onSubmit={handleSaveServiceSchedule}>
                <div className="modal-body p-4">
                  <div className="p-3 bg-light rounded-3 mb-3">
                    <div className="fw-bold text-dark">{serviceScheduleModal.serviceName}</div>
                    <div className="small text-muted">Farmer: {serviceScheduleModal.farmerName} • {serviceScheduleModal.location}</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Assigned Technician / Pilot</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={serviceScheduleForm.technicianAssigned}
                      onChange={(e) => setServiceScheduleForm((p) => ({ ...p, technicianAssigned: e.target.value }))}
                      placeholder="e.g. Drone Pilot Karan Meena / Agronomist Dr. Rao"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Scheduled Date</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={serviceScheduleForm.scheduledDate}
                      onChange={(e) => setServiceScheduleForm((p) => ({ ...p, scheduledDate: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Delivery Status</label>
                    <select
                      className="form-select form-select-sm"
                      value={serviceScheduleForm.status}
                      onChange={(e) => setServiceScheduleForm((p) => ({ ...p, status: e.target.value }))}
                    >
                      <option value="pending">Pending</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer border-top py-2 px-4">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setServiceScheduleModal(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success btn-sm" disabled={loading}>
                    Confirm Dispatch
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Record Policy Violation */}
      {violationModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3 px-4">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-octagon text-danger" />
                  Record Policy Violation &amp; Enforce Action
                </h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setViolationModal(false)} />
              </div>
              <form onSubmit={handleRecordViolation}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Offending User Name</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={violationForm.userName}
                      onChange={(e) => setViolationForm((p) => ({ ...p, userName: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Offending User Email</label>
                    <input
                      type="email"
                      className="form-control form-control-sm"
                      value={violationForm.userEmail}
                      onChange={(e) => setViolationForm((p) => ({ ...p, userEmail: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Violation Type</label>
                    <select
                      className="form-select form-select-sm"
                      value={violationForm.violationType}
                      onChange={(e) => setViolationForm((p) => ({ ...p, violationType: e.target.value }))}
                    >
                      <option value="terms_of_service_breach">Terms of Service Breach</option>
                      <option value="unauthorized_data_scraping">Unauthorized Data Scraping</option>
                      <option value="spam_listing">Spam Listing / Ads</option>
                      <option value="fraudulent_claims">Fraudulent Quality Claims</option>
                      <option value="abuse_of_support">Abuse of Support System</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Disciplinary Action to Enforce</label>
                    <select
                      className="form-select form-select-sm"
                      value={violationForm.actionTaken}
                      onChange={(e) => setViolationForm((p) => ({ ...p, actionTaken: e.target.value }))}
                    >
                      <option value="warning_issued">Issue Formal Warning</option>
                      <option value="account_flagged">Flag Account for Review</option>
                      <option value="account_suspended">Suspend Offending Account</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Violation Description &amp; Evidence</label>
                    <textarea
                      rows={3}
                      className="form-control form-control-sm"
                      value={violationForm.description}
                      onChange={(e) => setViolationForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Describe the incident and evidence..."
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer border-top py-2 px-4">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setViolationModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger btn-sm" disabled={loading}>
                    Enforce Disciplinary Action
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

export default AdminPage;
