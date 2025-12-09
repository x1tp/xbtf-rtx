import type { SeizewellLayout } from './seizewell'

export const POWER_CIRCLE_BLUEPRINT: SeizewellLayout = {
  sun: { position: [-50000000000, 70000000000, 30000000000], size: 550000000, color: '#ffeecc', intensity: 1.0 },
  planet: { position: [-2000000, 1500000, 18000000], size: 5500000 },
  asteroids: { count: 60, range: 1200, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00184.obj', position: [0, 0, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Cattle Ranch (M)', modelPath: '/models/00182.obj', position: [-300, 50, -200], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Shield Plant (1MW)', modelPath: '/models/00232.obj', position: [300, -20, -200], scale: 28, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'three_worlds', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'antigone_memorial', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'herron_s_nebula', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}