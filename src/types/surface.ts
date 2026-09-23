export type CardType = 
  | 'note'
  | 'pdf'
  | 'image'
  | 'audio'
  | 'video'
  | 'code'
  | 'table'
  | 'link'
  | 'map'
  | 'section';

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
  mapData?: MapData;
  ghostCards?: GhostCardData[]; // Potential expanding cards generated on the fly
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

export type ThemeMode = 'dark' | 'light';
