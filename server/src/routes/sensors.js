import { Router } from 'express';
import { createSensorController } from '../controllers/sensorController.js';
import { createProtect, restrictAdminFromAgriculturalWrites } from '../middleware/auth.js';
import { farmStore as defaultFarmStore } from '../storage/farmStore.js';
import { userStore as defaultUserStore } from '../storage/userStore.js';
import sensorSimulatorService from '../services/sensorSimulatorService.js';

export const createSensorRouter = (
  farmStore = defaultFarmStore,
  userStore = defaultUserStore,
  simulatorService = sensorSimulatorService
) => {
  const router = Router();
  const controller = createSensorController(farmStore, simulatorService);
  const protect = createProtect(userStore);

  router.use(protect);

  // Chart time-series endpoint
  router.get('/charts', controller.getReadingsForCharts);

  // Alerts endpoints
  router.get('/alerts', controller.listAlerts);
  router.patch('/alerts/:id/acknowledge', controller.acknowledgeAlert);

  // Development-only simulator endpoints
  router.post('/simulator/start', controller.startSimulation);
  router.post('/simulator/stop', controller.stopSimulation);
  router.get('/simulator/status', controller.getSimulatorStatus);
  router.post('/simulator/trigger', controller.triggerSimulatedReading);

  // Sensor CRUD & readings
  router.route('/')
    .get(controller.listSensors)
    .post(restrictAdminFromAgriculturalWrites, controller.createSensor);

  router.route('/:id')
    .get(controller.getSensor)
    .patch(restrictAdminFromAgriculturalWrites, controller.updateSensor)
    .delete(restrictAdminFromAgriculturalWrites, controller.deleteSensor);

  router.route('/:id/readings')
    .get(controller.listReadings)
    .post(controller.ingestReading);

  return router;
};

export default createSensorRouter();
