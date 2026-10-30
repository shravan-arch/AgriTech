import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEnvPath = path.resolve(__dirname, '../../.env');
const rootEnvPath = path.resolve(__dirname, '../../../.env');

if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
}

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

export const validateProductionEnv = (env = process.env) => {
  if (env.NODE_ENV !== 'production') return;

  if (env.STORAGE_MODE === 'local-json') {
    throw new Error('Local JSON storage is only available in development.');
  }

  if (!env.CLIENT_URL?.trim() && (env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL)) {
    env.CLIENT_URL = `https://${env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL}`;
  }

  const missing = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL']
    .filter((key) => !env[key]?.trim());

  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }

  if (env.JWT_SECRET.length < 32 || /<|>|your_|replace|example|placeholder/i.test(env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters in production.');
  }

  if (env.SMTP_PORT && (isNaN(parseInt(env.SMTP_PORT, 10)) || parseInt(env.SMTP_PORT, 10) <= 0 || parseInt(env.SMTP_PORT, 10) > 65535)) {
    throw new Error('SMTP_PORT must be a valid port number between 1 and 65535.');
  }

  try {
    const databaseUrl = new URL(env.MONGODB_URI);
    if (!['mongodb:', 'mongodb+srv:'].includes(databaseUrl.protocol)) {
      throw new Error();
    }
    for (const origin of env.CLIENT_URL.split(',').map((value) => value.trim()).filter(Boolean)) {
      const normalizedOrigin = /^https?:\/\//i.test(origin) ? origin : `https://${origin}`;
      const clientUrl = new URL(normalizedOrigin);
      if (clientUrl.protocol !== 'https:' && clientUrl.hostname !== 'localhost') {
        throw new Error();
      }
    }
  } catch {
    throw new Error('MONGODB_URI and CLIENT_URL must be valid production URLs.');
  }
};

export const validateRuntimeEnv = (env = process.env) => {
  validateProductionEnv(env);
  if (env.NODE_ENV !== 'test' &&
      (typeof env.JWT_SECRET !== 'string' ||
       env.JWT_SECRET.length < 32 ||
       /<|>|your_|replace|example|placeholder/i.test(env.JWT_SECRET))) {
    throw new Error('JWT_SECRET must be configured with a unique value of at least 32 characters.');
  }
};

export default dotenv;
