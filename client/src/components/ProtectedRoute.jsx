import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-shell">
        <div className="loading-panel" role="status" aria-live="polite">
          <span className="spinner-border text-success" aria-hidden="true" />
          <span>Checking your account…</span>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
