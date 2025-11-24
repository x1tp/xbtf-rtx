export interface SectorConfig {
  sun: { position: [number, number, number]; size: number; color: string; intensity: number };
  planet: { position: [number, number, number]; size: number };
  station: { position: [number, number, number]; scale: number; modelPath: string; rotationSpeed: number; rotationAxis: 'x'|'y'|'z' };
  asteroids: { count: number; range: number };
}
export const DEFAULT_SECTOR_CONFIG: SectorConfig = {
  sun: { position: [5000, 2000, 5000], size: 200, color: '#ffddaa', intensity: 5.0 },
  planet: { position: [8000, 500, -10000], size: 10000 },
  station: { position: [50, 0, -120], scale: 40, modelPath: '/models/00001.obj', rotationSpeed: -0.05, rotationAxis: 'z' },
  asteroids: { count: 500, range: 400 }
};
