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
  AlertTriangle,
  Pencil,
  Check,
  X,
  Plus,
  Link2,
  ChevronDown,
  Quote,
  User,
  CheckCircle2,
  HelpCircle,
  Calendar,
  Activity,
  Layers,
  FileCheck,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { Badge, Tooltip, Menu } from '@mantine/core';
import { SurfaceCard, CardColor, CardType } from '../types/surface';
import { formatBytes } from '../utils/fileHelpers';
import { KNOWN_LOCATIONS } from '../utils/cardIntelligence';
import { CompactDataGrid } from './CompactDataGrid';

interface CardNodeProps {
  card: SurfaceCard;
  zoom: number;
  isSelected: boolean;
  isSpotlight: boolean;
  isConnecting: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onStartDrag: (e: React.MouseEvent, cardId: string) => void;
  onStartResize: (e: React.MouseEvent, cardId: string, direction?: 'se' | 'e' | 's') => void;
  onStartConnect: (e: React.MouseEvent, cardId: string) => void;
  onEndConnect?: (cardId: string) => void;
  onOpenDetail: (card: SurfaceCard) => void;
  onUpdateCard: (id: string, updates: Partial<SurfaceCard>) => void;
  onDeleteCard: (id: string) => void;
  onDuplicateCard: (card: SurfaceCard) => void;
  onTextDrillDown?: (selectedText: string, card: SurfaceCard) => void;
  onLocationClick?: (locationName: string, card: SurfaceCard) => void;
  onPredictiveAction?: (action: 'compare' | 'find_relations' | 'trace_evidence' | 'find_contradictions' | 'timeline', card: SurfaceCard) => void;
  isResizingThisCard?: boolean;
}

// Minimal theme dark grey borders with subtle ontology category tags
export const ONTOLOGY_THEMES: Record<CardColor, {
  dot: string;
  badge: string;
  sectionBg: string;
  sectionBorder: string;
  sectionHeader: string;
  accentText: string;
}> = {
  default: {
    dot: 'bg-zinc-500',
    badge: 'GENERAL',
    sectionBg: 'bg-zinc-500/[0.03] dark:bg-zinc-400/[0.02]',
    sectionBorder: 'border-zinc-400 dark:border-zinc-700',
    sectionHeader: 'text-zinc-800 dark:text-zinc-200',
    accentText: 'text-zinc-600 dark:text-zinc-400',
  },
  blue: {
    dot: 'bg-blue-600 dark:bg-blue-400',
    badge: 'SYSTEM TOPOLOGY',
    sectionBg: 'bg-blue-500/[0.03] dark:bg-blue-400/[0.02]',
    sectionBorder: 'border-zinc-400 dark:border-zinc-700',
    sectionHeader: 'text-blue-900 dark:text-blue-200',
    accentText: 'text-blue-700 dark:text-blue-300',
  },
  purple: {
    dot: 'bg-purple-600 dark:bg-purple-400',
    badge: 'COGNITIVE & UX',
    sectionBg: 'bg-purple-500/[0.03] dark:bg-purple-400/[0.02]',
    sectionBorder: 'border-zinc-400 dark:border-zinc-700',
    sectionHeader: 'text-purple-900 dark:text-purple-200',
    accentText: 'text-purple-700 dark:text-purple-300',
  },
  green: {
    dot: 'bg-emerald-600 dark:bg-emerald-400',
    badge: 'TELEMETRY & DATA',
    sectionBg: 'bg-emerald-500/[0.03] dark:bg-emerald-400/[0.02]',
    sectionBorder: 'border-zinc-400 dark:border-zinc-700',
    sectionHeader: 'text-emerald-900 dark:text-emerald-200',
    accentText: 'text-emerald-700 dark:text-emerald-300',
  },
  orange: {
    dot: 'bg-amber-600 dark:bg-amber-400',
    badge: 'GEOGRAPHIC MESH',
    sectionBg: 'bg-amber-500/[0.03] dark:bg-amber-400/[0.02]',
    sectionBorder: 'border-zinc-400 dark:border-zinc-700',
    sectionHeader: 'text-amber-900 dark:text-amber-200',
    accentText: 'text-amber-700 dark:text-amber-300',
  },
  yellow: {
    dot: 'bg-yellow-500',
    badge: 'SPECIFICATION',
    sectionBg: 'bg-yellow-500/[0.03] dark:bg-yellow-400/[0.02]',
    sectionBorder: 'border-zinc-400 dark:border-zinc-700',
    sectionHeader: 'text-yellow-900 dark:text-yellow-200',
    accentText: 'text-yellow-700 dark:text-yellow-300',
  },
  red: {
    dot: 'bg-rose-600 dark:bg-rose-400',
    badge: 'CRITICAL PIPELINE',
    sectionBg: 'bg-rose-500/[0.03] dark:bg-rose-400/[0.02]',
    sectionBorder: 'border-zinc-400 dark:border-zinc-700',
    sectionHeader: 'text-rose-900 dark:text-rose-200',
    accentText: 'text-rose-700 dark:text-rose-300',
  },
  gray: {
    dot: 'bg-zinc-500',
    badge: 'INFRASTRUCTURE',
    sectionBg: 'bg-zinc-500/[0.03] dark:bg-zinc-400/[0.02]',
    sectionBorder: 'border-zinc-400 dark:border-zinc-700',
    sectionHeader: 'text-zinc-800 dark:text-zinc-200',
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
  isResizingThisCard = false,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(card.title);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [contentInput, setContentInput] = useState(card.content || '');
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

  const handleContentSubmit = () => {
    setIsEditingContent(false);
    onUpdateCard(card.id, { content: contentInput, updatedAt: Date.now() });
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
      const cleanToken = token.trim().replace(/^[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]$/g, '');
      const isLocation = Boolean(KNOWN_LOCATIONS[cleanToken.toLowerCase()]);

      if (isLocation) {
        return (
          <span
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              if (onLocationClick) onLocationClick(cleanToken, card);
            }}
            className="inline-flex items-center gap-0.5 text-orange-600 dark:text-orange-400 font-semibold hover:underline cursor-pointer bg-orange-500/10 px-1 py-0.2 rounded-xs transition-colors"
            title={`Open live satellite map for ${cleanToken}`}
          >
            <MapPin className="w-2.5 h-2.5 text-orange-500 inline shrink-0" />
            {token}
          </span>
        );
      }
      return token;
    });
  };

  // -------------------------------------------------------------
  // INLINE VISUALIZATIONS
  // -------------------------------------------------------------
  const renderSparkline = (data: number[]) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const w = 48;
    const h = 12;
    const points = data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / range) * (h - 2) - 1;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <div className="flex items-center gap-1 shrink-0" title="Telemetry sparkline trend">
        <svg className="w-12 h-3 overflow-visible" viewBox={`0 0 ${w} ${h}`}>
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
            className="text-orange-500 dark:text-orange-400"
          />
        </svg>
      </div>
    );
  };

  const renderDistribution = (data: number[]) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data) || 1;
    return (
      <div className="flex items-end gap-0.5 h-3 shrink-0" title="Latency distribution">
        {data.map((val, idx) => (
          <div
            key={idx}
            className="w-1 bg-zinc-400 dark:bg-zinc-500 rounded-xs transition-all"
            style={{ height: `${Math.max(2, Math.round((val / max) * 11))}px` }}
          />
        ))}
      </div>
    );
  };

  const renderConfidenceMark = (score: number) => {
    const isHigh = score >= 80;
    return (
      <div
        className={`flex items-center gap-1 font-mono text-[9px] font-semibold ${
          isHigh ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
        }`}
        title={`Confidence level: ${score}%`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        <span>{score}% conf</span>
      </div>
    );
  };

  // -------------------------------------------------------------
  // SECTION CLUSTERS
  // -------------------------------------------------------------
  if (isSection) {
    return (
      <div
        id={`card-${card.id}`}
        style={{
          transform: `translate3d(${card.x}px, ${card.y}px, 0)`,
          width: `${card.width}px`,
          height: `${card.height}px`,
          zIndex: 5,
        }}
        onClick={onSelect}
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button, input, textarea, a')) return;
          onStartDrag(e, card.id);
        }}
        className={`absolute rounded-lg border border-dashed select-none group transition-[border-color,box-shadow] duration-100 ${
          theme.sectionBorder
        } ${theme.sectionBg} ${
          isSelected ? 'selection-halo border-zinc-800 dark:border-zinc-200' : 'hover:border-zinc-600 dark:hover:border-zinc-400'
        }`}
      >
        {/* Section Header */}
        <div className="flex items-center justify-between px-3 py-1.5 cursor-grab active:cursor-grabbing border-b border-black/[0.04] dark:border-white/[0.04]">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`w-2 h-2 rounded-xs shrink-0 ${theme.dot}`} />
            {isEditingTitle ? (
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                  if (e.key === 'Escape') {
                    setTitleInput(card.title);
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                className="bg-transparent text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none w-full border-b border-orange-500 font-sans"
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
                className={`text-xs font-bold uppercase tracking-wider truncate cursor-text ${theme.sectionHeader}`}
              >
                {card.title}
              </span>
            )}
            <Badge size="xs" variant="outline" color="gray" className="font-mono text-[9px] uppercase tracking-wider">
              {theme.badge}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEditingTitle(true)}
              title="Edit Section Title"
              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDeleteCard(card.id)}
              title="Delete Section"
              className="p-1 text-zinc-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {card.content && (
          <div className="px-3 py-1 text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2 font-mono font-medium">
            {card.content}
          </div>
        )}

        {/* Section Resize Handles */}
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartResize(e, card.id, 'se');
          }}
          className={`absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 z-30 transition-opacity ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          title="Resize Section"
        >
          <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-zinc-700 dark:border-zinc-300" />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // CONTENT-AWARE CARD SHAPES & EDITORIAL TYPOGRAPHY
  // -------------------------------------------------------------
  const renderCardBody = () => {
    // Ultra-compact summary only at extreme zoom-out (< 0.28)
    if (zoom < 0.28) {
      return (
        <div className="h-full flex flex-col justify-between py-0.5 overflow-hidden">
          <div className="font-bold text-[11px] text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">
            {card.title}
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 pt-0.5">
            <span className="uppercase font-semibold text-orange-600 dark:text-orange-400">
              {card.type}
            </span>
            {card.inlineMetrics?.metricValue && (
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                {card.inlineMetrics.metricValue}
              </span>
            )}
          </div>
        </div>
      );
    }

    // 1. DATA GRID / TABLE
    if (card.type === 'datagrid' || card.type === 'table') {
      return (
        <div className="h-full w-full overflow-hidden -mx-2 -my-1 flex flex-col">
          <CompactDataGrid
            dataGrid={card.dataGridData}
            tableData={card.tableData}
            title={card.title}
            isCompact={true}
            isEditable={true}
            onUpdate={(updated) => {
              onUpdateCard(card.id, {
                ...updated,
                updatedAt: Date.now(),
              });
            }}
            onInteractiveTextClick={(text) => {
              if (onLocationClick) onLocationClick(text, card);
            }}
          />
        </div>
      );
    }

    // 2. QUOTATION (Editorial serif italic with attribution)
    if (card.type === 'quotation') {
      return (
        <div className="flex flex-col justify-between h-full py-0.5">
          <div className="relative pl-2.5 border-l-2 border-orange-500/70 dark:border-orange-400/80">
            <span className="absolute -left-1.5 -top-2.5 text-2xl font-serif text-zinc-300 dark:text-zinc-700 select-none">
              “
            </span>
            <blockquote className="font-serif italic text-zinc-800 dark:text-zinc-200 text-xs leading-snug select-text line-clamp-4">
              {card.content}
            </blockquote>
          </div>
          {zoom >= 0.65 && (
            <div className="flex items-center justify-between pt-1 mt-1 border-t border-zinc-200/60 dark:border-zinc-800/80 text-[10px]">
              <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
                — {card.attribution?.speaker || 'Primary Source'}
              </span>
              {card.attribution?.source && (
                <span className="font-mono text-[9px] text-zinc-400 truncate max-w-[120px]">
                  {card.attribution.source}
                </span>
              )}
            </div>
          )}
        </div>
      );
    }

    // 3. PERSON (Actor card with avatar initials and role badge)
    if (card.type === 'person') {
      return (
        <div className="flex flex-col justify-between h-full py-0.5">
          <div className="flex items-center gap-2 pb-1 border-b border-zinc-200/70 dark:border-zinc-800">
            <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center font-mono font-bold text-[10px] text-zinc-700 dark:text-zinc-300 shrink-0">
              {card.attribution?.avatar || card.title.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {card.title}
              </div>
              <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider truncate">
                {card.attribution?.role || 'Contributor'}
              </div>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Active state" />
          </div>
          <div className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-tight line-clamp-3 py-1 font-sans">
            {card.content}
          </div>
        </div>
      );
    }

    // 4. DECISION (Architectural Decision Record)
    if (card.type === 'decision') {
      const outcome = card.decisionData?.outcome || 'proposed';
      return (
        <div className="flex flex-col justify-between h-full py-0.5">
          <div className="flex items-center justify-between pb-1 border-b border-zinc-200/70 dark:border-zinc-800">
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                outcome === 'approved'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : outcome === 'rejected'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              }`}
            >
              {outcome}
            </span>
            {card.decisionData?.impact && (
              <span className="font-mono text-[9px] text-zinc-400 truncate max-w-[120px]">
                {card.decisionData.impact}
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-800 dark:text-zinc-200 py-1 font-medium leading-snug line-clamp-3">
            {card.content}
          </div>
          {card.decisionData?.rationale && zoom >= 0.65 && (
            <div className="bg-zinc-100/70 dark:bg-black/40 rounded p-1 text-[9px] text-zinc-500 dark:text-zinc-400 font-mono line-clamp-2">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Rationale: </span>
              {card.decisionData.rationale}
            </div>
          )}
        </div>
      );
    }

    // 5. EVIDENCE (Empirical finding with confidence mark and dataset citation)
    if (card.type === 'evidence') {
      return (
        <div className="flex flex-col justify-between h-full py-0.5">
          <div className="flex items-center justify-between pb-1 border-b border-zinc-200/70 dark:border-zinc-800">
            <span className="font-mono text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
              EMPIRICAL EVIDENCE
            </span>
            {card.evidenceData && renderConfidenceMark(card.evidenceData.confidence)}
          </div>
          <div className="text-[11px] text-zinc-800 dark:text-zinc-200 font-sans py-1 leading-snug line-clamp-3">
            {card.content}
          </div>
          {zoom >= 0.65 && (
            <div className="flex items-center justify-between pt-1 border-t border-zinc-200/70 dark:border-zinc-800 text-[9px] font-mono text-zinc-400">
              <span>{card.evidenceData?.doiOrCitation || 'Dataset'}</span>
              {card.evidenceData?.sampleSize && <span>N = {card.evidenceData.sampleSize}</span>}
            </div>
          )}
        </div>
      );
    }

    // 6. TIMELINE (Milestone progress)
    if (card.type === 'timeline') {
      return (
        <div className="flex flex-col justify-between h-full py-0.5">
          <div className="flex items-center justify-between pb-1 border-b border-zinc-200/70 dark:border-zinc-800">
            <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[9px] font-bold text-zinc-700 dark:text-zinc-300">
              {card.timelineData?.date || 'MILESTONE'}
            </span>
            <span className="font-mono text-[9px] text-orange-600 dark:text-orange-400 uppercase font-semibold">
              {card.timelineData?.phase || 'Target'}
            </span>
          </div>
          <div className="text-[11px] text-zinc-800 dark:text-zinc-200 py-1 leading-snug line-clamp-3">
            {card.content}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-400">
            <span className="text-emerald-500">●</span>
            <span className="truncate">{card.timelineData?.milestone || 'Key milestone checkpoint'}</span>
          </div>
        </div>
      );
    }

    // 7. QUESTION / HYPOTHESIS
    if (card.type === 'question') {
      return (
        <div className="flex flex-col justify-between h-full py-0.5">
          <div className="flex items-center gap-1.5 pb-1 border-b border-zinc-200/70 dark:border-zinc-800">
            <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-mono font-bold text-[10px]">
              ?
            </span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              OPEN HYPOTHESIS
            </span>
          </div>
          <div className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 py-1 leading-snug italic line-clamp-3">
            “{card.content}”
          </div>
          <div className="text-[9px] font-mono text-zinc-400">Verification in progress</div>
        </div>
      );
    }

    // 8. DOCUMENT
    if (card.type === 'document' || card.type === 'pdf') {
      return (
        <div className="flex flex-col justify-between h-full py-0.5">
          <div className="flex items-center justify-between pb-1 border-b border-zinc-200/70 dark:border-zinc-800">
            <span className="font-mono text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1 py-0.2 rounded">
              {card.fileMetadata?.mimeType?.split('/')[1]?.toUpperCase() || 'SPEC'}
            </span>
            <span className="font-mono text-[9px] text-zinc-400">
              {card.fileMetadata?.pageCount ? `${card.fileMetadata.pageCount} pages` : 'Document'}
            </span>
          </div>
          <div className="text-[11px] text-zinc-700 dark:text-zinc-300 py-1 leading-tight line-clamp-3">
            {card.content}
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-zinc-200/70 dark:border-zinc-800 text-[9px] font-mono text-zinc-400">
            <span>{formatBytes(card.fileMetadata?.size || 14200)}</span>
            <span className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer">Open Spec →</span>
          </div>
        </div>
      );
    }

    // 9. MAP
    if (card.type === 'map') {
      return (
        <div className="h-full flex flex-col justify-between">
          <div className="flex-1 relative rounded overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-[#1b1c22] map-embed-frame">
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
              className="w-full h-full contrast-105 pointer-events-none map-embed-iframe"
            />
            <div className="absolute top-1 left-1 bg-[var(--card-bg-elevated)]/95 dark:bg-black/90 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] font-mono text-zinc-900 dark:text-zinc-100 flex items-center gap-1 shadow-xs border border-zinc-300 dark:border-zinc-700">
              <Navigation className="w-2 h-2 text-sky-500" />
              <span>{card.mapData?.locationName || card.title}</span>
            </div>
          </div>
          {card.content && (
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
              {card.content}
            </div>
          )}
        </div>
      );
    }

    // 10. IMAGE
    if (card.type === 'image') {
      return (
        <div className="h-full flex flex-col items-center justify-center overflow-hidden rounded bg-zinc-50 dark:bg-black/40 relative">
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
      );
    }

    // 11. CODE
    if (card.type === 'code') {
      return (
        <div className="h-full flex flex-col rounded bg-zinc-950 dark:bg-black text-zinc-200 font-mono text-[10px] p-2 overflow-hidden border border-zinc-800">
          <div className="flex items-center justify-between pb-0.5 mb-1 text-[8px] text-zinc-400 uppercase border-b border-zinc-800">
            <span>{card.codeLanguage || 'TYPESCRIPT'}</span>
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
      );
    }

    // DEFAULT CONCEPT / NOTE
    return (
      <div className="flex flex-col justify-between h-full py-0.5">
        <div className="text-[11px] text-zinc-800 dark:text-zinc-200 leading-snug font-sans line-clamp-4 select-text">
          {renderInteractiveText(card.content)}
        </div>

        {/* Inline visualization footer if metrics exist */}
        {card.inlineMetrics && (
          <div className="flex items-center justify-between pt-1 mt-1 border-t border-zinc-200/70 dark:border-zinc-800">
            <span className="font-mono text-[9px] text-zinc-500 uppercase">
              {card.inlineMetrics.metricLabel || 'Signal'}
            </span>
            <div className="flex items-center gap-2">
              {card.inlineMetrics.sparkline && renderSparkline(card.inlineMetrics.sparkline)}
              {card.inlineMetrics.distribution && renderDistribution(card.inlineMetrics.distribution)}
              {card.inlineMetrics.metricValue && (
                <span className="font-mono text-[10px] font-bold text-zinc-900 dark:text-zinc-100">
                  {card.inlineMetrics.metricValue}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------
  // RENDER COMPACT CARD WITH MINIMAL DARK GREY BORDERS & RESTRAINED HALO
  // -------------------------------------------------------------
  return (
    <div
      id={`card-${card.id}`}
      style={{
        transform: `translate3d(${card.x}px, ${card.y}px, 0)`,
        width: `${card.width}px`,
        height: `${card.height}px`,
        zIndex: isSelected ? 25 : 10,
      }}
      onClick={onSelect}
      onDoubleClick={() => {
        if (!isEditingContent) onOpenDetail(card);
      }}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, textarea, audio, video, a, select, table')) return;
        onStartDrag(e, card.id);
      }}
      onMouseUp={() => {
        if (isConnecting && onEndConnect) {
          onEndConnect(card.id);
        }
      }}
      className={`absolute rounded-md border select-none group flex flex-col surface-card-artifact bg-[var(--card-bg)] text-[var(--text-primary)] transition-all duration-100 ${
        isSpotlight
          ? 'card-spotlight'
          : isSelected
          ? 'selection-halo border-zinc-800 dark:border-zinc-200'
          : 'border-zinc-300 dark:border-zinc-700/80 hover:border-zinc-500 dark:hover:border-zinc-500 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
      }`}
    >
      {/* ======================================================= */}
      {/* COMMAND SURFACE: Controls appear near the selected object */}
      {/* ======================================================= */}
      {isSelected && (
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-[#18191e]/95 backdrop-blur-md border border-zinc-300 dark:border-zinc-700 shadow-md rounded-md px-1.5 py-0.5 flex items-center gap-1 z-40 animate-in fade-in zoom-in-95 duration-100 select-none text-[10px] pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Change Type Menu */}
          <Menu shadow="md" width={150}>
            <Menu.Target>
              <button
                className="px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-mono text-[9px] uppercase tracking-wider font-semibold flex items-center gap-1"
                title="Change card structure"
              >
                <span>{card.type}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
            </Menu.Target>
            <Menu.Dropdown className="text-xs">
              <Menu.Label className="font-mono text-[9px] uppercase tracking-wider">Card Structure</Menu.Label>
              <Menu.Item onClick={() => onUpdateCard(card.id, { type: 'note' })}>Note Card</Menu.Item>
              <Menu.Item onClick={() => onUpdateCard(card.id, { type: 'concept' })}>Concept (Tenets)</Menu.Item>
              <Menu.Item onClick={() => onUpdateCard(card.id, { type: 'decision' })}>Decision (Record)</Menu.Item>
              <Menu.Item onClick={() => onUpdateCard(card.id, { type: 'evidence' })}>Evidence (Empirical)</Menu.Item>
              <Menu.Item onClick={() => onUpdateCard(card.id, { type: 'quotation' })}>Quotation (Editorial)</Menu.Item>
              <Menu.Item onClick={() => onUpdateCard(card.id, { type: 'question' })}>Question (Hypothesis)</Menu.Item>
              <Menu.Item onClick={() => onUpdateCard(card.id, { type: 'timeline' })}>Timeline (Milestones)</Menu.Item>
              <Menu.Item onClick={() => onUpdateCard(card.id, { type: 'person' })}>Person (Actor)</Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <span className="w-[1px] h-3 bg-zinc-300 dark:bg-zinc-700" />

          {/* Quick Connect Handle */}
          <Tooltip label="Drag to link another card">
            <button
              onMouseDown={(e) => onStartConnect(e, card.id)}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300 transition-colors"
            >
              <Link2 className="w-3 h-3 text-orange-500" />
            </button>
          </Tooltip>

          {/* Duplicate */}
          <Tooltip label="Duplicate card">
            <button
              onClick={() => onDuplicateCard(card)}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300 transition-colors"
            >
              <Copy className="w-3 h-3" />
            </button>
          </Tooltip>

          {/* Full Reader */}
          <Tooltip label="Inspect Reader Modal">
            <button
              onClick={() => onOpenDetail(card)}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300 transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </Tooltip>

          {/* Delete */}
          <Tooltip label="Remove card">
            <button
              onClick={() => onDeleteCard(card.id)}
              className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </Tooltip>
        </div>
      )}

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
            className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-[10px] font-medium rounded shadow-md border border-zinc-700 hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
          >
            <Sparkles className="w-2.5 h-2.5 text-orange-400 dark:text-orange-600" />
            <span>Drill down</span>
          </button>
        </div>
      )}

      {/* ======================================================= */}
      {/* EDITORIAL CARD HEADER: Compact with distinct hierarchy */}
      {/* ======================================================= */}
      <div className="flex items-center justify-between px-2 py-1 cursor-grab active:cursor-grabbing border-b border-zinc-200 dark:border-zinc-800/90 bg-zinc-50/70 dark:bg-[var(--card-bg-elevated)] shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme.dot}`} />
          
          {isEditingTitle ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                  if (e.key === 'Escape') {
                    setTitleInput(card.title);
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                className="bg-transparent text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 outline-none w-full border-b border-orange-500 font-sans"
              />
              <button onClick={handleTitleSubmit} className="text-orange-500 hover:text-orange-600">
                <Check className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
              title={`${card.title} (Double click to edit title)`}
              className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 truncate cursor-text tracking-tight"
            >
              {card.title}
            </span>
          )}
        </div>

        {/* Minimal Header Utility Icons */}
        <div className="flex items-center gap-0.5 ml-1 shrink-0">
          {card.pinned && <Pin className="w-2.5 h-2.5 text-orange-500 fill-orange-500" />}

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isEditingContent) {
                handleContentSubmit();
              } else {
                setContentInput(card.content || '');
                setIsEditingContent(true);
              }
            }}
            className={`p-0.5 rounded transition-colors ${
              isEditingContent 
                ? 'text-orange-500 bg-orange-500/10' 
                : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
            title={isEditingContent ? 'Save edits' : 'Edit content'}
          >
            {isEditingContent ? <Check className="w-2.5 h-2.5" /> : <Pencil className="w-2.5 h-2.5" />}
          </button>

          {/* Color Switcher */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-0.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded"
              title="Options"
            >
              <MoreHorizontal className="w-2.5 h-2.5" />
            </button>

            {showMenu && (
              <div 
                className="absolute right-0 mt-1 w-36 bg-white dark:bg-[#16171c] border border-zinc-300 dark:border-zinc-700 shadow-xl rounded-md py-1 z-50 text-[10px]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        onUpdateCard(card.id, { color: c });
                        setShowMenu(false);
                      }}
                      className={`w-3 h-3 rounded-full border ${
                        c === 'blue'
                          ? 'bg-blue-500 border-blue-600'
                          : c === 'green'
                          ? 'bg-emerald-500 border-emerald-600'
                          : c === 'orange'
                          ? 'bg-amber-500 border-amber-600'
                          : c === 'yellow'
                          ? 'bg-yellow-400 border-yellow-500'
                          : c === 'purple'
                          ? 'bg-purple-500 border-purple-600'
                          : c === 'red'
                          ? 'bg-rose-500 border-rose-600'
                          : 'bg-zinc-400 border-zinc-500'
                      }`}
                    />
                  ))}
                </div>

                <div className="py-0.5">
                  <button
                    onClick={() => {
                      setIsEditingTitle(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"
                  >
                    <Pencil className="w-2.5 h-2.5 text-zinc-400" /> Edit Title
                  </button>

                  <button
                    onClick={() => {
                      onUpdateCard(card.id, { pinned: !card.pinned });
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"
                  >
                    <Pin className="w-2.5 h-2.5 text-zinc-400" /> {card.pinned ? 'Unpin' : 'Pin Position'}
                  </button>

                  {onPredictiveAction && (
                    <>
                      <button
                        onClick={() => {
                          onPredictiveAction('find_relations', card);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"
                      >
                        <Network className="w-2.5 h-2.5 text-blue-500" /> Connect Similar
                      </button>

                      <button
                        onClick={() => {
                          onPredictiveAction('trace_evidence', card);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"
                      >
                        <ShieldCheck className="w-2.5 h-2.5 text-emerald-500" /> Trace Evidence
                      </button>

                      <button
                        onClick={() => {
                          onPredictiveAction('find_contradictions', card);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"
                      >
                        <AlertTriangle className="w-2.5 h-2.5 text-rose-500" /> Contradictions
                      </button>
                    </>
                  )}
                </div>

                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-0.5">
                  <button
                    onClick={() => {
                      onDuplicateCard(card);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200"
                  >
                    <Copy className="w-2.5 h-2.5 text-zinc-400" /> Duplicate
                  </button>

                  <button
                    onClick={() => {
                      onDeleteCard(card.id);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5 text-rose-600 dark:text-rose-400"
                  >
                    <Trash2 className="w-2.5 h-2.5" /> Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================= */}
      {/* DENSE CARD CONTENT: Compact Text & Minimal Whitespace */}
      {/* ======================================================= */}
      <div 
        onMouseUp={handleContentMouseUp}
        className="flex-1 overflow-hidden px-2 py-1.5 text-[11px] text-zinc-700 dark:text-zinc-300 flex flex-col justify-between"
      >
        {isEditingContent ? (
          <div className="h-full flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
            <textarea
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              className="flex-1 w-full bg-zinc-50 dark:bg-black/40 border border-orange-500 rounded p-1 text-xs text-zinc-900 dark:text-zinc-100 outline-none resize-none font-mono"
              placeholder="Edit card content..."
              autoFocus
            />
            <div className="flex items-center justify-between text-[9px] shrink-0">
              <span className="text-zinc-400 font-mono">Editing content</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsEditingContent(false)}
                  className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleContentSubmit}
                  className="px-1.5 py-0.5 rounded bg-orange-500 text-white font-medium flex items-center gap-1 hover:bg-orange-600"
                >
                  <Check className="w-2.5 h-2.5" /> Save
                </button>
              </div>
            </div>
          </div>
        ) : (
          renderCardBody()
        )}
      </div>

      {/* ======================================================= */}
      {/* CARD FOOTER: Compact metadata tags and link port */}
      {/* ======================================================= */}
      {zoom >= 0.65 && card.tags && card.tags.length > 0 && (
        <div className="px-2 py-0.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[9px] text-zinc-400 font-mono shrink-0">
          <div className="flex items-center gap-1 overflow-hidden">
            {card.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                #{tag}
              </span>
            ))}
            {card.tags.length > 3 && <span>+{card.tags.length - 3}</span>}
          </div>
          <span className="text-[8px] uppercase tracking-wider text-zinc-400">
            {card.type}
          </span>
        </div>
      )}

      {/* Interactive connection port handle (right edge) */}
      <div
        onMouseDown={(e) => onStartConnect(e, card.id)}
        className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-30"
        title="Drag to connect"
      >
        <div className="w-2 h-2 rounded-full bg-orange-500 border border-white dark:border-zinc-900 shadow-xs" />
      </div>

      {/* Card Resize Handle (Bottom-Right) */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartResize(e, card.id, 'se');
        }}
        className={`absolute bottom-0 right-0 w-3 h-3 cursor-se-resize flex items-end justify-end p-0.5 z-20 transition-opacity ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        title="Resize Card"
      >
        <div className="w-1.5 h-1.5 border-r border-b border-zinc-500 dark:border-zinc-400" />
      </div>
    </div>
  );
};
