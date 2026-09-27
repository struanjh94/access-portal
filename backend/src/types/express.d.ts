import type { Actor } from '../../../shared/contract.js';

/**
 * Declares the actor property that the actor middleware attaches to every
 * request (req.actor).
 *
 * https://expressjs.com/en/5x/guide/overriding-express-api/
 */
declare global {
  namespace Express {
    interface Request {
      actor?: Actor;
    }
  }
}
