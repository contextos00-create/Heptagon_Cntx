import React, { useState } from 'react';
import { 
  FolderKanban, 
  Plus, 
  Trash2, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Code, 
  Image as ImageIcon,
  HelpCircle,
  Sun,
  Moon,
  Layers
} from 'lucide-react';
import { Whiteboard, SurfaceCard, ThemeMode } from '../types/surface';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  whiteboards: Whiteboard[];
  currentBoardId: string;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: () => void;
  onDeleteBoard: (boardId: string) => void;
  cards: SurfaceCard[];
  onZoomToCard: (cardId: string) => void;
  activeFilterTag?: string;
  onSelectFilterTag: (tag?: string) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  whiteboards,
  currentBoardId,
  onSelectBoard,
  onCreateBoard,
  onDeleteBoard,
  cards,
  onZoomToCard,
  activeFilterTag,
  onSelectFilterTag,
  theme,
  onToggleTheme,
  onOpenShortcuts,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isWhiteboardsExpanded, setIsWhiteboardsExpanded] = useState(true);
  const [isCardsExpanded, setIsCardsExpanded] = useState(true);

  // Extract all unique tags
  const allTags = Array.from(new Set(cards.flatMap((c) => c.tags)));

  // Filtered cards in search
  const filteredCards = searchTerm.trim()
    ? cards.filter(
        (c) =>
          c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.content.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : cards;

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-1/2 -translate-y-1/2 left-0 z-50 flex items-center gap-1.5 px-2 py-2 rounded-r-md bg-orange-500 hover:bg-orange-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 group font-mono text-[11px] font-semibold cursor-pointer border-r border-y border-orange-600/40"
        title="Open Navigation"
      >
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        <span className="hidden sm:inline [writing-mode:vertical-lr] rotate-180 tracking-wider uppercase text-[10px]">
          Workspace
        </span>
      </button>
    );
  }

  return (
    <aside className="w-56 h-full flex flex-col bg-[#fbfbfc] dark:bg-[#0f1013] border-r border-black/[0.04] dark:border-white/[0.04] z-40 select-none text-zinc-600 dark:text-zinc-400">
      {/* Workspace Header */}
      <div className="h-9 px-3 border-b border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
        <span className="text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Whiteboard
        </span>
        <button
          onClick={onToggle}
          className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          title="Collapse Sidebar"
        >
          <ChevronRight className="w-3.5 h-3.5 rotate-180" />
        </button>
      </div>

      {/* Subtle Search */}
      <div className="px-2.5 py-1.5">
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-6 pr-2 py-1 text-xs bg-black/[0.02] dark:bg-white/[0.03] rounded border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 outline-none text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
          />
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-3 text-xs">
        
        {/* Whiteboards Section */}
        <div>
          <div className="flex items-center justify-between px-1.5 py-1 text-[11px] font-medium text-zinc-400">
            <button
              onClick={() => setIsWhiteboardsExpanded(!isWhiteboardsExpanded)}
              className="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              {isWhiteboardsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>Boards</span>
            </button>
            <button
              onClick={onCreateBoard}
              className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              title="New board"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {isWhiteboardsExpanded && (
            <div className="space-y-0.5 mt-0.5">
              {whiteboards.map((b) => (
                <div
                  key={b.id}
                  onClick={() => onSelectBoard(b.id)}
                  className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                    b.id === currentBoardId
                      ? 'bg-black/[0.04] dark:bg-white/[0.06] text-zinc-900 dark:text-zinc-100 font-medium'
                      : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02] text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <FolderKanban className="w-3 h-3 text-zinc-400 shrink-0" />
                    <span className="truncate text-xs">{b.name}</span>
                  </div>
                  {whiteboards.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBoard(b.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-500 text-zinc-400"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card Library Section */}
        <div>
          <div className="flex items-center justify-between px-1.5 py-1 text-[11px] font-medium text-zinc-400">
            <button
              onClick={() => setIsCardsExpanded(!isCardsExpanded)}
              className="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              {isCardsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>Cards ({filteredCards.length})</span>
            </button>
          </div>

          {isCardsExpanded && (
            <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1 mt-0.5">
              {filteredCards.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onZoomToCard(c.id)}
                  className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-zinc-600 dark:text-zinc-400 text-xs truncate transition-colors group"
                >
                  {c.type === 'code' ? (
                    <Code className="w-3 h-3 text-zinc-400 shrink-0" />
                  ) : c.type === 'image' ? (
                    <ImageIcon className="w-3 h-3 text-zinc-400 shrink-0" />
                  ) : (
                    <FileText className="w-3 h-3 text-zinc-400 shrink-0" />
                  )}
                  <span className="truncate flex-1 text-xs">{c.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tags Section */}
        {allTags.length > 0 && (
          <div>
            <div className="px-1.5 py-1 text-[11px] font-medium text-zinc-400 flex items-center justify-between">
              <span>Tags</span>
              {activeFilterTag && (
                <button
                  onClick={() => onSelectFilterTag(undefined)}
                  className="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 flex-wrap px-1 mt-1">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onSelectFilterTag(activeFilterTag === tag ? undefined : tag)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    activeFilterTag === tag
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/[0.03]'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="p-2 border-t border-black/[0.04] dark:border-white/[0.04] space-y-0.5 text-xs">
        <button
          onClick={onOpenShortcuts}
          className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          <HelpCircle className="w-3 h-3" />
          <span>Shortcuts</span>
        </button>
      </div>
    </aside>
  );
};
