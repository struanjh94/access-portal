import express from 'express';
import { getActor } from '../middleware/actor.js';

const meRouter = express.Router();

/**
 * Returns the current actor with their roles and resolved permissions.
 */
meRouter.get('/me', (req, res) => {
  res.json(getActor(req));
});

export { meRouter };
