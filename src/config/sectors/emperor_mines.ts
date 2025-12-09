import type { SeizewellLayout } from './seizewell'

export const EMPEROR_MINES_BLUEPRINT: SeizewellLayout = {
  sun: { position: [50000000000, 60000000000, 20000000000], size: 550000000, color: '#ffcc00', intensity: 1.1 },
  planet: { position: [2000000, 1000000, -15000000], size: 5500000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00279.obj', position: [200, 0, 200], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Ore Mine (M)', modelPath: '/models/00293.obj', position: [-200, 50, -200], scale: 45, rotationAxis: 'y', rotationSpeed: 0.005, collisions: true },
    { name: 'Soyfarm (M)', modelPath: '/models/00276.obj', position: [300, -30, -300], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'cloudbase_south_west', gateType: 'N' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'paranid_prime', gateType: 'E' },
  ],
  ships: [],
  background: { type: 'starfield' }
}