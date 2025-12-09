import type { SeizewellLayout } from './seizewell'

export const CEO_S_BUCKZOID_BLUEPRINT: SeizewellLayout = {
  sun: { position: [100000000000, 60000000000, 20000000000], size: 600000000, color: '#ffdfc4', intensity: 1.2 },
  planet: { position: [2500000, -1000000, -15000000], size: 5500000 },
  asteroids: { count: 180, range: 1300, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Teladi Equipment Dock', modelPath: '/models/00448.obj', position: [0, 0, 0], scale: 34, rotationAxis: 'z', rotationSpeed: -0.00, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [300, 50, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Sun Oil Refinery (M)', modelPath: '/models/00283.obj', position: [-200, -20, -200], scale: 32, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Teladianium Foundry (M)', modelPath: '/models/00431.obj', position: [150, 20, -150], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'menelaus_frontier', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'teladi_gain', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'profit_share', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}