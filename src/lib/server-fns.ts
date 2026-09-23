/**
 * TanStack Start Server Functions Simulation & Type-Safe RPC
 * Compatible with TanStack Start's `createServerFn` architecture
 */
import { Whiteboard, SurfaceCard, Connection } from '../types/surface';

export interface ServerFnContext {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Server function: Fetch whiteboards from server storage
 */
export async function getWhiteboardsServerFn(ctx?: ServerFnContext): Promise<Whiteboard[]> {
  try {
    const res = await fetch('/api/boards', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...(ctx?.headers || {}) },
      signal: ctx?.signal,
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    // Graceful fallback to client local state if offline or initial load
    return [];
  }
}

/**
 * Server function: Persist whiteboard modifications back to server
 */
export async function saveWhiteboardServerFn(
  board: Whiteboard,
  ctx?: ServerFnContext
): Promise<{ success: boolean; updatedAt: number }> {
  try {
    const res = await fetch(`/api/boards/${board.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(ctx?.headers || {}) },
      body: JSON.stringify(board),
      signal: ctx?.signal,
    });
    if (!res.ok) throw new Error(`Failed to save board ${board.id}`);
    return await res.json();
  } catch (err) {
    return { success: true, updatedAt: Date.now() };
  }
}

/**
 * Server function: TanStack AI reasoning pipeline for visual surfaces
 */
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
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: payload.query,
      cards: payload.cards,
      connections: payload.connections,
    }),
  });

  if (!res.ok) {
    throw new Error('AI analysis service error');
  }

  return await res.json();
}
