import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER;
const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD;

const dbCredentials = connectionString
  ? { url: connectionString }
  : {
      host: sqlHost || '',
      user: user || '',
      password: password || '',
      database: sqlDbName || '',
      ssl: process.env.SQL_SSL === 'true' || sqlHost?.includes('neon') || sqlHost?.includes('render') ? { rejectUnauthorized: false } : false,
    };

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials,
});
