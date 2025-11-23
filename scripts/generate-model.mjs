import { startModelingSession, applyOperation, getModelState, checkConstraints, exportModel } from './modeling.mjs';
import fs from 'node:fs';

async function generate(spec) {
  const sessionId = startModelingSession({ name: spec.name });
  for (const op of spec.operations) {
    const res = await applyOperation(sessionId, op);
    if (!res.ok) {
      console.error(res.error);
      process.exit(1);
    }
  }
  const state = getModelState(sessionId);
  const report = checkConstraints(sessionId, spec.constraints ?? {});
  if (!report.ok) {
    console.error('constraint_fail', report.issues);
  }
  const out = await exportModel(sessionId, 'glb');
  if (!out.ok) {
    console.error(out.error);
    process.exit(1);
  }
  console.log(JSON.stringify({ file: out.file, totalTriangles: state.totalTriangles, size: state.size }, null, 2));
}

async function loadSpec(filePath) {
  const text = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(text);
}

async function run() {
  const args = process.argv.slice(2);
  const input = args[0];
  const watch = args.includes('--watch');
  let spec = null;
  if (input) {
    spec = await loadSpec(input);
  } else {
    spec = { name: 'station', operations: [{ type: 'group', name: 'root' }], constraints: { maxFaces: 100000, heightRange: [0, 200] } };
  }
  await generate(spec);
  if (watch && input) {
    fs.watchFile(input, { interval: 300 }, async () => {
      try {
        const s = await loadSpec(input);
        await generate(s);
      } catch (e) {
        console.error(String(e));
      }
    });
  }
}

run().catch((e) => { console.error(String(e)); process.exit(1); });