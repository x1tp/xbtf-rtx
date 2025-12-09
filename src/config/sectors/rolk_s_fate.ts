import type { SeizewellLayout } from './seizewell'

export const ROLK_S_FATE_BLUEPRINT: SeizewellLayout = {
  sun: { position: [120000000000, 80000000000, 60000000000], size: 700000000, color: '#ddffff', intensity: 10.0 },
  planet: { position: [-5000000, 3000000, 20000000], size: 6500000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Boron Equipment Dock', modelPath: '/models/00448.obj', position: [0, 0, 0], scale: 34, rotationAxis: 'z', rotationSpeed: -0.00, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00281.obj', position: [300, 50, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Stott Mixery (M)', modelPath: '/models/00011.obj', position: [-200, -20, -200], scale: 28, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Crystal Fab (M)', modelPath: '/models/00432.obj', position: [150, 20, -150], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'menelaus_frontier', gateType: 'N' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'atreus_clouds', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}