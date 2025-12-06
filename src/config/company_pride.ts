import type { SeizewellLayout } from './seizewell'

export const COMPANY_PRIDE_BLUEPRINT: SeizewellLayout = {
  sun: { position: [115200000000, 76800000000, 57600000000], size: 696340000, color: '#ffddaa', intensity: 8.0 },
  planet: { position: [4534400, 1700400, -19838000], size: 6371000 },
  asteroids: { count: 300, range: 1200, center: [100, -50, 400] },
  playerStart: [0, 50, 0],
  stations: [
    { name: 'Teladi Trading Station', modelPath: '/models/00001.obj', position: [0, 0, 0], scale: 32, rotationAxis: 'z', rotationSpeed: -0.05, collisions: true },
    { name: 'Silicon Mine (M)', modelPath: '/models/00114.obj', position: [-300, 50, -300], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true }
  ],
  gates: [],
  ships: [],
  background: { type: 'starfield' }
}
