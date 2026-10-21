import { useEffect, useState } from 'react';
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

  const register = async (userData) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: userData,
    });
    saveSession(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('agritech_token');
    setToken(null);
    setUser(null);
    setAuthError('');
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: Boolean(user && token),
      loading,
      authError,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
