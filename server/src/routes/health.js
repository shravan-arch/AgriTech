import { Router } from 'express';
import { getDBStatus } from '../config/db.js';
import { isConfigured as isEmailConfigured } from '../services/emailService.js';

const router = Router();

router.get('/', (req, res) => {
  const storage = getDBStatus();
  const available = storage.isAvailable;
  const status = !available
    ? 'unavailable'
    : storage.mode === 'mongodb'
      ? 'ok'
      : 'degraded';

  return res.status(available ? 200 : 503).json({
    status,
    services: {
      api: 'active',
      persistence: storage.mode,
      email: isEmailConfigured() ? 'configured' : 'unconfigured',
    },
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

export default router;
