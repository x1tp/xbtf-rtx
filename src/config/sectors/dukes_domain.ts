import type { SeizewellLayout } from './seizewell'

export const DUKES_DOMAIN_BLUEPRINT: SeizewellLayout = {
  sun: { position: [0, 90000000000, 30000000000], size: 600000000, color: '#ffbb00', intensity: 1.1 },
  planet: { position: [5000000, -2000000, -20000000], size: 5800000 },
  asteroids: { count: 140, range: 1800, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [0, 0, 0], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Soyery (M)', modelPath: '/models/00288.obj', position: [-2000, -100, 2000], scale: 28, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'priest_rings', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'empires_edge', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'emperors_ridge', gateType: 'E' },
  ],
  ships: [],
  background: { type: 'starfield' }
}