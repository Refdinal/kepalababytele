import express from 'express';
import { router } from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export function createApp({ mount } = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(router);
  if (mount) mount(app);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
