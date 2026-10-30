import { Router } from 'express';
import { createWeatherController } from '../controllers/weatherController.js';
import { createProtect } from '../middleware/auth.js';
import { farmStore as defaultFarmStore } from '../storage/farmStore.js';
import { userStore as defaultUserStore } from '../storage/userStore.js';
import weatherService from '../services/weatherService.js';

export const createWeatherRouter = (
  farmStore = defaultFarmStore,
  userStore = defaultUserStore,
  customWeatherService = weatherService
) => {
  const router = Router();
  const controller = createWeatherController(farmStore, customWeatherService);
  const protect = createProtect(userStore);

  router.use(protect);

  router.route('/farms/:farmId')
    .get(controller.getFarmWeather);

  // Alias singular route for backward and frontend compatibility
  router.route('/farm/:farmId')
    .get(controller.getFarmWeather);

  router.route('/farms/:farmId/history')
    .get(controller.getWeatherHistory);

  router.route('/farm/:farmId/history')
    .get(controller.getWeatherHistory);

  return router;
};

export default createWeatherRouter();
