import type { SeizewellLayout } from './seizewell'

export const XENON_SECTOR_4_BLUEPRINT: SeizewellLayout = {
  sun: { position: [-80000000000, 60000000000, 0], size: 550000000, color: '#ff6600', intensity: 0.9 },
  planet: { position: [-2000000, 3000000, -20000000], size: 5800000 },
  asteroids: { count: 220, range: 2200, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Xenon Station', modelPath: '/models/00444.obj', position: [1000, 500, -1000], scale: 45, rotationAxis: 'y', rotationSpeed: 0.02, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'xenon_sector_2', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'xenon_sector_3', gateType: 'W' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'xenon_sector_6', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}