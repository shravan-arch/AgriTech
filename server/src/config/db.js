import mongoose from 'mongoose';

let isConnected = false;
let lastConnectionOutcome = {
  attempted: false,
  success: false,
  host: null,
  database: null,
  errorName: null,
  errorCode: null,
  errorCodeName: null,
  errorMessage: null,
  timestamp: null,
};

/**
 * Extracts safe diagnostic metadata from the connection URI without revealing credentials.
 */
export const getSafeConnectionDetails = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return {
      configured: false,
      reason: 'MONGODB_URI is not defined in environment',
    };
  }

  if (uri.includes('<username>') || uri.includes('<password>')) {
    return {
      configured: false,
      reason: 'MONGODB_URI contains unreplaced template placeholders (<username>/<password>)',
    };
  }

  try {
    const parsed = new URL(uri);
    return {
      configured: true,
      protocol: parsed.protocol ? parsed.protocol.replace(':', '') : 'unknown',
      host: parsed.host || 'unknown',
      database: (parsed.pathname && parsed.pathname !== '/') ? parsed.pathname.replace(/^\//, '') : '(default)',
      hasUsername: Boolean(parsed.username),
      hasPassword: Boolean(parsed.password),
      hasAuthSource: parsed.searchParams.has('authSource'),
      authSource: parsed.searchParams.get('authSource') || null,
      retryWrites: parsed.searchParams.get('retryWrites') || null,
    };
  } catch (err) {
    return {
      configured: true,
      reason: 'Failed to parse MONGODB_URI structure',
    };
  }
};

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  const safeDetails = getSafeConnectionDetails();

  lastConnectionOutcome.attempted = true;
  lastConnectionOutcome.timestamp = new Date().toISOString();
  lastConnectionOutcome.host = safeDetails.host || null;
  lastConnectionOutcome.database = safeDetails.database || null;

  if (!safeDetails.configured) {
    console.warn(`[Database Diagnostic] ${safeDetails.reason}`);
    console.warn('[Database Diagnostic] Operating in local-persistent-store fallback mode.');
    lastConnectionOutcome.errorMessage = safeDetails.reason;
    return false;
  }

  console.log(`[Database Diagnostic] Attempting MongoDB Atlas connection to host [${safeDetails.host}] (database: ${safeDetails.database})...`);

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    lastConnectionOutcome.success = true;
    lastConnectionOutcome.errorName = null;
    lastConnectionOutcome.errorCode = null;
    lastConnectionOutcome.errorCodeName = null;
    lastConnectionOutcome.errorMessage = null;

    console.log(`[Database Diagnostic] MongoDB Atlas connected successfully to host: ${conn.connection.host}`);
    return true;
  } catch (error) {
    isConnected = false;
    lastConnectionOutcome.success = false;
    lastConnectionOutcome.errorName = error.name || 'Error';
    lastConnectionOutcome.errorCode = error.code || null;
    lastConnectionOutcome.errorCodeName = error.codeName || null;
    lastConnectionOutcome.errorMessage = error.message || 'Unknown error occurred during connection';

    console.error(`[Database Diagnostic] Connection failed to [${safeDetails.host}]:`);
    console.error(`  - Error Name: ${lastConnectionOutcome.errorName}`);
    console.error(`  - Error Code: ${lastConnectionOutcome.errorCode || 'N/A'} (${lastConnectionOutcome.errorCodeName || 'N/A'})`);
    console.error(`  - Sanitized Error: ${lastConnectionOutcome.errorMessage}`);
    console.warn('[Database Diagnostic] Preserving local-persistent-store fallback for uninterrupted application service.');

    return false;
  }
};

export const getDBStatus = () => {
  const safeDetails = getSafeConnectionDetails();
  const currentlyConnected = mongoose.connection.readyState === 1 || isConnected;

  return {
    isConnected: currentlyConnected,
    readyState: mongoose.connection.readyState, // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    mode: currentlyConnected ? 'mongodb-atlas' : 'local-persistent-store',
    target: safeDetails,
    diagnostics: {
      attempted: lastConnectionOutcome.attempted,
      success: lastConnectionOutcome.success,
      host: lastConnectionOutcome.host,
      database: lastConnectionOutcome.database,
      errorName: lastConnectionOutcome.errorName,
      errorCode: lastConnectionOutcome.errorCode,
      errorCodeName: lastConnectionOutcome.errorCodeName,
      errorMessage: lastConnectionOutcome.errorMessage,
      lastAttemptAt: lastConnectionOutcome.timestamp,
    },
  };
};

export default connectDB;
