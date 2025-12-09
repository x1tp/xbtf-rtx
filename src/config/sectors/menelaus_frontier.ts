import type { SeizewellLayout } from './seizewell'

export const MENELAUS_FRONTIER_BLUEPRINT: SeizewellLayout = {
  sun: { position: [90000000000, 40000000000, 10000000000], size: 450000000, color: '#ddffff', intensity: 8.5 },
  planet: { position: [2000000, -1000000, -12000000], size: 5000000 },
  asteroids: { count: 120, range: 900, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [0, 0, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'BoFu Chemical Lab (M)', modelPath: '/models/00284.obj', position: [0, -50, -200], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'queens_space', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'ceo_s_buckzoid', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'rolk_s_fate', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}