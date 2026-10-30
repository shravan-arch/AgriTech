import { farmStore as defaultFarmStore } from '../storage/farmStore.js';
import defaultWeatherService from './weatherService.js';
import defaultSimulatorService from './sensorSimulatorService.js';

class SchedulerService {
  constructor() {
    this.weatherJobTimer = null;
    this.isWeatherJobRunning = false;
    this.weatherIntervalMs = 30 * 60 * 1000; // 30 minutes default
  }

  startWeatherAutoRefresh(farmStore = defaultFarmStore, weatherService = defaultWeatherService, intervalMinutes = 30) {
    if (this.weatherJobTimer) {
      clearInterval(this.weatherJobTimer);
    }

    this.weatherIntervalMs = Math.max(5, intervalMinutes) * 60 * 1000;

    const executeRefresh = async () => {
      if (this.isWeatherJobRunning) return;
      this.isWeatherJobRunning = true;

      try {
        // Collect farms that have latitude and longitude
        let allFarms = [];
        try {
          if (farmStore.listAllFarmsWithCoordinates) {
            allFarms = await farmStore.listAllFarmsWithCoordinates();
          }
        } catch {
          // ignore error if store doesn't support bulk query
        }

        for (const farm of allFarms) {
          if (farm.location?.latitude && farm.location?.longitude) {
            await weatherService.getFarmWeather(farm, { farmStore, persist: true }).catch(() => {});
            // Pacing delay to strictly prevent bursting requests to Open-Meteo
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
      } catch (err) {
        console.warn('[SchedulerService] Weather refresh cycle encountered error:', err.message);
      } finally {
        this.isWeatherJobRunning = false;
      }
    };

    // Run periodically
    this.weatherJobTimer = setInterval(executeRefresh, this.weatherIntervalMs);
  }

  stopAll() {
    if (this.weatherJobTimer) {
      clearInterval(this.weatherJobTimer);
      this.weatherJobTimer = null;
    }
    defaultSimulatorService.stopAll();
  }
}

export const schedulerService = new SchedulerService();
export default schedulerService;
