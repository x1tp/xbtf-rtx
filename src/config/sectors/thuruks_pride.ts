import type { SeizewellLayout } from './seizewell'

export const THURUKS_PRIDE_BLUEPRINT: SeizewellLayout = {
  sun: { position: [-80000000000, 60000000000, 20000000000], size: 600000000, color: '#ffaa88', intensity: 1.1 },
  planet: { position: [3000000, 1500000, -16000000], size: 5800000 },
  asteroids: { count: 140, range: 1400, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00275.obj', position: [200, 0, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Rastar Refinery (M)', modelPath: '/models/00273.obj', position: [-200, 50, -200], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'family_zein', gateType: 'N' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'family_pride', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'chins_fire', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}