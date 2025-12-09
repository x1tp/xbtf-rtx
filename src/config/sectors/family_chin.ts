import type { SeizewellLayout } from './seizewell'

export const FAMILY_CHIN_BLUEPRINT: SeizewellLayout = {
  sun: { position: [80000000000, 50000000000, 20000000000], size: 550000000, color: '#ffaa88', intensity: 1.0 },
  planet: { position: [3000000, -1000000, -14000000], size: 5300000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00275.obj', position: [200, 0, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Massom Mill (M)', modelPath: '/models/00273.obj', position: [-200, 50, -200], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'chins_fire', gateType: 'N' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'thuruks_beard', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}