/**
 * Typed canvas AI contracts — board mutations never invent free-text coordinates.
 */
export type CanvasContext = {
  boardId: string;
  selectedNoteIds: string[];
  visibleNoteIds: string[];
  viewport: { x: number; y: number; zoom: number };
  boardVersion: number;
};

export type CanvasOperation =
  | {
      type: 'create_note';
      tempId: string;
      title: string;
      body: string;
      nearNoteId?: string;
      cardType?: string;
    }
  | {
      type: 'update_note';
      noteId: string;
      expectedVersion: number;
      patch: { title?: string; body?: string };
    }
  | {
      type: 'connect_notes';
      sourceId: string;
      targetId: string;
      label?: string;
    }
  | {
      type: 'create_group';
      title: string;
      noteIds: string[];
    }
  | {
      type: 'move_notes';
      noteIds: string[];
      layoutHint: 'cluster' | 'row' | 'preserve';
    };

export type ChangeProposal = {
  proposalId: string;
  boardId: string;
  baseBoardVersion: number;
  rationale: string;
  evidenceNoteIds: string[];
  operations: CanvasOperation[];
};

export type ModelProfile = {
  id: string;
  provider: 'google' | 'openai' | 'anthropic';
  modelId: string;
  label: string;
  capabilities: { tools: boolean; structuredOutput: boolean; images: boolean };
  tasks: Array<'chat' | 'synthesis' | 'layout' | 'extraction'>;
  maxInputTokens: number;
  enabled: boolean;
};

export type CanvasAiAnswer = {
  reply: string;
  citedNoteIds: string[];
  focusNoteId?: string;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
};

export type CanvasAiRunResult = {
  threadId: string;
  status: 'answered' | 'proposal' | 'needs_clarification' | 'error';
  answer?: CanvasAiAnswer;
  proposal?: ChangeProposal;
  modelProfileId: string;
  latencyMs: number;
  error?: string;
};

export type BoardSnapshot = {
  id: string;
  name: string;
  description?: string;
  version: number;
  cards: any[];
  connections: any[];
  viewState?: { panX: number; panY: number; zoom: number };
  updatedAt: number;
};

export const MAX_NOTES_RETRIEVED = 24;
export const MAX_OPS_PER_PROPOSAL = 12;
export const MAX_NOTE_BODY_CHARS = 12_000;
