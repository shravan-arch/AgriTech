import './config/env.js';
import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { validateRuntimeEnv } from './config/env.js';

const PORT = process.env.PORT || 5000;

let server;
let shuttingDown = false;

const startServer = async () => {
  validateRuntimeEnv();
  await connectDB();

  server = app.listen(PORT, () => {
    console.log(`[AgriTech Server] Running on http://localhost:${PORT}`);
    console.log(`[AgriTech Server] Health check available at http://localhost:${PORT}/api/health`);
    console.log(`[AgriTech Server] Auth endpoints available at http://localhost:${PORT}/api/auth`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[Server Error] Port ${PORT} is already in use by another running process.`);
      console.error(`[Server Error] If an existing AgriTech server is already running, please stop it first or run 'npx kill-port ${PORT}'.`);
    } else {
      console.error(`[Server Error] ${error.message}`);
    }
    process.exit(1);
  });
};

startServer().catch((error) => {
  console.error(`[Startup] Server startup failed: ${error.message}`);
  process.exitCode = 1;
});

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Shutting down gracefully...`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await disconnectDB();
    console.log('Process terminated.');
  } catch (error) {
    console.error(`[Shutdown] Graceful shutdown failed (${error.name || 'Error'}).`);
    process.exitCode = 1;
  }
};

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });

export default server;
