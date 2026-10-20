import './config/env.js';
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;

let server;

const startServer = async () => {
  // Attempt MongoDB Atlas connection (falls back gracefully if offline or auth fails)
  await connectDB();

  server = app.listen(PORT, () => {
    console.log(`[AgriTech Server] Running on http://localhost:${PORT}`);
    console.log(`[AgriTech Server] Health check available at http://localhost:${PORT}/api/health`);
    console.log(`[AgriTech Server] Auth endpoints available at http://localhost:${PORT}/api/auth`);
  });
};

startServer();

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('Process terminated.');
    });
  }
});

export default server;
