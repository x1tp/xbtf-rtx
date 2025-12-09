import type { SeizewellLayout } from './seizewell'

export const PRIEST_RINGS_BLUEPRINT: SeizewellLayout = {
  sun: { position: [-60000000000, 70000000000, 30000000000], size: 600000000, color: '#ffcc00', intensity: 1.2 },
  planet: { position: [-2500000, 1500000, 18000000], size: 5800000 },
  asteroids: { count: 120, range: 1400, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [200, 0, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Soyery (M)', modelPath: '/models/00283.obj', position: [-200, 50, -200], scale: 32, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Crystal Fab (M)', modelPath: '/models/00432.obj', position: [300, -30, -100], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'paranid_prime', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'priest_pity', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'dukes_domain', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}