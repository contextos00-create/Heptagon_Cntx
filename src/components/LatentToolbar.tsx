import React from 'react';
import { 
  Eye, 
  EyeOff, 
  Layers, 
  AlertTriangle, 
  FileCheck2, 
  GitMerge, 
  Sliders, 
  Play, 
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  MapPin,
  Clock,
  LayoutGrid
} from 'lucide-react';
import { SegmentedControl, Badge, Tooltip, Button } from '@mantine/core';
import { 
  LatentEngineState, 
  ComputationalViewMode, 
  SemanticZoomLevel 
} from '../types/latentIntelligence';
import { SurfaceCard, Connection } from '../types/surface';

interface LatentToolbarProps {
  engineState: LatentEngineState;
  zoomLevel: SemanticZoomLevel;
  cards: SurfaceCard[];
  connections: Connection[];
  onToggleLatentLayer: () => void;
  onChangeViewMode: (mode: ComputationalViewMode) => void;
  onChangeGrouping: (criterion: LatentEngineState['dynamicGroupingCriterion']) => void;
  onScrubTimeline: (val: number) => void;
  onAcceptSuggestedConnection: (conn: Connection) => void;
  onDismissSuggestedConnection: (id: string) => void;
  onFocusCard: (cardId: string) => void;
  onOpenContradictionDetail?: (contraId: string) => void;
}

export const LatentToolbar: React.FC<LatentToolbarProps> = ({
  engineState,
  zoomLevel,
  cards,
  connections,
  onToggleLatentLayer,
  onChangeViewMode,
  onChangeGrouping,
  onScrubTimeline,
  onAcceptSuggestedConnection,
  onDismissSuggestedConnection,
  onFocusCard,
}) => {
  const { 
    isLatentLayerActive, 
    activeViewMode, 
    contradictions, 
    suggestedMissingConnections,
    dynamicGroupingCriterion,
    timelineScrubTimestamp 
  } = engineState;

  const unresolvedContradictions = contradictions.filter(c => !c.resolved);

  return (
    <div className="absolute bottom-3 inset-x-4 pointer-events-none flex flex-col items-center gap-2 z-30 select-none">
      
      {/* Dynamic Ambient Insights Pill when Latent Layer is Active */}
      {isLatentLayerActive && (
        <div className="pointer-events-auto bg-zinc-950/95 dark:bg-black/95 text-white border border-orange-500/40 shadow-2xl rounded-lg p-2.5 max-w-4xl w-full flex flex-col gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
          
          <div className="flex items-center justify-between text-xs border-b border-zinc-800 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="font-semibold text-orange-400 font-mono tracking-tight text-[11px] uppercase">
                Latent Computational Layer Active
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                [Space is Data • Zoom: <Badge size="xs" variant="filled" color="orange" className="font-mono text-[9px] uppercase px-1">{zoomLevel}</Badge>]
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <Badge variant="light" color="red" size="sm" leftSection={<AlertTriangle className="w-2.5 h-2.5" />}>
                {unresolvedContradictions.length} Contradictions
              </Badge>
              <Badge variant="light" color="blue" size="sm" leftSection={<Sparkles className="w-2.5 h-2.5" />}>
                {suggestedMissingConnections.length} Latent Links
              </Badge>
            </div>
          </div>

          {/* Quick Latent Intelligence Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            {/* Contradiction Detection */}
            {unresolvedContradictions.length > 0 ? (
              <div className="bg-rose-950/30 border border-rose-800/40 rounded p-1.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between font-medium text-rose-300 mb-0.5 text-[10px]">
                    <span className="flex items-center gap-1 font-mono uppercase">
                      <AlertTriangle className="w-2.5 h-2.5" /> Outdated Assumption / Conflict
                    </span>
                    <Badge variant="outline" color="red" size="xs">HIGH SEV</Badge>
                  </div>
                  <div className="text-zinc-300 text-[10px] leading-snug">
                    {unresolvedContradictions[0].reason}
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between pt-1 border-t border-rose-900/30">
                  <span className="text-[9px] text-zinc-400 font-mono">
                    Cards: {unresolvedContradictions[0].cardAId} vs {unresolvedContradictions[0].cardBId}
                  </span>
                  <button
                    onClick={() => onFocusCard(unresolvedContradictions[0].cardAId)}
                    className="text-[10px] text-rose-300 hover:text-white flex items-center gap-0.5"
                  >
                    <span>Inspect</span> <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded p-2 text-zinc-400 text-[10px] flex items-center gap-2">
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>No logical contradictions found across active claims and telemetry tables.</span>
              </div>
            )}

            {/* Ambient Missing Connection Suggestion */}
            {suggestedMissingConnections.length > 0 ? (
              <div className="bg-blue-950/30 border border-blue-800/40 rounded p-1.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between font-medium text-blue-300 mb-0.5 text-[10px]">
                    <span className="flex items-center gap-1 font-mono uppercase">
                      <Sparkles className="w-2.5 h-2.5" /> Ambient AI: Missing Relationship
                    </span>
                    <Badge variant="outline" color="blue" size="xs">
                      {Math.round((suggestedMissingConnections[0].confidence || 0.88) * 100)}% CONF
                    </Badge>
                  </div>
                  <div className="text-zinc-300 text-[10px] leading-snug">
                    {suggestedMissingConnections[0].notes || `Relationship "${suggestedMissingConnections[0].label}" detected via spatial and semantic co-occurrence.`}
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-end gap-1.5 pt-1 border-t border-blue-900/30">
                  <button
                    onClick={() => onDismissSuggestedConnection(suggestedMissingConnections[0].id)}
                    className="text-[10px] text-zinc-400 hover:text-zinc-200 px-1 py-0.5"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => onAcceptSuggestedConnection(suggestedMissingConnections[0])}
                    className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium px-2 py-0.5 rounded shadow-xs"
                  >
                    Connect
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded p-2 text-zinc-400 text-[10px] flex items-center gap-2">
                <GitMerge className="w-3.5 h-3.5 text-blue-400" />
                <span>All strong latent relationships materialized on surface.</span>
              </div>
            )}
          </div>

          {/* Temporal Knowledge Scrub Slider */}
          <div className="flex items-center gap-2 pt-1 border-t border-zinc-800 text-[10px] text-zinc-400">
            <span className="flex items-center gap-1 shrink-0 font-mono text-zinc-300">
              <Clock className="w-2.5 h-2.5 text-orange-400" /> Temporal Scrub:
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={timelineScrubTimestamp}
              onChange={(e) => onScrubTimeline(Number(e.target.value))}
              className="flex-1 accent-orange-500 cursor-pointer h-1 bg-zinc-800 rounded"
            />
            <span className="font-mono text-orange-300 shrink-0 text-[10px]">
              {timelineScrubTimestamp === 100 ? 'Present (Latest)' : `T - ${100 - timelineScrubTimestamp}d (Historical)`}
            </span>
            {timelineScrubTimestamp < 100 && (
              <button
                onClick={() => onScrubTimeline(100)}
                className="text-[9px] text-zinc-400 hover:text-white underline font-mono ml-1"
              >
                Reset
              </button>
            )}
          </div>

        </div>
      )}

      {/* Main Latent Mode Controls Bar with Mantine SegmentedControl */}
      <div className="pointer-events-auto flex items-center gap-1.5 p-1 bg-white/95 dark:bg-[#121316]/95 border border-black/15 dark:border-white/15 rounded-lg shadow-lg backdrop-blur-md text-xs max-w-[calc(100vw-16px)] overflow-x-auto">
        
        {/* Toggle Latent Computational Layer ("Show me what I'm not seeing") */}
        <Tooltip label="Toggle Latent Computational Layer: Reveal invisible connections, territory themes, and contradictions">
          <button
            onClick={onToggleLatentLayer}
            className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-all text-xs shrink-0 ${
              isLatentLayerActive
                ? 'bg-orange-500 text-white shadow-xs font-semibold'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {isLatentLayerActive ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
            <span className="hidden sm:inline">Show me what I'm not seeing</span>
            <span className="sm:hidden font-mono text-[11px]">Latent</span>
          </button>
        </Tooltip>

        <span className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 shrink-0" />

        {/* Mantine SegmentedControl for Multiple Computational Views */}
        <div className="shrink-0">
          <SegmentedControl
            size="xs"
            radius="sm"
            value={activeViewMode}
            onChange={(value) => onChangeViewMode(value as ComputationalViewMode)}
            data={[
              { label: 'Board', value: 'whiteboard' },
              { label: 'Graph', value: 'graph' },
              { label: 'Timeline', value: 'timeline' },
              { label: 'Deps', value: 'dependency' },
              { label: 'Evidence', value: 'evidence' },
            ]}
          />
        </div>

        <span className="hidden sm:block w-px h-4 bg-zinc-300 dark:bg-zinc-700 shrink-0" />

        {/* Dynamic Grouping Trigger */}
        <div className="hidden sm:flex items-center gap-1 text-[11px] shrink-0">
          <span className="text-zinc-400 font-mono">Group:</span>
          <select
            value={dynamicGroupingCriterion}
            onChange={(e) => onChangeGrouping(e.target.value as any)}
            className="bg-transparent text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 outline-none font-mono text-[10px]"
          >
            <option value="none">Original Space</option>
            <option value="ontology">By Ontology</option>
            <option value="confidence">By Confidence</option>
            <option value="time">By Evolution Time</option>
            <option value="contradiction">By Contradiction</option>
          </select>
        </div>

      </div>

    </div>
  );
};
