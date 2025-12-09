import type { SeizewellLayout } from './seizewell'

export const CLOUDBASE_SOUTH_EAST_BLUEPRINT: SeizewellLayout = {
  sun: { position: [60000000000, 50000000000, 40000000000], size: 500000000, color: '#ffeecc', intensity: 1.0 },
  planet: { position: [1500000, 1000000, 15000000], size: 5000000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00184.obj', position: [200, 0, 200], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Crystal Fab (M)', modelPath: '/models/00432.obj', position: [-200, 50, -200], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'president_s_end', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'ore_belt', gateType: 'W' },
  ],
  ships: [],
  background: { type: 'starfield' }
}