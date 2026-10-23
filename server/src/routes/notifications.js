import { Router } from 'express';
import { createNotificationController } from '../controllers/notificationController.js';
import { createProtect } from '../middleware/auth.js';
import { farmStore as defaultFarmStore } from '../storage/farmStore.js';
import { userStore as defaultUserStore } from '../storage/userStore.js';

export const createNotificationRouter = (
  farmStore = defaultFarmStore,
  userStore = defaultUserStore
) => {
  const router = Router();
  const controller = createNotificationController(farmStore);
  const protect = createProtect(userStore);

  router.use(protect);

  router.route('/')
    .get(controller.listNotifications);

  router.route('/read-all')
    .post(controller.markAllRead);

  router.route('/:id/read')
    .patch(controller.markRead);

  return router;
};

export default createNotificationRouter();
