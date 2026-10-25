/**
 * Sync the single source of truth (.env) into .dev.vars, which is the only
 * file `wrangler dev` reads for local secrets.
 *
 * Rules:
 *  - .env is authored by hand and never committed.
 *  - .dev.vars is generated. Do not edit it by hand.
 *  - Values are copied verbatim (wrangler accepts quoted values).
 *  - Missing or empty values are reported, never invented.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = join(root, '.env');
const OUT_FILE = join(root, '.dev.vars');

function parseDotEnv(text) {
  const pairs = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    pairs.push([key, value]);
  }
  return pairs;
}

const text = await readFile(ENV_FILE, 'utf8').catch(() => {
  console.error('[env:sync] .env not found at project root. Nothing to sync.');
  process.exit(1);
});

const pairs = parseDotEnv(text);
const empty = pairs.filter(([, v]) => v === '' || v === '""' || v === "''").map(([k]) => k);

const body = [
  '# AUTO-GENERATED from .env by scripts/env-sync.mjs. Do not edit, do not commit.',
  ...pairs.map(([k, v]) => `${k}=${v}`),
  '',
].join('\n');

await writeFile(OUT_FILE, body, { mode: 0o600 });

console.log(`[env:sync] wrote ${pairs.length} variable(s) to .dev.vars`);
if (empty.length) {
  console.log(`[env:sync] still empty: ${empty.join(', ')}`);
}
