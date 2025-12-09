import type { SeizewellLayout } from './seizewell'

export const ATREUS_CLOUDS_BLUEPRINT: SeizewellLayout = {
  sun: { position: [105000000000, 55000000000, 25000000000], size: 550000000, color: '#aaeeee', intensity: 8.0 },
  planet: { position: [3500000, 1500000, -16000000], size: 5800000 },
  playerStart: [0, 0, 0],
  stations: [
    { name: 'Pirate Base', modelPath: '/models/00397.obj', position: [1000, -500, 1000], scale: 50, rotationAxis: 'y', rotationSpeed: 0.05, collisions: true }, // Placeholder model for Pirate Base
    { name: 'Solar Power Plant (M)', modelPath: '/models/00281.obj', position: [-200, 0, -200], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Plankton Farm (M)', modelPath: '/models/00067.obj', position: [200, 50, -100], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI, 0], destinationSectorId: 'rolk_s_fate', gateType: 'N' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, -Math.PI / 2, 0], destinationSectorId: 'the_hole', gateType: 'W' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'xenon_sector_1', gateType: 'E' },
  ],
  ships: [],
  background: { type: 'starfield' }
}