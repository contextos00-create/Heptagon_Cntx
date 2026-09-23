import React from 'react';
import { GhostCardData } from '../types/surface';
import { Sparkles, MapPin, Plus } from 'lucide-react';
import { ONTOLOGY_THEMES } from './CardNode';

interface GhostCardNodeProps {
  ghost: GhostCardData;
  sourceCardId: string;
  sourceCardWidth: number;
  sourceCardHeight: number;
  onMaterialize: (ghost: GhostCardData, sourceCardId: string) => void;
}

export const GhostCardNode: React.FC<GhostCardNodeProps> = ({
  ghost,
  sourceCardId,
  onMaterialize,
}) => {
  const theme = ONTOLOGY_THEMES[ghost.color || 'default'] || ONTOLOGY_THEMES.default;

  return (
    <div
      id={`ghost-${ghost.id}`}
      style={{
        transform: `translate3d(${ghost.x}px, ${ghost.y}px, 0)`,
        width: `${ghost.width}px`,
        height: `${ghost.height}px`,
        zIndex: 5,
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onMaterialize(ghost, sourceCardId);
      }}
      title="Potential card: double-click to materialize onto surface"
      className="absolute rounded-md border-[1.5px] border-dashed border-zinc-700/50 dark:border-zinc-400/50 bg-white/40 dark:bg-black/30 hover:bg-white/80 dark:hover:bg-zinc-900/60 hover:border-black dark:hover:border-white transition-all cursor-pointer group flex flex-col justify-between p-2 select-none shadow-xs"
    >
      {/* Ghost Header */}
      <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-300">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme.dot}`} />
          {ghost.type === 'map' ? (
            <MapPin className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
          ) : (
            <Sparkles className="w-2.5 h-2.5 text-zinc-500" />
          )}
          <span className="text-[10px] font-semibold truncate">{ghost.title}</span>
        </div>

        <span className="text-[9px] opacity-0 group-hover:opacity-100 font-mono text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
          <Plus className="w-2.5 h-2.5" />
          <span>double-click</span>
        </span>
      </div>

      {/* Ghost Content Excerpt */}
      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-3 leading-snug font-sans my-1">
        {ghost.content}
      </div>

      {/* Ghost Footer */}
      <div className="text-[9px] text-zinc-400 dark:text-zinc-500 flex items-center justify-between pt-1 border-t border-dashed border-zinc-300/80 dark:border-zinc-700/80 font-mono">
        <span className="truncate">{ghost.relationLabel}</span>
        <span className="shrink-0">ghost</span>
      </div>
    </div>
  );
};
