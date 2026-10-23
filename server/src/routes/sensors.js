import { Router } from 'express';
import { createSensorController } from '../controllers/sensorController.js';
import { createProtect } from '../middleware/auth.js';
import { farmStore as defaultFarmStore } from '../storage/farmStore.js';
import { userStore as defaultUserStore } from '../storage/userStore.js';

export const createSensorRouter = (
  farmStore = defaultFarmStore,
  userStore = defaultUserStore
) => {
  const router = Router();
  const controller = createSensorController(farmStore);
  const protect = createProtect(userStore);

  router.use(protect);

  router.route('/')
    .get(controller.listSensors)
    .post(controller.createSensor);

  router.route('/:id')
    .get(controller.getSensor)
    .patch(controller.updateSensor)
    .delete(controller.deleteSensor);

  router.route('/:id/readings')
    .get(controller.listReadings)
    .post(controller.ingestReading);

  return router;
};

export default createSensorRouter();
