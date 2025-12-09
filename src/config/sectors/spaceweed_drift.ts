import type { SeizewellLayout } from './seizewell'

export const SPACEWEED_DRIFT_BLUEPRINT: SeizewellLayout = {
  sun: { position: [-80000000000, 50000000000, 30000000000], size: 550000000, color: '#aaeeaa', intensity: 1.0 },
  planet: { position: [-2000000, 1500000, 18000000], size: 5200000 },
  asteroids: { count: 300, range: 1600, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [200, 0, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Bliss Place (L)', modelPath: '/models/00283.obj', position: [-300, 0, -300], scale: 35, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'profit_share', gateType: 'N' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'greater_profit', gateType: 'E' },
  ],
  ships: [],
  background: { type: 'starfield' }
}