import React, { useState, useMemo } from 'react';
import { 
  Table as TableIcon, 
  Search, 
  ArrowUp, 
  ArrowDown, 
  ArrowUpDown, 
  X, 
  ArrowUpRight, 
  Trash2, 
  Download,
  Layers,
  Sparkles,
  Filter
} from 'lucide-react';
import { Badge, Tooltip, ActionIcon, Kbd, Button } from '@mantine/core';
import { SurfaceCard, Connection } from '../types/surface';

interface WorkspaceDataGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: SurfaceCard[];
  connections: Connection[];
  onZoomToCard: (cardId: string) => void;
  onDeleteCard: (cardId: string) => void;
}

type SortField = 'title' | 'type' | 'color' | 'connections' | 'tags' | 'size' | 'updatedAt';

export const WorkspaceDataGridModal: React.FC<WorkspaceDataGridModalProps> = ({
  isOpen,
  onClose,
  cards,
  connections,
  onZoomToCard,
  onDeleteCard,
}) => {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  if (!isOpen) return null;

  // Compute connections count per card
  const connectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    connections.forEach((c) => {
      counts[c.fromId] = (counts[c.fromId] || 0) + 1;
      counts[c.toId] = (counts[c.toId] || 0) + 1;
    });
    return counts;
  }, [connections]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filtered and sorted cards
  const processedCards = useMemo(() => {
    let result = cards.filter((c) => c.type !== 'section');

    if (selectedType !== 'all') {
      result = result.filter((c) => c.type === selectedType);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.content.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let valA: any = a[sortField as keyof SurfaceCard] || '';
      let valB: any = b[sortField as keyof SurfaceCard] || '';

      if (sortField === 'connections') {
        valA = connectionCounts[a.id] || 0;
        valB = connectionCounts[b.id] || 0;
      } else if (sortField === 'size') {
        valA = a.width * a.height;
        valB = b.width * b.height;
      } else if (sortField === 'tags') {
        valA = a.tags.join(', ');
        valB = b.tags.join(', ');
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    return result;
  }, [cards, selectedType, search, sortField, sortOrder, connectionCounts]);

  const exportCsv = () => {
    const headers = ['ID', 'Title', 'Type', 'Ontology', 'Tags', 'Connections', 'Width', 'Height', 'X', 'Y'];
    const rows = processedCards.map((c) => [
      `"${c.id}"`,
      `"${c.title.replace(/"/g, '""')}"`,
      `"${c.type}"`,
      `"${c.color}"`,
      `"${c.tags.join(';')}"`,
      connectionCounts[c.id] || 0,
      c.width,
      c.height,
      c.x,
      c.y,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-cards-datagrid-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typesList = ['all', 'note', 'datagrid', 'table', 'code', 'pdf', 'map', 'image', 'audio'];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl max-h-[85vh] bg-white dark:bg-[#121316] border border-black/15 dark:border-white/15 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Workspace Data Grid & Entity Matrix
            </span>
            <Badge size="xs" variant="light" color="orange" className="font-mono text-[9px]">
              {processedCards.length} / {cards.length} nodes
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={exportCsv}
              size="xs"
              variant="default"
              leftSection={<Download className="w-3 h-3" />}
              className="text-[11px] h-7"
            >
              Export CSV
            </Button>
            <ActionIcon onClick={onClose} variant="subtle" color="gray" size="sm">
              <X className="w-4 h-4" />
            </ActionIcon>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-black/5 dark:border-white/5 bg-white dark:bg-[#121316] text-[11px]">
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards by title, tag, or content..."
              className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 outline-none"
            />
            {search && (
              <ActionIcon onClick={() => setSearch('')} variant="subtle" color="gray" size="xs">
                <X className="w-3 h-3" />
              </ActionIcon>
            )}
          </div>

          {/* Type filters */}
          <div className="flex items-center gap-1 overflow-x-auto text-[10px] font-mono">
            {typesList.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-2 py-0.5 rounded transition-colors uppercase ${
                  selectedType === t
                    ? 'bg-orange-500 text-white font-semibold'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Data Grid Table with Sortable Columns */}
        <div className="flex-1 overflow-auto bg-white dark:bg-[#121316]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-zinc-100/95 dark:bg-zinc-900/95 backdrop-blur-xs z-10 border-b border-zinc-200 dark:border-zinc-800 font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
              <tr>
                <th
                  onClick={() => handleSort('title')}
                  className="px-3 py-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-1">
                    <span>Title</span>
                    {sortField === 'title' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-orange-500" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('type')}
                  className="px-3 py-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-1">
                    <span>Type</span>
                    {sortField === 'type' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-orange-500" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('color')}
                  className="px-3 py-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-1">
                    <span>Ontology</span>
                    {sortField === 'color' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-orange-500" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('connections')}
                  className="px-3 py-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Relations</span>
                    {sortField === 'connections' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-orange-500" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('size')}
                  className="px-3 py-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Dimensions</span>
                    {sortField === 'size' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-orange-500" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-3 py-2">Tags</th>
                <th className="w-16 px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-sans text-xs">
              {processedCards.map((card) => {
                const conns = connectionCounts[card.id] || 0;
                return (
                  <tr
                    key={card.id}
                    className="hover:bg-orange-500/[0.04] dark:hover:bg-orange-400/[0.05] group transition-colors"
                  >
                    <td className="px-3 py-2 max-w-[240px]">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {card.title}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono truncate">
                        x: {card.x}, y: {card.y}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge size="xs" variant="light" color="gray" className="font-mono text-[9px] uppercase">
                        {card.type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            card.color === 'blue'
                              ? 'bg-blue-500'
                              : card.color === 'green'
                              ? 'bg-emerald-500'
                              : card.color === 'orange'
                              ? 'bg-amber-500'
                              : card.color === 'purple'
                              ? 'bg-purple-500'
                              : card.color === 'red'
                              ? 'bg-rose-500'
                              : 'bg-zinc-500'
                          }`}
                        />
                        <span className="capitalize text-[11px] text-zinc-600 dark:text-zinc-300">
                          {card.color}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                      {conns}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[10px] text-zinc-500">
                      {card.width} × {card.height}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
                        {card.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[9px] font-mono bg-black/[0.04] dark:bg-white/[0.04] px-1 py-0.2 rounded text-zinc-600 dark:text-zinc-300"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip label="Jump to Card">
                          <button
                            onClick={() => {
                              onZoomToCard(card.id);
                              onClose();
                            }}
                            className="p-1 rounded text-orange-500 hover:bg-orange-500/10 transition-colors"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                        <Tooltip label="Delete Card">
                          <button
                            onClick={() => onDeleteCard(card.id)}
                            className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/60 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>Sort any column, filter by type, or jump to coordinates</span>
          <span className="flex items-center gap-1">Press <Kbd size="xs">Esc</Kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
