import type { SeizewellLayout } from './seizewell'

export const FAMILY_ZEIN_BLUEPRINT: SeizewellLayout = {
  sun: { position: [90000000000, 70000000000, 30000000000], size: 550000000, color: '#ffaa88', intensity: 1.0 },
  planet: { position: [-2500000, -1000000, 18000000], size: 5200000 },
  asteroids: { count: 100, range: 1200, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [200, 0, 200], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Massom Mill (M)', modelPath: '/models/00283.obj', position: [-200, 50, -200], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Scruffin Farm (M)', modelPath: '/models/00282.obj', position: [300, -30, -100], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'family_whi', gateType: 'N' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'thuruks_pride', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}