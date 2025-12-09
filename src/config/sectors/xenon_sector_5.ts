import type { SeizewellLayout } from './seizewell'

export const XENON_SECTOR_5_BLUEPRINT: SeizewellLayout = {
  sun: { position: [0, 85000000000, 20000000000], size: 520000000, color: '#ff8800', intensity: 0.95 },
  planet: { position: [3000000, -2000000, 18000000], size: 6100000 },
  asteroids: { count: 240, range: 2400, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Xenon Station', modelPath: '/models/00120.obj', position: [-1500, 0, 1500], scale: 45, rotationAxis: 'y', rotationSpeed: 0.02, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'xenon_sector_3', gateType: 'N' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'xenon_sector_6', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'priest_pity', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}