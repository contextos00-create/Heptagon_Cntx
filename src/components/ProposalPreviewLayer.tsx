import React from 'react';
import type { ChangeProposal } from '../ai/canvasTypes';
import { proposalToPreview } from '../ai/canvasAiClient';
import type { SurfaceCard } from '../types/surface';

interface ProposalPreviewLayerProps {
  proposal: ChangeProposal | null;
  cards: SurfaceCard[];
  zoom: number;
}

/**
 * Ephemeral ghost layer for AI proposals — never writes into canonical board state.
 */
export const ProposalPreviewLayer: React.FC<ProposalPreviewLayerProps> = ({
  proposal,
  cards,
  zoom,
}) => {
  if (!proposal) return null;
  const { ghostCards, ghostEdges } = proposalToPreview(proposal, cards);

  return (
    <div className="absolute inset-0 pointer-events-none z-[8]" aria-hidden>
      {ghostEdges.map((edge) => {
        const from =
          cards.find((c) => c.id === edge.fromId) ||
          ghostCards.find((g) => g.id === `preview-${edge.fromId}` || g.id === edge.fromId);
        const to =
          cards.find((c) => c.id === edge.toId) ||
          ghostCards.find((g) => g.id === `preview-${edge.toId}` || g.id === edge.toId);
        if (!from || !to) return null;
        const x1 = from.x + (from.width || 260) / 2;
        const y1 = from.y + (from.height || 180) / 2;
        const x2 = to.x + (to.width || 260) / 2;
        const y2 = to.y + (to.height || 180) / 2;
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const w = Math.abs(x2 - x1) || 1;
        const h = Math.abs(y2 - y1) || 1;
        return (
          <svg
            key={edge.id}
            className="absolute overflow-visible"
            style={{ left: minX, top: minY, width: w, height: h }}
          >
            <line
              x1={x1 - minX}
              y1={y1 - minY}
              x2={x2 - minX}
              y2={y2 - minY}
              stroke="#8b5cf6"
              strokeWidth={1.5 / Math.max(zoom, 0.4)}
              strokeDasharray="6 4"
              opacity={0.75}
            />
          </svg>
        );
      })}
      {ghostCards.map((ghost) => (
        <div
          key={ghost.id}
          className="absolute rounded-md border-2 border-dashed border-violet-500/70 bg-violet-500/10 dark:bg-violet-400/10 p-2 flex flex-col justify-between"
          style={{
            transform: `translate3d(${ghost.x}px, ${ghost.y}px, 0)`,
            width: ghost.width,
            height: ghost.height,
          }}
        >
          <div className="text-[10px] font-semibold text-violet-800 dark:text-violet-200 truncate">
            {ghost.title}
          </div>
          <div className="text-[10px] text-zinc-600 dark:text-zinc-300 line-clamp-4">
            {ghost.content}
          </div>
          <div className="text-[9px] font-mono text-violet-600 dark:text-violet-300">
            {ghost.relationLabel} · preview
          </div>
        </div>
      ))}
    </div>
  );
};
