import { Box3, Object3D, Vector3 } from 'three';
import type { SeizewellLayout } from '../config/sectors/seizewell';

export type NavObstacle = { id: string; center: Vector3; radius: number; label?: string };

export type NavNode = {
  id: string;
  label: string;
  position: Vector3;
  kind: 'station' | 'gate' | 'ship' | 'waypoint';
};

export type NavGraph = {
  nodes: NavNode[];
  edges: Map<string, Set<string>>;
  obstacles: NavObstacle[];
};

const DEFAULT_EDGE_LIMIT = 120000;
const DEFAULT_CLEARANCE = 60;

const place = (p: [number, number, number], spacing: number) =>
  new Vector3(p[0] * spacing, p[1] * spacing, p[2] * spacing);

export function buildNavNodesFromLayout(layout: SeizewellLayout | null, spacing: number): NavNode[] {
  if (!layout) return [];
  const nodes: NavNode[] = [];
  layout.stations.forEach((st, idx) => {
    nodes.push({
      id: `station-${idx}`,
      label: st.name,
      position: place(st.position, spacing),
      kind: 'station',
    });
  });
  layout.gates.forEach((g, idx) => {
    nodes.push({
      id: `gate-${idx}`,
      label: g.name,
      position: place(g.position, spacing),
      kind: 'gate',
    });
  });
  layout.ships.forEach((s, idx) => {
    nodes.push({
      id: `ship-${idx}`,
      label: s.name,
      position: place(s.position, spacing),
      kind: 'ship',
    });
  });

  // Helper waypoints to keep paths from clustering at the origin only.
  const spread = 600;
  const helpers: [string, Vector3][] = [
    ['waypoint-center', new Vector3(0, 0, 0)],
    ['waypoint-east', new Vector3(spread, 0, 0)],
    ['waypoint-west', new Vector3(-spread, 0, 0)],
    ['waypoint-north', new Vector3(0, spread, 0)],
    ['waypoint-south', new Vector3(0, -spread, 0)],
    ['waypoint-front', new Vector3(0, 0, spread)],
    ['waypoint-back', new Vector3(0, 0, -spread)],
  ];
  helpers.forEach(([id, pos]) => nodes.push({ id, label: id, position: pos, kind: 'waypoint' }));

  return nodes;
}

const distancePointToSegment = (p: Vector3, a: Vector3, b: Vector3): number => {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-6)));
  const closest = a.clone().add(ab.multiplyScalar(t));
  return closest.distanceTo(p);
};

const isSegmentBlocked = (a: Vector3, b: Vector3, obstacles: NavObstacle[], clearance: number) => {
  for (const o of obstacles) {
    const dist = distancePointToSegment(o.center, a, b);
    if (dist <= o.radius + clearance) return true;
  }
  return false;
};

export function buildNavGraph(
  nodes: NavNode[],
  obstacles: NavObstacle[],
  maxEdgeLength = DEFAULT_EDGE_LIMIT,
  clearance = DEFAULT_CLEARANCE,
): NavGraph {
  const edges = new Map<string, Set<string>>();
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    if (!edges.has(a.id)) edges.set(a.id, new Set());
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      if (!edges.has(b.id)) edges.set(b.id, new Set());
      const dist = a.position.distanceTo(b.position);
      if (dist > maxEdgeLength) continue;
      if (isSegmentBlocked(a.position, b.position, obstacles, clearance)) continue;
      edges.get(a.id)!.add(b.id);
      edges.get(b.id)!.add(a.id);
    }
  }
  return { nodes, edges, obstacles };
}

const attachNodeToGraph = (
  node: NavNode,
  baseNodes: NavNode[],
  baseEdges: Map<string, Set<string>>,
  obstacles: NavObstacle[],
  maxEdgeLength = DEFAULT_EDGE_LIMIT,
  clearance = DEFAULT_CLEARANCE,
) => {
  const edges = new Map<string, Set<string>>();
  baseEdges.forEach((v, k) => edges.set(k, new Set(v)));
  if (!edges.has(node.id)) edges.set(node.id, new Set());
  for (const other of baseNodes) {
    if (other.id === node.id) continue;
    const dist = node.position.distanceTo(other.position);
    if (dist > maxEdgeLength) continue;
    if (isSegmentBlocked(node.position, other.position, obstacles, clearance)) continue;
    edges.get(node.id)!.add(other.id);
    const existing = edges.get(other.id) ?? new Set<string>();
    existing.add(node.id);
    edges.set(other.id, existing);
  }
  return edges;
};

const reconstructPath = (cameFrom: Map<string, string>, current: string): string[] => {
  const totalPath = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    totalPath.push(current);
  }
  return totalPath.reverse();
};

const aStar = (nodes: Map<string, NavNode>, edges: Map<string, Set<string>>, start: string, goal: string): string[] => {
  const open = new Set<string>([start]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  nodes.forEach((_, id) => {
    gScore.set(id, Infinity);
    fScore.set(id, Infinity);
  });
  gScore.set(start, 0);
  fScore.set(start, nodes.get(start)!.position.distanceTo(nodes.get(goal)!.position));

  while (open.size > 0) {
    let current: string | null = null;
    let lowestF = Infinity;
    open.forEach((id) => {
      const f = fScore.get(id) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = id;
      }
    });
    if (!current) break;
    const currentId = current;
    const currentNode = nodes.get(currentId);
    const goalNode = nodes.get(goal);
    if (!currentNode || !goalNode) break;
    if (currentId === goal) return reconstructPath(cameFrom, currentId);
    open.delete(currentId);
    const neighbors = edges.get(currentId);
    if (!neighbors) continue;
    neighbors.forEach((n) => {
      const neighborNode = nodes.get(n);
      if (!neighborNode) return;
      const tentative = (gScore.get(currentId) ?? Infinity) + currentNode.position.distanceTo(neighborNode.position);
      if (tentative < (gScore.get(n) ?? Infinity)) {
        cameFrom.set(n, currentId);
        gScore.set(n, tentative);
        fScore.set(n, tentative + neighborNode.position.distanceTo(goalNode.position));
        open.add(n);
      }
    });
  }
  return [];
};

export function findPath(graph: NavGraph | null, start: Vector3, goal: Vector3): Vector3[] {
  if (!graph || graph.nodes.length === 0) return [goal.clone()];
  if (!isSegmentBlocked(start, goal, graph.obstacles, DEFAULT_CLEARANCE)) {
    return [goal.clone()];
  }

  const startNode: NavNode = { id: '__start', label: 'start', position: start.clone(), kind: 'waypoint' };
  const goalNode: NavNode = { id: '__goal', label: 'goal', position: goal.clone(), kind: 'waypoint' };
  const nodes = [...graph.nodes, startNode, goalNode];
  let edges = attachNodeToGraph(startNode, nodes, graph.edges, graph.obstacles);
  edges = attachNodeToGraph(goalNode, nodes, edges, graph.obstacles);

  const nodeMap = new Map<string, NavNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));
  const pathIds = aStar(nodeMap, edges, startNode.id, goalNode.id);
  if (pathIds.length <= 1) return [goal.clone()];
  const positions = pathIds
    .slice(1)
    .map((id) => nodeMap.get(id)?.position.clone())
    .filter((v): v is Vector3 => !!v);
  return positions.length > 0 ? positions : [goal.clone()];
}

export function computeSceneObstacles(scene: Object3D, minRadius = 80, inflate = 1.15): NavObstacle[] {
  const obstacles: NavObstacle[] = [];
  scene.children.forEach((child) => {
    const ud = (child as unknown as { userData?: { navRadius?: number } }).userData || {};
    const hasNavRadius = typeof ud.navRadius === 'number' && Number.isFinite(ud.navRadius);
    const name = (child.name || '').toLowerCase();
    const tagged =
      hasNavRadius ||
      name.includes('station') ||
      name.includes('gate') ||
      name.includes('planet') ||
      name.includes('asteroid');
    if (!tagged) return;
    const box = new Box3().setFromObject(child);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const radiusFromBounds = Math.max(size.length() * 0.25 * inflate, minRadius);
    const radius = hasNavRadius ? Math.max(ud.navRadius as number, radiusFromBounds) : radiusFromBounds;
    if (!Number.isFinite(radius)) return;
    obstacles.push({ id: child.uuid, center, radius, label: child.name || 'obstacle' });
  });
  return obstacles;
}
