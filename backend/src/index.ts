import 'dotenv/config';
import { app } from './app.js';
import { migrate } from './db/migrate.js';

const port = Number(process.env.PORT ?? 3000);

try {
  await migrate();
} catch (error) {
  console.error('Migrations failed; the server will not start.', error);
  process.exit(1);
}

app.listen(port, () => {
  console.log(`Express server running on port: ${port}`);
});
