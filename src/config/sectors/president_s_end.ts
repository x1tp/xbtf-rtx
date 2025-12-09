import type { SeizewellLayout } from './seizewell'

export const PRESIDENT_S_END_BLUEPRINT: SeizewellLayout = {
  sun: { position: [70000000000, 60000000000, 20000000000], size: 550000000, color: '#ffccaa', intensity: 1.0 },
  planet: { position: [3000000, 2000000, -15000000], size: 5200000 },
  asteroids: { count: 120, range: 1400, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [200, 0, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Cahoona Bakery (M)', modelPath: '/models/00132.obj', position: [-200, 50, -200], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Wheat Farm (M)', modelPath: '/models/00131.obj', position: [300, -30, -100], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'the_wall', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'home_of_light', gateType: 'W' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'cloudbase_south_east', gateType: 'S' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'xenon_sector_3', gateType: 'E' },
  ],
  ships: [],
  background: { type: 'starfield' }
}