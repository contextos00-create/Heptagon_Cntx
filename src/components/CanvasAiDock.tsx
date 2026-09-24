import React, { useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Settings2,
  Check,
  Trash2,
  Undo2,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge, Select, Tooltip, ActionIcon } from '@mantine/core';
import type { SurfaceCard, Whiteboard } from '../types/surface';
import {
  CANVAS_AI_QUICK_PROMPTS,
  type CanvasAiChatController,
} from '../ai/useCanvasAiChat';

interface CanvasAiDockProps {
  board: Whiteboard & { version?: number };
  chat: CanvasAiChatController;
  /** Offset above bottom control bars (LatentToolbar + status). */
  bottomOffsetPx?: number;
}

/**
 * Forever canvas chat composer — fixed to the viewport bottom-center,
 * above the latent/control bars. Transparent shell; transcript rises ~4in.
 * Shares LangGraph / CopilotKit canvas-ai controls via useCanvasAiChat.
 */
export const CanvasAiDock: React.FC<CanvasAiDockProps> = ({
  board,
  chat,
  bottomOffsetPx = 72,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const {
    messages,
    input,
    setInput,
    isRunning,
    models,
    modelProfileId,
    setModelProfileId,
    taskPreset,
    setTaskPreset,
    showSettings,
    setShowSettings,
    activeProposal,
    lastError,
    runState,
    activeModelLabel,
    expanded,
    setExpanded,
    selectedNoteIds,
    handleRun,
    handleApply,
    handleDiscard,
    handleUndo,
    handleCitationClick,
  } = chat;

  useEffect(() => {
    if (!expanded || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, expanded, activeProposal]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-40 flex justify-center px-3"
      style={{ bottom: bottomOffsetPx }}
      aria-label="Canvas AI forever composer"
    >
      <div className="pointer-events-auto w-full max-w-[640px] flex flex-col gap-1.5">
        {/* Rising transcript — ~4 inches (24rem), transparent */}
        {expanded && (
          <div className="relative rounded-xl border border-white/25 dark:border-white/10 bg-transparent backdrop-blur-[2px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/20 dark:border-white/10">
              <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                <span className="font-semibold truncate">Canvas AI</span>
                <span className="font-mono text-zinc-500 truncate">
                  {activeModelLabel}
                  {runState === 'running' ? ' · running' : ''}
                  {selectedNoteIds.length > 0 ? ` · ${selectedNoteIds.length} selected` : ''}
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip label="Model settings">
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={() => setShowSettings((v) => !v)}
                    aria-label="Model settings"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Undo last AI apply">
                  <ActionIcon variant="subtle" size="sm" onClick={handleUndo} aria-label="Undo">
                    <Undo2 className="w-3.5 h-3.5" />
                  </ActionIcon>
                </Tooltip>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => setExpanded(false)}
                  aria-label="Collapse transcript"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </ActionIcon>
              </div>
            </div>

            {showSettings && (
              <div className="px-3 py-2 border-b border-white/20 dark:border-white/10 space-y-2 bg-transparent">
                <Select
                  size="xs"
                  label="Model profile"
                  value={modelProfileId}
                  onChange={(v) => v && setModelProfileId(v)}
                  data={models.map((m) => ({ value: m.id, label: m.label }))}
                />
                <Select
                  size="xs"
                  label="Task preset"
                  value={taskPreset}
                  onChange={(v) => v && setTaskPreset(v as typeof taskPreset)}
                  data={[
                    { value: 'chat', label: 'Chat / Q&A' },
                    { value: 'synthesis', label: 'Synthesis' },
                    { value: 'layout', label: 'Layout' },
                    { value: 'extraction', label: 'Extraction' },
                  ]}
                />
              </div>
            )}

            {lastError && (
              <div className="px-3 py-1.5 text-[11px] text-amber-900 dark:text-amber-100 flex items-start gap-1.5 bg-amber-500/15">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{lastError}</span>
              </div>
            )}

            <div
              ref={scrollRef}
              className="px-3 py-2 overflow-y-auto space-y-2.5"
              style={{ maxHeight: '24rem' /* ~4 inches */ }}
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`text-[12px] leading-relaxed ${
                    m.role === 'user'
                      ? 'ml-6 rounded-lg bg-orange-600/15 px-2.5 py-1.5'
                      : m.role === 'system'
                        ? 'text-zinc-500 italic'
                        : 'mr-2'
                  }`}
                >
                  <div className="whitespace-pre-wrap drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {m.text}
                  </div>
                  {m.citedNoteIds && m.citedNoteIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {m.citedNoteIds.map((id) => {
                        const card = board.cards.find((c: SurfaceCard) => c.id === id);
                        return (
                          <Badge
                            key={id}
                            size="xs"
                            variant="outline"
                            className="cursor-pointer hover:border-orange-500 bg-white/40 dark:bg-black/30"
                            onClick={() => handleCitationClick(id)}
                          >
                            {card?.title?.slice(0, 28) || id}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  {m.modelProfileId && (
                    <div className="mt-1 text-[9px] font-mono text-zinc-500">
                      {m.modelProfileId}
                      {typeof m.latencyMs === 'number' ? ` · ${m.latencyMs}ms` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {activeProposal && (
              <div className="border-t border-dashed border-violet-400/50 px-3 py-2 space-y-1.5 bg-violet-500/10">
                <div className="text-[11px] font-semibold text-violet-900 dark:text-violet-200">
                  Proposed changes ({activeProposal.operations.length})
                </div>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 line-clamp-2">
                  {activeProposal.rationale}
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleApply}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-semibold py-1.5"
                  >
                    <Check className="w-3 h-3" /> Apply
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-zinc-400/60 dark:border-zinc-500 text-[11px] font-semibold py-1.5 bg-white/30 dark:bg-black/20"
                  >
                    <Trash2 className="w-3 h-3" /> Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!expanded && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 bg-transparent hover:text-orange-600 px-2 py-0.5"
            >
              <ChevronUp className="w-3 h-3" />
              Show thread
            </button>
          </div>
        )}

        {/* Forever composer row */}
        <div className="rounded-2xl border border-white/30 dark:border-white/15 bg-transparent backdrop-blur-[2px] shadow-[0_4px_24px_rgba(0,0,0,0.1)] px-2.5 py-2 space-y-1.5">
          <div className="flex flex-wrap gap-1 px-0.5">
            {CANVAS_AI_QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={isRunning}
                onClick={() => handleRun(p)}
                className="text-[10px] px-1.5 py-0.5 rounded-full border border-zinc-400/40 dark:border-zinc-500/50 hover:border-orange-500 text-zinc-700 dark:text-zinc-200 bg-white/25 dark:bg-black/20"
              >
                {p}
              </button>
            ))}
          </div>
          <form
            className="flex items-end gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              handleRun();
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={1}
              placeholder={
                selectedNoteIds.length
                  ? 'Ask about the selection…'
                  : 'Ask about this board…'
              }
              className="flex-1 resize-none rounded-xl border border-zinc-400/35 dark:border-zinc-500/40 bg-transparent px-3 py-2 text-[13px] focus:outline-none focus:border-orange-500 placeholder:text-zinc-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleRun();
                }
              }}
              onFocus={() => setExpanded(true)}
            />
            <button
              type="submit"
              disabled={isRunning || !input.trim()}
              className="rounded-xl bg-orange-600 disabled:opacity-40 text-white p-2.5 shrink-0"
              aria-label="Send"
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
