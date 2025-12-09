import type { SeizewellLayout } from './seizewell'

export const HERRON_S_NEBULA_BLUEPRINT: SeizewellLayout = {
  sun: { position: [90000000000, 50000000000, 30000000000], size: 600000000, color: '#ffddcc', intensity: 1.0 },
  planet: { position: [2500000, -1000000, -18000000], size: 5800000 },
  asteroids: { count: 120, range: 1600, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Argon Trading Station', modelPath: '/models/00186.obj', position: [0, 0, 0], scale: 35, rotationAxis: 'y', rotationSpeed: 0.02, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00184.obj', position: [400, 50, 400], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Space Fuel Distillery (L)', modelPath: '/models/00138.obj', position: [-500, -50, -500], scale: 35, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'power_circle', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'cloudbase_north_west', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'the_hole', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'argon_prime', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}