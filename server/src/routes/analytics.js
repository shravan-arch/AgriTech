import { Router } from 'express';
import { createAnalyticsController } from '../controllers/analyticsController.js';
import { createProtect } from '../middleware/auth.js';
import { farmStore as defaultFarmStore } from '../storage/farmStore.js';
import { userStore as defaultUserStore } from '../storage/userStore.js';

export const createAnalyticsRouter = (
  farmStore = defaultFarmStore,
  userStore = defaultUserStore
) => {
  const router = Router();
  const controller = createAnalyticsController(farmStore);
  const protect = createProtect(userStore);

  router.use(protect);

  router.route('/summary')
    .get(controller.getSummary);

  router.route('/market-prices')
    .get(controller.getMarketPrices);

  return router;
};

export default createAnalyticsRouter();
