// Re-export seed from db package for convenience
// Run the actual seed from packages/db
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(__dirname, '../../../packages/db');

console.log('Running seed from packages/db...');
execSync('pnpm run db:seed', { cwd: dbDir, stdio: 'inherit' });
