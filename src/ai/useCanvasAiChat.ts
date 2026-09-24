import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Whiteboard } from '../types/surface';
import type {
  CanvasAiAnswer,
  CanvasContext,
  ChangeProposal,
  ModelProfile,
} from '../ai/canvasTypes';
import {
  applyCanvasProposal,
  discardCanvasProposal,
  fetchCanvasModels,
  runCanvasAi,
  syncBoardToServer,
  undoCanvasProposal,
} from '../ai/canvasAiClient';

export type CanvasAiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  citedNoteIds?: string[];
  focusNoteId?: string;
  proposal?: ChangeProposal;
  modelProfileId?: string;
  latencyMs?: number;
  error?: string;
};

export const CANVAS_AI_QUICK_PROMPTS = [
  'Summarize these',
  'Find the contradiction',
  'What am I missing?',
  'Turn this into a plan',
  'Suggest three clusters',
] as const;

export type CanvasAiTaskPreset = 'chat' | 'synthesis' | 'layout' | 'extraction';

export type UseCanvasAiChatArgs = {
  board: Whiteboard & { version?: number };
  selectedNoteIds: string[];
  visibleNoteIds: string[];
  viewport: { x: number; y: number; zoom: number };
  onZoomToCard: (cardId: string) => void;
  onBoardReplaced: (board: Whiteboard & { version?: number }) => void;
  onProposalPreview: (proposal: ChangeProposal | null) => void;
  autoZoomEnabled: boolean;
};

export function useCanvasAiChat({
  board,
  selectedNoteIds,
  visibleNoteIds,
  viewport,
  onZoomToCard,
  onBoardReplaced,
  onProposalPreview,
  autoZoomEnabled,
}: UseCanvasAiChatArgs) {
  const [messages, setMessages] = useState<CanvasAiMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask anything about this board. Select notes for tighter grounding. Citations focus the canvas; proposals stay preview-only until you Apply.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [modelProfileId, setModelProfileId] = useState('gemini-flash');
  const [taskPreset, setTaskPreset] = useState<CanvasAiTaskPreset>('chat');
  const [showSettings, setShowSettings] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>();
  const [activeProposal, setActiveProposal] = useState<ChangeProposal | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [runState, setRunState] = useState<'idle' | 'running' | 'error'>('idle');
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetchCanvasModels()
      .then((res) => {
        setModels(res.models);
        if (res.defaultId) setModelProfileId(res.defaultId);
      })
      .catch(() => {
        /* offline / no server */
      });
  }, []);

  useEffect(() => {
    onProposalPreview(activeProposal);
  }, [activeProposal, onProposalPreview]);

  const activeModelLabel = useMemo(() => {
    return models.find((m) => m.id === modelProfileId)?.label || modelProfileId;
  }, [models, modelProfileId]);

  const buildContext = useCallback((): CanvasContext => {
    return {
      boardId: board.id,
      selectedNoteIds,
      visibleNoteIds,
      viewport: {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      },
      boardVersion: typeof board.version === 'number' ? board.version : 0,
    };
  }, [board, selectedNoteIds, visibleNoteIds, viewport]);

  const handleCitationClick = useCallback(
    (noteId: string) => {
      onZoomToCard(noteId);
    },
    [onZoomToCard]
  );

  const appendAssistant = useCallback(
    (result: {
      answer?: CanvasAiAnswer;
      proposal?: ChangeProposal;
      modelProfileId: string;
      latencyMs: number;
      error?: string;
      status: string;
    }) => {
      const text =
        result.answer?.reply ||
        result.proposal?.rationale ||
        result.error ||
        'No response.';
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          text,
          citedNoteIds: result.answer?.citedNoteIds || result.proposal?.evidenceNoteIds,
          focusNoteId: result.answer?.focusNoteId || result.proposal?.evidenceNoteIds?.[0],
          proposal: result.proposal,
          modelProfileId: result.modelProfileId,
          latencyMs: result.latencyMs,
          error: result.error,
        },
      ]);
      if (result.proposal) setActiveProposal(result.proposal);
      setExpanded(true);
      if (autoZoomEnabled && result.answer?.focusNoteId) {
        onZoomToCard(result.answer.focusNoteId);
      }
    },
    [autoZoomEnabled, onZoomToCard]
  );

  const handleRun = useCallback(
    async (queryOverride?: string) => {
      const query = (queryOverride ?? input).trim();
      if (!query || isRunning) return;

      setInput('');
      setLastError(null);
      setRunState('running');
      setIsRunning(true);
      setExpanded(true);
      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: 'user', text: query },
      ]);

      try {
        await syncBoardToServer({
          ...board,
          version: typeof board.version === 'number' ? board.version : 0,
        });

        const result = await runCanvasAi({
          query,
          context: buildContext(),
          threadId,
          modelProfileId,
          task: taskPreset,
          board: {
            ...board,
            version: typeof board.version === 'number' ? board.version : 0,
          },
        });

        setThreadId(result.threadId);
        if (result.status === 'error') {
          setRunState('error');
          setLastError(result.error || 'Agent error');
        } else {
          setRunState('idle');
        }
        appendAssistant(result);
      } catch (err: any) {
        setRunState('error');
        setLastError(err?.message || 'Run failed');
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            text: err?.message || 'Run failed',
            error: err?.message,
          },
        ]);
      } finally {
        setIsRunning(false);
      }
    },
    [
      appendAssistant,
      board,
      buildContext,
      input,
      isRunning,
      modelProfileId,
      taskPreset,
      threadId,
    ]
  );

  const handleApply = useCallback(async () => {
    if (!activeProposal) return;
    try {
      const result = await applyCanvasProposal(activeProposal.proposalId);
      if (result.board) {
        onBoardReplaced({
          ...result.board,
          description: result.board.description || board.description,
        });
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: 'system',
          text:
            result.status === 'duplicate'
              ? 'Proposal already applied (idempotent).'
              : 'Proposal applied as one undoable operation.',
        },
      ]);
      setActiveProposal(null);
    } catch (err: any) {
      const msg =
        err?.code === 'STALE_VERSION' || err?.data?.code === 'STALE_VERSION'
          ? 'Board changed since this proposal. Re-run to reconcile — refuse silent overwrite.'
          : err?.message || 'Apply failed';
      setLastError(msg);
      setMessages((prev) => [
        ...prev,
        { id: `sys-${Date.now()}`, role: 'system', text: msg, error: msg },
      ]);
    }
  }, [activeProposal, board.description, onBoardReplaced]);

  const handleDiscard = useCallback(async () => {
    if (!activeProposal) return;
    try {
      await discardCanvasProposal(activeProposal.proposalId);
    } catch {
      /* local discard still clears UI */
    }
    setActiveProposal(null);
    setMessages((prev) => [
      ...prev,
      { id: `sys-${Date.now()}`, role: 'system', text: 'Proposal discarded. Board unchanged.' },
    ]);
  }, [activeProposal]);

  const handleUndo = useCallback(async () => {
    try {
      const { board: restored } = await undoCanvasProposal(board.id);
      if (restored) {
        onBoardReplaced({
          ...restored,
          description: restored.description || board.description,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: 'system',
            text: 'Undid last AI apply.',
          },
        ]);
      }
    } catch (err: any) {
      setLastError(err?.message || 'Nothing to undo');
    }
  }, [board.description, board.id, onBoardReplaced]);

  return {
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
  };
}

export type CanvasAiChatController = ReturnType<typeof useCanvasAiChat>;
