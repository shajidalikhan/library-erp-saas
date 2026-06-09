import mongoose from 'mongoose';
import { ENV } from './env.config';
import { logger } from '@utils/logger';

/**
 * MongoDB connection helper.
 * - Single source of truth for connection lifecycle.
 * - Handles graceful reconnect logging.
 * - Caller (server.ts) decides what to do on failure (we throw).
 */

mongoose.set('strictQuery', true);

let isConnected = false;

export const connectDB = async (): Promise<typeof mongoose> => {
  if (isConnected) {
    logger.debug('MongoDB already connected, reusing existing connection.');
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(ENV.MONGODB_URI, {
      dbName: ENV.MONGODB_DB_NAME,
      autoIndex: !ENV.IS_PROD,
      serverSelectionTimeoutMS: 15_000,
      maxPoolSize: 20,
    });

    isConnected = conn.connections[0].readyState === 1;

    logger.info(
      `\u2705 MongoDB connected: host=${conn.connection.host} db=${conn.connection.name}`,
    );

    return conn;
  } catch (err) {
    logger.error('\u274C MongoDB connection failed:', err);
    throw err;
  }
};

export const disconnectDB = async (): Promise<void> => {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected.');
};

// Listeners (registered once when this module is loaded)
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  logger.warn('MongoDB connection lost.');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  logger.info('MongoDB reconnected.');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});
