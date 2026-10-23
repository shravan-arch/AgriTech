import { farmStore as defaultFarmStore } from '../storage/farmStore.js';
import defaultWeatherService from '../services/weatherService.js';

export const createWeatherController = (
  farmStore = defaultFarmStore,
  weatherService = defaultWeatherService
) => ({
  async getFarmWeather(req, res, next) {
    try {
      const { farmId } = req.params;
      const farm = await farmStore.findFarm(req.user._id, farmId);
      if (!farm) {
        return res.status(404).json({ error: 'Not Found', message: 'Farm not found.' });
      }

      const weather = await weatherService.getFarmWeather(farm);
      return res.status(200).json({
        success: true,
        data: weather,
      });
    } catch (err) {
      return next(err);
    }
  },
});

export default createWeatherController();
