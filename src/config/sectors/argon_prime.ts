import type { SeizewellLayout } from './seizewell'

export const ARGON_PRIME_BLUEPRINT: SeizewellLayout = {
  sun: { position: [0, 100000000000, 0], size: 800000000, color: '#ffeecc', intensity: 1.2 },
  planet: { position: [0, -2000000, 20000000], size: 8000000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Argon Shipyard', modelPath: '/models/00444.obj', position: [0, 0, 500], scale: 40, rotationAxis: 'y', rotationSpeed: 0.01, collisions: true },
    { name: 'Argon Equipment Dock', modelPath: '/models/00448.obj', position: [-500, 100, -500], scale: 35, rotationAxis: 'y', rotationSpeed: 0.01, collisions: true },
    { name: 'Free Argon Trading Station', modelPath: '/models/00186.obj', position: [500, -100, -500], scale: 35, rotationAxis: 'y', rotationSpeed: 0.02, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00184.obj', position: [1000, 0, 1000], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Cattle Ranch (M)', modelPath: '/models/00182.obj', position: [-1000, 0, 1000], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Wheat Farm (M)', modelPath: '/models/00182.obj', position: [1000, 0, -1000], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Crystal Fab (M)', modelPath: '/models/00432.obj', position: [-1000, 0, -1000], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -10000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'herron_s_nebula', gateType: 'N' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 10000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'home_of_light', gateType: 'S' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-10000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'ringo_moon', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [10000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'the_wall', gateType: 'E' },
  ],
  ships: [],
  background: { type: 'starfield' }
}