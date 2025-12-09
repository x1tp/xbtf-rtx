import type { SeizewellLayout } from './seizewell'

export const CLOUDBASE_SOUTH_WEST_BLUEPRINT: SeizewellLayout = {
  sun: { position: [-80000000000, 50000000000, 30000000000], size: 500000000, color: '#ffeecc', intensity: 1.0 },
  planet: { position: [-2500000, 1000000, 18000000], size: 5000000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Goner Temple', modelPath: '/models/00026.obj', position: [0, 100, 0], scale: 60, rotationAxis: 'y', rotationSpeed: 0.002, collisions: true },
    { name: 'Argon Equipment Dock', modelPath: '/models/00448.obj', position: [-500, -50, 500], scale: 35, rotationAxis: 'y', rotationSpeed: 0.01, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00184.obj', position: [500, 0, -500], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'red_light', gateType: 'N' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'ore_belt', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'emperor_mines', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}