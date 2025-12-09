import type { SeizewellLayout } from './seizewell'

export const ORE_BELT_BLUEPRINT: SeizewellLayout = {
  sun: { position: [90000000000, 70000000000, -20000000000], size: 600000000, color: '#ffccaa', intensity: 1.0 },
  planet: { position: [2000000, -1500000, -12000000], size: 5500000 },
  asteroids: { count: 400, range: 2500, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Pirate Base', modelPath: '/models/00397.obj', position: [1000, 500, -2000], scale: 50, rotationAxis: 'y', rotationSpeed: 0.05, collisions: true }, // Placeholder
    { name: 'Solar Power Plant (M)', modelPath: '/models/00184.obj', position: [0, 0, 0], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Ore Mine (L)', modelPath: '/models/00293.obj', position: [-500, 50, 500], scale: 50, rotationAxis: 'y', rotationSpeed: 0.005, collisions: true },
    { name: 'Silicon Mine (L)', modelPath: '/models/00114.obj', position: [500, -50, -500], scale: 50, rotationAxis: 'y', rotationSpeed: 0.005, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'home_of_light', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'cloudbase_south_west', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'cloudbase_south_east', gateType: 'E' },
  ],
  ships: [],
  background: { type: 'starfield' }
}