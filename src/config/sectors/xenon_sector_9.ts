import type { SeizewellLayout } from './seizewell'

export const XENON_SECTOR_9_BLUEPRINT: SeizewellLayout = {
  sun: { position: [0, 100000000000, 0], size: 800000000, color: '#aa0000', intensity: 1.5 },
  planet: { position: [6000000, -4000000, 30000000], size: 7000000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Xenon M0 Mothership', modelPath: '/models/00444.obj', position: [0, 0, 0], scale: 100, rotationAxis: 'y', rotationSpeed: 0.01, collisions: true },
    { name: 'Xenon Station', modelPath: '/models/00120.obj', position: [-3000, 1000, -3000], scale: 45, rotationAxis: 'y', rotationSpeed: 0.02, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'thuruks_beard', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'xenon_sector_8', gateType: 'W' },
  ],
  ships: [],
  background: { type: 'starfield' }
}