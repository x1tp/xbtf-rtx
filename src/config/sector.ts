export interface SectorConfig {
  sun: { position: [number, number, number]; size: number; color: string; intensity: number };
  planet: { position: [number, number, number]; size: number };
  station: { position: [number, number, number]; scale: number; modelPath: string; rotationSpeed: number; rotationAxis: 'x'|'y'|'z' };
  asteroids: { count: number; range: number; center: [number, number, number] };
}
export const DEFAULT_SECTOR_CONFIG: SectorConfig = {
  // Approximate real-scale: 1 AU distance and real solar radius (meters)
  sun: { position: [149600000000, 20000000, 0], size: 696340000, color: '#ffddaa', intensity: 5.0 },
  planet: { position: [5097200, 318575, -6371500], size: 6371000 },
  station: { position: [50, 0, -120], scale: 40, modelPath: '/models/00001.obj', rotationSpeed: -0.05, rotationAxis: 'z' },
  asteroids: { count: 500, range: 400, center: [-250, 80, -900] }
};
