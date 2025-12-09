import type { SeizewellLayout } from './seizewell'

export const EMPIRES_EDGE_BLUEPRINT: SeizewellLayout = {
  sun: { position: [0, 80000000000, 0], size: 750000000, color: '#ffcc33', intensity: 1.2 },
  planet: { position: [0, -3000000, 25000000], size: 6500000 },
  asteroids: { count: 120, range: 2000, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [-2000, 0, 2000], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Soyfarm (M)', modelPath: '/models/00279.obj', position: [2000, 100, -2000], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'paranid_prime', gateType: 'N' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'dukes_domain', gateType: 'E' },
  ],
  ships: [],
  background: { type: 'starfield' }
}
