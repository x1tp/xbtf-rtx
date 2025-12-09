import type { SeizewellLayout } from './seizewell'

export const CEO_S_SPRITE_BLUEPRINT: SeizewellLayout = {
  sun: { position: [70000000000, 80000000000, 30000000000], size: 600000000, color: '#ffdfc4', intensity: 1.2 },
  planet: { position: [-1500000, 1000000, 16000000], size: 5500000 },
  asteroids: { count: 100, range: 1200, center: [0, 0, 0] },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [200, 0, 300], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Quantum Tube Fab (M)', modelPath: '/models/00145.obj', position: [-200, 0, -200], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'blue_profit', gateType: 'N' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'company_pride', gateType: 'S' },
  ],
  ships: [],
  background: { type: 'starfield' }
}