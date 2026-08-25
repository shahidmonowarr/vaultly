import 'dotenv/config';
import { execFileSync } from 'node:child_process';

export default function setup() {
  execFileSync('npx', ['tsx', 'src/server/db/migrate.ts'], { stdio: 'inherit' });
}
