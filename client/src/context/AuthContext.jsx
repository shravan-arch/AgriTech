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
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
