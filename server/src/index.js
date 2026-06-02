const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const { ensureDatabase, runMigrations, closePool } = require('./db');
const { startReminderTask } = require('./reminder');
const { notFoundHandler, errorHandler } = require('./middleware/error-handler');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use('/api', routes);
app.use('/api', notFoundHandler);
app.use(errorHandler);

async function start() {
  await ensureDatabase();
  await runMigrations();

  const server = app.listen(config.port, () => {
    console.log(`[venue-booking-server] http://localhost:${config.port}`);
    console.log(`[venue-booking-server] MySQL ${config.mysql.host}:${config.mysql.port} / ${config.mysql.database}`);
    console.log('[venue-booking-server] Health check: GET /api/health');
    if (config.mockAuth) {
      console.log('[venue-booking-server] MOCK_AUTH is enabled');
    }

    startReminderTask();
  });

  async function shutdown(signal) {
    console.log(`[venue-booking-server] ${signal} received, shutting down`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('[startup failed]', err.message);
  process.exit(1);
});
