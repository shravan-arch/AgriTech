import { Router } from 'express';
import { getDBStatus } from '../config/db.js';

const router = Router();

router.get('/', (req, res) => {
  const dbStatus = getDBStatus();

  res.status(200).json({
    status: 'ok',
    message: 'AgriTech API Server is operational',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected: dbStatus.isConnected,
      mode: dbStatus.isConnected ? 'mongodb-atlas' : 'dev-fallback-mode'
    },
    services: {
      auth: 'active',
      health: 'active'
    }
  });
});

export default router;
