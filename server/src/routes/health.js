import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'AgriTech API Server is operational',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

export default router;
