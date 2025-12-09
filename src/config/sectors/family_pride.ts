import type { SeizewellLayout } from './seizewell'

export const FAMILY_PRIDE_BLUEPRINT: SeizewellLayout = {
  sun: { position: [100000000000, 80000000000, 40000000000], size: 700000000, color: '#ffaa88', intensity: 1.2 },
  planet: { position: [-3000000, 2000000, 20000000], size: 6500000 },
  asteroids: { count: 180, range: 1600, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Split Shipyard', modelPath: '/models/00444.obj', position: [0, 0, 500], scale: 38, rotationAxis: 'z', rotationSpeed: -0.00, collisions: true },
    { name: 'Split Equipment Dock', modelPath: '/models/00448.obj', position: [-500, 100, -500], scale: 34, rotationAxis: 'z', rotationSpeed: -0.00, collisions: true },
    { name: 'Split Trading Station', modelPath: '/models/00001.obj', position: [500, -100, -500], scale: 32, rotationAxis: 'z', rotationSpeed: -0.08, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [1000, 0, 1000], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Chelt Aquarium (M)', modelPath: '/models/00282.obj', position: [-1000, 0, 1000], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Rastar Refinery (M)', modelPath: '/models/00283.obj', position: [1000, 0, -1000], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'thuruks_pride', gateType: 'W' },
  ],
  ships: [],
  background: { type: 'starfield' }
}