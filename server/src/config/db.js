import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    console.warn('[Database] MONGODB_URI contains placeholders or is not defined.');
    console.warn('[Database] Running in decoupled/mock database fallback mode until MongoDB Atlas credentials are provided.');
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`[Database] MongoDB connection failed: ${error.message}`);
    console.warn('[Database] Continuing in fallback mode for offline/mock development.');
    return false;
  }
};

export const getDBStatus = () => {
  return {
    isConnected: mongoose.connection.readyState === 1 || isConnected,
    readyState: mongoose.connection.readyState, // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
  };
};

export default connectDB;
