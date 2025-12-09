import type { SeizewellLayout } from './seizewell'

export const PARANID_PRIME_BLUEPRINT: SeizewellLayout = {
  sun: { position: [0, 90000000000, 0], size: 700000000, color: '#ffcc00', intensity: 1.3 },
  planet: { position: [0, -2000000, 20000000], size: 6000000 },
  asteroids: { count: 150, range: 1800, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Paranid Shipyard', modelPath: '/models/00444.obj', position: [0, 0, 500], scale: 38, rotationAxis: 'z', rotationSpeed: -0.00, collisions: true },
    { name: 'Paranid Equipment Dock', modelPath: '/models/00448.obj', position: [-500, 100, -500], scale: 34, rotationAxis: 'z', rotationSpeed: -0.00, collisions: true },
    { name: 'Paranid Trading Station', modelPath: '/models/00122.obj', position: [500, -100, -500], scale: 32, rotationAxis: 'z', rotationSpeed: -0.08, collisions: true },
    { name: 'Hornet Missile Factory (M)', modelPath: '/models/00140.obj', position: [1000, 0, 1000], scale: 35, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: '25MW Shield Fab (M)', modelPath: '/models/00213.obj', position: [-1000, 0, 1000], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'emperor_mines', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'priest_rings', gateType: 'E' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'empires_edge', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}