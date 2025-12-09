import type { SeizewellLayout } from './seizewell'

export const ROLK_S_DRIFT_BLUEPRINT: SeizewellLayout = {
  sun: { position: [100000000000, 50000000000, 20000000000], size: 500000000, color: '#ddffff', intensity: 9.0 },
  planet: { position: [3000000, 1000000, -15000000], size: 5500000 },  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00281.obj', position: [200, 0, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'BoFu Chemical Lab (M)', modelPath: '/models/00011.obj', position: [-200, -20, 100], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Plankton Farm (M)', modelPath: '/models/00067.obj', position: [150, 20, -150], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'kingdom_end', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'queens_space', gateType: 'E' },
  ],
  ships: [],
  background: { type: 'starfield' }
}
