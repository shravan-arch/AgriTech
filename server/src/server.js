import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas (or graceful mock fallback)
connectDB();

const server = app.listen(PORT, () => {
  console.log(`[AgriTech Server] Running on http://localhost:${PORT}`);
  console.log(`[AgriTech Server] Health check available at http://localhost:${PORT}/api/health`);
  console.log(`[AgriTech Server] Auth endpoints available at http://localhost:${PORT}/api/auth`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated.');
  });
});

export default server;
