import type { SeizewellLayout } from './seizewell'

export const CHINS_CLOUDS_BLUEPRINT: SeizewellLayout = {
  sun: { position: [-60000000000, 60000000000, 30000000000], size: 500000000, color: '#ffaa88', intensity: 1.0 },
  planet: { position: [-2000000, 1500000, 16000000], size: 5000000 },
  asteroids: { count: 160, range: 1400, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Pirate Base', modelPath: '/models/00088.obj', position: [1000, -500, 1000], scale: 50, rotationAxis: 'y', rotationSpeed: 0.05, collisions: true }, // Placeholder
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [-300, 0, -300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Scruffin Farm (M)', modelPath: '/models/00282.obj', position: [200, 50, -100], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'chins_fire', gateType: 'W' },
  ],
  ships: [],
  background: { type: 'starfield' }
}