import express from 'express';
import { resolveActor } from './middleware/actor.js';
import { errorHandler } from './middleware/error-handler.js';
import { auditLogsRouter } from './routes/audit-logs.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import { usersRouter } from './routes/users.js';

const app = express();

app.use(express.json());

app.use(healthRouter);
app.use(resolveActor);
app.use(meRouter);
app.use(usersRouter);
app.use(auditLogsRouter);

app.use(errorHandler);

export { app };
