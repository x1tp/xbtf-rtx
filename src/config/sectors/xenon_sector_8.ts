import type { SeizewellLayout } from './seizewell'

export const XENON_SECTOR_8_BLUEPRINT: SeizewellLayout = {
  sun: { position: [-50000000000, 80000000000, 30000000000], size: 550000000, color: '#ff5500', intensity: 0.9 },
  planet: { position: [-2000000, 2000000, -18000000], size: 6000000 },
  asteroids: { count: 210, range: 2100, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Xenon Station', modelPath: '/models/00444.obj', position: [0, 0, 0], scale: 45, rotationAxis: 'y', rotationSpeed: 0.02, collisions: true },
  ],
  gates: [
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'xenon_sector_7', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'xenon_sector_9', gateType: 'E' },
  ],
  ships: [],
  background: { type: 'starfield' }
}