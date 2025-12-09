import type { SeizewellLayout } from './seizewell'

export const PROFIT_SHARE_BLUEPRINT: SeizewellLayout = {
  sun: { position: [115200000000, 76800000000, 57600000000], size: 696340000, color: '#ffdcb2', intensity: 12.0 },
  planet: { position: [-5534400, -1200400, -23838000], size: 6371000 },  playerStart: [0, 50, 900],
  stations: [
    { name: 'Teladi Trading Station', modelPath: '/models/00001.obj', position: [-80, -10, -60], scale: 32, rotationAxis: 'z', rotationSpeed: -0.08, collisions: true },
    { name: 'Solar Power Plant (M)', modelPath: '/models/00285.obj', position: [-140, 0, 40], scale: 40, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Teladianium Foundry (L)', modelPath: '/models/00435.obj', position: [60, -10, 220], scale: 32, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [3000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'seizewell', gateType: 'E' },
    { name: 'North Gate', modelPath: '/models/00088.obj', position: [0, 0, -3000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'ceo_s_buckzoid', gateType: 'N' },
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 3000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'spaceweed_drift', gateType: 'S' },
  ],
  ships: [],
}
