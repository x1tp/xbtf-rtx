import type { SeizewellLayout } from './seizewell'

export const THREE_WORLDS_BLUEPRINT: SeizewellLayout = {
  sun: { position: [50000000000, 80000000000, 20000000000], size: 600000000, color: '#ffeecc', intensity: 1.1 },
  planet: { position: [2000000, 1000000, -15000000], size: 6000000 },
  asteroids: { count: 80, range: 1500, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Argon Equipment Dock', modelPath: '/models/00448.obj', position: [0, 0, 0], scale: 35, rotationAxis: 'y', rotationSpeed: 0.01, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00184.obj', position: [500, 50, 500], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Cahoona Bakery (M)', modelPath: '/models/00183.obj', position: [-500, -20, 500], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Weapon Component Factory (M)', modelPath: '/models/00134.obj', position: [500, 20, -500], scale: 28, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'kingdom_end', gateType: 'N' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'power_circle', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'cloudbase_north_west', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}