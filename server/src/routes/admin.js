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

  // 1. User Management & Profiles
  router.get('/my-profile', controller.getAdminProfile);
  router.put('/my-profile', controller.updateAdminProfile);
  router.post('/my-profile/change-password', controller.changeAdminPassword);
  router.post('/my-profile/resend-verification', controller.resendAdminEmailVerification);
  router.get('/users', controller.listUsers);
  router.get('/users/:id', controller.getUserDetails);
  router.put('/users/:id/profile', controller.updateUserProfile);
  router.get('/pending-requests', controller.listPendingRequests);
  router.post('/users/:id/verify-email', controller.verifyUserEmail);
  router.post('/users/:id/reset-password', controller.resetUserPassword);
  router.post('/requests/:id/approve', controller.approveRoleRequest);
  router.post('/requests/:id/reject', controller.rejectRoleRequest);
  router.post('/users/:id/approve', controller.approveRoleRequest);
  router.post('/users/:id/reject', controller.rejectRoleRequest);
  router.put('/users/:id/role', controller.changeUserRole);
  router.put('/users/:id/status', controller.changeUserStatus);
  router.get('/support-tickets', controller.listSupportTickets);
  router.put('/support-tickets/:id', controller.replySupportTicket);

  // 2. Content Management
  router.get('/content', controller.listCropContent);
  router.post('/content', controller.createCropContent);
  router.put('/content/:id', controller.updateCropContent);
  router.delete('/content/:id', controller.deleteCropContent);

  // 3. Resource Management (Inventory & Supplier Coordination)
  router.get('/resources', controller.listResources);
  router.post('/resources', controller.createResource);
  router.put('/resources/:id', controller.updateResource);
  router.post('/resources/:id/reorder', controller.orderResourceRestock);

  // 4. Service Management (Scheduling & Delivery)
  router.get('/services', controller.listServiceBookings);
  router.post('/services', controller.createServiceBooking);
  router.put('/services/:id', controller.updateServiceBooking);

  // 5. System Maintenance
  router.get('/system-health', controller.getSystemHealth);
  router.get('/maintenance/health', controller.getSystemHealth);
  router.post('/maintenance/run-check', controller.runSystemCheck);
  router.post('/maintenance/mode', controller.toggleMaintenanceMode);
  router.post('/maintenance/clear-cache', controller.clearCache);

  // 6. Security Management
  router.get('/security/overview', controller.getSecurityOverview);
  router.put('/security/policies', controller.updateSecurityPolicies);
  router.post('/security/block-ip', controller.blockIP);
  router.get('/audit-logs', controller.listAuditLogs);

  // 7. Data Analytics & Strategic Reports
  router.get('/analytics', controller.getPlatformAnalytics);
  router.post('/analytics/generate-report', controller.generateStrategicReport);

  // 8. Policy Enforcement & Violations
  router.get('/policies', controller.listPolicyViolations);
  router.post('/policies/violations', controller.recordPolicyViolation);
  router.put('/policies/violations/:id/resolve', controller.resolvePolicyViolation);

  // Platform Settings & Announcements
  router.get('/settings', controller.getPlatformSettings);
  router.put('/settings', controller.updatePlatformSettings);
  router.post('/announcements', controller.createAnnouncement);

  // Farmland oversight & exceptional maintenance
  router.get('/farms', controller.listAllFarms);
  router.patch('/farms/:farmId', controller.updateFarmExceptional);

  return router;
};

const adminRouter = createAdminRouter();
export default adminRouter;
