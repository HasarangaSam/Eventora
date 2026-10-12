import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // Generation and validation work without a database connection. Migration commands need DATABASE_URL.
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
