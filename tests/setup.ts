// Vitest already sets NODE_ENV=test; this only pulls in the local database and bucket
// credentials so the integration tests talk to the docker-compose services.
import 'dotenv/config';

// The integration tests create and delete rows. Pointing them at anything other than a
// local database is almost always a mistake, so make it one you have to opt into.
const host = new URL(process.env.DATABASE_URL ?? 'postgres://localhost').hostname;
const isLocal = ['localhost', '127.0.0.1', '::1', 'postgres'].includes(host);

if (!isLocal && process.env.ALLOW_REMOTE_TEST_DB !== 'true') {
  throw new Error(
    `Refusing to run tests against ${host}. These tests write and delete rows. ` +
      'Point DATABASE_URL at the local database, or set ALLOW_REMOTE_TEST_DB=true.',
  );
}
