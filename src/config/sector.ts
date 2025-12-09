import { UNIVERSE_SECTORS_XBTF } from './universe_xbtf'
import type { SeizewellLayout, BlueprintObject } from './sectors/seizewell'
import { PLANET_DATABASE } from './planetDatabase'

// Boron
import { KINGDOM_END_BLUEPRINT } from './sectors/kingdom_end'
import { ROLK_S_DRIFT_BLUEPRINT } from './sectors/rolk_s_drift'
import { QUEENS_SPACE_BLUEPRINT } from './sectors/queens_space'
import { MENELAUS_FRONTIER_BLUEPRINT } from './sectors/menelaus_frontier'
import { ROLK_S_FATE_BLUEPRINT } from './sectors/rolk_s_fate'
import { ATREUS_CLOUDS_BLUEPRINT } from './sectors/atreus_clouds'

// Argon
import { ARGON_PRIME_BLUEPRINT } from './sectors/argon_prime'
import { THREE_WORLDS_BLUEPRINT } from './sectors/three_worlds'
import { POWER_CIRCLE_BLUEPRINT } from './sectors/power_circle'
import { ANTIGONE_MEMORIAL_BLUEPRINT } from './sectors/antigone_memorial'
import { CLOUDBASE_NORTH_WEST_BLUEPRINT } from './sectors/cloudbase_north_west'
import { HERRON_S_NEBULA_BLUEPRINT } from './sectors/herron_s_nebula'
import { THE_HOLE_BLUEPRINT } from './sectors/the_hole'
import { RINGO_MOON_BLUEPRINT } from './sectors/ringo_moon'
import { THE_WALL_BLUEPRINT } from './sectors/the_wall'
import { RED_LIGHT_BLUEPRINT } from './sectors/red_light'
import { HOME_OF_LIGHT_BLUEPRINT } from './sectors/home_of_light'
import { PRESIDENT_S_END_BLUEPRINT } from './sectors/president_s_end'
import { CLOUDBASE_SOUTH_WEST_BLUEPRINT } from './sectors/cloudbase_south_west'
import { ORE_BELT_BLUEPRINT } from './sectors/ore_belt'
import { CLOUDBASE_SOUTH_EAST_BLUEPRINT } from './sectors/cloudbase_south_east'

// Teladi
import { SEIZEWELL_BLUEPRINT } from './sectors/seizewell'
import { CEO_S_BUCKZOID_BLUEPRINT } from './sectors/ceo_s_buckzoid'
import { TELADI_GAIN_BLUEPRINT } from './sectors/teladi_gain'
import { PROFIT_SHARE_BLUEPRINT } from './sectors/profit_share'
import { SPACEWEED_DRIFT_BLUEPRINT } from './sectors/spaceweed_drift'
import { GREATER_PROFIT_BLUEPRINT } from './sectors/greater_profit'
import { BLUE_PROFIT_BLUEPRINT } from './sectors/blue_profit'
import { CEO_S_SPRITE_BLUEPRINT } from './sectors/ceo_s_sprite'
import { COMPANY_PRIDE_BLUEPRINT } from './sectors/company_pride'

// Split
import { FAMILY_WHI_BLUEPRINT } from './sectors/family_whi'
import { FAMILY_ZEIN_BLUEPRINT } from './sectors/family_zein'
import { THURUKS_PRIDE_BLUEPRINT } from './sectors/thuruks_pride'
import { FAMILY_PRIDE_BLUEPRINT } from './sectors/family_pride'
import { CHINS_FIRE_BLUEPRINT } from './sectors/chins_fire'
import { CHINS_CLOUDS_BLUEPRINT } from './sectors/chins_clouds'
import { FAMILY_CHIN_BLUEPRINT } from './sectors/family_chin'
import { THURUKS_BEARD_BLUEPRINT } from './sectors/thuruks_beard'

// Paranid
import { EMPEROR_MINES_BLUEPRINT } from './sectors/emperor_mines'
import { PARANID_PRIME_BLUEPRINT } from './sectors/paranid_prime'
import { PRIEST_RINGS_BLUEPRINT } from './sectors/priest_rings'
import { PRIEST_PITY_BLUEPRINT } from './sectors/priest_pity'
import { EMPIRES_EDGE_BLUEPRINT } from './sectors/empires_edge'
import { DUKES_DOMAIN_BLUEPRINT } from './sectors/dukes_domain'
import { EMPERORS_RIDGE_BLUEPRINT } from './sectors/emperors_ridge'

// Xenon
import { XENON_SECTOR_1_BLUEPRINT } from './sectors/xenon_sector_1'
import { XENON_SECTOR_2_BLUEPRINT } from './sectors/xenon_sector_2'
import { XENON_SECTOR_3_BLUEPRINT } from './sectors/xenon_sector_3'
import { XENON_SECTOR_4_BLUEPRINT } from './sectors/xenon_sector_4'
import { XENON_SECTOR_5_BLUEPRINT } from './sectors/xenon_sector_5'
import { XENON_SECTOR_6_BLUEPRINT } from './sectors/xenon_sector_6'
import { XENON_SECTOR_7_BLUEPRINT } from './sectors/xenon_sector_7'
import { XENON_SECTOR_8_BLUEPRINT } from './sectors/xenon_sector_8'
import { XENON_SECTOR_9_BLUEPRINT } from './sectors/xenon_sector_9'

export interface SectorConfig {
  sun: { position: [number, number, number]; size: number; color: string; intensity: number };
  planet: { position: [number, number, number]; size: number };
  station: { position: [number, number, number]; scale: number; modelPath: string; rotationSpeed: number; rotationAxis: 'x' | 'y' | 'z' };
  background?: { type: 'starfield' | 'nebula'; texturePath?: string };
}
export const DEFAULT_SECTOR_CONFIG: SectorConfig = {
  // Approximate real-scale: 1 AU distance and real solar radius (meters)
  sun: { position: [149600000000, 20000000, 0], size: 696340000, color: '#ffddaa', intensity: 5.0 },
  planet: { position: [5097200, 318575, -6371500], size: 6371000 },
  station: { position: [50, 0, -120], scale: 40, modelPath: '/models/00001.obj', rotationSpeed: -0.05, rotationAxis: 'z' }
};

const MANUAL_SECTOR_LAYOUTS: Record<string, SeizewellLayout> = {
  // Boron
  kingdom_end: KINGDOM_END_BLUEPRINT,
  rolk_s_drift: ROLK_S_DRIFT_BLUEPRINT,
  queens_space: QUEENS_SPACE_BLUEPRINT,
  menelaus_frontier: MENELAUS_FRONTIER_BLUEPRINT,
  rolk_s_fate: ROLK_S_FATE_BLUEPRINT,
  atreus_clouds: ATREUS_CLOUDS_BLUEPRINT,

  // Argon
  argon_prime: ARGON_PRIME_BLUEPRINT,
  three_worlds: THREE_WORLDS_BLUEPRINT,
  power_circle: POWER_CIRCLE_BLUEPRINT,
  antigone_memorial: ANTIGONE_MEMORIAL_BLUEPRINT,
  cloudbase_north_west: CLOUDBASE_NORTH_WEST_BLUEPRINT,
  herron_s_nebula: HERRON_S_NEBULA_BLUEPRINT,
  the_hole: THE_HOLE_BLUEPRINT,
  ringo_moon: RINGO_MOON_BLUEPRINT,
  the_wall: THE_WALL_BLUEPRINT,
  red_light: RED_LIGHT_BLUEPRINT,
  home_of_light: HOME_OF_LIGHT_BLUEPRINT,
  president_s_end: PRESIDENT_S_END_BLUEPRINT,
  cloudbase_south_west: CLOUDBASE_SOUTH_WEST_BLUEPRINT,
  ore_belt: ORE_BELT_BLUEPRINT,
  cloudbase_south_east: CLOUDBASE_SOUTH_EAST_BLUEPRINT,

  // Teladi
  seizewell: SEIZEWELL_BLUEPRINT,
  ceo_s_buckzoid: CEO_S_BUCKZOID_BLUEPRINT,
  teladi_gain: TELADI_GAIN_BLUEPRINT,
  profit_share: PROFIT_SHARE_BLUEPRINT,
  spaceweed_drift: SPACEWEED_DRIFT_BLUEPRINT,
  greater_profit: GREATER_PROFIT_BLUEPRINT,
  blue_profit: BLUE_PROFIT_BLUEPRINT,
  ceo_s_sprite: CEO_S_SPRITE_BLUEPRINT,
  company_pride: COMPANY_PRIDE_BLUEPRINT,

  // Split
  family_whi: FAMILY_WHI_BLUEPRINT,
  family_zein: FAMILY_ZEIN_BLUEPRINT,
  thuruks_pride: THURUKS_PRIDE_BLUEPRINT,
  family_pride: FAMILY_PRIDE_BLUEPRINT,
  chins_fire: CHINS_FIRE_BLUEPRINT,
  chins_clouds: CHINS_CLOUDS_BLUEPRINT,
  family_chin: FAMILY_CHIN_BLUEPRINT,
  thuruks_beard: THURUKS_BEARD_BLUEPRINT,

  // Paranid
  emperor_mines: EMPEROR_MINES_BLUEPRINT,
  paranid_prime: PARANID_PRIME_BLUEPRINT,
  priest_rings: PRIEST_RINGS_BLUEPRINT,
  priest_pity: PRIEST_PITY_BLUEPRINT,
  empires_edge: EMPIRES_EDGE_BLUEPRINT,
  dukes_domain: DUKES_DOMAIN_BLUEPRINT,
  emperors_ridge: EMPERORS_RIDGE_BLUEPRINT,

  // Xenon
  xenon_sector_1: XENON_SECTOR_1_BLUEPRINT,
  xenon_sector_2: XENON_SECTOR_2_BLUEPRINT,
  xenon_sector_3: XENON_SECTOR_3_BLUEPRINT,
  xenon_sector_4: XENON_SECTOR_4_BLUEPRINT,
  xenon_sector_5: XENON_SECTOR_5_BLUEPRINT,
  xenon_sector_6: XENON_SECTOR_6_BLUEPRINT,
  xenon_sector_7: XENON_SECTOR_7_BLUEPRINT,
  xenon_sector_8: XENON_SECTOR_8_BLUEPRINT,
  xenon_sector_9: XENON_SECTOR_9_BLUEPRINT,
}

// --- Procedural Generation Utils ---
class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  // Simple LCG
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }
}

// Ensure Seizewell remains fixed
const FIXED_SECTORS = ['seizewell'];

export const getSectorLayoutById = (id: string): SeizewellLayout => {
  const sector = UNIVERSE_SECTORS_XBTF.find((s) => s.id === id) || UNIVERSE_SECTORS_XBTF[0]

  // Use a hash of the sector ID to seed the PRNG
  let seed = 0;
  for (let i = 0; i < sector.id.length; i++) {
    seed = ((seed << 5) - seed) + sector.id.charCodeAt(i);
    seed |= 0;
  }
  const rng = new SeededRandom(Math.abs(seed));

  const generatedGates = (sector?.neighbors || []).map((nm) => {
    const neighbor = UNIVERSE_SECTORS_XBTF.find((s) => s.name === nm)
    if (!neighbor) return null

    const dx = neighbor.x - sector.x
    const dy = neighbor.y - sector.y

    let name = 'Gate'
    let position: [number, number, number] = [0, 0, 0]
    let rotation: [number, number, number] = [0, 0, 0]
    let gateType: 'N' | 'S' | 'W' | 'E' | undefined

    if (dx === 1) {
      name = 'East Gate'
      position = [5000, 0, 0]
      rotation = [0, Math.PI / 2, 0]
      gateType = 'E'
    } else if (dx === -1) {
      name = 'West Gate'
      position = [-5000, 0, 0]
      rotation = [0, Math.PI / 2, 0]
      gateType = 'W'
    } else if (dy === 1) {
      name = 'South Gate'
      position = [0, 0, 5000]
      rotation = [0, 0, 0]
      gateType = 'S'
    } else if (dy === -1) {
      name = 'North Gate'
      position = [0, 0, -5000]
      rotation = [0, 0, 0]
      gateType = 'N'
    } else {
      // Fallback for non-adjacent jumps if any
      name = 'Gate'
      // Determine approximate cardinal direction for gate type
      if (Math.abs(dx) > Math.abs(dy)) {
        gateType = dx > 0 ? 'E' : 'W';
        position = dx > 0 ? [5000, 0, 0] : [-5000, 0, 0];
        rotation = [0, Math.PI / 2, 0];
      } else {
        gateType = dy > 0 ? 'S' : 'N';
        position = dy > 0 ? [0, 0, 5000] : [0, 0, -5000];
        rotation = [0, 0, 0];
      }
    }

    return { name, position, rotation, modelPath: '/models/00088.obj', destinationSectorId: neighbor.id, gateType, scale: 300 }
  }).filter((g) => !!g) as BlueprintObject[]

  const manual = MANUAL_SECTOR_LAYOUTS[id as keyof typeof MANUAL_SECTOR_LAYOUTS]

  // Base configuration (can be overridden by procedural generation below)
  let layout: SeizewellLayout = {
    gates: generatedGates,
    stations: [
      { name: 'Trading Station', position: DEFAULT_SECTOR_CONFIG.station.position, scale: DEFAULT_SECTOR_CONFIG.station.scale, modelPath: DEFAULT_SECTOR_CONFIG.station.modelPath },
    ],
    ships: [],
    sun: { position: [149600000000, 20000000, 0], size: DEFAULT_SECTOR_CONFIG.sun.size, color: DEFAULT_SECTOR_CONFIG.sun.color, intensity: DEFAULT_SECTOR_CONFIG.sun.intensity },
    planet: { position: [5097200, 318575, -6371500], size: DEFAULT_SECTOR_CONFIG.planet.size },
    playerStart: [0, 50, 900],
  };

  // If manual layout exists, blindly copy it first
  if (manual) {
    layout = { ...layout, ...manual };
    // If manual layout has gates, use them. Otherwise use generated gates.
    if (manual.gates && manual.gates.length > 0) {
      layout.gates = manual.gates;
    }
  }

  // PROC GEN INJECTION
  // If NOT Seizewell, we inject variations to override defaults (or simple manual copies)
  if (!FIXED_SECTORS.includes(id)) {
    // 1. Varied Sun
    const sunColors = [
      '#ffaa00', // Yellow (Default)
      '#ffddaa', // Pale Yellow
      '#ffecdb', // White-Yellow
      '#ffffff', // White
      '#aaddff', // Blue-White
      '#88bbff', // Blue
      '#ff8866', // Red-Orange
      '#ff4422', // Red Giant
    ];
    const sunColor = rng.pick(sunColors);
    const sunSizeMult = rng.range(0.8, 3.0);
    // Place sun in random quadrant but far away
    const sunDist = 149600000000; // 1 AU
    const sunTheta = rng.range(0, Math.PI * 2);
    const sunPhi = rng.range(-0.5, 0.5); // Keep it relatively near the ecliptic
    const sunX = sunDist * Math.cos(sunTheta) * Math.cos(sunPhi);
    const sunY = sunDist * Math.sin(sunPhi);
    const sunZ = sunDist * Math.sin(sunTheta) * Math.cos(sunPhi);

    layout.sun = {
      ...layout.sun,
      color: sunColor,
      size: DEFAULT_SECTOR_CONFIG.sun.size * sunSizeMult,
      position: [sunX, sunY, sunZ],
      intensity: 1.5 + rng.range(0, 2.0)
    };

    // 2. Varied Planet
    const planetTypes = ['terran', 'desert', 'ice', 'volcanic', 'barren', 'alien', 'gas_giant'];
    const planetType = rng.pick(planetTypes);
    const planetConfig = PLANET_DATABASE[planetType];

    if (planetConfig) {
      layout.planet = {
        ...layout.planet,
        // We attach the full config to the layout so Scene.tsx can use it
        config: planetConfig,
        size: planetConfig.size || layout.planet.size
      };
    }

    // 3. Varied Background (Skybox)
    // Only override if no background is set, OR if it's a generic starfield WITHOUT a specific texture
    if (!layout.background || (layout.background.type === 'starfield' && !layout.background.texturePath)) {
      const density = rng.range(0.1, 0.3);

      // Randomly pick a skybox texture
      // We include 'undefined' (default/none) as an option
      const skyboxOptions = [
        undefined,
        '/materials/skybox/dense_stars.png',
        '/materials/skybox/nebula_green.png',
        '/materials/skybox/nebula_purple.png',
        '/materials/skybox/nebula_red.png'
      ];
      const skybox = rng.pick(skyboxOptions);

      layout.background = {
        type: 'starfield',
        starDensity: density,
        texturePath: skybox
      };
    }
  }

  return layout;
}