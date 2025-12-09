import type { SeizewellLayout } from './seizewell'

export const PRIEST_PITY_BLUEPRINT: SeizewellLayout = {
  sun: { position: [80000000000, 50000000000, 20000000000], size: 550000000, color: '#ffaa66', intensity: 1.0 },
  planet: { position: [3000000, -1000000, -14000000], size: 5200000 },
  asteroids: { count: 180, range: 1500, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Pirate Base', modelPath: '/models/00397.obj', position: [1000, -500, 1000], scale: 50, rotationAxis: 'y', rotationSpeed: 0.05, collisions: true }, // Placeholder
    { name: 'Solar Power Plant (M)', modelPath: '/models/00279.obj', position: [-300, 0, -300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Snail Ranch (M)', modelPath: '/models/00276.obj', position: [200, 50, -100], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'xenon_sector_5', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'priest_rings', gateType: 'W' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'emperors_ridge', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}