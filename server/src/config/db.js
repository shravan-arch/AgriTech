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

let connectionPromise = null;
let lastConnectionDiagnostic = {
  attempted: false,
  success: false,
  errorName: null,
  errorCode: null,
  errorMessage: null,
  timestamp: null,
};

const sanitizeMongoError = (message) => {
  if (!message || typeof message !== 'string') return 'Unknown database error.';
  return message.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
};

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    selectedStorageMode = 'mongodb';
    return mongoose.connection;
  }
  if (connectionPromise) {
    return connectionPromise;
  }

  try {
    validateRuntimeEnv();
  } catch (envError) {
    lastConnectionDiagnostic.attempted = true;
    lastConnectionDiagnostic.success = false;
    lastConnectionDiagnostic.errorName = envError.name || 'ConfigurationError';
    lastConnectionDiagnostic.errorMessage = envError.message;
    lastConnectionDiagnostic.timestamp = new Date().toISOString();
    console.error(`[Database] Environment validation error: ${envError.message}`);
    throw envError;
  }

  if (process.env.NODE_ENV === 'development' && process.env.STORAGE_MODE === 'local-json') {
    selectedStorageMode = 'local-json-development';
    console.warn('[Database] Explicit local JSON development storage is enabled; records are not synced to MongoDB.');
    return false;
  }

  const details = getSafeConnectionDetails();

  if (!details.configured) {
    const configError = new Error('A valid MONGODB_URI is required; no local persistence fallback is available.');
    lastConnectionDiagnostic.attempted = true;
    lastConnectionDiagnostic.success = false;
    lastConnectionDiagnostic.errorName = 'ConfigurationError';
    lastConnectionDiagnostic.errorMessage = configError.message;
    lastConnectionDiagnostic.timestamp = new Date().toISOString();
    throw configError;
  }

  connectionPromise = (async () => {
    lastConnectionDiagnostic.attempted = true;
    lastConnectionDiagnostic.timestamp = new Date().toISOString();
    try {
      const connection = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      selectedStorageMode = 'mongodb';
      lastConnectionDiagnostic.success = true;
      lastConnectionDiagnostic.errorName = null;
      lastConnectionDiagnostic.errorCode = null;
      lastConnectionDiagnostic.errorMessage = null;
      console.log(`[Database] Connected to MongoDB host ${connection.connection.host}.`);
      return connection;
    } catch (error) {
      selectedStorageMode = 'unavailable';
      connectionPromise = null;
      const sanitizedMessage = sanitizeMongoError(error.message);
      lastConnectionDiagnostic.success = false;
      lastConnectionDiagnostic.errorName = error.name || 'Error';
      lastConnectionDiagnostic.errorCode = error.code || null;
      lastConnectionDiagnostic.errorMessage = sanitizedMessage;
      console.error(`[Database] MongoDB connection failed (${error.name || 'Error'}): ${sanitizedMessage}`);
      throw new Error('MongoDB connection failed; the server was not started.');
    }
  })();

  return connectionPromise;
};

export const disconnectDB = async () => {
  connectionPromise = null;
  await mongoose.disconnect();
  selectedStorageMode = 'unavailable';
  lastConnectionDiagnostic = {
    attempted: false,
    success: false,
    errorName: null,
    errorCode: null,
    errorMessage: null,
    timestamp: null,
  };
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
    diagnostics: { ...lastConnectionDiagnostic },
  };
};

export default connectDB;
