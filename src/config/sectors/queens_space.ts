import type { SeizewellLayout } from './seizewell'

export const QUEENS_SPACE_BLUEPRINT: SeizewellLayout = {
  sun: { position: [110000000000, 60000000000, 30000000000], size: 600000000, color: '#ddffff', intensity: 9.5 },
  planet: { position: [-4000000, 2000000, 18000000], size: 6000000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00281.obj', position: [100, 50, 200], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'BoGas Factory (M)', modelPath: '/models/00011.obj', position: [-150, -30, -100], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Stott Mixery (M)', modelPath: '/models/00011.obj', position: [200, 10, -200], scale: 28, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'rolk_s_drift', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'menelaus_frontier', gateType: 'E' },
  ],
  ships: [],
  background: { type: 'starfield' }
}