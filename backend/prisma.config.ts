import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Prisma CLI commands (db pull/migrate) should use direct Postgres.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
