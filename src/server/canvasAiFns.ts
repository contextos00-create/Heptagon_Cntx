/**
 * Client-safe server function callables (TanStack Start style).
 * Import these from React — do not call fetch or /api/canvas-ai yourself.
 */
import { createServerFn } from './createServerFn';
import type {
  CanvasAiRunResult,
  CanvasContext,
  ChangeProposal,
  ModelProfile,
} from '../ai/canvasTypes';

export type CompactNote = {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  sectionId?: string;
  updatedAt?: number;
  version?: number;
};

export type ListCanvasModelsResult = {
  models: ModelProfile[];
  defaultId: string;
};

export type SyncBoardInput = {
  id: string;
  name?: string;
  description?: string;
  version?: number;
  cards?: any[];
  connections?: any[];
  viewState?: any;
  updatedAt?: number;
  [key: string]: unknown;
};

export type ResolveCanvasNotesInput = {
  context: CanvasContext;
  query?: string;
  board?: SyncBoardInput;
};

export type ResolveCanvasNotesResult = {
  notes: CompactNote[];
  boardVersion: number;
};

export type SearchCanvasNotesInput = {
  boardId: string;
  query?: string;
  limit?: number;
  board?: SyncBoardInput;
};

export type SearchCanvasNotesResult = {
  notes: CompactNote[];
};

export type RunCanvasAiInput = {
  query: string;
  context: CanvasContext;
  threadId?: string;
  modelProfileId?: string;
  task?: 'chat' | 'synthesis' | 'layout' | 'extraction';
  board?: SyncBoardInput;
};

export type ApplyCanvasProposalInput = { proposalId: string };
export type DiscardCanvasProposalInput = { proposalId: string };
export type UndoCanvasProposalInput = { boardId: string };

export const listCanvasModelsFn = createServerFn<void, ListCanvasModelsResult>(
  'canvasAi.listModels'
);

export const syncBoardFn = createServerFn<
  SyncBoardInput,
  { success: boolean; updatedAt: number; version: number }
>('canvasAi.syncBoard');

export const resolveCanvasNotesFn = createServerFn<
  ResolveCanvasNotesInput,
  ResolveCanvasNotesResult
>('canvasAi.resolveNotes');

export const searchCanvasNotesFn = createServerFn<
  SearchCanvasNotesInput,
  SearchCanvasNotesResult
>('canvasAi.searchNotes');

export const runCanvasAiFn = createServerFn<RunCanvasAiInput, CanvasAiRunResult>('canvasAi.run');

export const applyCanvasProposalFn = createServerFn<
  ApplyCanvasProposalInput,
  {
    board: any;
    createdIds: Record<string, string>;
    status: 'applied' | 'duplicate' | 'stale';
  }
>('canvasAi.applyProposal');

export const discardCanvasProposalFn = createServerFn<
  DiscardCanvasProposalInput,
  { proposal: ChangeProposal & { status: string } }
>('canvasAi.discardProposal');

export const undoCanvasProposalFn = createServerFn<
  UndoCanvasProposalInput,
  { board: any | null }
>('canvasAi.undo');

export const listBoardsFn = createServerFn<void, any[]>('boards.list');
export const getBoardFn = createServerFn<{ id: string }, any>('boards.get');
export const saveBoardFn = createServerFn<
  SyncBoardInput,
  { success: boolean; updatedAt: number; version?: number }
>('boards.save');
