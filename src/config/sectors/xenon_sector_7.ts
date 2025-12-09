import type { SeizewellLayout } from './seizewell'

export const XENON_SECTOR_7_BLUEPRINT: SeizewellLayout = {
  sun: { position: [0, 95000000000, 0], size: 580000000, color: '#ff2200', intensity: 0.9 },
  planet: { position: [4000000, -3000000, 20000000], size: 5900000 },
  asteroids: { count: 230, range: 2300, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Xenon Station', modelPath: '/models/00120.obj', position: [-1000, 0, 1000], scale: 45, rotationAxis: 'y', rotationSpeed: 0.02, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'xenon_sector_6', gateType: 'N' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'xenon_sector_8', gateType: 'E' },
  ],
  ships: [],
  background: { type: 'starfield' }
}