import { Router } from 'express';
import { getDBStatus } from '../config/db.js';

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
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
