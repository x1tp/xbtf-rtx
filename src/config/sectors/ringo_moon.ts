import type { SeizewellLayout } from './seizewell'

export const RINGO_MOON_BLUEPRINT: SeizewellLayout = {
  sun: { position: [100000000000, 40000000000, -10000000000], size: 500000000, color: '#ffffee', intensity: 1.0 },
  planet: { position: [1500000, -1000000, -12000000], size: 4800000 },
  asteroids: { count: 80, range: 1100, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [200, 0, 200], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Cattle Ranch (M)', modelPath: '/models/00136.obj', position: [-200, 30, -100], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Cahoona Bakery (M)', modelPath: '/models/00132.obj', position: [100, -20, -300], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'cloudbase_north_west', gateType: 'N' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'argon_prime', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'red_light', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}