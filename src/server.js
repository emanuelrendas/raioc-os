/**
 * RAIOC OS - Standalone HTTP & API Server Entrypoint (Container Runtime)
 * Used by Docker container runtime and `npm run start:container`.
 */

import { startApiServer } from './api/server.js';
import { memoryRssMonitor } from './monitoring/memory-rss-monitor.js';
import { logger } from './logging/audit-logger.js';

const port = parseInt(process.env.PORT || '3000', 10);

logger.info('SERVER', `Starting RAIOC OS Standalone Server on port ${port}...`);

// Start memory RSS monitor (warning at 180MB, critical drain at 250MB)
memoryRssMonitor.start(15000);

const serverPromise = startApiServer(port);

serverPromise.then((server) => {
  logger.info('SERVER', `RAIOC OS Server ready on port ${port} with /healthz active`);

  const shutdown = (signal) => {
    logger.info('SERVER', `Received ${signal}. Shutting down server gracefully...`);
    memoryRssMonitor.stop();
    if (server && typeof server.close === 'function') {
      server.close(() => {
        logger.info('SERVER', 'Server closed gracefully.');
        if (process.env.NODE_ENV !== 'test') {
          process.exit(0);
        }
      });
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}).catch((err) => {
  logger.error('SERVER', `Failed to start server: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

export { serverPromise };
