import { UNIVERSE_SECTORS_XBTF, type UniverseSector } from '../config/universe_xbtf';

// Build a map for quick lookup
const sectorById = new Map<string, UniverseSector>();
const sectorByName = new Map<string, UniverseSector>();

UNIVERSE_SECTORS_XBTF.forEach(s => {
  sectorById.set(s.id, s);
  sectorByName.set(s.name, s);
});

/**
 * Finds the next sector ID to travel to in order to reach the target sector.
 * Uses BFS to find the shortest path.
 */
export function findNextHop(currentSectorId: string, targetSectorId: string): string | null {
  if (currentSectorId === targetSectorId) return null;
  if (!sectorById.has(currentSectorId) || !sectorById.has(targetSectorId)) return null;

  // BFS to find shortest path
  // We store the 'first hop' in the queue items so we know which way to go from start
  const queue: { id: string; firstHop: string | null }[] = [{ id: currentSectorId, firstHop: null }];
  const visited = new Set<string>([currentSectorId]);

  while (queue.length > 0) {
    const { id, firstHop } = queue.shift()!;
    
    if (id === targetSectorId) {
      return firstHop;
    }

    const sector = sectorById.get(id);
    if (!sector) continue;

    for (const neighborName of sector.neighbors) {
      const neighbor = sectorByName.get(neighborName);
      if (neighbor && !visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        // If firstHop is null, then THIS neighbor is the first hop
        const nextHop = firstHop || neighbor.id;
        queue.push({ id: neighbor.id, firstHop: nextHop });
      }
    }
  }

  return null; // No path found
}
