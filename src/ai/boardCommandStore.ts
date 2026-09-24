import { randomUUID } from 'crypto';
import {
  BoardSnapshot,
  CanvasContext,
  CanvasOperation,
  ChangeProposal,
  MAX_NOTE_BODY_CHARS,
  MAX_NOTES_RETRIEVED,
  MAX_OPS_PER_PROPOSAL,
} from './canvasTypes';

type UndoEntry = {
  proposalId: string;
  boardId: string;
  before: BoardSnapshot;
  after: BoardSnapshot;
  appliedAt: number;
};

type ProposalRecord = ChangeProposal & {
  status: 'pending' | 'applied' | 'discarded' | 'stale';
  createdAt: number;
  appliedAt?: number;
  createdIds?: Record<string, string>;
};

/**
 * In-memory board command handler.
 * Canonical mutations only happen here — layout engine resolves positions.
 */
export class BoardCommandStore {
  private boards = new Map<string, BoardSnapshot>();
  private proposals = new Map<string, ProposalRecord>();
  private undoStack: UndoEntry[] = [];
  private appliedIds = new Set<string>();

  upsertBoard(board: any): BoardSnapshot {
    const existing = this.boards.get(board.id);
    const version =
      typeof board.version === 'number'
        ? board.version
        : (existing?.version || 0) + 1;
    const snap: BoardSnapshot = {
      id: board.id,
      name: board.name || existing?.name || 'Board',
      description: board.description,
      version,
      cards: Array.isArray(board.cards) ? board.cards : existing?.cards || [],
      connections: Array.isArray(board.connections)
        ? board.connections
        : existing?.connections || [],
      viewState: board.viewState || existing?.viewState,
      updatedAt: Date.now(),
    };
    this.boards.set(snap.id, snap);
    return snap;
  }

  getBoard(boardId: string): BoardSnapshot | null {
    return this.boards.get(boardId) || null;
  }

  getNotesByIds(boardId: string, noteIds: string[]) {
    const board = this.boards.get(boardId);
    if (!board) return [];
    const set = new Set(noteIds);
    return board.cards
      .filter((c) => set.has(c.id) && c.type !== 'section')
      .map(compactNote)
      .slice(0, MAX_NOTES_RETRIEVED);
  }

  searchNotes(boardId: string, query: string, limit = 12) {
    const board = this.boards.get(boardId);
    if (!board) return [];
    const q = query.toLowerCase().trim();
    if (!q) {
      return board.cards
        .filter((c) => c.type !== 'section')
        .slice(0, limit)
        .map(compactNote);
    }
    const words = q.split(/\s+/).filter((w) => w.length > 1);
    const scored = board.cards
      .filter((c) => c.type !== 'section')
      .map((card) => {
        const hay = `${card.title || ''} ${card.content || ''} ${(card.tags || []).join(' ')}`.toLowerCase();
        let score = 0;
        for (const w of words) {
          if ((card.title || '').toLowerCase().includes(w)) score += 5;
          if ((card.tags || []).some((t: string) => t.toLowerCase().includes(w))) score += 3;
          if (hay.includes(w)) score += 1;
        }
        return { card, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(limit, MAX_NOTES_RETRIEVED));
    return scored.map((s) => compactNote(s.card));
  }

  createProposal(proposal: ChangeProposal): ProposalRecord {
    if (proposal.operations.length > MAX_OPS_PER_PROPOSAL) {
      throw new Error(`Too many operations (max ${MAX_OPS_PER_PROPOSAL})`);
    }
    const board = this.boards.get(proposal.boardId);
    if (!board) throw new Error('Board not found');
    const validated = this.validateProposal(proposal, board);
    const record: ProposalRecord = {
      ...validated,
      status: board.version !== proposal.baseBoardVersion ? 'stale' : 'pending',
      createdAt: Date.now(),
    };
    this.proposals.set(record.proposalId, record);
    return record;
  }

  getProposal(proposalId: string) {
    return this.proposals.get(proposalId) || null;
  }

  discardProposal(proposalId: string) {
    const p = this.proposals.get(proposalId);
    if (!p) return null;
    p.status = 'discarded';
    return p;
  }

  applyProposal(proposalId: string): {
    board: BoardSnapshot;
    createdIds: Record<string, string>;
    status: 'applied' | 'duplicate' | 'stale';
  } {
    if (this.appliedIds.has(proposalId)) {
      const board = this.boards.get(this.proposals.get(proposalId)?.boardId || '');
      if (!board) throw new Error('Board missing for duplicate apply');
      return {
        board,
        createdIds: this.proposals.get(proposalId)?.createdIds || {},
        status: 'duplicate',
      };
    }

    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.status === 'discarded') throw new Error('Proposal was discarded');

    const board = this.boards.get(proposal.boardId);
    if (!board) throw new Error('Board not found');
    if (board.version !== proposal.baseBoardVersion) {
      proposal.status = 'stale';
      throw Object.assign(new Error('Stale board version — reconcile before apply'), {
        code: 'STALE_VERSION',
        currentVersion: board.version,
        baseBoardVersion: proposal.baseBoardVersion,
      });
    }

    const before = structuredClone(board);
    const next = structuredClone(board);
    const createdIds: Record<string, string> = {};

    for (const op of proposal.operations) {
      applyOperation(next, op, createdIds);
    }

    next.version = board.version + 1;
    next.updatedAt = Date.now();
    this.boards.set(next.id, next);

    proposal.status = 'applied';
    proposal.appliedAt = Date.now();
    proposal.createdIds = createdIds;
    this.appliedIds.add(proposalId);
    this.undoStack.push({
      proposalId,
      boardId: next.id,
      before,
      after: structuredClone(next),
      appliedAt: Date.now(),
    });

    return { board: next, createdIds, status: 'applied' };
  }

  undoLast(boardId: string): BoardSnapshot | null {
    for (let i = this.undoStack.length - 1; i >= 0; i--) {
      const entry = this.undoStack[i];
      if (entry.boardId !== boardId) continue;
      this.undoStack.splice(i, 1);
      const restored = structuredClone(entry.before);
      restored.version = (this.boards.get(boardId)?.version || restored.version) + 1;
      restored.updatedAt = Date.now();
      this.boards.set(boardId, restored);
      this.appliedIds.delete(entry.proposalId);
      const proposal = this.proposals.get(entry.proposalId);
      if (proposal) proposal.status = 'pending';
      return restored;
    }
    return null;
  }

  private validateProposal(proposal: ChangeProposal, board: BoardSnapshot): ChangeProposal {
    const cardIds = new Set(board.cards.map((c) => c.id));
    const ops: CanvasOperation[] = [];
    for (const op of proposal.operations) {
      if (op.type === 'create_note') {
        if (!op.title?.trim() || !op.tempId) continue;
        ops.push({
          ...op,
          title: op.title.slice(0, 200),
          body: (op.body || '').slice(0, MAX_NOTE_BODY_CHARS),
        });
      } else if (op.type === 'update_note') {
        if (!cardIds.has(op.noteId)) continue;
        ops.push({
          ...op,
          patch: {
            title: op.patch.title?.slice(0, 200),
            body: op.patch.body?.slice(0, MAX_NOTE_BODY_CHARS),
          },
        });
      } else if (op.type === 'connect_notes') {
        if (!cardIds.has(op.sourceId) || !cardIds.has(op.targetId)) continue;
        if (op.sourceId === op.targetId) continue;
        ops.push(op);
      } else if (op.type === 'create_group') {
        const valid = op.noteIds.filter((id) => cardIds.has(id));
        if (valid.length === 0) continue;
        ops.push({ ...op, noteIds: valid, title: (op.title || 'Group').slice(0, 120) });
      } else if (op.type === 'move_notes') {
        const valid = op.noteIds.filter((id) => cardIds.has(id));
        if (valid.length === 0) continue;
        ops.push({ ...op, noteIds: valid });
      }
    }
    return {
      ...proposal,
      proposalId: proposal.proposalId || randomUUID(),
      evidenceNoteIds: proposal.evidenceNoteIds.filter((id) => cardIds.has(id)),
      operations: ops,
    };
  }
}

function compactNote(card: any) {
  return {
    id: card.id,
    type: card.type,
    title: card.title || 'Untitled',
    content: String(card.content || '').slice(0, 2000),
    tags: card.tags || [],
    sectionId: card.sectionId,
    updatedAt: card.updatedAt,
    version: card.updatedAt || 0,
  };
}

function applyOperation(
  board: BoardSnapshot,
  op: CanvasOperation,
  createdIds: Record<string, string>
) {
  const now = Date.now();
  if (op.type === 'create_note') {
    const id = `card-ai-${randomUUID().slice(0, 8)}`;
    createdIds[op.tempId] = id;
    const near = op.nearNoteId
      ? board.cards.find((c) => c.id === op.nearNoteId)
      : board.cards.filter((c) => c.type !== 'section').at(-1);
    const x = (near?.x ?? 80) + (near ? (near.width || 260) + 40 : 0);
    const y = near?.y ?? 80;
    board.cards.push({
      id,
      type: op.cardType || 'note',
      title: op.title,
      content: op.body,
      x,
      y,
      width: 260,
      height: 180,
      color: 'blue',
      tags: ['AI', 'PROPOSAL'],
      createdAt: now,
      updatedAt: now,
    });
  } else if (op.type === 'update_note') {
    const card = board.cards.find((c) => c.id === op.noteId);
    if (!card) return;
    if (op.patch.title != null) card.title = op.patch.title;
    if (op.patch.body != null) card.content = op.patch.body;
    card.updatedAt = now;
  } else if (op.type === 'connect_notes') {
    const sourceId = createdIds[op.sourceId] || op.sourceId;
    const targetId = createdIds[op.targetId] || op.targetId;
    const exists = board.connections.some(
      (c) => c.fromId === sourceId && c.toId === targetId
    );
    if (exists) return;
    board.connections.push({
      id: `conn-ai-${randomUUID().slice(0, 8)}`,
      fromId: sourceId,
      toId: targetId,
      label: op.label || 'related',
      style: 'dashed',
      semanticType: 'ai_proposal',
      confidence: 0.7,
    });
  } else if (op.type === 'create_group') {
    const members = op.noteIds
      .map((id) => createdIds[id] || id)
      .map((id) => board.cards.find((c) => c.id === id))
      .filter(Boolean) as any[];
    if (members.length === 0) return;
    const minX = Math.min(...members.map((m) => m.x));
    const minY = Math.min(...members.map((m) => m.y));
    const maxX = Math.max(...members.map((m) => m.x + (m.width || 260)));
    const maxY = Math.max(...members.map((m) => m.y + (m.height || 180)));
    const sectionId = `sec-ai-${randomUUID().slice(0, 8)}`;
    createdIds[`group:${op.title}`] = sectionId;
    board.cards.push({
      id: sectionId,
      type: 'section',
      title: op.title,
      content: `AI-proposed group (${members.length} notes)`,
      x: minX - 28,
      y: minY - 48,
      width: maxX - minX + 56,
      height: maxY - minY + 80,
      color: 'purple',
      tags: ['AI', 'CLUSTER'],
      createdAt: now,
      updatedAt: now,
    });
    for (const m of members) {
      m.sectionId = sectionId;
      m.updatedAt = now;
    }
  } else if (op.type === 'move_notes') {
    const ids = op.noteIds.map((id) => createdIds[id] || id);
    const cards = board.cards.filter((c) => ids.includes(c.id));
    if (cards.length === 0) return;
    if (op.layoutHint === 'preserve') return;
    const originX = Math.min(...cards.map((c) => c.x));
    const originY = Math.min(...cards.map((c) => c.y));
    cards.forEach((card, idx) => {
      if (op.layoutHint === 'row') {
        card.x = originX + idx * 280;
        card.y = originY;
      } else {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        card.x = originX + col * 280;
        card.y = originY + row * 210;
      }
      card.updatedAt = now;
    });
  }
}

export function resolveContextNotes(
  store: BoardCommandStore,
  ctx: CanvasContext,
  query?: string
) {
  const selected = store.getNotesByIds(ctx.boardId, ctx.selectedNoteIds);
  if (selected.length > 0 && !query) return selected;
  if (query) {
    const searched = store.searchNotes(ctx.boardId, query, 16);
    const merged = new Map<string, any>();
    for (const n of [...selected, ...searched]) merged.set(n.id, n);
    return [...merged.values()].slice(0, MAX_NOTES_RETRIEVED);
  }
  if (ctx.visibleNoteIds.length > 0) {
    return store.getNotesByIds(ctx.boardId, ctx.visibleNoteIds.slice(0, MAX_NOTES_RETRIEVED));
  }
  return store.searchNotes(ctx.boardId, '', 12);
}

export const boardCommandStore = new BoardCommandStore();
