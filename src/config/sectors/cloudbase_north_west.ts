import type { SeizewellLayout } from './seizewell'

export const CLOUDBASE_NORTH_WEST_BLUEPRINT: SeizewellLayout = {
  sun: { position: [-70000000000, 50000000000, 40000000000], size: 500000000, color: '#ffeecc', intensity: 1.0 },
  planet: { position: [-1500000, 1000000, 16000000], size: 5000000 },
  asteroids: { count: 90, range: 1300, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [200, 0, 200], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Wheat Farm (M)', modelPath: '/models/00131.obj', position: [-200, 50, -200], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Crystal Fab (M)', modelPath: '/models/00432.obj', position: [300, -30, -300], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Gamma HEPT Forge', modelPath: '/models/00140.obj', position: [-300, 20, 300], scale: 35, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'three_worlds', gateType: 'N' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'herron_s_nebula', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'ringo_moon', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}