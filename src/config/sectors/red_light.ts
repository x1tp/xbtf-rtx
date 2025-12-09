import type { SeizewellLayout } from './seizewell'

export const RED_LIGHT_BLUEPRINT: SeizewellLayout = {
  sun: { position: [-60000000000, 50000000000, -30000000000], size: 550000000, color: '#ffaaaa', intensity: 1.1 },
  planet: { position: [-2000000, 1000000, -15000000], size: 5500000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Argon Equipment Dock', modelPath: '/models/00448.obj', position: [0, 0, 0], scale: 35, rotationAxis: 'y', rotationSpeed: 0.01, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00184.obj', position: [400, 0, 400], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Crystal Fab (M)', modelPath: '/models/00432.obj', position: [-300, 50, -200], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Microchip Plant (M)', modelPath: '/models/00431.obj', position: [200, -30, -400], scale: 28, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'ringo_moon', gateType: 'N' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'home_of_light', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'cloudbase_south_west', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}