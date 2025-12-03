import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type { SeizewellLayout } from '../config/seizewell';
import { buildNavGraph, buildNavNodesFromLayout, computeSceneObstacles } from './navigation';
import type { NavGraph, NavNode, NavObstacle } from './navigation';

export type NavData = { graph: NavGraph | null; nodes: NavNode[]; obstacles: NavObstacle[] };

/**
 * Builds a lightweight navigation graph for AI ships using the current scene
 * geometry as obstacles plus layout-provided anchor nodes.
 */
export const useAiNavigation = (layout: SeizewellLayout | null, spacing: number): NavData => {
  const { scene } = useThree();
  const [navData, setNavData] = useState<NavData>({ graph: null, nodes: [], obstacles: [] });
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!layout) {
      setNavData({ graph: null, nodes: [], obstacles: [] });
      return;
    }
    let cancelled = false;
    const build = (delay = 800) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (cancelled) return;
        const nodes = buildNavNodesFromLayout(layout, spacing);
        const obstacles = computeSceneObstacles(scene);
        const graph = buildNavGraph(nodes, obstacles);
        setNavData({ graph, nodes, obstacles });
        if (!cancelled && obstacles.length === 0) {
          build(1400); // Retry once assets have likely finished loading
        }
      }, delay);
    };
    build(800);
    return () => {
      cancelled = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [layout, spacing, scene]);

  return navData;
};
