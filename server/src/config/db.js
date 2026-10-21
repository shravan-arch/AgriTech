import mongoose from 'mongoose';
import { validateRuntimeEnv } from './env.js';

let selectedStorageMode = 'unavailable';

export const getSafeConnectionDetails = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    return { configured: false, host: null, database: null };
  }

  try {
    const parsed = new URL(uri);
    return {
      configured: ['mongodb:', 'mongodb+srv:'].includes(parsed.protocol),
      host: parsed.host || null,
      database: parsed.pathname.replace(/^\//, '') || '(default)',
    };
  } catch {
    return { configured: false, host: null, database: null };
  }
};

export const connectDB = async () => {
  validateRuntimeEnv();
  if (process.env.NODE_ENV === 'development' && process.env.STORAGE_MODE === 'local-json') {
    selectedStorageMode = 'local-json-development';
    console.warn('[Database] Explicit local JSON development storage is enabled; records are not synced to MongoDB.');
    return false;
  }

  const details = getSafeConnectionDetails();

  if (!details.configured) {
    throw new Error('A valid MONGODB_URI is required; no local persistence fallback is available.');
  }

  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    selectedStorageMode = 'mongodb';
    console.log(`[Database] Connected to MongoDB host ${connection.connection.host}.`);
    return connection;
  } catch (error) {
    selectedStorageMode = 'unavailable';
    console.error(`[Database] MongoDB connection failed (${error.name || 'Error'}).`);
    throw new Error('MongoDB connection failed; the server was not started.');
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  selectedStorageMode = 'unavailable';
};

export const getDBStatus = () => {
  const connected = mongoose.connection.readyState === 1;
  const mode = connected
    ? 'mongodb'
    : selectedStorageMode === 'local-json-development' &&
      process.env.NODE_ENV === 'development' &&
      process.env.STORAGE_MODE === 'local-json'
      ? selectedStorageMode
      : 'unavailable';

  return {
    isConnected: connected,
    isAvailable: mode !== 'unavailable',
    readyState: mongoose.connection.readyState,
    mode,
  };
};

export default connectDB;
