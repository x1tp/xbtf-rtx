import type { SeizewellLayout } from './seizewell'

export const GREATER_PROFIT_BLUEPRINT: SeizewellLayout = {
  sun: { position: [115200000000, 76800000000, 57600000000], size: 696340000, color: '#ffdcb2', intensity: 12.0 },
  planet: { position: [-3534400, -2000400, -21838000], size: 6371000 },
  asteroids: { count: 420, range: 1200, center: [40, 60, -200] },
  playerStart: [0, 50, 900],
  stations: [
    { name: 'Teladi Trading Station', modelPath: '/models/00001.obj', position: [-50, -10, -80], scale: 32, rotationAxis: 'z', rotationSpeed: -0.08, collisions: true },
    { name: 'Sun Oil Refinery (M)', modelPath: '/models/00283.obj', position: [20, -20, 160], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Flower Farm (M)', modelPath: '/models/00403.obj', position: [120, -20, 420], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 900, 0], scale: 50, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0] },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, -900, 0], scale: 50, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0] },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-1200, 0, 0], scale: 50, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0] },
  ],
  ships: [],
}
