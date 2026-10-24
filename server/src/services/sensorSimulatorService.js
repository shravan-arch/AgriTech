import { farmStore as defaultFarmStore } from '../storage/farmStore.js';

const SENSOR_TYPE_DEFAULTS = {
  soil_moisture: {
    nominal: 45,
    min: 15,
    max: 85,
    volatility: 2.2,
    thresholds: { min: 25, max: 70, unit: '%' },
    unit: '%',
    label: 'Simulated Soil Moisture Probe',
  },
  soil_temperature: {
    nominal: 22,
    min: 12,
    max: 38,
    volatility: 0.8,
    thresholds: { min: 16, max: 30, unit: '°C' },
    unit: '°C',
    label: 'Simulated Soil Temperature Sensor',
  },
  air_temperature: {
    nominal: 25,
    min: 10,
    max: 45,
    volatility: 1.2,
    thresholds: { min: 15, max: 38, unit: '°C' },
    unit: '°C',
    label: 'Simulated Air Temperature Sensor',
  },
  humidity: {
    nominal: 62,
    min: 20,
    max: 95,
    volatility: 3.0,
    thresholds: { min: 30, max: 80, unit: '%' },
    unit: '%',
    label: 'Simulated Humidity Gauge',
  },
};

class SensorSimulatorService {
  constructor() {
    this.activeSimulations = new Map(); // key -> { running, intervalSeconds, timer, farmId, fieldId, ownerId, lastValues }
  }

  isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  assertDevelopmentMode() {
    if (this.isProduction()) {
      const err = new Error('Sensor simulator is strictly disabled in production environments.');
      err.status = 403;
      err.code = 'SIMULATOR_DISABLED_IN_PRODUCTION';
      throw err;
    }
  }

  getSessionKey(ownerId, farmId, fieldId) {
    return `${ownerId}:${farmId}:${fieldId || 'all'}`;
  }

  async ensureSimulatedSensor(farmStore, ownerId, farmId, fieldId, type) {
    const typeDef = SENSOR_TYPE_DEFAULTS[type] || SENSOR_TYPE_DEFAULTS.soil_moisture;
    const farmSuffix = String(farmId).slice(-4);
    const fieldSuffix = fieldId ? String(fieldId).slice(-4) : 'GEN';
    const deviceUid = `SIM-${type.toUpperCase().slice(0, 4)}-${farmSuffix}-${fieldSuffix}`;

    let sensor = await farmStore.findSensorByUid(ownerId, deviceUid);
    if (!sensor) {
      const created = await farmStore.createSensor(ownerId, {
        farmId,
        fieldId: fieldId || undefined,
        name: `[SIMULATED] ${typeDef.label}`,
        type,
        deviceUid,
        thresholds: typeDef.thresholds,
        isSimulated: true,
        source: 'simulated',
        status: 'active',
        batteryLevel: 98,
      });
      sensor = created.sensor;
    }
    return sensor;
  }

  async generateNextReading(farmStore, sensor, options = {}) {
    const type = sensor.type || 'soil_moisture';
    const typeDef = SENSOR_TYPE_DEFAULTS[type] || SENSOR_TYPE_DEFAULTS.soil_moisture;

    let value;
    if (options.customValue !== undefined && !isNaN(Number(options.customValue))) {
      value = Number(options.customValue);
    } else if (options.forceBreach) {
      // Force a threshold breach to test alert logic
      if (options.breachDirection === 'high' || Math.random() > 0.5) {
        value = Number((sensor.thresholds?.max ? sensor.thresholds.max + 8.5 : 85).toFixed(1));
      } else {
        value = Number((sensor.thresholds?.min ? Math.max(0, sensor.thresholds.min - 8.5) : 15).toFixed(1));
      }
    } else {
      // Realistic gradual random walk with bounded nominal drift
      const prevVal = options.previousValue !== undefined ? Number(options.previousValue) : typeDef.nominal;
      const drift = (Math.random() - 0.49) * typeDef.volatility * 2;
      let nextVal = prevVal + drift;

      // Keep within plausible sensor limits
      if (nextVal < typeDef.min) nextVal = typeDef.min + Math.random() * 2;
      if (nextVal > typeDef.max) nextVal = typeDef.max - Math.random() * 2;
      value = Number(nextVal.toFixed(1));
    }

    const readingData = {
      value,
      unit: sensor.thresholds?.unit || typeDef.unit,
      timestamp: options.timestamp || new Date().toISOString(),
      isSimulated: true,
      source: 'simulated',
      batteryLevel: Math.max(70, Math.min(100, Math.floor(95 + Math.random() * 5))),
    };

    const addResult = await farmStore.addSensorReading(sensor, readingData);
    const reading = addResult?.reading || addResult;
    const alert = addResult?.alert || null;
    return { reading, alert, value, sensor };
  }

  async startSimulation(farmStore = defaultFarmStore, ownerId, config = {}) {
    this.assertDevelopmentMode();

    const { farmId, fieldId, intervalSeconds = 15, types = ['soil_moisture', 'soil_temperature'] } = config;
    if (!farmId) {
      const err = new Error('farmId is required to start simulation.');
      err.status = 400;
      throw err;
    }

    const key = this.getSessionKey(ownerId, farmId, fieldId);
    this.stopSimulation(ownerId, farmId, fieldId);

    const session = {
      ownerId,
      farmId,
      fieldId: fieldId || null,
      intervalSeconds: Math.max(5, Math.min(3600, Number(intervalSeconds) || 15)),
      types,
      running: true,
      startedAt: new Date().toISOString(),
      lastValues: {},
      timer: null,
      lastReadings: [],
    };

    // Immediate first tick
    const tick = async () => {
      try {
        for (const type of session.types) {
          const sensor = await this.ensureSimulatedSensor(farmStore, ownerId, farmId, fieldId, type);
          if (sensor) {
            const { reading, value } = await this.generateNextReading(farmStore, sensor, {
              previousValue: session.lastValues[type],
            });
            session.lastValues[type] = value;
            session.lastReadings.unshift({
              sensorId: sensor._id,
              sensorName: sensor.name,
              type,
              value,
              unit: reading.unit,
              timestamp: reading.timestamp,
            });
            if (session.lastReadings.length > 20) session.lastReadings.pop();
          }
        }
      } catch (tickErr) {
        console.warn('[SensorSimulator] Tick generation error:', tickErr.message);
      }
    };

    await tick();

    // Schedule subsequent ticks
    session.timer = setInterval(tick, session.intervalSeconds * 1000);
    this.activeSimulations.set(key, session);

    return {
      success: true,
      message: `Simulator running for farm ${farmId} (interval: ${session.intervalSeconds}s)`,
      session: {
        key,
        farmId,
        fieldId,
        running: true,
        intervalSeconds: session.intervalSeconds,
        types: session.types,
      },
    };
  }

  stopSimulation(ownerId, farmId, fieldId) {
    const key = this.getSessionKey(ownerId, farmId, fieldId);
    const session = this.activeSimulations.get(key);
    if (session) {
      if (session.timer) {
        clearInterval(session.timer);
      }
      this.activeSimulations.delete(key);
      return { success: true, message: 'Simulation stopped successfully.' };
    }
    return { success: true, message: 'No active simulation found for this target.' };
  }

  async triggerSingleReading(farmStore = defaultFarmStore, ownerId, options = {}) {
    this.assertDevelopmentMode();

    const { farmId, fieldId, type = 'soil_moisture', forceBreach = false, customValue } = options;
    if (!farmId) {
      const err = new Error('farmId is required for test reading generation.');
      err.status = 400;
      throw err;
    }

    const sensor = await this.ensureSimulatedSensor(farmStore, ownerId, farmId, fieldId, type);
    const result = await this.generateNextReading(farmStore, sensor, { forceBreach, customValue });

    return {
      success: true,
      message: forceBreach
        ? `[SIMULATED] Test threshold breach reading recorded for ${sensor.name}`
        : `[SIMULATED] Test telemetry reading recorded for ${sensor.name}`,
      data: {
        sensorId: sensor._id,
        sensorName: sensor.name,
        deviceUid: sensor.deviceUid,
        type: sensor.type,
        value: result.value,
        unit: result.reading.unit,
        isSimulated: true,
        source: 'simulated',
        timestamp: result.reading.timestamp,
        alert: result.alert || null,
      },
    };
  }

  getStatus(ownerId, farmId, fieldId) {
    if (this.isProduction()) {
      return { running: false, disabledInProduction: true };
    }

    const key = this.getSessionKey(ownerId, farmId, fieldId);
    const session = this.activeSimulations.get(key);

    if (session) {
      return {
        running: true,
        farmId: session.farmId,
        fieldId: session.fieldId,
        intervalSeconds: session.intervalSeconds,
        types: session.types,
        startedAt: session.startedAt,
        lastReadings: session.lastReadings || [],
      };
    }

    return {
      running: false,
      farmId,
      fieldId,
      intervalSeconds: 15,
      types: ['soil_moisture', 'soil_temperature'],
      lastReadings: [],
    };
  }

  stopAll() {
    for (const [key, session] of this.activeSimulations.entries()) {
      if (session.timer) clearInterval(session.timer);
    }
    this.activeSimulations.clear();
  }
}

export { SensorSimulatorService };
export const createSensorSimulatorService = () => new SensorSimulatorService();
export const sensorSimulatorService = new SensorSimulatorService();
export default sensorSimulatorService;
