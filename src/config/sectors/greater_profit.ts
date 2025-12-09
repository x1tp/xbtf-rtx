import type { SeizewellLayout } from './seizewell'

export const GREATER_PROFIT_BLUEPRINT: SeizewellLayout = {
  sun: { position: [115200000000, 76800000000, 57600000000], size: 696340000, color: '#ffddaa', intensity: 8.0 },
  planet: { position: [4534400, 1700400, -19838000], size: 6371000 },
  asteroids: { count: 300, range: 1200, center: [100, -50, 400] },
  playerStart: [0, 50, 0],
  stations: [
    { name: 'Teladi Trading Station', modelPath: '/models/00001.obj', position: [0, 0, 0], scale: 32, rotationAxis: 'z', rotationSpeed: -0.05, collisions: true },
    { name: 'Dream Farm (M)', modelPath: '/models/00282.obj', position: [200, -20, -200], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Bliss Place (L)', modelPath: '/models/00283.obj', position: [-200, 20, 200], scale: 28, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Crystal Fab (M)', modelPath: '/models/00432.obj', position: [300, 0, 300], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true }
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -4000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'seizewell', gateType: 'N' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 4000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'blue_profit', gateType: 'S' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-4000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'spaceweed_drift', gateType: 'W' },
  ],
  ships: [],
  background: { type: 'starfield' } // Default or specific nebula if available
}
