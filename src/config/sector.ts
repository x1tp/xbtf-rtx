export interface SectorConfig {
  sun: { position: [number, number, number]; size: number; color: string; intensity: number };
  planet: { position: [number, number, number]; size: number };
  station: { position: [number, number, number]; scale: number; modelPath: string; rotationSpeed: number; rotationAxis: 'x' | 'y' | 'z' };
  asteroids: { count: number; range: number; center: [number, number, number] };
}
export const DEFAULT_SECTOR_CONFIG: SectorConfig = {
  // Approximate real-scale: 1 AU distance and real solar radius (meters)
  sun: { position: [149600000000, 20000000, 0], size: 696340000, color: '#ffddaa', intensity: 5.0 },
  planet: { position: [5097200, 318575, -6371500], size: 6371000 },
  station: { position: [50, 0, -120], scale: 40, modelPath: '/models/00001.obj', rotationSpeed: -0.05, rotationAxis: 'z' },
  asteroids: { count: 500, range: 400, center: [-250, 80, -900] }
};
import { UNIVERSE_SECTORS_XBTF } from './universe_xbtf'
import type { SeizewellLayout } from './seizewell'
import { TELADI_GAIN_BLUEPRINT } from './teladi_gain'
import { PROFIT_SHARE_BLUEPRINT } from './profit_share'
import { GREATER_PROFIT_BLUEPRINT } from './greater_profit'
import { SEIZEWELL_BLUEPRINT } from './seizewell'

const gatePositions: [number, number, number][] = [
  [-1200, 0, 0],
  [0, 900, 0],
  [1200, 0, 0],
  [0, -900, 0],
  [-900, 900, 0],
  [900, 900, 0],
  [900, -900, 0],
  [-900, -900, 0],
]
const gateNames = ['West Gate', 'North Gate', 'East Gate', 'South Gate', 'NW Gate', 'NE Gate', 'SE Gate', 'SW Gate']

const MANUAL_SECTOR_LAYOUTS: Record<string, SeizewellLayout> = {
  seizewell: SEIZEWELL_BLUEPRINT,
  teladi_gain: TELADI_GAIN_BLUEPRINT,
  profit_share: PROFIT_SHARE_BLUEPRINT,
  greater_profit: GREATER_PROFIT_BLUEPRINT,
}

export const getSectorLayoutById = (id: string): SeizewellLayout => {
  const sector = UNIVERSE_SECTORS_XBTF.find((s) => s.id === id) || UNIVERSE_SECTORS_XBTF[0]

  const gates = (sector?.neighbors || []).map((nm) => {
    const neighbor = UNIVERSE_SECTORS_XBTF.find((s) => s.name === nm)
    if (!neighbor) return null

    const dx = neighbor.x - sector.x
    const dy = neighbor.y - sector.y

    let name = 'Gate'
    let position: [number, number, number] = [0, 0, 0]

    if (dx === 1) { name = 'East Gate'; position = [4000, 0, 0] }
    else if (dx === -1) { name = 'West Gate'; position = [-4000, 0, 0] }
    else if (dy === 1) { name = 'South Gate'; position = [0, 0, 4000] }
    else if (dy === -1) { name = 'North Gate'; position = [0, 0, -4000] }
    else {
      // Fallback for non-adjacent jumps if any
      name = 'Gate'
      position = [2000, 0, 2000]
    }

    return { name, position, modelPath: '/models/00088.obj' }
  }).filter((g): g is { name: string; position: [number, number, number]; modelPath: string } => !!g)

  const manual = MANUAL_SECTOR_LAYOUTS[id as keyof typeof MANUAL_SECTOR_LAYOUTS]
  if (manual) {
    return {
      ...manual,
      gates
    }
  }
  const stations = [
    { name: 'Trading Station', position: DEFAULT_SECTOR_CONFIG.station.position, scale: DEFAULT_SECTOR_CONFIG.station.scale, rotate: true, modelPath: DEFAULT_SECTOR_CONFIG.station.modelPath },
  ]
  const sunPosition = [115200000000, 76800000000, 57600000000] as [number, number, number]
  const planetPosition = [-4534400, -1700400, -19838000] as [number, number, number]
  const playerStart: [number, number, number] = [0, 50, 900]
  return {
    gates,
    stations,
    ships: [],
    sun: { position: sunPosition, size: DEFAULT_SECTOR_CONFIG.sun.size, color: DEFAULT_SECTOR_CONFIG.sun.color, intensity: DEFAULT_SECTOR_CONFIG.sun.intensity },
    planet: { position: planetPosition, size: DEFAULT_SECTOR_CONFIG.planet.size },
    asteroids: { count: 520, range: 1400, center: [40, 40, -160] },
    playerStart,
  } as SeizewellLayout
}
