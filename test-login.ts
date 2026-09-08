import { db } from './src/db/index.js';
import { users } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function run() {
  try {
    const res = await db.select().from(users).where(eq(users.email, 'sakethma007@gmail.com'));
    console.log(res);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
