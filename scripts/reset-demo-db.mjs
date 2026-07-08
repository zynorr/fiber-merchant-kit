import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(repoRoot, 'packages', 'api-server', 'data');
const files = ['merchant.db', 'merchant.db-shm', 'merchant.db-wal'];

let removed = 0;

for (const file of files) {
  const target = path.join(dataDir, file);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { force: true });
    removed += 1;
    console.log(`Removed ${path.relative(repoRoot, target)}`);
  }
}

if (removed === 0) {
  console.log('Demo database already clean.');
} else {
  console.log('Demo database reset. The API server will recreate it on next start.');
}
