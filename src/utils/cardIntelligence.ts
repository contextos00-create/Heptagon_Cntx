import { SurfaceCard, Connection, GhostCardData, MapData, CardColor } from '../types/surface';

// Location dictionary for automatic map card detection
export const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number; label: string; details: string }> = {
  'san francisco': { lat: 37.7749, lng: -122.4194, label: 'San Francisco, CA', details: 'Global tech hub & AI research centers' },
  'singapore': { lat: 1.3521, lng: 103.8198, label: 'Singapore Edge Node', details: 'Asia-Pacific ultra-low latency routing hub' },
  'tokyo': { lat: 35.6762, lng: 139.6503, label: 'Tokyo, Japan (ap-northeast-1)', details: 'High-availability cluster & data backbone' },
  'london': { lat: 51.5074, lng: -0.1278, label: 'London, UK', details: 'European core financial & transit exchange' },
  'new york': { lat: 40.7128, lng: -74.0060, label: 'New York, NY (us-east-1)', details: 'Equinix NY4 transit cross-connect point' },
  'berlin': { lat: 52.5200, lng: 13.4050, label: 'Berlin, Germany', details: 'Continental mesh node' },
  'seattle': { lat: 47.6062, lng: -122.3321, label: 'Seattle, WA', details: 'Cloud infrastructure region' },
  'paris': { lat: 48.8566, lng: 2.3522, label: 'Paris, France', details: 'Central European latency cluster' },
  'sydney': { lat: -33.8688, lng: 151.2093, label: 'Sydney, Australia', details: 'Oceania edge gateway' },
  'zurich': { lat: 47.3769, lng: 8.5417, label: 'Zurich, Switzerland', details: 'Secure enclave datacenter' },
  'frankfurt': { lat: 50.1109, lng: 8.6821, label: 'Frankfurt, Germany (eu-central-1)', details: 'DE-CIX peering point' },
  'austin': { lat: 30.2672, lng: -97.7431, label: 'Austin, TX', details: 'Silicon Hills semiconductor center' },
};

export function detectLocationInText(text: string): { name: string; mapData: MapData } | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [locKey, data] of Object.entries(KNOWN_LOCATIONS)) {
    // Word boundary match
    const regex = new RegExp(`\\b${locKey}\\b`, 'i');
    if (regex.test(lower)) {
      return {
        name: data.label,
        mapData: {
          locationName: data.label,
          latitude: data.lat,
          longitude: data.lng,
          zoomLevel: 12,
          placeDetails: data.details,
        },
      };
    }
  }
  return null;
}

// Semantic Ontology Classification: detects domain theme to auto-color groups and cards
export interface OntologyDefinition {
  color: CardColor;
  label: string;
  badge: string;
  themeDescription: string;
}

export function classifyOntology(cards: SurfaceCard[]): OntologyDefinition {
  const combinedText = cards.map(c => `${c.title} ${c.content} ${c.tags.join(' ')}`).join(' ').toLowerCase();

  // 1. Geography & Spatial nodes
  if (cards.some(c => c.type === 'map') || combinedText.includes('location') || combinedText.includes('region') || combinedText.includes('routing') || combinedText.includes('edge node')) {
    return {
      color: 'orange',
      label: 'Geographic Infrastructure',
      badge: 'GEO-MESH',
      themeDescription: 'Spatial distribution, regional edge clusters, and physical topologies.'
    };
  }

  // 2. Data & Metrics
  if (cards.some(c => c.type === 'table') || combinedText.includes('csv') || combinedText.includes('latency') || combinedText.includes('benchmark') || combinedText.includes('p99') || combinedText.includes('metrics')) {
    return {
      color: 'green',
      label: 'Telemetry & Benchmarks',
      badge: 'TELEMETRY',
      themeDescription: 'Empirical data tables, latency benchmarks, and performance metrics.'
    };
  }

  // 3. System Architecture & Engineering
  if (cards.some(c => c.type === 'code') || combinedText.includes('rpc') || combinedText.includes('protocol') || combinedText.includes('cache') || combinedText.includes('raft') || combinedText.includes('sync')) {
    return {
      color: 'blue',
      label: 'System Topology & Code',
      badge: 'SYSTEM',
      themeDescription: 'Consensus protocols, server routines, specifications, and architecture.'
    };
  }

  // 4. Research & Design / Media
  if (cards.some(c => c.type === 'audio' || c.type === 'image') || combinedText.includes('design') || combinedText.includes('research') || combinedText.includes('interview')) {
    return {
      color: 'purple',
      label: 'Cognitive & Visual Research',
      badge: 'RESEARCH',
      themeDescription: 'Human factors, audio interviews, visual wireframes, and design models.'
    };
  }

  // 5. Default Ontology
  const palette: CardColor[] = ['blue', 'purple', 'green', 'orange', 'yellow', 'red'];
  const fallbackColor = palette[Math.abs(cards.length) % palette.length];
  return {
    color: fallbackColor,
    label: 'Knowledge Cluster',
    badge: 'CLUSTER',
    themeDescription: 'Contextually linked knowledge cluster.'
  };
}

// Generate contextual ghost cards (expansion ideas) based on card content & type
export function generateGhostCardsForCard(card: SurfaceCard): GhostCardData[] {
  const ghosts: GhostCardData[] = [];
  const text = (card.title + ' ' + (card.content || '')).toLowerCase();

  // Compact offsets for ghost cards
  const offsetX = card.width + 30;
  const offsetY = 0;

  // 1. Check for locations in the card
  const loc = detectLocationInText(card.title + ' ' + card.content);
  if (loc && card.type !== 'map') {
    ghosts.push({
      id: `ghost-loc-${card.id}`,
      title: `${loc.name} Map`,
      content: `Geographic coordinates and network ingress details for ${loc.name}.\n${loc.mapData.placeDetails || ''}`,
      type: 'map',
      x: card.x + offsetX,
      y: card.y + offsetY,
      width: 270,
      height: 190,
      relationLabel: 'geographic:site',
      color: 'orange',
      mapData: loc.mapData,
    });
  }

  // 2. Technical / Code context
  if (card.type === 'code' || text.includes('cache') || text.includes('raft') || text.includes('rpc') || text.includes('sync')) {
    ghosts.push({
      id: `ghost-perf-${card.id}`,
      title: `Benchmarking: ${card.title.replace(/\.[^/.]+$/, '')}`,
      content: `### Telemetry & Benchmarks\n- P99 Write Convergence: 4.8ms\n- Concurrency Ceiling: 45,000 req/sec\n\n*Double-click to materialize live telemetry benchmark.*`,
      type: 'note',
      x: card.x + offsetX,
      y: card.y + (ghosts.length > 0 ? 210 : 0),
      width: 250,
      height: 170,
      relationLabel: 'telemetry:eval',
      color: 'blue',
    });
  }

  // 3. Document / Spec context
  if (card.type === 'pdf' || text.includes('spec') || text.includes('architecture') || text.includes('rfc')) {
    ghosts.push({
      id: `ghost-dep-${card.id}`,
      title: `Requirements: ${card.title.slice(0, 22)}`,
      content: `### Core Requirements:\n1. Non-blocking asynchronous I/O loop\n2. Partition tolerance with quorums\n\n*Double-click to materialize requirement tracking card.*`,
      type: 'note',
      x: card.x + offsetX,
      y: card.y + (ghosts.length > 0 ? 210 : 0),
      width: 250,
      height: 170,
      relationLabel: 'spec:requirements',
      color: 'green',
    });
  }

  // 4. Default fallback contextual expansion
  if (ghosts.length === 0) {
    ghosts.push({
      id: `ghost-explore-${card.id}`,
      title: `Deep Dive: ${card.title.slice(0, 20)}`,
      content: `Contextual synthesis analyzing the structural relationship between "${card.title}" and surrounding cards.\n\n*Double-click to materialize note.*`,
      type: 'note',
      x: card.x + offsetX,
      y: card.y,
      width: 240,
      height: 160,
      relationLabel: 'context:expansion',
      color: card.color || 'blue',
    });
  }

  return ghosts.slice(0, 2);
}

// Generate contextual drill-down note from selected text
export function generateContextualDrillDown(
  selectedText: string,
  sourceCard: SurfaceCard
): { newCard: SurfaceCard; newConnection: Connection } {
  const cleanSnippet = selectedText.trim();
  const title = cleanSnippet.length > 32 
    ? cleanSnippet.slice(0, 30) + '...' 
    : cleanSnippet;

  // Check if text is a location
  const locationMatch = detectLocationInText(cleanSnippet);
  const cardId = `card-sel-${Date.now()}`;
  const now = Date.now();

  const isMap = Boolean(locationMatch);
  const cardType = isMap ? 'map' : 'note';

  // Inherit ontology color from source card or map
  const color: CardColor = isMap ? 'orange' : (sourceCard.color !== 'default' ? sourceCard.color : 'blue');

  const newCard: SurfaceCard = {
    id: cardId,
    type: cardType,
    title: isMap ? `${locationMatch!.name} Location` : title,
    content: isMap
      ? `Geographic satellite node at ${locationMatch!.name}.\n${locationMatch!.mapData.placeDetails || ''}`
      : `### Drill-down: "${cleanSnippet}"\n\nContext extracted from **${sourceCard.title}**.\n\nDeep analysis examining downstream implications and dependencies across this surface.`,
    x: sourceCard.x + sourceCard.width + 40,
    y: sourceCard.y,
    width: isMap ? 280 : 250,
    height: isMap ? 210 : 170,
    color,
    tags: isMap ? ['LOCATION', 'MAP'] : ['DRILLDOWN', 'NOTE'],
    mapData: locationMatch ? locationMatch.mapData : undefined,
    createdAt: now,
    updatedAt: now,
  };

  const newConnection: Connection = {
    id: `conn-sel-${Date.now()}`,
    fromId: sourceCard.id,
    toId: cardId,
    label: isMap ? 'geo:location' : 'drilldown',
    style: 'solid',
  };

  return { newCard, newConnection };
}

// Group and automatically place a list of newly dropped/uploaded files with defined ontology color-coding
export interface ProcessedDropResult {
  newCards: SurfaceCard[];
  newConnections: Connection[];
}

export function groupAndPositionUploadedCards(
  importedCards: SurfaceCard[],
  dropX: number,
  dropY: number
): ProcessedDropResult {
  if (importedCards.length === 0) {
    return { newCards: [], newConnections: [] };
  }

  // Deduce the ontology definition for this batch
  const ontology = classifyOntology(importedCards);

  // If only 1 card dropped, simply position at drop coordinates and assign ontology color
  if (importedCards.length === 1) {
    importedCards[0].x = dropX;
    importedCards[0].y = dropY;
    importedCards[0].color = ontology.color;
    importedCards[0].ghostCards = generateGhostCardsForCard(importedCards[0]);
    return { newCards: importedCards, newConnections: [] };
  }

  // If multiple files dropped: group them into an automated Section with compact dense layout
  const sectionId = `sec-ingest-${Date.now()}`;
  const now = Date.now();
  const cardCols = Math.min(3, importedCards.length);
  const colWidth = 270;
  const rowHeight = 220;
  const numRows = Math.ceil(importedCards.length / cardCols);

  const sectionWidth = cardCols * colWidth + 50;
  const sectionHeight = numRows * rowHeight + 80;

  const sectionCard: SurfaceCard = {
    id: sectionId,
    type: 'section',
    title: `${ontology.label} (${importedCards.length} items)`,
    content: `${ontology.themeDescription} Auto-grouped ontology [${ontology.badge}].`,
    x: dropX,
    y: dropY,
    width: sectionWidth,
    height: sectionHeight,
    color: ontology.color, // Color-coded ontology group
    tags: [ontology.badge, 'ONTOLOGY', 'CLUSTER'],
    createdAt: now,
    updatedAt: now,
  };

  const positionedCards: SurfaceCard[] = [];
  const connections: Connection[] = [];

  importedCards.forEach((card, idx) => {
    const col = idx % cardCols;
    const row = Math.floor(idx / cardCols);

    card.x = dropX + 25 + col * colWidth;
    card.y = dropY + 55 + row * rowHeight;
    card.sectionId = sectionId;
    card.color = ontology.color; // Color-code individual member cards to match ontology group
    card.ghostCards = generateGhostCardsForCard(card);

    positionedCards.push(card);

    // Form smart sequential and semantic connections
    if (idx > 0) {
      const prevCard = positionedCards[idx - 1];
      connections.push({
        id: `conn-ingest-${Date.now()}-${idx}`,
        fromId: prevCard.id,
        toId: card.id,
        label: `${prevCard.type}:${card.type}`,
        style: 'dashed',
      });
    }
  });

  return {
    newCards: [sectionCard, ...positionedCards],
    newConnections: connections,
  };
}
