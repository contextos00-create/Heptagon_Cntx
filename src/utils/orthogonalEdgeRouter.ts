import { SurfaceCard, Connection } from '../types/surface';

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RoutedEdgeResult {
  pathData: string;
  startPoint: Point;
  endPoint: Point;
  waypoints: Point[];
  midPoint: Point;
}

/**
 * Checks if a 2D line segment intersects an axis-aligned box (with optional clearance)
 */
function lineIntersectsBox(
  p1: Point,
  p2: Point,
  box: Box
): boolean {
  // If line is completely to one side of the box
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  if (maxX <= box.minX || minX >= box.maxX || maxY <= box.minY || minY >= box.maxY) {
    return false;
  }

  // Vertical segment
  if (Math.abs(p1.x - p2.x) < 0.001) {
    return p1.x > box.minX && p1.x < box.maxX && maxY > box.minY && minX < box.maxY;
  }

  // Horizontal segment
  if (Math.abs(p1.y - p2.y) < 0.001) {
    return p1.y > box.minY && p1.y < box.maxY && maxX > box.minX && minX < box.maxX;
  }

  // Cohen-Sutherland style box intersection check
  const leftIntersectionY = p1.y + ((box.minX - p1.x) * (p2.y - p1.y)) / (p2.x - p1.x);
  if (leftIntersectionY >= box.minY && leftIntersectionY <= box.maxY && box.minX >= minX && box.minX <= maxX) {
    return true;
  }

  const rightIntersectionY = p1.y + ((box.maxX - p1.x) * (p2.y - p1.y)) / (p2.x - p1.x);
  if (rightIntersectionY >= box.minY && rightIntersectionY <= box.maxY && box.maxX >= minX && box.maxX <= maxX) {
    return true;
  }

  const topIntersectionX = p1.x + ((box.minY - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y);
  if (topIntersectionX >= box.minX && topIntersectionX <= box.maxX && box.minY >= minY && box.minY <= maxY) {
    return true;
  }

  const bottomIntersectionX = p1.x + ((box.maxY - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y);
  if (bottomIntersectionX >= box.minX && bottomIntersectionX <= box.maxX && box.maxY >= minY && box.maxY <= maxY) {
    return true;
  }

  return false;
}

/**
 * Converts a sequence of orthogonal points into an SVG path with smooth corner fillets
 */
export function pointsToSmoothSvgPath(points: Point[], cornerRadius: number = 8): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Vectors
    const d1x = curr.x - prev.x;
    const d1y = curr.y - prev.y;
    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;

    const len1 = Math.hypot(d1x, d1y);
    const len2 = Math.hypot(d2x, d2y);

    if (len1 < 0.001 || len2 < 0.001) continue;

    // Actual fillet radius cannot exceed half segment length
    const r = Math.min(cornerRadius, len1 / 2, len2 / 2);

    const cornerStartX = curr.x - (d1x / len1) * r;
    const cornerStartY = curr.y - (d1y / len1) * r;
    const cornerEndX = curr.x + (d2x / len2) * r;
    const cornerEndY = curr.y + (d2y / len2) * r;

    d += ` L ${cornerStartX.toFixed(1)} ${cornerStartY.toFixed(1)}`;
    d += ` Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${cornerEndX.toFixed(1)} ${cornerEndY.toFixed(1)}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

/**
 * Determine cardinal connection ports between source card and target card
 */
function getBestPorts(
  source: SurfaceCard,
  target: SurfaceCard
): { start: Point; end: Point; startDir: 'right' | 'left' | 'top' | 'bottom'; endDir: 'right' | 'left' | 'top' | 'bottom' } {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };

  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  // Horizontal dominance
  if (Math.abs(dx) >= Math.abs(dy) * 0.75) {
    if (dx >= 0) {
      // Source right -> Target left
      return {
        start: { x: source.x + source.width, y: source.y + source.height / 2 },
        end: { x: target.x, y: target.y + target.height / 2 },
        startDir: 'right',
        endDir: 'left',
      };
    } else {
      // Source left -> Target right
      return {
        start: { x: source.x, y: source.y + source.height / 2 },
        end: { x: target.x + target.width, y: target.y + target.height / 2 },
        startDir: 'left',
        endDir: 'right',
      };
    }
  } else {
    // Vertical dominance
    if (dy >= 0) {
      // Source bottom -> Target top
      return {
        start: { x: source.x + source.width / 2, y: source.y + source.height },
        end: { x: target.x + target.width / 2, y: target.y },
        startDir: 'bottom',
        endDir: 'top',
      };
    } else {
      // Source top -> Target bottom
      return {
        start: { x: source.x + source.width / 2, y: source.y },
        end: { x: target.x + target.width / 2, y: target.y + target.height },
        startDir: 'top',
        endDir: 'bottom',
      };
    }
  }
}

/**
 * Obstacle-avoiding orthogonal edge routing.
 * Avoids passing through intermediate cards with tight clearance padding.
 */
export function routeOrthogonalEdgeWithObstacleAvoidance(
  fromCard: SurfaceCard,
  toCard: SurfaceCard,
  allCards: SurfaceCard[],
  obstaclePadding: number = 14
): RoutedEdgeResult {
  const { start, end, startDir, endDir } = getBestPorts(fromCard, toCard);

  // Prepare obstacle boxes (excluding source, target, and large background section containers)
  const obstacles: Box[] = allCards
    .filter((c) => c.id !== fromCard.id && c.id !== toCard.id && c.type !== 'section')
    .map((c) => ({
      id: c.id,
      minX: c.x - obstaclePadding,
      minY: c.y - obstaclePadding,
      maxX: c.x + c.width + obstaclePadding,
      maxY: c.y + c.height + obstaclePadding,
    }));

  const stubLength = 16;
  const startStub: Point = {
    x: startDir === 'right' ? start.x + stubLength : startDir === 'left' ? start.x - stubLength : start.x,
    y: startDir === 'bottom' ? start.y + stubLength : startDir === 'top' ? start.y - stubLength : start.y,
  };
  const endStub: Point = {
    x: endDir === 'right' ? end.x + stubLength : endDir === 'left' ? end.x - stubLength : end.x,
    y: endDir === 'bottom' ? end.y + stubLength : endDir === 'top' ? end.y - stubLength : end.y,
  };

  // 1. Try simple direct orthogonal routes first (Z-step, L-step, or C-step)
  let candidateWays: Point[][] = [];

  if (startDir === 'right' && endDir === 'left' && startStub.x <= endStub.x) {
    const midX = (startStub.x + endStub.x) / 2;
    candidateWays.push([
      start,
      startStub,
      { x: midX, y: startStub.y },
      { x: midX, y: endStub.y },
      endStub,
      end,
    ]);
  } else if (startDir === 'left' && endDir === 'right' && startStub.x >= endStub.x) {
    const midX = (startStub.x + endStub.x) / 2;
    candidateWays.push([
      start,
      startStub,
      { x: midX, y: startStub.y },
      { x: midX, y: endStub.y },
      endStub,
      end,
    ]);
  } else if (startDir === 'bottom' && endDir === 'top' && startStub.y <= endStub.y) {
    const midY = (startStub.y + endStub.y) / 2;
    candidateWays.push([
      start,
      startStub,
      { x: startStub.x, y: midY },
      { x: endStub.x, y: midY },
      endStub,
      end,
    ]);
  } else if (startDir === 'top' && endDir === 'bottom' && startStub.y >= endStub.y) {
    const midY = (startStub.y + endStub.y) / 2;
    candidateWays.push([
      start,
      startStub,
      { x: startStub.x, y: midY },
      { x: endStub.x, y: midY },
      endStub,
      end,
    ]);
  } else {
    // Corner turn
    candidateWays.push([
      start,
      startStub,
      { x: endStub.x, y: startStub.y },
      endStub,
      end,
    ]);
    candidateWays.push([
      start,
      startStub,
      { x: startStub.x, y: endStub.y },
      endStub,
      end,
    ]);
  }

  // Check if any candidate has zero collision with obstacles
  let validPath: Point[] | null = null;
  for (const candidate of candidateWays) {
    let hasCollision = false;
    for (let i = 0; i < candidate.length - 1; i++) {
      const p1 = candidate[i];
      const p2 = candidate[i + 1];
      for (const box of obstacles) {
        if (lineIntersectsBox(p1, p2, box)) {
          hasCollision = true;
          break;
        }
      }
      if (hasCollision) break;
    }
    if (!hasCollision) {
      validPath = candidate;
      break;
    }
  }

  // 2. If simple candidates collide, run Obstacle-Avoidance Channel Routing (A* search)
  if (!validPath) {
    validPath = solveCorridorPath(start, startStub, endStub, end, obstacles);
  }

  // Clean redundant collinear points
  const simplified = simplifyCollinearPoints(validPath);
  const pathData = pointsToSmoothSvgPath(simplified, 7);

  // Compute representative mid-point for relation tag labels
  const midIdx = Math.floor(simplified.length / 2);
  const pA = simplified[Math.max(0, midIdx - 1)];
  const pB = simplified[Math.min(simplified.length - 1, midIdx)];
  const midPoint = {
    x: (pA.x + pB.x) / 2,
    y: (pA.y + pB.y) / 2,
  };

  return {
    pathData,
    startPoint: start,
    endPoint: end,
    waypoints: simplified,
    midPoint,
  };
}

/**
 * Solves an obstacle-avoiding orthogonal corridor path using a discrete waypoint graph
 */
function solveCorridorPath(
  start: Point,
  startStub: Point,
  endStub: Point,
  end: Point,
  obstacles: Box[]
): Point[] {
  // Collect critical X and Y grid lines from obstacles and endpoints
  const xCoords = new Set<number>([start.x, startStub.x, endStub.x, end.x]);
  const yCoords = new Set<number>([start.y, startStub.y, endStub.y, end.y]);

  for (const box of obstacles) {
    xCoords.add(box.minX);
    xCoords.add(box.maxX);
    xCoords.add((box.minX + box.maxX) / 2);

    yCoords.add(box.minY);
    yCoords.add(box.maxY);
    yCoords.add((box.minY + box.maxY) / 2);
  }

  // Convert to sorted arrays
  const sortedX = Array.from(xCoords).sort((a, b) => a - b);
  const sortedY = Array.from(yCoords).sort((a, b) => a - b);

  // Filter grid points that fall inside any obstacle
  const isInsideObstacle = (p: Point): boolean => {
    return obstacles.some(
      (b) => p.x > b.minX + 0.1 && p.x < b.maxX - 0.1 && p.y > b.minY + 0.1 && p.y < b.maxY - 0.1
    );
  };

  // Node key generator
  const pointKey = (p: Point) => `${Math.round(p.x)},${Math.round(p.y)}`;

  interface PathNode {
    point: Point;
    gScore: number;
    fScore: number;
    parent?: PathNode;
    dir?: 'h' | 'v';
  }

  const openSet: PathNode[] = [
    {
      point: startStub,
      gScore: 0,
      fScore: Math.hypot(endStub.x - startStub.x, endStub.y - startStub.y),
    },
  ];
  const closedSet = new Set<string>();

  let bestNode: PathNode | null = null;
  let iterations = 0;
  const maxIterations = 350; // Keep routing lightning-fast

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;
    // Get lowest fScore node
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].fScore < openSet[lowestIdx].fScore) lowestIdx = i;
    }
    const current = openSet.splice(lowestIdx, 1)[0];
    const curKey = pointKey(current.point);

    // Goal reached
    if (Math.hypot(current.point.x - endStub.x, current.point.y - endStub.y) < 12) {
      bestNode = current;
      break;
    }

    closedSet.add(curKey);

    // Generate orthogonal neighbors along adjacent x and y coordinates
    const curXIdx = sortedX.findIndex((x) => Math.abs(x - current.point.x) < 2);
    const curYIdx = sortedY.findIndex((y) => Math.abs(y - current.point.y) < 2);

    const neighbors: { p: Point; dir: 'h' | 'v' }[] = [];
    if (curXIdx > 0) neighbors.push({ p: { x: sortedX[curXIdx - 1], y: current.point.y }, dir: 'h' });
    if (curXIdx < sortedX.length - 1) neighbors.push({ p: { x: sortedX[curXIdx + 1], y: current.point.y }, dir: 'h' });
    if (curYIdx > 0) neighbors.push({ p: { x: current.point.x, y: sortedY[curYIdx - 1] }, dir: 'v' });
    if (curYIdx < sortedY.length - 1) neighbors.push({ p: { x: current.point.x, y: sortedY[curYIdx + 1] }, dir: 'v' });

    for (const { p: nbr, dir } of neighbors) {
      const nbrKey = pointKey(nbr);
      if (closedSet.has(nbrKey)) continue;
      if (isInsideObstacle(nbr)) continue;

      // Check if connecting segment intersects any obstacle
      let blocked = false;
      for (const box of obstacles) {
        if (lineIntersectsBox(current.point, nbr, box)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      const segLen = Math.hypot(nbr.x - current.point.x, nbr.y - current.point.y);
      // Bend penalty discourages unnecessary zig-zags
      const bendPenalty = current.dir && current.dir !== dir ? 35 : 0;
      const tentativeG = current.gScore + segLen + bendPenalty;

      const existing = openSet.find((item) => pointKey(item.point) === nbrKey);
      if (!existing || tentativeG < existing.gScore) {
        const h = Math.hypot(endStub.x - nbr.x, endStub.y - nbr.y);
        if (existing) {
          existing.gScore = tentativeG;
          existing.fScore = tentativeG + h;
          existing.parent = current;
          existing.dir = dir;
        } else {
          openSet.push({
            point: nbr,
            gScore: tentativeG,
            fScore: tentativeG + h,
            parent: current,
            dir,
          });
        }
      }
    }
  }

  // Reconstruct path
  const path: Point[] = [end, endStub];
  let trace: PathNode | null = bestNode;
  while (trace) {
    path.push(trace.point);
    trace = trace.parent || null;
  }
  path.push(startStub, start);
  return path.reverse();
}

/**
 * Simplifies consecutive collinear points along the same line
 */
function simplifyCollinearPoints(points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const isCollinearX = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
    const isCollinearY = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;

    if (!isCollinearX && !isCollinearY) {
      result.push(curr);
    }
  }

  result.push(points[points.length - 1]);
  return result;
}
