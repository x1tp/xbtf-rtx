import type { SeizewellLayout } from './seizewell'

export const EMPERORS_RIDGE_BLUEPRINT: SeizewellLayout = {
  sun: { position: [-30000000000, 70000000000, 0], size: 680000000, color: '#ffcc66', intensity: 1.25 },
  planet: { position: [-4000000, 1000000, 22000000], size: 6200000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Paranid Equipment Dock', modelPath: '/models/00448.obj', position: [1000, 0, -1000], scale: 34, rotationAxis: 'z', rotationSpeed: -0.00, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00279.obj', position: [-2000, 0, 2000], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Majaglit Factory (M)', modelPath: '/models/00276.obj', position: [2000, -200, 1000], scale: 28, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'priest_pity', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'dukes_domain', gateType: 'W' },
  ],
  ships: [],
  background: { type: 'starfield' }
}