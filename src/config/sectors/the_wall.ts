import type { SeizewellLayout } from './seizewell'

export const THE_WALL_BLUEPRINT: SeizewellLayout = {
  sun: { position: [0, 90000000000, 0], size: 700000000, color: '#ffeecc', intensity: 1.5 },
  planet: { position: [4000000, 2000000, 18000000], size: 6000000 },
  asteroids: { count: 50, range: 1000, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (XL)', modelPath: '/models/00184.obj', position: [0, 0, 0], scale: 60, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Solar Power Plant (L)', modelPath: '/models/00184.obj', position: [500, 50, 500], scale: 50, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Solar Power Plant (L)', modelPath: '/models/00184.obj', position: [-500, -50, 500], scale: 50, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00184.obj', position: [500, 50, -500], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00184.obj', position: [-500, -50, -500], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'the_hole', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'argon_prime', gateType: 'W' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'president_s_end', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}