/**
 * Server-only registration for canvas AI + board persistence.
 * Import this file from `server.ts` only — never from React components.
 */
import { boardCommandStore, resolveContextNotes } from '../ai/boardCommandStore';
import { listEnabledModels, resolveModelProfile } from '../ai/modelRegistry';
import { runNoteCanvasAgent } from '../ai/langgraph/noteCanvasAgent';
import type { CanvasContext } from '../ai/canvasTypes';
import { registerServerFn } from './createServerFn';
import type {
  ApplyCanvasProposalInput,
  DiscardCanvasProposalInput,
  ListCanvasModelsResult,
  ResolveCanvasNotesInput,
  ResolveCanvasNotesResult,
  RunCanvasAiInput,
  SearchCanvasNotesInput,
  SearchCanvasNotesResult,
  SyncBoardInput,
  UndoCanvasProposalInput,
} from './canvasAiFns';

/** In-memory boards (shared with the Express process). */
export const boardsStore: Record<string, any> = {};

registerServerFn<void, ListCanvasModelsResult>('canvasAi.listModels', async () => {
  const models = listEnabledModels();
  const fallback = resolveModelProfile(undefined, 'chat');
  return { models, defaultId: fallback.id };
});

registerServerFn<SyncBoardInput, { success: boolean; updatedAt: number; version: number }>(
  'canvasAi.syncBoard',
  async (board) => {
    if (!board?.id) throw new Error('board.id is required');
    boardsStore[board.id] = board;
    const snap = boardCommandStore.upsertBoard({
      ...board,
      version:
        typeof board.version === 'number'
          ? board.version
          : boardCommandStore.getBoard(board.id)?.version || 0,
    });
    return { success: true, updatedAt: snap.updatedAt, version: snap.version };
  }
);

registerServerFn<ResolveCanvasNotesInput, ResolveCanvasNotesResult>(
  'canvasAi.resolveNotes',
  async ({ context, query, board }) => {
    if (!context?.boardId) throw new Error('context.boardId is required');
    if (board) boardCommandStore.upsertBoard(board);
    else if (boardsStore[context.boardId]) {
      boardCommandStore.upsertBoard(boardsStore[context.boardId]);
    }
    const notes = resolveContextNotes(boardCommandStore, context as CanvasContext, query);
    const live = boardCommandStore.getBoard(context.boardId);
    return { notes, boardVersion: live?.version || context.boardVersion || 0 };
  }
);

registerServerFn<SearchCanvasNotesInput, SearchCanvasNotesResult>(
  'canvasAi.searchNotes',
  async ({ boardId, query = '', limit = 12, board }) => {
    if (!boardId) throw new Error('boardId is required');
    if (board) boardCommandStore.upsertBoard(board);
    else if (boardsStore[boardId]) boardCommandStore.upsertBoard(boardsStore[boardId]);
    return { notes: boardCommandStore.searchNotes(boardId, query, limit) };
  }
);

registerServerFn('canvasAi.run', async (input: RunCanvasAiInput) => {
  if (!input?.query || typeof input.query !== 'string') {
    throw new Error('query is required');
  }
  if (!input.context?.boardId) throw new Error('context.boardId is required');
  if (input.board) {
    boardCommandStore.upsertBoard(input.board);
    boardsStore[input.board.id] = input.board;
  } else if (boardsStore[input.context.boardId]) {
    boardCommandStore.upsertBoard(boardsStore[input.context.boardId]);
  }
  return runNoteCanvasAgent({
    query: input.query,
    context: input.context,
    threadId: input.threadId,
    modelProfileId: input.modelProfileId,
    task: input.task,
  });
});

registerServerFn('canvasAi.applyProposal', async ({ proposalId }: ApplyCanvasProposalInput) => {
  if (!proposalId) throw new Error('proposalId is required');
  const result = boardCommandStore.applyProposal(proposalId);
  boardsStore[result.board.id] = result.board;
  return result;
});

registerServerFn('canvasAi.discardProposal', async ({ proposalId }: DiscardCanvasProposalInput) => {
  if (!proposalId) throw new Error('proposalId is required');
  const proposal = boardCommandStore.discardProposal(proposalId);
  if (!proposal) throw new Error('Proposal not found');
  return { proposal };
});

registerServerFn('canvasAi.undo', async ({ boardId }: UndoCanvasProposalInput) => {
  if (!boardId) throw new Error('boardId is required');
  const board = boardCommandStore.undoLast(boardId);
  if (board) boardsStore[boardId] = board;
  return { board };
});

registerServerFn('boards.list', async () => Object.values(boardsStore));

registerServerFn('boards.get', async ({ id }: { id: string }) => {
  const board = boardsStore[id];
  if (!board) throw new Error('Board not found');
  return board;
});

registerServerFn('boards.save', async (board: any) => {
  if (!board?.id) throw new Error('board.id is required');
  boardsStore[board.id] = board;
  const snap = boardCommandStore.upsertBoard({
    ...board,
    version:
      typeof board.version === 'number'
        ? board.version
        : boardCommandStore.getBoard(board.id)?.version || 0,
  });
  return { success: true, updatedAt: snap.updatedAt, version: snap.version };
});
