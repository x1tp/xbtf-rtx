import type { SeizewellLayout } from './seizewell'

export const XENON_SECTOR_3_BLUEPRINT: SeizewellLayout = {
  sun: { position: [0, 90000000000, 0], size: 600000000, color: '#ff4400', intensity: 0.9 },
  planet: { position: [4000000, -1000000, 25000000], size: 6500000 },
  asteroids: { count: 250, range: 2500, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Xenon Station', modelPath: '/models/00120.obj', position: [0, 0, 0], scale: 45, rotationAxis: 'y', rotationSpeed: 0.02, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'xenon_sector_1', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'president_s_end', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'xenon_sector_4', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'xenon_sector_5', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}