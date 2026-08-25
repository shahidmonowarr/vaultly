import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../lib/password';
import { ensureBucket } from '../services/storage';
import { db, pool } from './client';
import { users } from './schema';

const DEMO_EMAIL = 'demo@vaultly.app';
const DEMO_PASSWORD = 'demo-password-2026';

async function seed() {
  const origins = new Set(['http://localhost:3000']);
  if (process.env.APP_ORIGIN) {
    origins.add(process.env.APP_ORIGIN);
  }

  await ensureBucket([...origins]);
  console.log('storage bucket ready');

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${DEMO_EMAIL}`)
    .limit(1);

  if (existing) {
    console.log(`demo account already present: ${DEMO_EMAIL}`);
    return;
  }

  await db.insert(users).values({ email: DEMO_EMAIL, passwordHash: await hashPassword(DEMO_PASSWORD) });
  console.log(`demo account created: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
