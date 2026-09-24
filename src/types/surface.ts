export type CardType = 
  | 'note'
  | 'pdf'
  | 'image'
  | 'audio'
  | 'video'
  | 'code'
  | 'table'
  | 'datagrid'
  | 'link'
  | 'map'
  | 'section'
  | 'quotation'
  | 'person'
  | 'decision'
  | 'evidence'
  | 'concept'
  | 'question'
  | 'timeline'
  | 'document';

export type CardColor = 
  | 'default'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'gray';

export interface FileMetadata {
  name: string;
  size: number;
  mimeType: string;
  url?: string;
  dataUrl?: string;
  pageCount?: number;
  dimensions?: { width: number; height: number };
  duration?: number;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface DataGridColumn {
  id: string;
  header: string;
  type?: 'text' | 'number' | 'status' | 'badge' | 'percentage';
  width?: number;
  sortable?: boolean;
}

export interface DataGridData {
  columns: DataGridColumn[];
  rows: Record<string, any>[];
  compact?: boolean;
}

export interface MapData {
  locationName: string;
  latitude: number;
  longitude: number;
  zoomLevel: number;
  placeDetails?: string;
}

export interface GhostCardData {
  id: string;
  title: string;
  content: string;
  type: CardType;
  x: number;
  y: number;
  width: number;
  height: number;
  relationLabel: string;
  color?: CardColor;
  mapData?: MapData;
}

export interface SurfaceCard {
  id: string;
  type: CardType;
  title: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: CardColor;
  tags: string[];
  pinned?: boolean;
  sectionId?: string; // If enclosed inside a section
  fileMetadata?: FileMetadata;
  codeLanguage?: string;
  tableData?: TableData;
  dataGridData?: DataGridData;
  mapData?: MapData;
  ghostCards?: GhostCardData[]; // Potential expanding cards generated on the fly
  attribution?: {
    speaker?: string;
    role?: string;
    avatar?: string;
    source?: string;
  };
  evidenceData?: {
    confidence: number; // 0 - 100
    sampleSize?: string;
    verified?: boolean;
    doiOrCitation?: string;
  };
  decisionData?: {
    outcome: 'approved' | 'proposed' | 'deferred' | 'rejected';
    rationale?: string;
    impact?: string;
  };
  timelineData?: {
    date?: string;
    phase?: string;
    milestone?: string;
  };
  inlineMetrics?: {
    sparkline?: number[];
    distribution?: number[];
    status?: 'active' | 'verified' | 'warning' | 'in_review';
    metricValue?: string;
    metricLabel?: string;
  };
  createdAt: number;
  updatedAt: number;
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed';
  semanticType?: string;
  confidence?: number;
  evidenceSnippet?: string;
  reasoning?: string;
  history?: string;
  strength?: number;
}

export interface Whiteboard {
  id: string;
  name: string;
  description: string;
  cards: SurfaceCard[];
  connections: Connection[];
  viewState: {
    panX: number;
    panY: number;
    zoom: number;
  };
  createdAt: number;
  updatedAt: number;
}

export type CanvasTool = 
  | 'select' 
  | 'pan' 
  | 'add-note' 
  | 'add-section' 
  | 'connect' 
  | 'upload';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  referencedCardIds?: string[];
  focusCardId?: string;
}

export type ThemeMode = 'dark' | 'light' | 'hepta-dark';

/** Cycle: light → dark → hepta-dark → light */
export function nextThemeMode(current: ThemeMode): ThemeMode {
  if (current === 'light') return 'dark';
  if (current === 'dark') return 'hepta-dark';
  return 'light';
}

export function themeModeLabel(mode: ThemeMode): string {
  if (mode === 'hepta-dark') return 'Hepta Dark';
  if (mode === 'dark') return 'Dark';
  return 'Light';
}

export function isDarkTheme(mode: ThemeMode): boolean {
  return mode === 'dark' || mode === 'hepta-dark';
}

export type GraphLayoutAlgorithm = 
  | 'force-directed'
  | 'stress-majorization'
  | 'elk-layered'
  | 'orthogonal'
  | 'grid-compact'
  | 'mobile-stack';

export type EdgeRoutingMode = 
  | 'orthogonal-avoid'
  | 'curved-smart'
  | 'direct-straight';

export type LayoutTightness = 'tight' | 'compact' | 'balanced';
