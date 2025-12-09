export interface PlanetDatabaseEntry {
  seed: number
  size?: number
  colorPalette: string[]
  waterLevel: number
  noiseScale: number
  bumpIntensity: number
  landRoughness: number
  oceanRoughness: number
  cloudDensity: number
  cloudOpacity: number
  rotationSpeed: number
  cloudRotationSpeed: number
  atmosphereEnabled: boolean
}

export const PLANET_DATABASE: Record<string, PlanetDatabaseEntry> = {
  seizewell: {
    seed: 983741,
    size: 6371000,
    // X3 Style: Deep Teal, Cyan, Grey Sand, Muted Green, Dark Green, Grey Rock, White Snow
    colorPalette: ['#001a26', '#004d66', '#8c99a6', '#2d4030', '#1a261a', '#555555', '#ffffff'],
    waterLevel: 0.48,
    noiseScale: 3.0, // More detail
    bumpIntensity: 1.5,
    landRoughness: 0.9,
    oceanRoughness: 0.6, // Diffuse sun reflection
    cloudDensity: 0.7, // Increased coverage
    cloudOpacity: 0.8,
    rotationSpeed: 0.0011,
    cloudRotationSpeed: 0.0015,
    atmosphereEnabled: true
  },
  // --- Presets (used by procedural generator) ---
  terran: {
    seed: 12345,
    size: 6400000,
    colorPalette: ['#002244', '#005577', '#c2b280', '#225522', '#113311', '#666666', '#ffffff'],
    waterLevel: 0.55,
    noiseScale: 2.5,
    bumpIntensity: 1.0,
    landRoughness: 0.9,
    oceanRoughness: 0.3,
    cloudDensity: 0.6,
    cloudOpacity: 0.8,
    rotationSpeed: 0.001,
    cloudRotationSpeed: 0.0012,
    atmosphereEnabled: true
  },
  desert: {
    seed: 67890,
    size: 6000000,
    colorPalette: ['#4a3b28', '#70543a', '#d4b483', '#c2a278', '#e6c288', '#8f6a45', '#70543a'],
    waterLevel: 0.0,
    noiseScale: 3.5,
    bumpIntensity: 0.8,
    landRoughness: 0.95,
    oceanRoughness: 0.1,
    cloudDensity: 0.2,
    cloudOpacity: 0.5,
    rotationSpeed: 0.0008,
    cloudRotationSpeed: 0.001,
    atmosphereEnabled: true
  },
  ice: {
    seed: 11223,
    size: 5800000,
    colorPalette: ['#ffffff', '#e0f0ff', '#c0e0ff', '#a0d0ff', '#80bdff', '#60a0ff', '#ffffff'],
    waterLevel: 0.0, // All ice
    noiseScale: 2.0,
    bumpIntensity: 0.5,
    landRoughness: 0.4, // Icy/shiny
    oceanRoughness: 0.4,
    cloudDensity: 0.4,
    cloudOpacity: 0.6,
    rotationSpeed: 0.0005,
    cloudRotationSpeed: 0.0008,
    atmosphereEnabled: true
  },
  volcanic: {
    seed: 44556,
    size: 6200000,
    colorPalette: ['#1a0500', '#2a0a00', '#3b0f00', '#551500', '#802000', '#aa3000', '#ff4500'],
    waterLevel: 0.0,
    noiseScale: 4.0, // Jagged
    bumpIntensity: 2.5,
    landRoughness: 1.0,
    oceanRoughness: 1.0,
    cloudDensity: 0.8,
    cloudOpacity: 0.9, // Thick smoke/ash
    rotationSpeed: 0.002,
    cloudRotationSpeed: 0.0025,
    atmosphereEnabled: true
  },
  barren: {
    seed: 99887,
    size: 5000000,
    colorPalette: ['#333333', '#444444', '#555555', '#666666', '#777777', '#888888', '#999999'],
    waterLevel: 0.0,
    noiseScale: 5.0,
    bumpIntensity: 1.8,
    landRoughness: 1.0,
    oceanRoughness: 1.0,
    cloudDensity: 0.0,
    cloudOpacity: 0.0,
    rotationSpeed: 0.0002,
    cloudRotationSpeed: 0.0,
    atmosphereEnabled: false
  },
  alien: {
    seed: 77777,
    size: 6500000,
    colorPalette: ['#220044', '#330066', '#6600cc', '#9900ff', '#cc00ff', '#4b0082', '#800080'],
    waterLevel: 0.7,
    noiseScale: 1.5,
    bumpIntensity: 1.2,
    landRoughness: 0.7,
    oceanRoughness: 0.4,
    cloudDensity: 0.5,
    cloudOpacity: 0.7,
    rotationSpeed: 0.0015,
    cloudRotationSpeed: 0.002,
    atmosphereEnabled: true
  },
  gas_giant: {
    seed: 55555,
    size: 15000000, // Very large
    colorPalette: ['#daddc5', '#e6e4d0', '#c8b696', '#a48464', '#785444', '#583e36', '#483430'],
    waterLevel: 0.0, // It's all gas (using terrain noise to fake bands for now)
    noiseScale: 1.0, // Large distinct bands
    bumpIntensity: 0.1, // Smooth
    landRoughness: 0.5,
    oceanRoughness: 0.5,
    cloudDensity: 0.8, // "Clouds" are the surface
    cloudOpacity: 0.3,
    rotationSpeed: 0.005,
    cloudRotationSpeed: 0.006,
    atmosphereEnabled: true
  },
  // --- Manual Override Backups ---
  teladi_gain: {
    seed: 620517,
    size: 5800000,
    colorPalette: ['#4a3b28', '#70543a', '#8f6a45', '#b28a5c', '#d0a274'],
    waterLevel: 0.34,
    noiseScale: 2.8,
    bumpIntensity: 0.7,
    landRoughness: 0.9,
    oceanRoughness: 0.25,
    cloudDensity: 0.35,
    cloudOpacity: 0.7,
    rotationSpeed: 0.0013,
    cloudRotationSpeed: 0.0016,
    atmosphereEnabled: false
  },
  profit_share: {
    seed: 411209,
    size: 6400000,
    colorPalette: ['#24324a', '#334d5e', '#4f6c6a', '#7a9b6e', '#c7d7a2'],
    waterLevel: 0.56,
    noiseScale: 2.2,
    bumpIntensity: 0.5,
    landRoughness: 0.8,
    oceanRoughness: 0.18,
    cloudDensity: 0.55,
    cloudOpacity: 0.8,
    rotationSpeed: 0.0010,
    cloudRotationSpeed: 0.0013,
    atmosphereEnabled: true
  },
  greater_profit: {
    seed: 771033,
    size: 6150000,
    colorPalette: ['#3b2f2a', '#514437', '#6a5a44', '#8c7a58', '#b59f76'],
    waterLevel: 0.28,
    noiseScale: 3.1,
    bumpIntensity: 0.8,
    landRoughness: 0.92,
    oceanRoughness: 0.3,
    cloudDensity: 0.25,
    cloudOpacity: 0.65,
    rotationSpeed: 0.0016,
    cloudRotationSpeed: 0.0019,
    atmosphereEnabled: false
  }
}
