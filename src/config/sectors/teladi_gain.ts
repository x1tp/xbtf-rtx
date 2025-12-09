import type { SeizewellLayout } from './seizewell'

export const TELADI_GAIN_BLUEPRINT: SeizewellLayout = {
  sun: { position: [115200000000, 76800000000, 57600000000], size: 696340000, color: '#ffdcb2', intensity: 12.0 },
  planet: { position: [-4534400, -1700400, -19838000], size: 6371000 },
  playerStart: [0, 50, 900],
  stations: [
    { name: 'Teladi Trading Station', modelPath: '/models/00001.obj', position: [-60, -10, -30], scale: 32, rotationAxis: 'z', rotationSpeed: -0.08, collisions: true },
    { name: 'Bliss Place (M)', modelPath: '/models/00283.obj', position: [40, -10, 60], scale: 28, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Sun Oil Refinery (M)', modelPath: '/models/00283.obj', position: [22, -20, 160], scale: 30, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
    { name: 'Flower Farm (M)', modelPath: '/models/00282.obj', position: [120, -20, 420], scale: 26, rotationAxis: 'y', rotationSpeed: 0.00, collisions: true },
  ],
  gates: [
    { name: 'South Gate', modelPath: '/models/00088.obj', position: [0, 0, 5000], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, 0, 0], destinationSectorId: 'seizewell', gateType: 'S' },
    { name: 'East Gate', modelPath: '/models/00088.obj', position: [5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'family_whi', gateType: 'E' },
    { name: 'West Gate', modelPath: '/models/00088.obj', position: [-5000, 0, 0], scale: 300, rotationAxis: 'y', rotationSpeed: 0, collisions: false, rotation: [0, Math.PI / 2, 0], destinationSectorId: 'ceo_s_buckzoid', gateType: 'W' },
  ],
  ships: [
    // Ships migrated to persistent NPC fleet system
    // { name: 'Osprey (M6)', modelPath: '/models/00141.obj', position: [480, 10, 220], scale: 18, rotationAxis: 'y', rotationSpeed: 0, collisions: false },
  ],
}
