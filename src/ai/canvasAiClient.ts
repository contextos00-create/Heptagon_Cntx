/**
 * Canvas AI client surface — TanStack Start–style server functions.
 * UI imports these; no hand-rolled REST clients.
 */
export {
  listCanvasModelsFn as fetchCanvasModels,
  syncBoardFn as syncBoardToServer,
  resolveCanvasNotesFn as resolveCanvasNotes,
  searchCanvasNotesFn as searchCanvasNotes,
  runCanvasAiFn as runCanvasAi,
  type CompactNote,
} from '../server/canvasAiFns';

import {
  applyCanvasProposalFn,
  discardCanvasProposalFn,
  undoCanvasProposalFn,
} from '../server/canvasAiFns';
import type { ChangeProposal } from './canvasTypes';

export async function applyCanvasProposal(proposalId: string) {
  return applyCanvasProposalFn({ proposalId });
}

export async function discardCanvasProposal(proposalId: string) {
  return discardCanvasProposalFn({ proposalId });
}

export async function undoCanvasProposal(boardId: string) {
  return undoCanvasProposalFn({ boardId });
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
