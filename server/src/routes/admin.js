import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { createAdminController } from '../controllers/adminController.js';

export const createAdminRouter = (controller = createAdminController()) => {
  const router = express.Router();

  // One-time bootstrap endpoint (allowed ONLY when active admin count is 0)
  router.post('/bootstrap', controller.bootstrapAdmin);

  // All other admin routes require valid authentication AND 'admin' role
  router.use(protect);
  router.use(authorize('admin'));

  // User management
  router.get('/users', controller.listUsers);
  router.get('/pending-requests', controller.listPendingRequests);

  // Request review
  router.post('/requests/:id/approve', controller.approveRoleRequest);
  router.post('/requests/:id/reject', controller.rejectRoleRequest);

  // Direct role and status changes
  router.put('/users/:id/role', controller.changeUserRole);
  router.put('/users/:id/status', controller.changeUserStatus);

  // Audit logs
  router.get('/audit-logs', controller.listAuditLogs);

  return router;
};

const adminRouter = createAdminRouter();
export default adminRouter;
