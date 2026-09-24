import React from 'react';
import {
  Sparkles,
  Send,
  X,
  Settings2,
  Check,
  Trash2,
  Undo2,
  Loader2,
  ChevronLeft,
  AlertTriangle,
} from 'lucide-react';
import { Badge, Select, Tooltip, ActionIcon, ScrollArea } from '@mantine/core';
import type { SurfaceCard, Whiteboard } from '../types/surface';
import {
  CANVAS_AI_QUICK_PROMPTS,
  type CanvasAiChatController,
} from '../ai/useCanvasAiChat';

interface CanvasAiPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  board: Whiteboard & { version?: number };
  chat: CanvasAiChatController;
}

/** Side lane — same LangGraph canvas-ai controller as the forever dock. */
export const CanvasAiPanel: React.FC<CanvasAiPanelProps> = ({
  isOpen,
  onClose,
  onOpen,
  board,
  chat,
}) => {
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
    selectedNoteIds,
    handleRun,
    handleApply,
    handleDiscard,
    handleUndo,
    handleCitationClick,
  } = chat;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1 pl-1.5 pr-2 py-3 rounded-l-md bg-orange-600/90 text-white text-[11px] font-semibold shadow-md hover:bg-orange-500"
        title="Open canvas AI lane"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <aside className="w-[340px] shrink-0 h-full border-l border-zinc-200 dark:border-zinc-800 bg-[color-mix(in_srgb,var(--card-bg)_92%,transparent)] dark:bg-zinc-950/90 flex flex-col z-20">
      <header className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-orange-600 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">Canvas AI lane</div>
            <div className="text-[10px] text-zinc-500 truncate font-mono">
              {activeModelLabel}
              {runState === 'running' ? ' · running' : ''}
              {selectedNoteIds.length > 0 ? ` · ${selectedNoteIds.length} selected` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
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
          <ActionIcon variant="subtle" size="sm" onClick={onClose} aria-label="Close">
            <X className="w-3.5 h-3.5" />
          </ActionIcon>
        </div>
      </header>

      {showSettings && (
        <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 space-y-2 bg-zinc-50/80 dark:bg-zinc-900/50">
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
          <p className="text-[10px] text-zinc-500">
            Same allowlisted profiles as the forever dock. Keys stay server-side.
          </p>
        </div>
      )}

      {lastError && (
        <div className="px-3 py-1.5 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{lastError}</span>
        </div>
      )}

      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-3 pb-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`text-[12px] leading-relaxed ${
                m.role === 'user'
                  ? 'ml-4 rounded-md bg-orange-600/10 dark:bg-orange-500/15 px-2.5 py-2'
                  : m.role === 'system'
                    ? 'text-zinc-500 italic'
                    : 'mr-2'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>
              {m.citedNoteIds && m.citedNoteIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
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
                <div className="mt-1 text-[9px] font-mono text-zinc-400">
                  {m.modelProfileId}
                  {typeof m.latencyMs === 'number' ? ` · ${m.latencyMs}ms` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {activeProposal && (
        <div className="border-t border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-2 space-y-2 bg-violet-50/50 dark:bg-violet-950/20">
          <div className="text-[11px] font-semibold text-violet-800 dark:text-violet-200">
            Proposed changes ({activeProposal.operations.length})
          </div>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-3">
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

      <div className="border-t border-zinc-200 dark:border-zinc-800 p-2 space-y-2">
        <div className="flex flex-wrap gap-1">
          {CANVAS_AI_QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={isRunning}
              onClick={() => handleRun(p)}
              className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 hover:border-orange-500 text-zinc-600 dark:text-zinc-300"
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
            rows={2}
            placeholder={
              selectedNoteIds.length
                ? 'Ask about the selection…'
                : 'Ask about this board…'
            }
            className="flex-1 resize-none rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-[12px] focus:outline-none focus:border-orange-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleRun();
              }
            }}
          />
          <button
            type="submit"
            disabled={isRunning || !input.trim()}
            className="rounded-md bg-orange-600 disabled:opacity-40 text-white p-2"
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
    </aside>
  );
};
