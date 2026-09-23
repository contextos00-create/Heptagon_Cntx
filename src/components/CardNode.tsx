import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Copy, 
  Pin, 
  Play, 
  Pause, 
  ExternalLink,
  MapPin,
  Sparkles,
  Navigation,
  MoreHorizontal,
  Maximize2,
  Trash2,
  GitCompare,
  Network,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { Badge, Tooltip } from '@mantine/core';
import { SurfaceCard, CardColor } from '../types/surface';
import { formatBytes } from '../utils/fileHelpers';
import { KNOWN_LOCATIONS } from '../utils/cardIntelligence';

interface CardNodeProps {
  card: SurfaceCard;
  zoom: number;
  isSelected: boolean;
  isSpotlight: boolean;
  isConnecting: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onStartDrag: (e: React.MouseEvent, cardId: string) => void;
  onStartResize: (e: React.MouseEvent, cardId: string) => void;
  onStartConnect: (e: React.MouseEvent, cardId: string) => void;
  onEndConnect?: (cardId: string) => void;
  onOpenDetail: (card: SurfaceCard) => void;
  onUpdateCard: (id: string, updates: Partial<SurfaceCard>) => void;
  onDeleteCard: (id: string) => void;
  onDuplicateCard: (card: SurfaceCard) => void;
  onTextDrillDown?: (selectedText: string, card: SurfaceCard) => void;
  onLocationClick?: (locationName: string, card: SurfaceCard) => void;
  onPredictiveAction?: (action: 'compare' | 'find_relations' | 'trace_evidence' | 'find_contradictions' | 'timeline', card: SurfaceCard) => void;
}

// Crisp, high-contrast dark border with subtle ontology tinting
export const ONTOLOGY_THEMES: Record<CardColor, {
  dot: string;
  badge: string;
  sectionBg: string;
  sectionBorder: string;
  sectionHeader: string;
  cardBorder: string;
  cardSelectedBorder: string;
  accentText: string;
}> = {
  default: {
    dot: 'bg-zinc-500',
    badge: 'GENERAL',
    sectionBg: 'bg-zinc-500/[0.03] dark:bg-zinc-400/[0.02]',
    sectionBorder: 'border-zinc-800 dark:border-zinc-600',
    sectionHeader: 'text-zinc-800 dark:text-zinc-200',
    cardBorder: 'border-zinc-900/90 dark:border-zinc-500/90',
    cardSelectedBorder: 'border-blue-600 dark:border-blue-400 ring-1 ring-blue-500',
    accentText: 'text-zinc-600 dark:text-zinc-400',
  },
  blue: {
    dot: 'bg-blue-600 dark:bg-blue-400',
    badge: 'SYSTEM TOPOLOGY',
    sectionBg: 'bg-blue-500/[0.04] dark:bg-blue-400/[0.03]',
    sectionBorder: 'border-blue-900/80 dark:border-blue-400/70',
    sectionHeader: 'text-blue-900 dark:text-blue-200',
    cardBorder: 'border-blue-950/90 dark:border-blue-400/85',
    cardSelectedBorder: 'border-blue-600 dark:border-blue-300 ring-1 ring-blue-500',
    accentText: 'text-blue-700 dark:text-blue-300',
  },
  purple: {
    dot: 'bg-purple-600 dark:bg-purple-400',
    badge: 'COGNITIVE & UX',
    sectionBg: 'bg-purple-500/[0.04] dark:bg-purple-400/[0.03]',
    sectionBorder: 'border-purple-900/80 dark:border-purple-400/70',
    sectionHeader: 'text-purple-900 dark:text-purple-200',
    cardBorder: 'border-purple-950/90 dark:border-purple-400/85',
    cardSelectedBorder: 'border-purple-600 dark:border-purple-300 ring-1 ring-purple-500',
    accentText: 'text-purple-700 dark:text-purple-300',
  },
  green: {
    dot: 'bg-emerald-600 dark:bg-emerald-400',
    badge: 'TELEMETRY & DATA',
    sectionBg: 'bg-emerald-500/[0.04] dark:bg-emerald-400/[0.03]',
    sectionBorder: 'border-emerald-900/80 dark:border-emerald-400/70',
    sectionHeader: 'text-emerald-900 dark:text-emerald-200',
    cardBorder: 'border-emerald-950/90 dark:border-emerald-400/85',
    cardSelectedBorder: 'border-emerald-600 dark:border-emerald-300 ring-1 ring-emerald-500',
    accentText: 'text-emerald-700 dark:text-emerald-300',
  },
  orange: {
    dot: 'bg-amber-600 dark:bg-amber-400',
    badge: 'GEOGRAPHIC MESH',
    sectionBg: 'bg-amber-500/[0.04] dark:bg-amber-400/[0.03]',
    sectionBorder: 'border-amber-900/80 dark:border-amber-400/70',
    sectionHeader: 'text-amber-900 dark:text-amber-200',
    cardBorder: 'border-amber-950/90 dark:border-amber-400/85',
    cardSelectedBorder: 'border-amber-600 dark:border-amber-300 ring-1 ring-amber-500',
    accentText: 'text-amber-700 dark:text-amber-300',
  },
  yellow: {
    dot: 'bg-yellow-500',
    badge: 'SPECIFICATION',
    sectionBg: 'bg-yellow-500/[0.04] dark:bg-yellow-400/[0.03]',
    sectionBorder: 'border-yellow-900/80 dark:border-yellow-400/70',
    sectionHeader: 'text-yellow-900 dark:text-yellow-200',
    cardBorder: 'border-yellow-950/90 dark:border-yellow-400/85',
    cardSelectedBorder: 'border-yellow-600 dark:border-yellow-300 ring-1 ring-yellow-500',
    accentText: 'text-yellow-700 dark:text-yellow-300',
  },
  red: {
    dot: 'bg-rose-600 dark:bg-rose-400',
    badge: 'CRITICAL PIPELINE',
    sectionBg: 'bg-rose-500/[0.04] dark:bg-rose-400/[0.03]',
    sectionBorder: 'border-rose-900/80 dark:border-rose-400/70',
    sectionHeader: 'text-rose-900 dark:text-rose-200',
    cardBorder: 'border-rose-950/90 dark:border-rose-400/85',
    cardSelectedBorder: 'border-rose-600 dark:border-rose-300 ring-1 ring-rose-500',
    accentText: 'text-rose-700 dark:text-rose-300',
  },
  gray: {
    dot: 'bg-zinc-500',
    badge: 'INFRASTRUCTURE',
    sectionBg: 'bg-zinc-500/[0.03] dark:bg-zinc-400/[0.02]',
    sectionBorder: 'border-zinc-800 dark:border-zinc-600',
    sectionHeader: 'text-zinc-800 dark:text-zinc-200',
    cardBorder: 'border-zinc-900/90 dark:border-zinc-500/90',
    cardSelectedBorder: 'border-blue-600 dark:border-blue-400 ring-1 ring-blue-500',
    accentText: 'text-zinc-600 dark:text-zinc-400',
  },
};

const COLOR_OPTIONS: CardColor[] = ['default', 'blue', 'green', 'purple', 'yellow', 'orange', 'red', 'gray'];

export const CardNode: React.FC<CardNodeProps> = ({
  card,
  zoom,
  isSelected,
  isSpotlight,
  isConnecting,
  onSelect,
  onStartDrag,
  onStartResize,
  onStartConnect,
  onEndConnect,
  onOpenDetail,
  onUpdateCard,
  onDeleteCard,
  onDuplicateCard,
  onTextDrillDown,
  onLocationClick,
  onPredictiveAction,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(card.title);
  const [showMenu, setShowMenu] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Floating drill-down action for selected text segment
  const [textSelectionPopover, setTextSelectionPopover] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const theme = ONTOLOGY_THEMES[card.color] || ONTOLOGY_THEMES.default;
  const isSection = card.type === 'section';

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput !== card.title) {
      onUpdateCard(card.id, { title: titleInput.trim(), updatedAt: Date.now() });
    } else {
      setTitleInput(card.title);
    }
  };

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlayingAudio(true);
    }
  };

  // Listen for text selection inside the card body
  const handleContentMouseUp = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setTextSelectionPopover(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (selectedText.length > 2) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const cardEl = document.getElementById(`card-${card.id}`);
      if (cardEl) {
        const cardRect = cardEl.getBoundingClientRect();
        setTextSelectionPopover({
          text: selectedText,
          x: Math.max(10, (rect.left + rect.width / 2 - cardRect.left) / zoom),
          y: Math.max(10, (rect.top - cardRect.top) / zoom - 28),
        });
      }
    } else {
      setTextSelectionPopover(null);
    }
  };

  // Helper to highlight identifiable location words in text so user can tap them
  const renderInteractiveText = (text: string) => {
    if (!text) return null;
    const words = text.split(/(\s+)/);
    return words.map((token, index) => {
      const cleanToken = token.trim().toLowerCase().replace(/[.,!?:;()]/g, '');
      const isLocation = Boolean(cleanToken && KNOWN_LOCATIONS[cleanToken]);

      if (isLocation) {
        return (
          <span
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              if (onLocationClick) {
                onLocationClick(cleanToken, card);
              }
            }}
            title={`Tap to generate map card for ${token}`}
            className="cursor-pointer underline decoration-dotted decoration-blue-600 dark:decoration-blue-400 font-medium hover:bg-blue-500/15 text-blue-700 dark:text-blue-300 transition-colors inline-flex items-center gap-0.5 rounded px-0.5"
          >
            <span>{token}</span>
            <MapPin className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400 inline-block shrink-0" />
          </span>
        );
      }
      return <span key={index}>{token}</span>;
    });
  };

  // Section Grouping Node with Defined Ontology Color Coding & Dark Contrast Border
  if (isSection) {
    return (
      <div
        id={`card-${card.id}`}
        style={{
          transform: `translate3d(${card.x}px, ${card.y}px, 0)`,
          width: `${card.width}px`,
          height: `${card.height}px`,
          zIndex: 1,
        }}
        onClick={onSelect}
        onMouseDown={(e) => onStartDrag(e, card.id)}
        className={`absolute select-none group border-2 rounded-lg transition-colors ${
          isSpotlight ? 'card-spotlight' : ''
        } ${theme.sectionBg} ${
          isSelected
            ? 'border-blue-600 dark:border-blue-400 shadow-[0_0_0_1px_rgba(37,99,235,0.4)]'
            : theme.sectionBorder
        }`}
      >
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot}`} />
            {isEditingTitle ? (
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                autoFocus
                className="bg-transparent text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 outline-none w-full border-b border-zinc-500"
              />
            ) : (
              <span
                onDoubleClick={() => setIsEditingTitle(true)}
                className={`text-[11px] font-semibold tracking-tight uppercase truncate cursor-text ${theme.sectionHeader}`}
              >
                {card.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/40 ${theme.accentText}`}>
              {theme.badge}
            </span>
            <button
              onClick={() => onDuplicateCard(card)}
              title="Duplicate"
              className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Copy className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => onDeleteCard(card.id)}
              title="Delete"
              className="p-0.5 text-zinc-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {card.content && (
          <div className="px-2.5 py-1 text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
            {card.content}
          </div>
        )}

        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartResize(e, card.id);
          }}
          className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize flex items-end justify-end p-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
        >
          <div className="w-1.5 h-1.5 border-r border-b border-zinc-700 dark:border-zinc-300" />
        </div>
      </div>
    );
  }

  // Standard Compact Card with Notable Dark High-Contrast Border
  return (
    <div
      id={`card-${card.id}`}
      style={{
        transform: `translate3d(${card.x}px, ${card.y}px, 0)`,
        width: `${card.width}px`,
        height: `${card.height}px`,
        zIndex: isSelected ? 20 : 10,
      }}
      onClick={onSelect}
      onDoubleClick={() => onOpenDetail(card)}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, textarea, audio, video, a, select')) return;
        onStartDrag(e, card.id);
      }}
      onMouseUp={() => {
        if (isConnecting && onEndConnect) {
          onEndConnect(card.id);
        }
      }}
      className={`absolute rounded-md border-[1.5px] select-none group flex flex-col bg-white dark:bg-[#121317] transition-[border-color,box-shadow] duration-100 ${
        isSpotlight
          ? 'card-spotlight'
          : isSelected
          ? theme.cardSelectedBorder
          : `${theme.cardBorder} hover:border-black dark:hover:border-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]`
      }`}
    >
      {/* Floating Action Button for Text Selection Drill-Down */}
      {textSelectionPopover && (
        <div
          style={{
            position: 'absolute',
            left: `${textSelectionPopover.x}px`,
            top: `${textSelectionPopover.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 60,
          }}
          className="animate-in fade-in zoom-in-95 duration-100 pointer-events-auto"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onTextDrillDown) {
                onTextDrillDown(textSelectionPopover.text, card);
              }
              setTextSelectionPopover(null);
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-[10px] font-medium rounded shadow-md border border-black/20 hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
          >
            <Sparkles className="w-2.5 h-2.5 text-blue-400 dark:text-blue-600" />
            <span>Drill down</span>
          </button>
        </div>
      )}

      {/* Dense Card Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 cursor-grab active:cursor-grabbing border-b border-zinc-200/90 dark:border-zinc-800/90 bg-zinc-50/60 dark:bg-zinc-900/40">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme.dot}`} />
          
          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              autoFocus
              className="bg-transparent text-[11px] font-medium text-zinc-900 dark:text-zinc-100 outline-none w-full border-b border-zinc-400"
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
              title={card.title}
              className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 truncate cursor-text tracking-tight"
            >
              {card.title}
            </span>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {card.pinned && (
            <Pin className="w-2.5 h-2.5 text-zinc-500 fill-zinc-500 mr-0.5" />
          )}

          {/* Color Switcher */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-0.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded"
              title="Options"
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>

            {showMenu && (
              <div 
                className="absolute right-0 mt-1 w-36 bg-white dark:bg-[#16171c] border border-black/20 dark:border-white/20 shadow-xl rounded-md py-1 z-50 text-[11px]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 flex items-center gap-1 border-b border-black/10 dark:border-white/10">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        onUpdateCard(card.id, { color: c });
                        setShowMenu(false);
                      }}
                      className={`w-2.5 h-2.5 rounded-full border border-black/20 ${
                        ONTOLOGY_THEMES[c].dot
                      } ${card.color === c ? 'scale-125 ring-1 ring-black dark:ring-white' : 'hover:scale-110'} transition-transform`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => {
                    onOpenDetail(card);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"
                >
                  <Maximize2 className="w-2.5 h-2.5 text-zinc-400" /> Open reader
                </button>

                {/* Predictive Actions */}
                <div className="my-1 border-t border-black/10 dark:border-white/10 pt-1">
                  <div className="px-2.5 py-0.5 text-[9px] font-mono text-zinc-400 uppercase">Predictive Actions</div>
                  
                  <button
                    onClick={() => {
                      if (onPredictiveAction) onPredictiveAction('find_relations', card);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"
                  >
                    <Network className="w-2.5 h-2.5 text-blue-500" /> Find Relationships
                  </button>

                  <button
                    onClick={() => {
                      if (onPredictiveAction) onPredictiveAction('trace_evidence', card);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"
                  >
                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-500" /> Trace Evidence
                  </button>

                  <button
                    onClick={() => {
                      if (onPredictiveAction) onPredictiveAction('find_contradictions', card);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"
                  >
                    <AlertTriangle className="w-2.5 h-2.5 text-rose-500" /> Find Contradictions
                  </button>
                </div>

                <div className="border-t border-black/10 dark:border-white/10 pt-1">
                  <button
                    onClick={() => {
                      onDuplicateCard(card);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"
                  >
                    <Copy className="w-2.5 h-2.5 text-zinc-400" /> Duplicate
                  </button>

                  <button
                    onClick={() => {
                      onDeleteCard(card.id);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5 text-rose-600 dark:text-rose-400"
                  >
                    <Trash2 className="w-2.5 h-2.5" /> Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(card);
            }}
            className="p-0.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded"
            title="Inspect"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Dense Card Content with Selection Listener */}
      <div 
        onMouseUp={handleContentMouseUp}
        className="flex-1 overflow-hidden px-2.5 py-2 text-[11px] text-zinc-700 dark:text-zinc-300 flex flex-col justify-between"
      >
        {/* MAP TYPE */}
        {card.type === 'map' && (
          <div className="h-full flex flex-col justify-between">
            <div className="flex-1 relative rounded overflow-hidden border border-black/20 dark:border-white/20 bg-zinc-100 dark:bg-[#1b1c22]">
              <iframe
                title={card.title}
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight={0}
                marginWidth={0}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(
                  card.mapData?.locationName || card.title
                )}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                className="w-full h-full contrast-105 pointer-events-none"
              />
              <div className="absolute top-1.5 left-1.5 bg-white/95 dark:bg-black/90 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] font-mono text-zinc-900 dark:text-zinc-100 flex items-center gap-1 shadow-xs border border-black/10 dark:border-white/10">
                <Navigation className="w-2 h-2 text-blue-600" />
                <span>{card.mapData?.locationName || card.title}</span>
              </div>
            </div>
            {card.content && (
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                {card.content}
              </div>
            )}
          </div>
        )}

        {/* IMAGE TYPE */}
        {card.type === 'image' && (
          <div className="h-full flex flex-col items-center justify-center overflow-hidden rounded bg-zinc-50 dark:bg-black/30 relative">
            <img
              src={card.fileMetadata?.dataUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80'}
              alt={card.title}
              className="max-h-full max-w-full object-contain rounded"
            />
            {card.content && (
              <div className="absolute bottom-0 inset-x-0 bg-black/75 px-1.5 py-0.5 text-[9px] text-white/90 truncate">
                {card.content}
              </div>
            )}
          </div>
        )}

        {/* CODE TYPE */}
        {card.type === 'code' && (
          <div className="h-full flex flex-col rounded bg-zinc-950 dark:bg-black text-zinc-200 font-mono text-[10px] p-2 overflow-hidden border border-black/20">
            <div className="flex items-center justify-between pb-0.5 mb-1 text-[8px] text-zinc-400 uppercase border-b border-zinc-800">
              <span>{card.codeLanguage || 'CODE'}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(card.content);
                }}
                className="hover:text-zinc-100 flex items-center gap-0.5"
                title="Copy code"
              >
                <Copy className="w-2 h-2" /> copy
              </button>
            </div>
            <pre className="overflow-auto flex-1 font-mono text-[10px] leading-tight text-zinc-300 whitespace-pre">
              {card.content}
            </pre>
          </div>
        )}

        {/* AUDIO TYPE */}
        {card.type === 'audio' && (
          <div className="h-full flex flex-col justify-between p-0.5">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAudio}
                className="w-6 h-6 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center transition-transform active:scale-95 shrink-0"
              >
                {isPlayingAudio ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[11px] text-zinc-900 dark:text-zinc-100 truncate">{card.fileMetadata?.name || card.title}</div>
                <div className="text-[9px] text-zinc-500">
                  {card.fileMetadata?.size ? formatBytes(card.fileMetadata.size) : 'Audio file'}
                </div>
              </div>
            </div>

            <div className="flex items-end gap-0.5 h-6 py-0.5">
              {[30, 55, 25, 70, 85, 40, 60, 75, 45, 80, 50, 30, 65, 75, 35, 50, 65, 85, 35, 45, 55].map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${isPlayingAudio ? Math.min(100, h * (0.8 + Math.random() * 0.4)) : h}%` }}
                  className={`flex-1 rounded-full transition-all duration-100 ${
                    isPlayingAudio ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                />
              ))}
            </div>

            <audio
              ref={audioRef}
              src={card.fileMetadata?.dataUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'}
              onEnded={() => setIsPlayingAudio(false)}
            />
          </div>
        )}

        {/* PDF TYPE */}
        {card.type === 'pdf' && (
          <div className="h-full flex flex-col justify-between">
            <div className="space-y-1">
              <div className="text-zinc-500 text-[9px] flex items-center gap-1 font-mono">
                <FileText className="w-2.5 h-2.5" />
                <span>{card.fileMetadata?.pageCount ? `${card.fileMetadata.pageCount}p` : 'Doc'} {card.fileMetadata?.size ? `• ${formatBytes(card.fileMetadata.size)}` : ''}</span>
              </div>
              <div className="text-zinc-700 dark:text-zinc-300 line-clamp-4 leading-snug font-sans">
                {renderInteractiveText(card.content)}
              </div>
            </div>
            
            <div className="pt-1 flex items-center justify-end text-[10px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail(card);
                }}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-0.5"
              >
                <span>Inspect</span> <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        )}

        {/* TABLE TYPE */}
        {card.type === 'table' && (
          <div className="h-full flex flex-col overflow-hidden">
            {card.tableData ? (
              <div className="overflow-auto border border-black/15 dark:border-white/15 rounded">
                <table className="w-full text-[9px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-zinc-500 font-semibold bg-black/[0.02] dark:bg-white/[0.02]">
                      {card.tableData.headers.map((h, i) => (
                        <th key={i} className="py-0.5 px-1 truncate max-w-[80px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {card.tableData.rows.slice(0, 5).map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-black/[0.04] dark:border-white/[0.04]">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="py-0.5 px-1 truncate max-w-[80px] text-zinc-800 dark:text-zinc-200">
                            {renderInteractiveText(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-zinc-500">{card.content}</div>
            )}
            <div className="text-[9px] text-zinc-500 mt-0.5 truncate font-mono">
              {card.tableData ? `${card.tableData.rows.length} rows dataset` : ''}
            </div>
          </div>
        )}

        {/* NOTE OR DEFAULT TYPE */}
        {(card.type === 'note' || card.type === 'link') && (
          <div className="h-full flex flex-col justify-between overflow-hidden">
            <div className="overflow-hidden line-clamp-5 text-zinc-800 dark:text-zinc-200 whitespace-pre-line leading-snug font-sans">
              {renderInteractiveText(card.content)}
            </div>
            {card.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap pt-1 mt-auto">
                {card.tags.slice(0, 3).map((tag, idx) => (
                  <Badge
                    key={idx}
                    size="xs"
                    variant="light"
                    color="gray"
                    className="font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5"
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Discrete Connection Handle */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect(e, card.id);
        }}
        title="Connect to card"
        className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white dark:bg-zinc-800 border-2 border-zinc-800 dark:border-zinc-300 hover:scale-125 hover:border-blue-500 cursor-crosshair opacity-0 group-hover:opacity-100 transition-all z-30"
      />

      {/* Minimal Resize Corner Handle */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartResize(e, card.id);
        }}
        className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize flex items-end justify-end p-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
      >
        <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-zinc-800 dark:border-zinc-300" />
      </div>
    </div>
  );
};
