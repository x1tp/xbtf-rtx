import type { SeizewellLayout } from './seizewell'

export const ANTIGONE_MEMORIAL_BLUEPRINT: SeizewellLayout = {
  sun: { position: [60000000000, 60000000000, -20000000000], size: 650000000, color: '#ffeecc', intensity: 1.1 },
  planet: { position: [3000000, -2000000, -12000000], size: 6200000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Argon Equipment Dock', modelPath: '/models/00448.obj', position: [0, 0, 0], scale: 35, rotationAxis: 'y', rotationSpeed: 0.01, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00184.obj', position: [400, 0, 400], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Cattle Ranch (M)', modelPath: '/models/00182.obj', position: [-400, 50, 200], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Ore Mine (M)', modelPath: '/models/00293.obj', position: [0, -100, -500], scale: 45, rotationAxis: 'y', rotationSpeed: 0.005, collisions: true },
  ],
  gates: [
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'power_circle', gateType: 'W' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'the_hole', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}