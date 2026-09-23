import React, { useState } from 'react';
import { Search, GitBranch, Sparkles, Filter, X } from 'lucide-react';
import { Badge, ActionIcon, Kbd } from '@mantine/core';
import { SurfaceCard, Connection } from '../types/surface';
import { enrichConnectionSemantics } from '../utils/latentEngine';

interface GraphNativeSearchProps {
  isOpen: boolean;
  onClose: () => void;
  cards: SurfaceCard[];
  connections: Connection[];
  onFocusCard: (cardId: string) => void;
}

export const GraphNativeSearch: React.FC<GraphNativeSearchProps> = ({
  isOpen,
  onClose,
  cards,
  connections,
  onFocusCard,
}) => {
  const [query, setQuery] = useState('');
  const [selectedRelationType, setSelectedRelationType] = useState<string>('all');

  if (!isOpen) return null;

  const enrichedConns = connections.map(enrichConnectionSemantics);

  // Graph structural search filter
  const results = cards.filter(card => {
    if (card.type === 'section') return false;

    // Direct text match
    const textMatch = 
      card.title.toLowerCase().includes(query.toLowerCase()) ||
      card.content.toLowerCase().includes(query.toLowerCase()) ||
      card.tags.some(t => t.toLowerCase().includes(query.toLowerCase()));

    // Relationship structural query match
    const nodeConns = enrichedConns.filter(c => c.fromId === card.id || c.toId === card.id);
    const relationMatch = selectedRelationType === 'all' 
      ? true 
      : nodeConns.some(c => c.semanticType === selectedRelationType || c.label?.toLowerCase().includes(selectedRelationType));

    // Graph query syntax e.g. "rel:depends_on" or "has:"
    const isGraphQuery = query.startsWith('rel:') || query.startsWith('has:');
    if (isGraphQuery) {
      const criteria = query.split(':')[1]?.toLowerCase() || '';
      return nodeConns.some(c => (c.semanticType || c.label || '').toLowerCase().includes(criteria));
    }

    return (query === '' || textMatch) && relationMatch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center pt-20 p-4 select-none">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#141519] border border-black/20 dark:border-white/20 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-3 py-2.5 border-b border-black/10 dark:border-white/10 gap-2">
          <Search className="w-4 h-4 text-orange-500 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Graph search: query entities or relational syntax like 'rel:depends_on'..."
            className="flex-1 bg-transparent text-xs text-zinc-900 dark:text-zinc-100 outline-none font-mono"
            autoFocus
          />
          {query && (
            <ActionIcon onClick={() => setQuery('')} variant="subtle" color="gray" size="xs">
              <X className="w-3.5 h-3.5" />
            </ActionIcon>
          )}
          <ActionIcon onClick={onClose} variant="subtle" color="gray" size="sm">
            <X className="w-4 h-4" />
          </ActionIcon>
        </div>

        {/* Structural Filter Chips with Mantine Badges */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/60 border-b border-black/5 dark:border-white/5 overflow-x-auto text-[10px] font-mono">
          <span className="text-zinc-400 flex items-center gap-1">
            <Filter className="w-2.5 h-2.5" /> Relation:
          </span>
          {['all', 'supports', 'contradicts', 'depends_on', 'derived_from', 'telemetry', 'spec_impl'].map(rel => (
            <button
              key={rel}
              onClick={() => setSelectedRelationType(rel)}
              className={`px-2 py-0.5 rounded transition-colors text-[10px] font-mono ${
                selectedRelationType === rel
                  ? 'bg-orange-500 text-white font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {rel}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400 font-mono">
              No entities found matching relationship structure or keyword query.
            </div>
          ) : (
            results.map(card => {
              const nodeConns = enrichedConns.filter(c => c.fromId === card.id || c.toId === card.id);
              return (
                <div
                  key={card.id}
                  onClick={() => {
                    onFocusCard(card.id);
                    onClose();
                  }}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 cursor-pointer flex items-center justify-between group transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{card.title}</span>
                      <Badge size="xs" variant="light" color="gray" className="font-mono text-[8px] uppercase">
                        {card.type}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">{card.content}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge size="xs" variant="outline" color="blue" className="font-mono text-[9px]">
                      {nodeConns.length} relations
                    </Badge>
                    <span className="text-[10px] font-mono opacity-0 group-hover:opacity-100 text-orange-500">
                      Jump →
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/60 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] font-mono text-zinc-400">
          <span>{results.length} nodes indexed in spatial graph</span>
          <span className="flex items-center gap-1">Press <Kbd size="xs">Esc</Kbd> to exit</span>
        </div>
      </div>
    </div>
  );
};
