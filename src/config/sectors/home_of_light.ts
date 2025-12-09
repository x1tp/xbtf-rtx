import type { SeizewellLayout } from './seizewell'

export const HOME_OF_LIGHT_BLUEPRINT: SeizewellLayout = {
  sun: { position: [0, 80000000000, 40000000000], size: 600000000, color: '#ffeecc', intensity: 1.1 },
  planet: { position: [0, -1500000, 16000000], size: 5500000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'TerraCorp HQ', modelPath: '/models/00022.obj', position: [0, 100, 0], scale: 50, rotationAxis: 'y', rotationSpeed: 0.005, collisions: true },
    { name: 'Argon Trading Station', modelPath: '/models/00186.obj', position: [-500, -50, 500], scale: 35, rotationAxis: 'y', rotationSpeed: 0.02, collisions: true },
    { name: 'Quantum Tube Fab (M)', modelPath: '/models/00232.obj', position: [500, 50, -500], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'argon_prime', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'red_light', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'president_s_end', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'ore_belt', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}