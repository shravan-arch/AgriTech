import { Router } from 'express';
import { createFarmController } from '../controllers/farmController.js';
import { createProtect } from '../middleware/auth.js';
import { farmStore as defaultFarmStore } from '../storage/farmStore.js';
import { userStore as defaultUserStore } from '../storage/userStore.js';

export const createFarmRouter = (
  farmStore = defaultFarmStore,
  userStore = defaultUserStore
) => {
  const router = Router();
  const controller = createFarmController(farmStore);
  const protect = createProtect(userStore);

  router.use(protect);
  router.route('/')
    .get(controller.listFarms)
    .post(controller.createFarm);
  router.route('/:farmId')
    .get(controller.getFarm)
    .patch(controller.updateFarm)
    .delete(controller.deleteFarm);
  router.route('/:farmId/fields')
    .get(controller.listFields)
    .post(controller.createField);
  router.route('/fields/:fieldId')
    .patch(controller.updateField)
    .delete(controller.deleteField);
  return router;
};

export default createFarmRouter();
