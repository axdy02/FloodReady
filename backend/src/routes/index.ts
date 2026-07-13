import { Router } from 'express';

import { authRouter } from '../modules/auth/auth.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { incidentsRouter } from '../modules/incidents/incidents.routes.js';
import { ownReportsRouter, reportsRouter } from '../modules/reports/reports.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/users/me/reports', ownReportsRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/incidents', incidentsRouter);
