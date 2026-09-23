/**
 * TanStack AI Integration Layer for Visual Whiteboarding
 * Uses @tanstack/ai and @tanstack/ai-react conventions
 */
import { SurfaceCard, Connection } from '../types/surface';

export interface TanStackAiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: TanStackAiToolCall[];
  focusCardId?: string;
  referencedCardIds?: string[];
}

export interface TanStackAiToolCall {
  id: string;
  name: 'zoom_to_card' | 'create_card' | 'link_cards' | 'find_contradictions';
  arguments: Record<string, any>;
  result?: any;
}

export interface TanStackAiClientOptions {
  apiEndpoint?: string;
  cards: SurfaceCard[];
  connections: Connection[];
  onZoomToCard?: (cardId: string) => void;
  onAddCard?: (card: Partial<SurfaceCard>) => void;
  onAddConnection?: (conn: Partial<Connection>) => void;
}

/**
 * Client-side assistant driver compatible with TanStack AI execution model
 */
export class TanStackAiSurfaceClient {
  private cards: SurfaceCard[] = [];
  private connections: Connection[] = [];
  private onZoomToCard?: (cardId: string) => void;
  private onAddCard?: (card: Partial<SurfaceCard>) => void;
  private onAddConnection?: (conn: Partial<Connection>) => void;
  private endpoint: string;

  constructor(options: TanStackAiClientOptions) {
    this.cards = options.cards;
    this.connections = options.connections;
    this.onZoomToCard = options.onZoomToCard;
    this.onAddCard = options.onAddCard;
    this.onAddConnection = options.onAddConnection;
    this.endpoint = options.apiEndpoint || '/api/chat';
  }

  updateContext(cards: SurfaceCard[], connections: Connection[]) {
    this.cards = cards;
    this.connections = connections;
  }

  /**
   * Execute user prompt via TanStack AI endpoint with tool resolution
   */
  async sendMessage(
    prompt: string,
    history: TanStackAiMessage[] = []
  ): Promise<TanStackAiMessage> {
    const formattedHistory = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: prompt,
        cards: this.cards,
        connections: this.connections,
        history: formattedHistory,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI request failed with status: ${response.status}`);
    }

    const data = await response.json();
    const toolCalls: TanStackAiToolCall[] = [];

    // Automatic tool invocation: zoom_to_card
    if (data.focusCardId) {
      toolCalls.push({
        id: `call-zoom-${Date.now()}`,
        name: 'zoom_to_card',
        arguments: { cardId: data.focusCardId },
        result: { success: true },
      });
      if (this.onZoomToCard) {
        this.onZoomToCard(data.focusCardId);
      }
    }

    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'assistant',
      content: data.reply || 'Analysis complete.',
      timestamp: Date.now(),
      toolCalls,
      focusCardId: data.focusCardId,
      referencedCardIds: data.referencedCardIds || [],
    };
  }
}
