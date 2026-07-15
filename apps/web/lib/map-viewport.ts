import type { CenterGeo, NodeGeo } from "../components/ops-map-libre";

type Bounds = [[number, number], [number, number]];

export function computeMapBounds(nodes: NodeGeo[], centers: CenterGeo[] = []): Bounds | null {
  const points = [
    ...nodes.map((node) => [node.lng, node.lat] as const),
    ...centers.map((center) => [center.lng, center.lat] as const),
  ];

  if (points.length === 0) return null;

  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);

  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
