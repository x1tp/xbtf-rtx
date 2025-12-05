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
