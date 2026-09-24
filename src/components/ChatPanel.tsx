import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  X, 
  Compass, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  ArrowUpRight, 
  ChevronLeft, 
  Cpu, 
  ShieldAlert, 
  Wrench,
  Search,
  CheckCircle2
} from 'lucide-react';
import { 
  Badge, 
  Tooltip, 
  ActionIcon, 
  Tabs, 
  ScrollArea, 
  Loader, 
  Button,
  Group
} from '@mantine/core';
import { SurfaceCard, ChatMessage } from '../types/surface';
import { TanStackAiSurfaceClient, TanStackAiMessage } from '../lib/tanstackAi';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  cards: SurfaceCard[];
  onZoomToCard: (cardId: string) => void;
  autoZoomEnabled: boolean;
  onToggleAutoZoom: () => void;
}

interface ToolExecutionEvent {
  id: string;
  name: string;
  args: Record<string, any>;
  timestamp: number;
  status: 'executing' | 'completed';
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  onOpen,
  cards,
  onZoomToCard,
  autoZoomEnabled,
  onToggleAutoZoom,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: `TanStack AI visual copilot initialized. I can analyze system architecture, detect contradictions between specifications and empirical data, and automatically glide your canvas directly to relevant nodes.`,
      timestamp: Date.now(),
      referencedCardIds: ['card-arch-pdf', 'card-code-cache'],
      focusCardId: 'card-arch-pdf',
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('chat');
  const [toolEvents, setToolEvents] = useState<ToolExecutionEvent[]>([
    {
      id: 'tool-init',
      name: 'inspect_spatial_context',
      args: { cardCount: cards.length },
      timestamp: Date.now() - 10000,
      status: 'completed',
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const aiClientRef = useRef<TanStackAiSurfaceClient | null>(null);

  useEffect(() => {
    aiClientRef.current = new TanStackAiSurfaceClient({
      cards,
      connections: [],
      onZoomToCard: (cardId) => {
        if (autoZoomEnabled) {
          onZoomToCard(cardId);
          setToolEvents((prev) => [
            {
              id: `tool-${Date.now()}`,
              name: 'zoom_to_card',
              args: { targetCardId: cardId },
              timestamp: Date.now(),
              status: 'completed',
            },
            ...prev,
          ]);
        }
      },
    });
  }, [cards, autoZoomEnabled, onZoomToCard]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, activeTab]);

  const handleSpeak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const cleanText = text.replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const handleSendMessage = async (userTextOverride?: string) => {
    const messageText = userTextOverride || input;
    if (!messageText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: messageText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!userTextOverride) setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          cards,
          history: messages.map((m) => ({ role: m.sender, content: m.text })),
        }),
      });

      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();

      let replyText = data.reply || 'Analysis completed.';
      let detectedIds: string[] = data.referencedCardIds || [];
      let focusId: string | undefined = data.focusCardId;

      // Extract bracketed refs if returned by model
      const refsMatch = replyText.match(/\[REFS:\s*([^\]]+)\]/);
      if (refsMatch) {
        try {
          const rawRefs = `[${refsMatch[1]}]`;
          const parsed = JSON.parse(rawRefs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            detectedIds = parsed;
            if (!focusId) focusId = parsed[0];
          }
          replyText = replyText.replace(/\[REFS:\s*[^\]]+\]/, '').trim();
        } catch {
          // ignore
        }
      }

      if (focusId) {
        setToolEvents((prev) => [
          {
            id: `tool-${Date.now()}`,
            name: 'zoom_to_card',
            args: { cardId: focusId },
            timestamp: Date.now(),
            status: 'completed',
          },
          ...prev,
        ]);
        if (autoZoomEnabled) {
          onZoomToCard(focusId);
        }
      }

      const assistantMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: Date.now(),
        referencedCardIds: detectedIds.length > 0 ? detectedIds : undefined,
        focusCardId: focusId,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      // Heuristic fallback
      const lower = messageText.toLowerCase();
      const matched = cards.filter(
        (c) =>
          lower.includes(c.title.toLowerCase()) ||
          c.tags.some((t) => lower.includes(t.toLowerCase()))
      );

      const focus = matched[0] || cards[0];
      if (focus && autoZoomEnabled) {
        onZoomToCard(focus.id);
      }

      const fallbackMsg: ChatMessage = {
        id: `ai-fb-${Date.now()}`,
        sender: 'assistant',
        text: focus
          ? `Analyzed ${cards.length} cards. Found key reference in **"${focus.title}"** (${focus.type.toUpperCase()}). Auto-focusing camera to this node.`
          : `Examined your whiteboard canvas containing ${cards.length} cards and files.`,
        timestamp: Date.now(),
        referencedCardIds: focus ? [focus.id] : undefined,
        focusCardId: focus?.id,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Protruding orange tab when closed
  if (!isOpen) {
    return (
      <button
        onClick={onOpen}
        className="fixed top-28 sm:top-1/2 sm:-translate-y-1/2 right-0 z-50 flex items-center gap-1.5 px-2 py-2.5 rounded-l-md bg-orange-500 hover:bg-orange-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 group font-mono text-[11px] font-semibold cursor-pointer border-l border-y border-orange-600/40"
        title="Open TanStack AI Visual Copilot"
      >
        <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
        <span className="hidden sm:inline [writing-mode:vertical-lr] tracking-wider uppercase text-[10px]">
          TanStack AI
        </span>
      </button>
    );
  }

  return (
    <aside className="w-84 h-full flex flex-col bg-[#fbfbfc] dark:bg-[#0f1013] border-l border-black/[0.04] dark:border-white/[0.04] z-40 select-none text-zinc-600 dark:text-zinc-400 shadow-xl">
      {/* Header with Mantine Badges */}
      <div className="h-10 px-3 border-b border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">TanStack AI</span>
          <Badge size="xs" variant="light" color="orange" className="font-mono text-[8px] uppercase">
            v0.58
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <Tooltip label="Toggle smooth camera auto-zoom to mentioned nodes">
            <button
              onClick={onToggleAutoZoom}
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                autoZoomEnabled 
                  ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold' 
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Auto-zoom
            </button>
          </Tooltip>

          <Tooltip label="Close panel">
            <ActionIcon onClick={onClose} variant="subtle" color="gray" size="sm">
              <X className="w-3.5 h-3.5" />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {/* Mantine Tabs: Chat vs Tool Calls */}
      <Tabs value={activeTab} onChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-3 pt-1 border-b border-black/[0.04] dark:border-white/[0.04]">
          <Tabs.List>
            <Tabs.Tab value="chat" className="text-[11px] py-1">
              Copilot Chat
            </Tabs.Tab>
            <Tabs.Tab 
              value="tools" 
              className="text-[11px] py-1"
              rightSection={
                <Badge size="xs" circle variant="light" color="orange">
                  {toolEvents.length}
                </Badge>
              }
            >
              Tool Traces
            </Tabs.Tab>
          </Tabs.List>
        </div>

        {/* Tab 1: Chat Messages */}
        <Tabs.Panel value="chat" className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[92%] px-3 py-2 leading-relaxed text-xs rounded-lg shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-white dark:bg-[#15161a] border border-black/[0.06] dark:border-white/[0.06] text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* Referenced Cards Badges */}
                  {msg.referencedCardIds && msg.referencedCardIds.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] text-zinc-400 font-mono">Linked:</span>
                      {msg.referencedCardIds.map((cardId) => {
                        const refCard = cards.find((c) => c.id === cardId);
                        if (!refCard) return null;
                        return (
                          <button
                            key={cardId}
                            onClick={() => onZoomToCard(cardId)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 text-[10px] font-medium transition-colors"
                          >
                            <span>{refCard.title}</span>
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {msg.sender === 'assistant' && (
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => handleSpeak(msg.text)}
                      className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1"
                    >
                      {isSpeaking ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                      <span>{isSpeaking ? 'Stop' : 'Read'}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-zinc-500 text-xs py-2 px-3 bg-white dark:bg-[#15161a] rounded-lg border border-black/5 dark:border-white/5 w-fit">
                <Loader size="xs" color="orange" />
                <span className="font-mono text-[11px]">TanStack AI Reasoning...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          <div className="px-2 py-1.5 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center gap-1 overflow-x-auto text-[10px]">
            {cards.some((c) => c.tags?.includes('GOOGLE')) ? (
              <>
                <button
                  onClick={() => handleSendMessage('Summarize the main themes across my imported Google notes')}
                  className="px-2 py-1 rounded bg-black/[0.03] dark:bg-white/[0.04] hover:bg-orange-500/10 hover:text-orange-500 text-zinc-600 dark:text-zinc-400 whitespace-nowrap transition-colors"
                >
                  Summarize Google notes
                </button>
                <button
                  onClick={() => handleSendMessage('What connections and open decisions emerge from my Google notes?')}
                  className="px-2 py-1 rounded bg-black/[0.03] dark:bg-white/[0.04] hover:bg-orange-500/10 hover:text-orange-500 text-zinc-600 dark:text-zinc-400 whitespace-nowrap transition-colors"
                >
                  Find connections
                </button>
                <button
                  onClick={() => handleSendMessage('Are there contradictions between any of my Google notes?')}
                  className="px-2 py-1 rounded bg-black/[0.03] dark:bg-white/[0.04] hover:bg-orange-500/10 hover:text-orange-500 text-zinc-600 dark:text-zinc-400 whitespace-nowrap transition-colors"
                >
                  Spot contradictions
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleSendMessage('Identify any contradictions between SLI claims and telemetry data')}
                  className="px-2 py-1 rounded bg-black/[0.03] dark:bg-white/[0.04] hover:bg-orange-500/10 hover:text-orange-500 text-zinc-600 dark:text-zinc-400 whitespace-nowrap transition-colors"
                >
                  Find contradictions
                </button>
                <button
                  onClick={() => handleSendMessage('Analyze cache architecture and Singapore edge node')}
                  className="px-2 py-1 rounded bg-black/[0.03] dark:bg-white/[0.04] hover:bg-orange-500/10 hover:text-orange-500 text-zinc-600 dark:text-zinc-400 whitespace-nowrap transition-colors"
                >
                  Inspect edge cache
                </button>
              </>
            )}
          </div>

          {/* Input Form */}
          <div className="p-2 border-t border-black/[0.04] dark:border-white/[0.04] bg-white/50 dark:bg-black/20">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-center"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask TanStack AI about your surface..."
                className="w-full pl-3 pr-8 py-2 text-xs bg-white dark:bg-[#15161a] rounded-md border border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 text-orange-500 hover:text-orange-600 disabled:opacity-30 p-1"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </Tabs.Panel>

        {/* Tab 2: TanStack AI Tool Calls Trace */}
        <Tabs.Panel value="tools" className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
          <div className="text-[10px] text-zinc-400 font-mono mb-2 uppercase">
            Active Tool Pipeline
          </div>
          {toolEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-2 rounded-md border border-black/5 dark:border-white/5 bg-white dark:bg-[#141519] space-y-1 font-mono text-[10px]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-semibold">
                  <Wrench className="w-3 h-3 text-orange-500" />
                  <span>{evt.name}</span>
                </div>
                <Badge size="xs" color="teal" variant="light">
                  {evt.status}
                </Badge>
              </div>
              <div className="text-zinc-500 break-all bg-black/[0.02] dark:bg-white/[0.02] p-1 rounded">
                {JSON.stringify(evt.args)}
              </div>
            </div>
          ))}
        </Tabs.Panel>
      </Tabs>
    </aside>
  );
};
