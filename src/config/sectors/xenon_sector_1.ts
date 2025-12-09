import type { SeizewellLayout } from './seizewell'

export const XENON_SECTOR_1_BLUEPRINT: SeizewellLayout = {
  sun: { position: [0, 80000000000, 0], size: 500000000, color: '#ff0000', intensity: 0.8 },
  planet: { position: [0, -5000000, 20000000], size: 6000000 },
  asteroids: { count: 200, range: 2000, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Xenon Solar Power Plant', modelPath: '/models/00285.obj', position: [1000, 0, 1000], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Xenon Solar Power Plant', modelPath: '/models/00285.obj', position: [-1000, 0, -1000], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'atreus_clouds', gateType: 'N' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'xenon_sector_2', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'xenon_sector_3', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}