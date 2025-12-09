import type { SeizewellLayout } from './seizewell'

export const XENON_SECTOR_2_BLUEPRINT: SeizewellLayout = {
  sun: { position: [50000000000, 50000000000, 0], size: 500000000, color: '#aa0000', intensity: 0.8 },
  planet: { position: [-3000000, -2000000, -15000000], size: 5500000 },
  asteroids: { count: 180, range: 1800, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Xenon Solar Power Plant', modelPath: '/models/00323.obj', position: [2000, 0, -1000], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Xenon Solar Power Plant', modelPath: '/models/00323.obj', position: [-2000, 0, 1000], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'xenon_sector_1', gateType: 'W' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'xenon_sector_4', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}