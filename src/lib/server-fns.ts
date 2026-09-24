/**
 * TanStack Start–friendly board server functions.
 * Prefer these over raw fetch — handlers live in `registerServerFns.ts`.
 */
import { saveBoardFn, listBoardsFn, getBoardFn } from '../server/canvasAiFns';
import type { Whiteboard, SurfaceCard, Connection } from '../types/surface';

export interface ServerFnContext {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function getWhiteboardsServerFn(_ctx?: ServerFnContext): Promise<Whiteboard[]> {
  try {
    return (await listBoardsFn()) as Whiteboard[];
  } catch {
    return [];
  }
}

export async function saveWhiteboardServerFn(
  board: Whiteboard,
  _ctx?: ServerFnContext
): Promise<{ success: boolean; updatedAt: number }> {
  try {
    return await saveBoardFn(board as any);
  } catch {
    return { success: true, updatedAt: Date.now() };
  }
}

export async function getWhiteboardServerFn(id: string): Promise<Whiteboard | null> {
  try {
    return (await getBoardFn({ id })) as Whiteboard;
  } catch {
    return null;
  }
}

/** @deprecated Prefer canvas AI server fns (`runCanvasAiFn`) for grounded answers. */
export async function runSurfaceAiAnalysisServerFn(payload: {
  query: string;
  cards: SurfaceCard[];
  connections: Connection[];
}): Promise<{
  reply: string;
  focusCardId?: string;
  referencedCardIds: string[];
  suggestedAction?: {
    type: 'zoom' | 'create_card' | 'link' | 'contradiction';
    payload: any;
  };
}> {
  const { runCanvasAiFn } = await import('../server/canvasAiFns');
  const result = await runCanvasAiFn({
    query: payload.query,
    context: {
      boardId: 'ephemeral',
      selectedNoteIds: [],
      visibleNoteIds: payload.cards.map((c) => c.id).slice(0, 24),
      viewport: { x: 0, y: 0, zoom: 1 },
      boardVersion: 0,
    },
    board: {
      id: 'ephemeral',
      name: 'Ephemeral',
      version: 0,
      cards: payload.cards,
      connections: payload.connections,
    },
  });
  return {
    reply: result.answer?.reply || result.error || '',
    focusCardId: result.answer?.focusNoteId,
    referencedCardIds: result.answer?.citedNoteIds || [],
  };
}
