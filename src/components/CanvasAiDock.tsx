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
} from 'lucide-react';
import { Badge, Select, Tooltip, ActionIcon } from '@mantine/core';
import { AnimatePresence, motion } from 'motion/react';
import type { SurfaceCard, Whiteboard } from '../types/surface';
import type { CanvasAiChatController } from '../ai/useCanvasAiChat';

const FOLD_AWAY_MS = 5000;

const panelTransition = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 34,
  mass: 0.85,
};

interface CanvasAiDockProps {
  board: Whiteboard & { version?: number };
  chat: CanvasAiChatController;
  /** Offset above bottom control bars (LatentToolbar + status). */
  bottomOffsetPx?: number;
}

const frameClass =
  'rounded-2xl border border-zinc-300 dark:border-zinc-600 bg-[var(--card-bg,#ffffff)] dark:bg-zinc-900 shadow-lg';

/**
 * Forever canvas chat composer — fixed bottom-center above control bars.
 * Framed solid shell; transcript slides up ~4in and slides down 5s after click-away.
 */
export const CanvasAiDock: React.FC<CanvasAiDockProps> = ({
  board,
  chat,
  bottomOffsetPx = 72,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const foldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const isRunningRef = useRef(isRunning);
  const activeProposalRef = useRef(activeProposal);
  const awayRef = useRef(false);
  isRunningRef.current = isRunning;
  activeProposalRef.current = activeProposal;

  const clearFoldTimer = () => {
    if (foldTimerRef.current) {
      clearTimeout(foldTimerRef.current);
      foldTimerRef.current = null;
    }
  };

  const scheduleFold = () => {
    clearFoldTimer();
    foldTimerRef.current = setTimeout(() => {
      if (isRunningRef.current || activeProposalRef.current) return;
      setExpanded(false);
      setShowSettings(false);
      awayRef.current = false;
    }, FOLD_AWAY_MS);
  };

  useEffect(() => {
    return () => clearFoldTimer();
  }, []);

  useEffect(() => {
    if (!expanded || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, expanded, activeProposal]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const target = e.target as Node | null;
      if (target && root.contains(target)) {
        awayRef.current = false;
        clearFoldTimer();
        return;
      }
      awayRef.current = true;
      if (expanded) scheduleFold();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [expanded]);

  useEffect(() => {
    if (isRunning || activeProposal || !expanded || !awayRef.current) return;
    scheduleFold();
  }, [isRunning, activeProposal, expanded]);

  /** Only surface the dialogue panel when there is conversation — not empty chrome. */
  const openDialogue = () => {
    awayRef.current = false;
    clearFoldTimer();
    if (messages.length > 0 || isRunning) setExpanded(true);
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-40 flex justify-center px-3"
      style={{ bottom: bottomOffsetPx }}
      aria-label="Canvas AI forever composer"
    >
      <div
        ref={rootRef}
        className="pointer-events-auto w-full max-w-[640px] flex flex-col gap-1.5"
        onFocusCapture={openDialogue}
        onPointerDownCapture={clearFoldTimer}
      >
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="canvas-ai-transcript"
              initial={{ height: 0, opacity: 0, y: 28 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: 20 }}
              transition={panelTransition}
              className="overflow-hidden origin-bottom"
              style={{ willChange: 'height, opacity, transform' }}
            >
              <motion.div
                className={frameClass}
                initial={{ scaleY: 0.96 }}
                animate={{ scaleY: 1 }}
                exit={{ scaleY: 0.98 }}
                transition={panelTransition}
                style={{ transformOrigin: 'bottom center' }}
              >
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                    <span className="font-semibold truncate">Canvas AI</span>
                    <span className="font-mono text-zinc-500 truncate">
                      {activeModelLabel}
                      {runState === 'running' ? ' · running' : ''}
                      {selectedNoteIds.length > 0
                        ? ` · ${selectedNoteIds.length} selected`
                        : ''}
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
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={handleUndo}
                        aria-label="Undo"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </ActionIcon>
                    </Tooltip>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      onClick={() => {
                        clearFoldTimer();
                        setExpanded(false);
                        setShowSettings(false);
                      }}
                      aria-label="Collapse transcript"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </ActionIcon>
                  </div>
                </div>

                {showSettings && (
                  <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 space-y-2 bg-zinc-50 dark:bg-zinc-950/60">
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
                  <div className="px-3 py-1.5 text-[11px] text-amber-900 dark:text-amber-100 flex items-start gap-1.5 bg-amber-50 dark:bg-amber-950/40">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{lastError}</span>
                  </div>
                )}

                <div
                  ref={scrollRef}
                  className="px-3 py-2 overflow-y-auto space-y-2.5"
                  style={{ maxHeight: '24rem' }}
                >
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`text-[12px] leading-relaxed ${
                        m.role === 'user'
                          ? 'ml-6 rounded-lg bg-orange-600/10 dark:bg-orange-500/15 px-2.5 py-1.5'
                          : m.role === 'system'
                            ? 'text-zinc-500 italic'
                            : 'mr-2'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.text}</div>
                      {m.citedNoteIds && m.citedNoteIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {m.citedNoteIds.map((id) => {
                            const card = board.cards.find((c: SurfaceCard) => c.id === id);
                            return (
                              <Badge
                                key={id}
                                size="xs"
                                variant="outline"
                                className="cursor-pointer hover:border-orange-500"
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
                  <div className="border-t border-dashed border-violet-400/60 px-3 py-2 space-y-1.5 bg-violet-50 dark:bg-violet-950/30">
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
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-zinc-300 dark:border-zinc-600 text-[11px] font-semibold py-1.5"
                      >
                        <Trash2 className="w-3 h-3" /> Discard
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`${frameClass} px-2.5 py-2`}>
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
              className="flex-1 resize-none rounded-xl border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-950/50 px-3 py-2 text-[13px] focus:outline-none focus:border-orange-500 placeholder:text-zinc-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleRun();
                }
              }}
              onFocus={openDialogue}
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
