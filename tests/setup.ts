// Vitest already sets NODE_ENV=test; this only pulls in the local database and bucket
// credentials so the integration tests talk to the docker-compose services.
import 'dotenv/config';
