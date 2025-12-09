import type { SeizewellLayout } from './seizewell'

export const BLUE_PROFIT_BLUEPRINT: SeizewellLayout = {
  sun: { position: [90000000000, 40000000000, 10000000000], size: 500000000, color: '#ffdfc4', intensity: 1.1 },
  planet: { position: [3000000, -2000000, -12000000], size: 5000000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [200, 0, 200], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Flower Farm (M)', modelPath: '/models/00282.obj', position: [-200, 50, -200], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Sun Oil Refinery (M)', modelPath: '/models/00283.obj', position: [300, -30, -300], scale: 32, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'greater_profit', gateType: 'N' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'ceo_s_sprite', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}