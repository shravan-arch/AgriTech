import { useCallback, useEffect, useState } from 'react';
import AuthContext from './AuthContextValue.js';
import { apiRequest } from '../lib/api.js';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('agritech_token'));
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let active = true;

    const validateSession = async () => {
      if (!token) {
        if (active) setLoading(false);
        return;
      }

      try {
        const data = await apiRequest('/auth/me', { token });
        if (active) {
          setUser(data.user);
          setAuthError('');
        }
      } catch (error) {
        if (active && error.status === 401) {
          localStorage.removeItem('agritech_token');
          setToken(null);
          setUser(null);
        } else if (active) {
          setAuthError(error.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    validateSession();
    return () => {
      active = false;
    };
  }, [token]);

  const saveSession = (data) => {
    localStorage.setItem('agritech_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setAuthError('');
  };

  const login = async (email, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    saveSession(data);
    return data;
  };

  const googleLogin = async (credential) => {
    const data = await apiRequest('/auth/google', {
      method: 'POST',
      body: { credential },
    });
    saveSession(data);
    return data;
  };

  const register = async (userData) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: userData,
    });
    if (data.token) {
      saveSession(data);
    }
    return data;
  };

  const checkVerifyEmail = useCallback(async (verificationToken) => {
    return apiRequest(`/auth/verify-email?token=${encodeURIComponent(verificationToken)}`);
  }, []);

  const verifyEmail = useCallback(async (verificationToken) => {
    return apiRequest('/auth/verify-email', {
      method: 'POST',
      body: { token: verificationToken },
    });
  }, []);

  const resendVerification = useCallback(async (email) => {
    return apiRequest('/auth/resend-verification', {
      method: 'POST',
      body: { email },
    });
  }, []);

  const forgotPassword = async (email) => {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
  };

  const resetPassword = async (resetToken, newPassword) => {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: { token: resetToken, password: newPassword },
    });
  };

  const updateProfile = async (profileData) => {
    const data = await apiRequest('/auth/profile', {
      method: 'PUT',
      token,
      body: profileData,
    });
    if (data.user) {
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('agritech_token');
    setToken(null);
    setUser(null);
    setAuthError('');
  };

  const listAdminUsers = useCallback(async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/users${query ? `?${query}` : ''}`, { token });
  }, [token]);

  const listPendingRequests = useCallback(async () => {
    return apiRequest('/admin/pending-requests', { token });
  }, [token]);

  const approveRoleRequest = useCallback(async (userId, reason) => {
    return apiRequest(`/admin/requests/${userId}/approve`, {
      method: 'POST',
      token,
      body: { reason },
    });
  }, [token]);

  const rejectRoleRequest = useCallback(async (userId, reason) => {
    return apiRequest(`/admin/requests/${userId}/reject`, {
      method: 'POST',
      token,
      body: { reason },
    });
  }, [token]);

  const changeUserRole = useCallback(async (userId, newRole, reason) => {
    return apiRequest(`/admin/users/${userId}/role`, {
      method: 'PUT',
      token,
      body: { role: newRole, reason },
    });
  }, [token]);

  const changeUserStatus = useCallback(async (userId, newStatus, reason) => {
    return apiRequest(`/admin/users/${userId}/status`, {
      method: 'PUT',
      token,
      body: { status: newStatus, reason },
    });
  }, [token]);

  const listAuditLogs = useCallback(async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/audit-logs${query ? `?${query}` : ''}`, { token });
  }, [token]);

  const listAdminFarms = useCallback(async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/farms${query ? `?${query}` : ''}`, { token });
  }, [token]);

  const getUserDetailsAdmin = useCallback(async (userId) => {
    return apiRequest(`/admin/users/${userId}`, { token });
  }, [token]);

  const updateUserProfileAdmin = useCallback(async (userId, profileData, reason) => {
    return apiRequest(`/admin/users/${userId}/profile`, {
      method: 'PUT',
      token,
      body: { ...profileData, reason },
    });
  }, [token]);

  const verifyUserEmailAdmin = useCallback(async (userId, reason) => {
    return apiRequest(`/admin/users/${userId}/verify-email`, {
      method: 'POST',
      token,
      body: { reason },
    });
  }, [token]);

  const resetUserPasswordAdmin = useCallback(async (userId, reason) => {
    return apiRequest(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
      token,
      body: { reason },
    });
  }, [token]);

  const getSystemHealth = useCallback(async () => {
    return apiRequest('/admin/system-health', { token });
  }, [token]);

  const getPlatformSettings = useCallback(async () => {
    return apiRequest('/admin/settings', { token });
  }, [token]);

  const updatePlatformSettings = useCallback(async (settings, reason) => {
    return apiRequest('/admin/settings', {
      method: 'PUT',
      token,
      body: { settings, reason },
    });
  }, [token]);

  const createAnnouncement = useCallback(async (announcement) => {
    return apiRequest('/admin/announcements', {
      method: 'POST',
      token,
      body: announcement,
    });
  }, [token]);

  const updateFarmExceptional = useCallback(async (farmId, updateData, reason) => {
    return apiRequest(`/admin/farms/${farmId}`, {
      method: 'PATCH',
      token,
      body: { ...updateData, reason },
    });
  }, [token]);

  // Support Queries
  const listSupportTicketsAdmin = useCallback(async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/support-tickets${query ? `?${query}` : ''}`, { token });
  }, [token]);

  const replySupportTicketAdmin = useCallback(async (ticketId, replyData) => {
    return apiRequest(`/admin/support-tickets/${ticketId}`, {
      method: 'PUT',
      token,
      body: replyData,
    });
  }, [token]);

  // Content Management
  const listCropContentAdmin = useCallback(async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/content${query ? `?${query}` : ''}`, { token });
  }, [token]);

  const createCropContentAdmin = useCallback(async (data) => {
    return apiRequest('/admin/content', {
      method: 'POST',
      token,
      body: data,
    });
  }, [token]);

  const updateCropContentAdmin = useCallback(async (id, data) => {
    return apiRequest(`/admin/content/${id}`, {
      method: 'PUT',
      token,
      body: data,
    });
  }, [token]);

  const deleteCropContentAdmin = useCallback(async (id) => {
    return apiRequest(`/admin/content/${id}`, {
      method: 'DELETE',
      token,
    });
  }, [token]);

  // Resource Management
  const listResourcesAdmin = useCallback(async () => {
    return apiRequest('/admin/resources', { token });
  }, [token]);

  const createResourceAdmin = useCallback(async (data) => {
    return apiRequest('/admin/resources', {
      method: 'POST',
      token,
      body: data,
    });
  }, [token]);

  const updateResourceAdmin = useCallback(async (id, data) => {
    return apiRequest(`/admin/resources/${id}`, {
      method: 'PUT',
      token,
      body: data,
    });
  }, [token]);

  const orderResourceRestockAdmin = useCallback(async (id, data) => {
    return apiRequest(`/admin/resources/${id}/reorder`, {
      method: 'POST',
      token,
      body: data,
    });
  }, [token]);

  // Service Management
  const listServiceBookingsAdmin = useCallback(async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admin/services${query ? `?${query}` : ''}`, { token });
  }, [token]);

  const createServiceBookingAdmin = useCallback(async (data) => {
    return apiRequest('/admin/services', {
      method: 'POST',
      token,
      body: data,
    });
  }, [token]);

  const updateServiceBookingAdmin = useCallback(async (id, data) => {
    return apiRequest(`/admin/services/${id}`, {
      method: 'PUT',
      token,
      body: data,
    });
  }, [token]);

  // System Maintenance
  const runSystemCheckAdmin = useCallback(async () => {
    return apiRequest('/admin/maintenance/run-check', {
      method: 'POST',
      token,
    });
  }, [token]);

  const toggleMaintenanceModeAdmin = useCallback(async (maintenanceMode, systemNotice) => {
    return apiRequest('/admin/maintenance/mode', {
      method: 'POST',
      token,
      body: { maintenanceMode, systemNotice },
    });
  }, [token]);

  const clearCacheAdmin = useCallback(async () => {
    return apiRequest('/admin/maintenance/clear-cache', {
      method: 'POST',
      token,
    });
  }, [token]);

  // Security Management
  const getSecurityOverviewAdmin = useCallback(async () => {
    return apiRequest('/admin/security/overview', { token });
  }, [token]);

  const updateSecurityPoliciesAdmin = useCallback(async (policies) => {
    return apiRequest('/admin/security/policies', {
      method: 'PUT',
      token,
      body: policies,
    });
  }, [token]);

  const blockIPAdmin = useCallback(async (ip, unblock = false) => {
    return apiRequest('/admin/security/block-ip', {
      method: 'POST',
      token,
      body: { ip, unblock },
    });
  }, [token]);

  // Data Analytics
  const getPlatformAnalyticsAdmin = useCallback(async () => {
    return apiRequest('/admin/analytics', { token });
  }, [token]);

  const generateStrategicReportAdmin = useCallback(async (reportType) => {
    return apiRequest('/admin/analytics/generate-report', {
      method: 'POST',
      token,
      body: { reportType },
    });
  }, [token]);

  // Policy Enforcement
  const listPolicyViolationsAdmin = useCallback(async () => {
    return apiRequest('/admin/policies', { token });
  }, [token]);

  const recordPolicyViolationAdmin = useCallback(async (violationData) => {
    return apiRequest('/admin/policies/violations', {
      method: 'POST',
      token,
      body: violationData,
    });
  }, [token]);

  const resolvePolicyViolationAdmin = useCallback(async (id, resolutionNotes) => {
    return apiRequest(`/admin/policies/violations/${id}/resolve`, {
      method: 'PUT',
      token,
      body: { resolutionNotes },
    });
  }, [token]);

  const getAdminProfile = useCallback(async () => {
    return apiRequest('/admin/my-profile', { token });
  }, [token]);

  const updateAdminProfile = useCallback(async (profileData) => {
    const data = await apiRequest('/admin/my-profile', {
      method: 'PUT',
      token,
      body: profileData,
    });
    if (data?.profile) {
      setUser((prev) => ({ ...prev, ...data.profile }));
    }
    return data;
  }, [token]);

  const changeAdminPassword = useCallback(async (payload) => {
    return apiRequest('/admin/my-profile/change-password', {
      method: 'POST',
      token,
      body: payload,
    });
  }, [token]);

  const resendAdminEmailVerification = useCallback(async () => {
    return apiRequest('/admin/my-profile/resend-verification', {
      method: 'POST',
      token,
    });
  }, [token]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      setUser,
      isAuthenticated: Boolean(user && token),
      loading,
      authError,
      login,
      googleLogin,
      register,
      checkVerifyEmail,
      verifyEmail,
      resendVerification,
      updateProfile,
      forgotPassword,
      resetPassword,
      logout,
      listAdminUsers,
      listPendingRequests,
      approveRoleRequest,
      rejectRoleRequest,
      changeUserRole,
      changeUserStatus,
      listAuditLogs,
      listAdminFarms,
      getUserDetailsAdmin,
      updateUserProfileAdmin,
      verifyUserEmailAdmin,
      resetUserPasswordAdmin,
      getSystemHealth,
      getPlatformSettings,
      updatePlatformSettings,
      createAnnouncement,
      updateFarmExceptional,
      listSupportTicketsAdmin,
      replySupportTicketAdmin,
      listCropContentAdmin,
      createCropContentAdmin,
      updateCropContentAdmin,
      deleteCropContentAdmin,
      listResourcesAdmin,
      createResourceAdmin,
      updateResourceAdmin,
      orderResourceRestockAdmin,
      listServiceBookingsAdmin,
      createServiceBookingAdmin,
      updateServiceBookingAdmin,
      runSystemCheckAdmin,
      toggleMaintenanceModeAdmin,
      clearCacheAdmin,
      getSecurityOverviewAdmin,
      updateSecurityPoliciesAdmin,
      blockIPAdmin,
      getPlatformAnalyticsAdmin,
      generateStrategicReportAdmin,
      listPolicyViolationsAdmin,
      recordPolicyViolationAdmin,
      resolvePolicyViolationAdmin,
      getAdminProfile,
      updateAdminProfile,
      changeAdminPassword,
      resendAdminEmailVerification,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
