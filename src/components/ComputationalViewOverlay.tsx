import React from 'react';
import { 
  Network, 
  Clock, 
  Layers, 
  FileCheck, 
  ArrowRight, 
  Maximize2,
  AlertTriangle,
  GitBranch,
  ShieldCheck
} from 'lucide-react';
import { SurfaceCard, Connection } from '../types/surface';
import { 
  ComputationalViewMode, 
  DetectedContradiction, 
  ProvenanceTrace, 
  SemanticConnection 
} from '../types/latentIntelligence';
import { enrichConnectionSemantics } from '../utils/latentEngine';

interface ComputationalViewOverlayProps {
  viewMode: ComputationalViewMode;
  cards: SurfaceCard[];
  connections: Connection[];
  contradictions: DetectedContradiction[];
  provenanceTraces: ProvenanceTrace[];
  onCloseView: () => void;
  onFocusCard: (cardId: string) => void;
}

export const ComputationalViewOverlay: React.FC<ComputationalViewOverlayProps> = ({
  viewMode,
  cards,
  connections,
  contradictions,
  provenanceTraces,
  onCloseView,
  onFocusCard,
}) => {
  if (viewMode === 'whiteboard') return null;

  const enrichedConns = connections.map(enrichConnectionSemantics);

  return (
    <div className="absolute inset-0 z-35 bg-white/95 dark:bg-[#0c0d10]/95 backdrop-blur-md flex flex-col animate-in fade-in duration-150 select-none">
      
      {/* View Header */}
      <div className="h-11 px-5 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {viewMode === 'graph' && <Network className="w-4 h-4 text-blue-500" />}
          {viewMode === 'timeline' && <Clock className="w-4 h-4 text-orange-500" />}
          {viewMode === 'dependency' && <GitBranch className="w-4 h-4 text-purple-500" />}
          {viewMode === 'arguments' && <AlertTriangle className="w-4 h-4 text-rose-500" />}
          {viewMode === 'evidence' && <FileCheck className="w-4 h-4 text-emerald-500" />}
          
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 uppercase font-mono">
            {viewMode === 'graph' && 'Relational Graph Network'}
            {viewMode === 'timeline' && 'Temporal Knowledge Evolution'}
            {viewMode === 'dependency' && 'Strict Dependency & Ingress Pipeline'}
            {viewMode === 'arguments' && 'Argument Mapping & Contradictions'}
            {viewMode === 'evidence' && 'Evidence Provenance & Verification Matrix'}
          </h2>
          <span className="text-[11px] text-zinc-400 font-mono">
            ({cards.length} entities • {connections.length} semantic connections)
          </span>
        </div>

        <button
          onClick={onCloseView}
          className="text-xs px-2.5 py-1 rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-medium hover:opacity-90"
        >
          Return to Whiteboard Surface
        </button>
      </div>

      {/* View Body */}
      <div className="flex-1 overflow-auto p-6">
        
        {/* 1. GRAPH VIEW */}
        {viewMode === 'graph' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <p className="text-xs text-zinc-500 font-mono">
              Graph-native topology mapped by semantic relationship weights and central cluster hubs.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cards.filter(c => c.type !== 'section').map(card => {
                const nodeConns = enrichedConns.filter(c => c.fromId === card.id || c.toId === card.id);
                return (
                  <div 
                    key={card.id} 
                    className="p-3 rounded-lg border-2 border-zinc-800 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{card.title}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">{card.type}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 line-clamp-2 mb-2">{card.content}</div>
                    </div>
                    
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                      <span className="text-[10px] font-mono text-zinc-400">{nodeConns.length} Relations:</span>
                      {nodeConns.slice(0, 3).map(cn => {
                        const otherId = cn.fromId === card.id ? cn.toId : cn.fromId;
                        const otherCard = cards.find(c => c.id === otherId);
                        return (
                          <div key={cn.id} className="text-[10px] flex items-center justify-between font-mono text-zinc-600 dark:text-zinc-300">
                            <span className="text-blue-500 font-semibold">{cn.semanticType || cn.label}</span>
                            <span className="truncate max-w-[120px]">{otherCard?.title || otherId}</span>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => {
                          onCloseView();
                          onFocusCard(card.id);
                        }}
                        className="mt-2 text-[10px] text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"
                      >
                        <span>Focus on canvas</span> <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. TIMELINE VIEW */}
        {viewMode === 'timeline' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <p className="text-xs text-zinc-500 font-mono">
              Temporal chronological progression of knowledge artifacts and historical evolution.
            </p>
            <div className="relative border-l-2 border-zinc-300 dark:border-zinc-700 ml-4 pl-6 space-y-6">
              {[...cards]
                .sort((a, b) => a.createdAt - b.createdAt)
                .map((card, idx) => (
                  <div key={card.id} className="relative group">
                    <span className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-orange-500 border-2 border-white dark:border-zinc-900" />
                    <div className="p-3 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-xs flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{card.title}</span>
                          <span className="text-[10px] font-mono text-orange-600 dark:text-orange-400">Step {idx + 1}</span>
                        </div>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 max-w-xl">{card.content}</p>
                      </div>
                      <button
                        onClick={() => {
                          onCloseView();
                          onFocusCard(card.id);
                        }}
                        className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium shrink-0 ml-4"
                      >
                        Locate
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 3. DEPENDENCY VIEW */}
        {viewMode === 'dependency' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <p className="text-xs text-zinc-500 font-mono">
              Directed dependency pipeline (upstream specifications driving downstream code and telemetry).
            </p>
            <div className="space-y-3">
              {enrichedConns.map((conn) => {
                const fromCard = cards.find(c => c.id === conn.fromId);
                const toCard = cards.find(c => c.id === conn.toId);
                return (
                  <div key={conn.id} className="p-3 rounded border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-mono text-zinc-400 uppercase">Upstream Dependency</div>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{fromCard?.title || conn.fromId}</div>
                      </div>
                      
                      <div className="flex flex-col items-center px-4">
                        <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold uppercase">{conn.semanticType || conn.label}</span>
                        <ArrowRight className="w-4 h-4 text-purple-500" />
                        <span className="text-[9px] text-zinc-400 font-mono">weight: {Math.round((conn.strength || 0.7) * 100)}%</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-mono text-zinc-400 uppercase">Downstream Consumer</div>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{toCard?.title || conn.toId}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onCloseView();
                        if (fromCard) onFocusCard(fromCard.id);
                      }}
                      className="ml-4 text-[10px] text-purple-600 dark:text-purple-400 hover:underline shrink-0"
                    >
                      View on surface
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. EVIDENCE & PROVENANCE VIEW */}
        {viewMode === 'evidence' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <p className="text-xs text-zinc-500 font-mono">
              Evidence Provenance Trace: Verify the origin, empirical data tables, and documents grounding every conclusion.
            </p>
            <div className="space-y-3">
              {provenanceTraces.map((trace) => {
                const targetCard = cards.find(c => c.id === trace.targetCardId);
                const evidenceCards = cards.filter(c => trace.evidenceCardIds.includes(c.id));
                return (
                  <div key={trace.id} className="p-3.5 rounded-lg border-2 border-emerald-900/60 dark:border-emerald-600/60 bg-emerald-500/[0.02] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{targetCard?.title}</span>
                      </div>
                      <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded font-bold">
                        {Math.round(trace.confidence * 100)}% Verified
                      </span>
                    </div>

                    <div className="text-xs text-zinc-700 dark:text-zinc-300 bg-white/60 dark:bg-black/40 p-2 rounded border border-black/5">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">Claim: </span>
                      {trace.claim}
                    </div>

                    <div className="text-[11px] text-zinc-500 font-mono">
                      <span>Method: {trace.derivationMethod}</span>
                    </div>

                    <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                        <span>Grounding Evidence:</span>
                        {evidenceCards.map(ec => (
                          <span key={ec.id} className="underline text-emerald-600 dark:text-emerald-400 font-semibold">{ec.title}</span>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          onCloseView();
                          onFocusCard(trace.targetCardId);
                        }}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
                      >
                        Inspect Claim
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
