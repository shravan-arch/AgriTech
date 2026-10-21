import './config/env.js';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import healthRouter from './routes/health.js';
import { createAuthRouter } from './routes/auth.js';
import { createFarmRouter } from './routes/farms.js';
import { userStore as defaultUserStore } from './storage/userStore.js';
import { farmStore as defaultFarmStore } from './storage/farmStore.js';

export const createApp = ({
  userStore = defaultUserStore,
  farmStore = defaultFarmStore,
} = {}) => {
  const app = express();
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    next();
  });
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(Object.assign(new Error('Origin is not allowed.'), { status: 403 }));
    },
  }));
  app.use(express.json({ limit: '20kb' }));
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));

  if (process.env.NODE_ENV !== 'test') app.use(morgan('combined'));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', createAuthRouter(userStore));
  app.use('/api/farms', createFarmRouter(farmStore, userStore));

  app.use((req, res) => res.status(404).json({
    error: 'Not Found',
    message: 'Endpoint not found.',
  }));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Validation Error', message: 'Request body must be valid JSON.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Payload Too Large', message: 'Request body exceeds the size limit.' });
    }
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Conflict', message: 'A record with that value already exists.' });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ error: 'Validation Error', message: 'Submitted data is invalid.' });
    }
    if (error.status === 403) {
      return res.status(403).json({ error: 'Forbidden', message: 'Request origin is not allowed.' });
    }

    console.error(`[API] Request failed (${error.name || 'Error'}).`);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again.',
    });
  });

  return app;
};

const app = createApp();

export default app;
