import { CardColor, CardType, Connection, SurfaceCard } from './surface';

export type GoogleSourceKind =
  | 'keep'
  | 'docs'
  | 'drive'
  | 'sheets'
  | 'takeout'
  | 'manual';

export interface GoogleKeepListItem {
  text: string;
  isChecked?: boolean;
}

export interface GoogleKeepLabel {
  name: string;
}

export interface GoogleKeepAttachment {
  filePath?: string;
  mimetype?: string;
}

/** Normalized note from Keep Takeout, Drive Docs, or pasted content */
export interface ImportedGoogleNote {
  id: string;
  source: GoogleSourceKind;
  title: string;
  content: string;
  labels: string[];
  color?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  listItems?: GoogleKeepListItem[];
  attachments?: GoogleKeepAttachment[];
  createdAt?: number;
  updatedAt?: number;
  sourceUrl?: string;
  mimeType?: string;
}

export interface GoogleThemeCluster {
  id: string;
  name: string;
  summary: string;
  noteIds: string[];
  color: CardColor;
  keywords: string[];
}

export interface GoogleNoteConnectionSuggestion {
  fromNoteId: string;
  toNoteId: string;
  label: string;
  reasoning: string;
  confidence: number;
}

export interface GoogleOrganizeResult {
  overview: string;
  clusters: GoogleThemeCluster[];
  connections: GoogleNoteConnectionSuggestion[];
  highlights: string[];
  suggestedQuestions: string[];
}

export interface GoogleImportPlacement {
  cards: SurfaceCard[];
  connections: Connection[];
  overviewCardId?: string;
  clusterSectionIds: string[];
}

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export const KEEP_COLOR_MAP: Record<string, CardColor> = {
  DEFAULT: 'default',
  RED: 'red',
  ORANGE: 'orange',
  YELLOW: 'yellow',
  GREEN: 'green',
  TEAL: 'green',
  BLUE: 'blue',
  CERULEAN: 'blue',
  PURPLE: 'purple',
  PINK: 'purple',
  BROWN: 'orange',
  GRAY: 'gray',
};

export function keepColorToCardColor(raw?: string): CardColor {
  if (!raw) return 'default';
  const key = raw.toUpperCase().replace(/\s+/g, '_');
  return KEEP_COLOR_MAP[key] || 'default';
}

export function noteToCardType(note: ImportedGoogleNote): CardType {
  if (note.listItems && note.listItems.length > 0) return 'timeline';
  if (note.source === 'docs' || note.source === 'drive') return 'document';
  if (note.source === 'sheets') return 'datagrid';
  return 'note';
}
