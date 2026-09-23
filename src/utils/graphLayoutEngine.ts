import { SurfaceCard, Connection, GraphLayoutAlgorithm, LayoutTightness } from '../types/surface';

export interface LayoutOptions {
  tightness?: LayoutTightness;
  preservePinned?: boolean;
  direction?: 'horizontal' | 'vertical';
  startX?: number;
  startY?: number;
}

/**
 * Resolves rectangular bounding box overlaps while maintaining maximum tightness
 */
function resolveBoxOverlaps(
  nodes: { id: string; x: number; y: number; width: number; height: number; pinned?: boolean }[],
  minGap: number = 24,
  maxIterations: number = 25
) {
  for (let iter = 0; iter < maxIterations; iter++) {
    let hasOverlap = false;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];

        const aCenterX = a.x + a.width / 2;
        const aCenterY = a.y + a.height / 2;
        const bCenterX = b.x + b.width / 2;
        const bCenterY = b.y + b.height / 2;

        const reqHalfW = (a.width + b.width) / 2 + minGap;
        const reqHalfH = (a.height + b.height) / 2 + minGap;

        const diffX = bCenterX - aCenterX;
        const diffY = bCenterY - aCenterY;

        const overlapX = reqHalfW - Math.abs(diffX);
        const overlapY = reqHalfH - Math.abs(diffY);

        if (overlapX > 0 && overlapY > 0) {
          hasOverlap = true;

          // Push along minimum overlap axis to keep layout tight
          if (overlapX < overlapY) {
            const push = (overlapX / 2) * (diffX >= 0 ? 1 : -1);
            if (!a.pinned) a.x -= push;
            if (!b.pinned) b.x += push;
          } else {
            const push = (overlapY / 2) * (diffY >= 0 ? 1 : -1);
            if (!a.pinned) a.y -= push;
            if (!b.pinned) b.y += push;
          }
        }
      }
    }

    if (!hasOverlap) break;
  }
}

/**
 * 1. FORCE-DIRECTED GRAPH LAYOUT
 * Realistic spring-electrical simulation with tight box-boundary forces and simulated annealing.
 */
export function applyForceDirectedLayout(
  cards: SurfaceCard[],
  connections: Connection[],
  options: LayoutOptions = {}
): SurfaceCard[] {
  if (cards.length === 0) return [];
  const tightness = options.tightness || 'tight';
  const minGap = tightness === 'tight' ? 18 : tightness === 'compact' ? 28 : 44;
  const idealSpringLen = tightness === 'tight' ? 170 : tightness === 'compact' ? 240 : 320;

  // Clone nodes for layout calculation
  const nodes = cards.map((c) => ({
    id: c.id,
    x: c.x,
    y: c.y,
    vx: 0,
    vy: 0,
    width: c.width,
    height: c.height,
    pinned: options.preservePinned ? c.pinned : false,
    card: c,
  }));

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Adjacency edges
  const edgeList = connections
    .map((conn) => ({
      source: nodeMap.get(conn.fromId),
      target: nodeMap.get(conn.toId),
    }))
    .filter((e): e is { source: (typeof nodes)[0]; target: (typeof nodes)[0] } => Boolean(e.source && e.target));

  // Simulation parameters
  const iterations = 85;
  let temperature = 120.0;
  const coolingRate = 0.94;

  for (let step = 0; step < iterations; step++) {
    // 1. Repulsive forces between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const u = nodes[i];
        const v = nodes[j];

        const uxCenter = u.x + u.width / 2;
        const uyCenter = u.y + u.height / 2;
        const vxCenter = v.x + v.width / 2;
        const vyCenter = v.y + v.height / 2;

        let dx = vxCenter - uxCenter;
        let dy = vyCenter - uyCenter;
        let dist = Math.hypot(dx, dy) || 1;

        // Effective minimum distance accounting for card shapes
        const minDist = (Math.hypot(u.width, u.height) + Math.hypot(v.width, v.height)) / 2 + minGap;
        const k = Math.max(dist, minDist * 0.7);

        const repForce = (idealSpringLen * idealSpringLen * 1.8) / (k * k);
        const fx = (dx / dist) * repForce;
        const fy = (dy / dist) * repForce;

        if (!u.pinned) {
          u.vx -= fx;
          u.vy -= fy;
        }
        if (!v.pinned) {
          v.vx += fx;
          v.vy += fy;
        }
      }
    }

    // 2. Attractive spring forces between connected nodes
    for (const { source, target } of edgeList) {
      const sxCenter = source.x + source.width / 2;
      const syCenter = source.y + source.height / 2;
      const txCenter = target.x + target.width / 2;
      const tyCenter = target.y + target.height / 2;

      let dx = txCenter - sxCenter;
      let dy = tyCenter - syCenter;
      let dist = Math.hypot(dx, dy) || 1;

      // Hooke's spring force
      const delta = dist - idealSpringLen;
      const attrForce = (delta * delta) / (idealSpringLen * 1.5) * (delta >= 0 ? 1 : -1);

      const fx = (dx / dist) * attrForce;
      const fy = (dy / dist) * attrForce;

      if (!source.pinned) {
        source.vx += fx;
        source.vy += fy;
      }
      if (!target.pinned) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // 3. Apply velocities capped by current temperature
    for (const node of nodes) {
      if (node.pinned) continue;
      const speed = Math.hypot(node.vx, node.vy) || 1;
      const stepDist = Math.min(speed, temperature);

      node.x += (node.vx / speed) * stepDist;
      node.y += (node.vy / speed) * stepDist;

      // Damping
      node.vx *= 0.45;
      node.vy *= 0.45;
    }

    temperature *= coolingRate;
  }

  // Remove any remaining box overlaps tightly
  resolveBoxOverlaps(nodes, minGap);

  // Normalize origin to startX, startY or top-left
  return alignNodesToOrigin(nodes, options.startX ?? 60, options.startY ?? 60);
}

/**
 * 2. STRESS MAJORIZATION GRAPH LAYOUT
 * Minimizes global stress function using all-pairs shortest path distance matrix & iterative majorization.
 */
export function applyStressMajorizationLayout(
  cards: SurfaceCard[],
  connections: Connection[],
  options: LayoutOptions = {}
): SurfaceCard[] {
  if (cards.length === 0) return [];
  const tightness = options.tightness || 'tight';
  const minGap = tightness === 'tight' ? 18 : tightness === 'compact' ? 28 : 44;
  const edgeTargetLen = tightness === 'tight' ? 160 : tightness === 'compact' ? 230 : 310;

  const n = cards.length;
  const nodes = cards.map((c, idx) => ({
    idx,
    id: c.id,
    x: c.x,
    y: c.y,
    width: c.width,
    height: c.height,
    pinned: options.preservePinned ? c.pinned : false,
    card: c,
  }));
  const idToIdx = new Map(nodes.map((n) => [n.id, n.idx]));

  // Adjacency graph
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const conn of connections) {
    const u = idToIdx.get(conn.fromId);
    const v = idToIdx.get(conn.toId);
    if (u !== undefined && v !== undefined && u !== v) {
      adj[u].push(v);
      adj[v].push(u);
    }
  }

  // Compute all-pairs shortest paths via BFS
  const dist: number[][] = Array.from({ length: n }, () => Array(n).fill(Infinity));
  for (let i = 0; i < n; i++) {
    dist[i][i] = 0;
    const queue = [i];
    while (queue.length > 0) {
      const u = queue.shift()!;
      for (const v of adj[u]) {
        if (dist[i][v] === Infinity) {
          dist[i][v] = dist[i][u] + 1;
          queue.push(v);
        }
      }
    }
  }

  // Fill unreachable pairs with max distance + 2
  let maxGraphDist = 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (dist[i][j] !== Infinity && dist[i][j] > maxGraphDist) {
        maxGraphDist = dist[i][j];
      }
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (dist[i][j] === Infinity) {
        dist[i][j] = maxGraphDist + 2;
      }
    }
  }

  // Weight matrix w_ij = 1 / (d_ij ^ 2), target euclidean distance delta_ij = d_ij * edgeTargetLen
  const weights: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const targetDists: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const d = dist[i][j];
        weights[i][j] = 1 / (d * d);
        targetDists[i][j] = d * edgeTargetLen;
      }
    }
  }

  // Iterative localized stress descent
  const iterations = 50;
  for (let step = 0; step < iterations; step++) {
    for (let i = 0; i < n; i++) {
      if (nodes[i].pinned) continue;

      let sumWeight = 0;
      let targetX = 0;
      let targetY = 0;

      const pX = nodes[i].x + nodes[i].width / 2;
      const pY = nodes[i].y + nodes[i].height / 2;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const w = weights[i][j];
        const delta = targetDists[i][j];

        const qX = nodes[j].x + nodes[j].width / 2;
        const qY = nodes[j].y + nodes[j].height / 2;

        const dx = pX - qX;
        const dy = pY - qY;
        const norm = Math.hypot(dx, dy) || 0.001;

        sumWeight += w;
        targetX += w * (qX + (delta * dx) / norm);
        targetY += w * (qY + (delta * dy) / norm);
      }

      if (sumWeight > 0) {
        const newCenterX = targetX / sumWeight;
        const newCenterY = targetY / sumWeight;
        // Damped update
        nodes[i].x += (newCenterX - nodes[i].width / 2 - nodes[i].x) * 0.7;
        nodes[i].y += (newCenterY - nodes[i].height / 2 - nodes[i].y) * 0.7;
      }
    }
  }

  // Remove box overlaps tightly
  resolveBoxOverlaps(nodes, minGap);

  return alignNodesToOrigin(nodes, options.startX ?? 60, options.startY ?? 60);
}

/**
 * 3. ELK LAYERED GRAPH LAYOUT (Sugiyama Framework)
 * Cycle breaking (DFS) -> Layer ranking (longest path) -> Crossing reduction (barycenter sweeps) -> Coordinate compaction.
 */
export function applyElkLayeredLayout(
  cards: SurfaceCard[],
  connections: Connection[],
  options: LayoutOptions = {}
): SurfaceCard[] {
  if (cards.length === 0) return [];
  const tightness = options.tightness || 'tight';
  const nodeGap = tightness === 'tight' ? 20 : tightness === 'compact' ? 30 : 44;
  const layerGap = tightness === 'tight' ? 70 : tightness === 'compact' ? 95 : 130;
  const isHorizontal = options.direction !== 'vertical'; // Default horizontal data-flow

  const nodes = cards.map((c) => ({
    id: c.id,
    x: c.x,
    y: c.y,
    width: c.width,
    height: c.height,
    card: c,
    layer: 0,
    order: 0,
  }));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Directed graph representation
  const outEdges = new Map<string, string[]>();
  const inEdges = new Map<string, string[]>();
  for (const n of nodes) {
    outEdges.set(n.id, []);
    inEdges.set(n.id, []);
  }

  for (const conn of connections) {
    if (nodeMap.has(conn.fromId) && nodeMap.has(conn.toId) && conn.fromId !== conn.toId) {
      outEdges.get(conn.fromId)!.push(conn.toId);
      inEdges.get(conn.toId)!.push(conn.fromId);
    }
  }

  // Step 1: Cycle breaking using DFS coloring
  const visited = new Map<string, 'white' | 'gray' | 'black'>();
  nodes.forEach((n) => visited.set(n.id, 'white'));
  const dagEdges: { from: string; to: string }[] = [];

  function dfsCycleRemove(u: string) {
    visited.set(u, 'gray');
    for (const v of outEdges.get(u) || []) {
      const color = visited.get(v);
      if (color === 'gray') {
        // Back-edge detected! Reverse to break cycle
        dagEdges.push({ from: v, to: u });
      } else if (color === 'white') {
        dagEdges.push({ from: u, to: v });
        dfsCycleRemove(v);
      } else {
        dagEdges.push({ from: u, to: v });
      }
    }
    visited.set(u, 'black');
  }

  nodes.forEach((n) => {
    if (visited.get(n.id) === 'white') dfsCycleRemove(n.id);
  });

  // Build DAG adjacencies
  const dagOut = new Map<string, string[]>();
  const dagIn = new Map<string, string[]>();
  nodes.forEach((n) => {
    dagOut.set(n.id, []);
    dagIn.set(n.id, []);
  });
  dagEdges.forEach(({ from, to }) => {
    dagOut.get(from)?.push(to);
    dagIn.get(to)?.push(from);
  });

  // Step 2: Layer Assignment (Longest Path in DAG)
  const inDegree = new Map<string, number>();
  nodes.forEach((n) => inDegree.set(n.id, dagIn.get(n.id)!.length));

  const zeroInNodes = nodes.filter((n) => inDegree.get(n.id) === 0);
  const queue = [...zeroInNodes];

  // If disconnected or purely circular, default all roots
  if (queue.length === 0 && nodes.length > 0) {
    queue.push(nodes[0]);
  }

  const levels = new Map<string, number>();
  queue.forEach((n) => levels.set(n.id, 0));

  while (queue.length > 0) {
    const u = queue.shift()!;
    const uLevel = levels.get(u.id) || 0;

    for (const vId of dagOut.get(u.id) || []) {
      const currVLevel = levels.get(vId) ?? 0;
      levels.set(vId, Math.max(currVLevel, uLevel + 1));

      const deg = (inDegree.get(vId) || 1) - 1;
      inDegree.set(vId, deg);
      if (deg === 0) {
        queue.push(nodeMap.get(vId)!);
      }
    }
  }

  // Assign remaining unvisited to fallback
  nodes.forEach((n) => {
    n.layer = levels.get(n.id) || 0;
  });

  // Group nodes into layers
  const maxLayer = Math.max(...nodes.map((n) => n.layer), 0);
  const layers: (typeof nodes)[] = Array.from({ length: maxLayer + 1 }, () => []);
  nodes.forEach((n) => layers[n.layer].push(n));

  // Step 3: Crossing Reduction (Barycentric sweeps)
  for (let sweep = 0; sweep < 4; sweep++) {
    // Forward sweep
    for (let l = 1; l < layers.length; l++) {
      for (const node of layers[l]) {
        const predecessors = dagIn.get(node.id) || [];
        if (predecessors.length > 0) {
          const sumOrder = predecessors.reduce((sum, pId) => {
            const pNode = nodeMap.get(pId);
            return sum + (pNode ? pNode.order : 0);
          }, 0);
          node.order = sumOrder / predecessors.length;
        }
      }
      layers[l].sort((a, b) => a.order - b.order);
      layers[l].forEach((n, idx) => (n.order = idx));
    }

    // Backward sweep
    for (let l = layers.length - 2; l >= 0; l--) {
      for (const node of layers[l]) {
        const successors = dagOut.get(node.id) || [];
        if (successors.length > 0) {
          const sumOrder = successors.reduce((sum, sId) => {
            const sNode = nodeMap.get(sId);
            return sum + (sNode ? sNode.order : 0);
          }, 0);
          node.order = sumOrder / successors.length;
        }
      }
      layers[l].sort((a, b) => a.order - b.order);
      layers[l].forEach((n, idx) => (n.order = idx));
    }
  }

  // Step 4: Coordinate Assignment with tight packing
  if (isHorizontal) {
    let currentX = options.startX ?? 60;

    for (let l = 0; l < layers.length; l++) {
      const layerNodes = layers[l];
      if (layerNodes.length === 0) continue;

      const layerWidth = Math.max(...layerNodes.map((n) => n.width));

      // Calculate total height of this layer column
      const totalColHeight =
        layerNodes.reduce((sum, n) => sum + n.height, 0) + (layerNodes.length - 1) * nodeGap;

      let currentY = (options.startY ?? 60) - totalColHeight / 2;

      for (const n of layerNodes) {
        n.x = currentX;
        n.y = Math.round(currentY);
        currentY += n.height + nodeGap;
      }

      currentX += layerWidth + layerGap;
    }
  } else {
    // Vertical Top-to-Bottom layered flow
    let currentY = options.startY ?? 60;

    for (let l = 0; l < layers.length; l++) {
      const layerNodes = layers[l];
      if (layerNodes.length === 0) continue;

      const layerHeight = Math.max(...layerNodes.map((n) => n.height));
      const totalRowWidth =
        layerNodes.reduce((sum, n) => sum + n.width, 0) + (layerNodes.length - 1) * nodeGap;

      let currentX = (options.startX ?? 60) - totalRowWidth / 2;

      for (const n of layerNodes) {
        n.x = Math.round(currentX);
        n.y = currentY;
        currentX += n.width + nodeGap;
      }

      currentY += layerHeight + layerGap;
    }
  }

  resolveBoxOverlaps(nodes, nodeGap);
  return alignNodesToOrigin(nodes, options.startX ?? 60, options.startY ?? 60);
}

/**
 * 4. ORTHOGONAL GRAPH LAYOUT
 * Manhattan grid layout aligning dependent modules along straight orthogonal channels.
 */
export function applyOrthogonalGraphLayout(
  cards: SurfaceCard[],
  connections: Connection[],
  options: LayoutOptions = {}
): SurfaceCard[] {
  if (cards.length === 0) return [];
  const tightness = options.tightness || 'tight';
  const cellGapX = tightness === 'tight' ? 36 : tightness === 'compact' ? 52 : 75;
  const cellGapY = tightness === 'tight' ? 24 : tightness === 'compact' ? 38 : 55;

  // First partition into connected components or hierarchy
  const layered = applyElkLayeredLayout(cards, connections, {
    ...options,
    direction: 'horizontal',
  });

  // Snap to discrete orthogonal channels
  const gridUnit = 24;
  const nodes = layered.map((c) => ({
    id: c.id,
    x: Math.round(c.x / gridUnit) * gridUnit,
    y: Math.round(c.y / gridUnit) * gridUnit,
    width: c.width,
    height: c.height,
    card: c,
  }));

  // Resolve overlaps with strict orthogonal grid spacing
  resolveBoxOverlaps(nodes, Math.min(cellGapX, cellGapY));

  // Snap final positions to grid
  nodes.forEach((n) => {
    n.x = Math.round(n.x / gridUnit) * gridUnit;
    n.y = Math.round(n.y / gridUnit) * gridUnit;
  });

  return alignNodesToOrigin(nodes, options.startX ?? 60, options.startY ?? 60);
}

/**
 * 5. COMPACT GRID LAYOUT
 * Compact square/aspect-ratio optimal arrangement
 */
export function applyGridCompactLayout(
  cards: SurfaceCard[],
  _connections: Connection[],
  options: LayoutOptions = {}
): SurfaceCard[] {
  if (cards.length === 0) return [];
  const tightness = options.tightness || 'tight';
  const margin = tightness === 'tight' ? 18 : tightness === 'compact' ? 28 : 40;

  const cols = Math.max(1, Math.ceil(Math.sqrt(cards.length * 1.3)));
  let curX = options.startX ?? 60;
  let curY = options.startY ?? 60;
  let maxHInRow = 0;

  const nodes = cards.map((c, i) => {
    const colIdx = i % cols;
    if (colIdx === 0 && i !== 0) {
      curX = options.startX ?? 60;
      curY += maxHInRow + margin;
      maxHInRow = 0;
    }

    const node = {
      id: c.id,
      x: curX,
      y: curY,
      width: c.width,
      height: c.height,
      card: c,
    };

    curX += c.width + margin;
    maxHInRow = Math.max(maxHInRow, c.height);
    return node;
  });

  return alignNodesToOrigin(nodes, options.startX ?? 60, options.startY ?? 60);
}

/**
 * Normalizes all nodes so the minimum coordinate matches (targetMinX, targetMinY)
 */
function alignNodesToOrigin(
  nodes: { id: string; x: number; y: number; width: number; height: number; card: SurfaceCard }[],
  targetMinX: number = 60,
  targetMinY: number = 60
): SurfaceCard[] {
  if (nodes.length === 0) return [];

  let minX = Infinity;
  let minY = Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
  }

  const shiftX = targetMinX - minX;
  const shiftY = targetMinY - minY;

  return nodes.map((n) => ({
    ...n.card,
    x: Math.round(n.x + shiftX),
    y: Math.round(n.y + shiftY),
    updatedAt: Date.now(),
  }));
}

/**
 * Mobile Vertical Stack Layout
 * Organizes sections and cards in a single vertical column flow (~360px wide)
 * perfectly optimized for mobile screens: prevents horizontal sprawl, guarantees high card fill and zero dead white space.
 */
export function applyMobileStackLayout(
  cards: SurfaceCard[],
  connections: Connection[],
  options: LayoutOptions = {}
): SurfaceCard[] {
  if (cards.length === 0) return [];

  const colWidth = 360;
  const startX = options.startX ?? 20;
  let curY = options.startY ?? 40;

  const sections = cards.filter((c) => c.type === 'section');
  const nonSectionCards = cards.filter((c) => c.type !== 'section');

  const updatedCardsMap = new Map<string, Partial<SurfaceCard>>();

  if (sections.length > 0) {
    sections.forEach((sec) => {
      const childCards = nonSectionCards.filter((c) => c.sectionId === sec.id);
      let secCardY = curY + 65;

      childCards.forEach((child) => {
        const cardW = Math.min(colWidth - 28, child.width);
        const cardH = Math.min(230, Math.max(130, child.height));
        updatedCardsMap.set(child.id, {
          x: startX + 14,
          y: secCardY,
          width: cardW,
          height: cardH,
        });
        secCardY += cardH + 16;
      });

      const sectionHeight = Math.max(200, secCardY - curY + 20);
      updatedCardsMap.set(sec.id, {
        x: startX,
        y: curY,
        width: colWidth,
        height: sectionHeight,
      });

      curY += sectionHeight + 36;
    });

    // Any orphan cards not assigned to any existing section
    const orphanCards = nonSectionCards.filter(
      (c) => !c.sectionId || !sections.some((s) => s.id === c.sectionId)
    );
    orphanCards.forEach((orphan) => {
      const cardW = Math.min(colWidth, orphan.width);
      const cardH = Math.min(200, Math.max(120, orphan.height));
      updatedCardsMap.set(orphan.id, {
        x: startX,
        y: curY,
        width: cardW,
        height: cardH,
      });
      curY += cardH + 20;
    });
  } else {
    // No sections: single tidy column stack
    cards.forEach((card) => {
      const cardW = Math.min(colWidth, card.width);
      const cardH = Math.min(220, Math.max(120, card.height));
      updatedCardsMap.set(card.id, {
        x: startX,
        y: curY,
        width: cardW,
        height: cardH,
      });
      curY += cardH + 20;
    });
  }

  return cards.map((c) => {
    const upd = updatedCardsMap.get(c.id);
    return upd ? { ...c, ...upd, updatedAt: Date.now() } : c;
  });
}

/**
 * Unified Layout Dispatcher
 */
export function applyGraphLayout(
  cards: SurfaceCard[],
  connections: Connection[],
  algorithm: GraphLayoutAlgorithm,
  options: LayoutOptions = {}
): SurfaceCard[] {
  switch (algorithm) {
    case 'force-directed':
      return applyForceDirectedLayout(cards, connections, options);
    case 'stress-majorization':
      return applyStressMajorizationLayout(cards, connections, options);
    case 'elk-layered':
      return applyElkLayeredLayout(cards, connections, options);
    case 'orthogonal':
      return applyOrthogonalGraphLayout(cards, connections, options);
    case 'mobile-stack':
      return applyMobileStackLayout(cards, connections, options);
    case 'grid-compact':
    default:
      return applyGridCompactLayout(cards, connections, options);
  }
}
