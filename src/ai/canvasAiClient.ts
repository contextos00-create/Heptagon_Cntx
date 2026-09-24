import type {
  CanvasAiRunResult,
  CanvasContext,
  ChangeProposal,
  ModelProfile,
} from './canvasTypes';

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

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as any)?.error || res.statusText || 'Request failed';
    throw Object.assign(new Error(err), { code: (data as any)?.code, data });
  }
  return data as T;
}

export async function syncBoardToServer(board: any) {
  const res = await fetch(`/api/boards/${encodeURIComponent(board.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(board),
  });
  return parseJson<{ success: boolean; version?: number }>(res);
}

export async function fetchCanvasModels() {
  const res = await fetch('/api/canvas-ai/models');
  return parseJson<{ models: ModelProfile[]; defaultId: string }>(res);
}

export async function resolveCanvasNotes(context: CanvasContext, query?: string) {
  const res = await fetch('/api/canvas-ai/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context, query }),
  });
  return parseJson<{ notes: CompactNote[]; boardVersion: number }>(res);
}

export async function searchCanvasNotes(boardId: string, query: string, limit?: number) {
  const res = await fetch('/api/canvas-ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boardId, query, limit }),
  });
  return parseJson<{ notes: CompactNote[] }>(res);
}

export async function runCanvasAi(input: {
  query: string;
  context: CanvasContext;
  threadId?: string;
  modelProfileId?: string;
  task?: 'chat' | 'synthesis' | 'layout' | 'extraction';
  board?: any;
}) {
  const res = await fetch('/api/canvas-ai/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJson<CanvasAiRunResult>(res);
}

export async function applyCanvasProposal(proposalId: string) {
  const res = await fetch(`/api/canvas-ai/proposals/${encodeURIComponent(proposalId)}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return parseJson<{
    board: any;
    createdIds: Record<string, string>;
    status: 'applied' | 'duplicate' | 'stale';
  }>(res);
}

export async function discardCanvasProposal(proposalId: string) {
  const res = await fetch(`/api/canvas-ai/proposals/${encodeURIComponent(proposalId)}/discard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return parseJson<{ proposal: ChangeProposal & { status: string } }>(res);
}

export async function undoCanvasProposal(boardId: string) {
  const res = await fetch('/api/canvas-ai/undo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boardId }),
  });
  return parseJson<{ board: any | null }>(res);
}

/** Map a proposal into ephemeral ghost cards/edges for preview (never canonical). */
export function proposalToPreview(proposal: ChangeProposal, cards: any[]) {
  const ghostCards: Array<{
    id: string;
    title: string;
    content: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    relationLabel: string;
    color?: string;
  }> = [];
  const ghostEdges: Array<{
    id: string;
    fromId: string;
    toId: string;
    label?: string;
  }> = [];

  for (const op of proposal.operations) {
    if (op.type === 'create_note') {
      const near = op.nearNoteId
        ? cards.find((c) => c.id === op.nearNoteId)
        : cards.filter((c) => c.type !== 'section').at(-1);
      ghostCards.push({
        id: `preview-${op.tempId}`,
        title: op.title,
        content: op.body,
        type: 'note',
        x: (near?.x ?? 80) + (near ? (near.width || 260) + 40 : 0),
        y: near?.y ?? 80,
        width: 260,
        height: 180,
        relationLabel: 'AI proposal',
        color: 'blue',
      });
    } else if (op.type === 'connect_notes') {
      ghostEdges.push({
        id: `preview-edge-${op.sourceId}-${op.targetId}`,
        fromId: op.sourceId,
        toId: op.targetId,
        label: op.label || 'related',
      });
    } else if (op.type === 'create_group') {
      const members = op.noteIds
        .map((id) => cards.find((c) => c.id === id))
        .filter(Boolean) as any[];
      if (members.length === 0) continue;
      const minX = Math.min(...members.map((m) => m.x));
      const minY = Math.min(...members.map((m) => m.y));
      const maxX = Math.max(...members.map((m) => m.x + (m.width || 260)));
      const maxY = Math.max(...members.map((m) => m.y + (m.height || 180)));
      ghostCards.push({
        id: `preview-group-${op.title}`,
        title: op.title,
        content: `Proposed group · ${members.length} notes`,
        type: 'section',
        x: minX - 28,
        y: minY - 48,
        width: maxX - minX + 56,
        height: maxY - minY + 80,
        relationLabel: 'AI cluster',
        color: 'purple',
      });
    }
  }

  return { ghostCards, ghostEdges };
}
