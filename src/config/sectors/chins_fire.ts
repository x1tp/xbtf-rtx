import type { SeizewellLayout } from './seizewell'

export const CHINS_FIRE_BLUEPRINT: SeizewellLayout = {
  sun: { position: [70000000000, 50000000000, 20000000000], size: 550000000, color: '#ff8866', intensity: 1.0 },
  planet: { position: [2500000, -1000000, -15000000], size: 5200000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00275.obj', position: [200, 0, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Chelt Aquarium (M)', modelPath: '/models/00272.obj', position: [-200, 50, -200], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'thuruks_pride', gateType: 'N' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'chins_clouds', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'family_chin', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}