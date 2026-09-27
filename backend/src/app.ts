import express from 'express';
import { resolveActor } from './middleware/actor.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';

const app = express();

app.use(express.json());

app.use(healthRouter);
app.use(resolveActor);
app.use(meRouter);

app.use(errorHandler);

export { app };
