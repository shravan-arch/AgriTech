import { farmStore as defaultFarmStore } from '../storage/farmStore.js';

export const createSensorController = (farmStore = defaultFarmStore) => ({
  async listSensors(req, res, next) {
    try {
      const sensors = await farmStore.listSensors(req.user._id, req.query);
      return res.status(200).json({
        success: true,
        count: sensors.length,
        data: sensors,
      });
    } catch (err) {
      return next(err);
    }
  },

  async getSensor(req, res, next) {
    try {
      const sensor = await farmStore.findSensor(req.user._id, req.params.id);
      if (!sensor) {
        return res.status(404).json({ error: 'Not Found', message: 'Sensor not found.' });
      }
      return res.status(200).json({
        success: true,
        data: sensor,
      });
    } catch (err) {
      return next(err);
    }
  },

  async createSensor(req, res, next) {
    try {
      const { farmId, name, type, deviceUid } = req.body;
      if (!farmId) {
        return res.status(400).json({ error: 'Validation Error', message: 'Farm ID is required.' });
      }
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Validation Error', message: 'Sensor name is required.' });
      }
      if (!type) {
        return res.status(400).json({ error: 'Validation Error', message: 'Sensor type is required.' });
      }
      if (!deviceUid || !deviceUid.trim()) {
        return res.status(400).json({ error: 'Validation Error', message: 'Device UID is required.' });
      }

      const result = await farmStore.createSensor(req.user._id, req.body);
      if (result.notFound) {
        return res.status(404).json({
          error: 'Not Found',
          message: `${result.resource.charAt(0).toUpperCase() + result.resource.slice(1)} not found.`,
        });
      }
      if (result.conflict) {
        return res.status(409).json({ error: 'Conflict', message: result.message });
      }

      return res.status(201).json({
        success: true,
        data: result.sensor,
      });
    } catch (err) {
      return next(err);
    }
  },

  async updateSensor(req, res, next) {
    try {
      const updated = await farmStore.updateSensor(req.user._id, req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Not Found', message: 'Sensor not found.' });
      }
      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      return next(err);
    }
  },

  async deleteSensor(req, res, next) {
    try {
      const deleted = await farmStore.deleteSensor(req.user._id, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Not Found', message: 'Sensor not found.' });
      }
      return res.status(200).json({
        success: true,
        message: 'Sensor deleted.',
        data: deleted,
      });
    } catch (err) {
      return next(err);
    }
  },

  async ingestReading(req, res, next) {
    try {
      const sensorId = req.params.id;
      const sensor = await farmStore.findSensor(req.user._id, sensorId);
      if (!sensor) {
        return res.status(404).json({ error: 'Not Found', message: 'Sensor device not found.' });
      }

      const { value } = req.body;
      if (value === undefined || isNaN(Number(value))) {
        return res.status(400).json({ error: 'Validation Error', message: 'Numeric reading value is required.' });
      }

      const reading = await farmStore.addSensorReading(sensor, req.body);
      return res.status(201).json({
        success: true,
        message: 'Telemetry reading recorded successfully.',
        data: reading,
      });
    } catch (err) {
      return next(err);
    }
  },

  async listReadings(req, res, next) {
    try {
      const sensor = await farmStore.findSensor(req.user._id, req.params.id);
      if (!sensor) {
        return res.status(404).json({ error: 'Not Found', message: 'Sensor not found.' });
      }

      const readings = await farmStore.listSensorReadings(req.user._id, req.params.id, req.query.limit || 100);
      return res.status(200).json({
        success: true,
        count: readings.length,
        data: readings,
      });
    } catch (err) {
      return next(err);
    }
  },
});

export default createSensorController();
