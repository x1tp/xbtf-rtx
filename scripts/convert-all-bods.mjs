import fs from 'node:fs';
import path from 'node:path';
import { convertBodToObj } from './modeling.mjs';

/**
 * Bulk converter for XBTF .bod files.
 * Writes OBJ+MTL into public/models, mirroring the source filename.
 *
 * Usage:
 *   node scripts/convert-all-bods.mjs               # convert all .bod in xbtf_models/v
 *   node scripts/convert-all-bods.mjs pattern=Gate  # only files whose path includes "Gate"
 *   node scripts/convert-all-bods.mjs limit=50      # stop after N files
 */

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'xbtf_models', 'v');
const TEX_DIR = path.join(ROOT, 'public', 'models', 'true');
const OUT_DIR = path.join(ROOT, 'public', 'models');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { pattern: null, limit: null };
  for (const a of args) {
    if (a.startsWith('pattern=')) opts.pattern = a.replace('pattern=', '');
    if (a.startsWith('limit=')) opts.limit = parseInt(a.replace('limit=', ''), 10);
  }
  return opts;
}

async function main() {
  const { pattern, limit } = parseArgs();
  const files = fs.readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.bod'));
  const filtered = pattern ? files.filter((f) => f.toLowerCase().includes(pattern.toLowerCase())) : files;
  const targets = typeof limit === 'number' && limit > 0 ? filtered.slice(0, limit) : filtered;
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Converting ${targets.length} .bod files${pattern ? ` matching "${pattern}"` : ''}...`);
  let idx = 0;
  for (const file of targets) {
    idx += 1;
    const src = path.join(SRC_DIR, file);
    const base = path.parse(file).name;
    const outName = base;
    try {
      console.log(`[${idx}/${targets.length}] ${file}`);
      await convertBodToObj(src, TEX_DIR, outName, OUT_DIR, false, null, null, true, 0);
    } catch (e) {
      console.error(`Failed ${file}: ${e}`);
    }
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
