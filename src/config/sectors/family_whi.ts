import type { SeizewellLayout } from './seizewell'

export const FAMILY_WHI_BLUEPRINT: SeizewellLayout = {
  sun: { position: [100000000000, 80000000000, -20000000000], size: 600000000, color: '#ffaa88', intensity: 1.1 },
  planet: { position: [2000000, 1000000, -15000000], size: 5500000 },
  asteroids: { count: 120, range: 1300, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Split Equipment Dock', modelPath: '/models/00448.obj', position: [0, 0, 0], scale: 34, rotationAxis: 'z', rotationSpeed: -0.00, collisions: true },
    { name: '25MW Shield Prod. Facility (M)', modelPath: '/models/00135.obj', position: [300, 50, 300], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'teladi_gain', gateType: 'W' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'family_zein', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}