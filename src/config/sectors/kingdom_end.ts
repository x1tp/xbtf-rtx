import type { SeizewellLayout } from './seizewell'

export const KINGDOM_END_BLUEPRINT: SeizewellLayout = {
  sun: { position: [115200000000, 76800000000, 57600000000], size: 696340000, color: '#ddffff', intensity: 10.0 },
  planet: { position: [4534400, 1700400, -19838000], size: 6371000 },
  asteroids: { count: 200, range: 1200, center: [0, 0, 0] },
  playerStart: [0, 50, 0],
  stations: [
    { name: 'Boron Shipyard', modelPath: '/models/00444.obj', position: [100, -50, 200], scale: 38, rotationAxis: 'z', rotationSpeed: -0.00, collisions: true },
    { name: 'Boron Equipment Dock', modelPath: '/models/00448.obj', position: [-100, 50, -200], scale: 34, rotationAxis: 'z', rotationSpeed: -0.00, collisions: true },
    { name: 'Boron Trading Station', modelPath: '/models/00136.obj', position: [0, 0, 0], scale: 32, rotationAxis: 'z', rotationSpeed: -0.08, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00281.obj', position: [200, 0, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'BoGas Factory (M)', modelPath: '/models/00011.obj', position: [-200, -20, 100], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Crystal Fab (M)', modelPath: '/models/00432.obj', position: [150, 20, -150], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'rolk_s_drift', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'three_worlds', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}
