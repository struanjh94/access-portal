import 'dotenv/config';
import { migrate } from '../src/db/migrate.js';

await migrate();
