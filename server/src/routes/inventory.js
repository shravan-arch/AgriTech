import { Router } from 'express';
import { createInventoryController } from '../controllers/inventoryController.js';
import { createProtect, restrictAdminFromAgriculturalWrites } from '../middleware/auth.js';
import { farmStore as defaultFarmStore } from '../storage/farmStore.js';
import { userStore as defaultUserStore } from '../storage/userStore.js';

export const createInventoryRouter = (
  farmStore = defaultFarmStore,
  userStore = defaultUserStore
) => {
  const router = Router();
  const controller = createInventoryController(farmStore);
  const protect = createProtect(userStore);

  router.use(protect);

  router.route('/')
    .get(controller.listItems)
    .post(controller.createItem);

  router.route('/movements')
    .get(controller.listMovements)
    .post(controller.logMovement);

  router.route('/:id')
    .get(controller.getItem)
    .patch(controller.updateItem)
    .delete(controller.deleteItem);

  return router;
};

export default createInventoryRouter();
