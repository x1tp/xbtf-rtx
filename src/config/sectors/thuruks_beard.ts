import type { SeizewellLayout } from './seizewell'

export const THURUKS_BEARD_BLUEPRINT: SeizewellLayout = {
  sun: { position: [100000000000, 70000000000, 30000000000], size: 600000000, color: '#ffaa88', intensity: 1.1 },
  planet: { position: [-2500000, 1000000, 18000000], size: 5600000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Split Equipment Dock', modelPath: '/models/00448.obj', position: [0, 0, 0], scale: 34, rotationAxis: 'z', rotationSpeed: -0.00, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00275.obj', position: [300, 50, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Rastar Refinery (M)', modelPath: '/models/00273.obj', position: [-200, -20, -200], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'family_chin', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'company_pride', gateType: 'W' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'xenon_sector_9', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}