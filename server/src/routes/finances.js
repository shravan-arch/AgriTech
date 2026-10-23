import { Router } from 'express';
import { createFinanceController } from '../controllers/financeController.js';
import { createProtect } from '../middleware/auth.js';
import { farmStore as defaultFarmStore } from '../storage/farmStore.js';
import { userStore as defaultUserStore } from '../storage/userStore.js';

export const createFinanceRouter = (
  farmStore = defaultFarmStore,
  userStore = defaultUserStore
) => {
  const router = Router();
  const controller = createFinanceController(farmStore);
  const protect = createProtect(userStore);

  router.use(protect);

  router.route('/')
    .get(controller.listRecords)
    .post(controller.createRecord);

  router.route('/summary')
    .get(controller.getSummary);

  router.route('/:id')
    .put(controller.updateRecord)
    .patch(controller.updateRecord)
    .delete(controller.deleteRecord);

  return router;
};

export default createFinanceRouter();
