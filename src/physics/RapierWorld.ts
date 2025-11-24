import RAPIER from '@dimforge/rapier3d-compat';

let world: RAPIER.World | null = null;
let initDone = false;
let initPromise: Promise<void> | null = null;

export async function ensureRapier(): Promise<typeof RAPIER> {
  if (initDone) return RAPIER;
  if (!initPromise) {
    initPromise = (RAPIER as unknown as { init: (opts?: Record<string, unknown>) => Promise<void> }).init({}).then(() => { initDone = true; });
  }
  await initPromise;
  return RAPIER;
}

export async function getWorld(): Promise<RAPIER.World> {
  if (world) return world;
  await ensureRapier();
  world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  return world;
}

export function getWorldSync(): RAPIER.World | null {
  return world;
}

export async function stepWorld(): Promise<void> {
  const w = await getWorld();
  w.step();
}
