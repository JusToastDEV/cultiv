import { access, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workerRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(workerRoot, '..');
const outDir = path.join(workerRoot, 'dist');

const assetEntries = [
  'index.html',
  'app.js',
  'main.js',
  'data.js',
  'styles.css',
  'manifest.json',
  'sw.js',
  'favicon.ico',
  'robots.txt',
  '404.html',
  'assets',
  'imgs',
  'css',
  'js'
];

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const entry of assetEntries) {
  const sourcePath = path.join(repoRoot, entry);
  if (!(await exists(sourcePath))) continue;

  const targetPath = path.join(outDir, entry);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true });
}

console.log(`Built deploy assets in ${outDir}`);