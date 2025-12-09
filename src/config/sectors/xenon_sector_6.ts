import type { SeizewellLayout } from './seizewell'

export const XENON_SECTOR_6_BLUEPRINT: SeizewellLayout = {
  sun: { position: [70000000000, 70000000000, 0], size: 600000000, color: '#aa4400', intensity: 1.0 },
  planet: { position: [-5000000, 1000000, -22000000], size: 6300000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Xenon Station', modelPath: '/models/00120.obj', position: [2000, 0, -2000], scale: 45, rotationAxis: 'y', rotationSpeed: 0.02, collisions: true },
    { name: 'Earth Jumpgate (Inactive)', modelPath: '/models/00088.obj', position: [0, 0, 0], scale: 350, rotationAxis: 'z', rotationSpeed: 0.01, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'xenon_sector_4', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'xenon_sector_5', gateType: 'W' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'xenon_sector_7', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}