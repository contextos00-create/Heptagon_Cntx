import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize GoogleGenAI if key is present
const geminiApiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (geminiApiKey) {
  try {
    aiClient = new GoogleGenAI({});
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI with environment key:', err);
  }
}

interface CardContext {
  id: string;
  type: string;
  title: string;
  content: string;
  tags?: string[];
  codeLanguage?: string;
  fileName?: string;
  fileType?: string;
  sectionName?: string;
}

// Fallback intelligent responder when Gemini API key is missing or encounters errors
function generateFallbackResponse(
  message: string,
  cards: CardContext[]
): {
  reply: string;
  referencedCardIds: string[];
  focusCardId?: string;
} {
  const queryLower = message.toLowerCase();
  
  // Find matching cards based on title, content, tags, filename
  const matchingCards: { card: CardContext; score: number }[] = [];
  
  for (const card of cards) {
    let score = 0;
    const titleLower = (card.title || '').toLowerCase();
    const contentLower = (card.content || '').toLowerCase();
    const fileLower = (card.fileName || '').toLowerCase();
    const tagsLower = (card.tags || []).join(' ').toLowerCase();

    // Check query terms
    const words = queryLower.split(/\s+/).filter(w => w.length > 2);
    for (const w of words) {
      if (titleLower.includes(w)) score += 5;
      if (fileLower.includes(w)) score += 4;
      if (tagsLower.includes(w)) score += 3;
      if (contentLower.includes(w)) score += 1;
    }

    if (score > 0) {
      matchingCards.push({ card, score });
    }
  }

  // Sort by score
  matchingCards.sort((a, b) => b.score - a.score);
  const referencedCardIds = matchingCards.slice(0, 3).map(m => m.card.id);
  const focusCard = matchingCards[0]?.card;

  // Generic summary or greeting if no direct match
  if (queryLower.includes('summar') || queryLower.includes('overview') || queryLower.includes('board') || queryLower.includes('surface')) {
    const cardSummary = cards
      .slice(0, 5)
      .map(c => `• **${c.title}** (${c.type}): ${c.content.slice(0, 100).replace(/\n/g, ' ')}...`)
      .join('\n');

    return {
      reply: `Here is an overview of your current Heptabase surface with ${cards.length} cards and files:\n\n${cardSummary}\n\nYou can click on any card badge below or ask specific questions to automatically glide and zoom directly into that node!`,
      referencedCardIds: cards.slice(0, 3).map(c => c.id),
      focusCardId: cards[0]?.id
    };
  }

  if (focusCard) {
    const snippet = focusCard.content.slice(0, 220);
    return {
      reply: `I found relevant information in **"${focusCard.title}"** (${focusCard.type.toUpperCase()}).\n\n> "${snippet}${snippet.length >= 220 ? '...' : ''}"\n\n*Auto-zooming your canvas right now to inspect this card in full detail.*`,
      referencedCardIds,
      focusCardId: focusCard.id
    };
  }

  // Fallback default
  const defaultCard = cards[0];
  return {
    reply: `I analyzed your ${cards.length} cards on the surface. Here's a look at your workspace structure. Let me bring up your primary node: **"${defaultCard?.title || 'Workspace Overview'}"**.`,
    referencedCardIds: defaultCard ? [defaultCard.id] : [],
    focusCardId: defaultCard?.id
  };
}

// API endpoint for AI chat with auto-zoom reference extraction
app.post('/api/chat', async (req, res) => {
  try {
    const { message, cards = [], history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Format cards context for the model
    const cardsContext = (cards as CardContext[]).map(c => ({
      id: c.id,
      title: c.title,
      type: c.type,
      tags: c.tags,
      summary: c.content ? c.content.slice(0, 500) : '',
      fileName: c.fileName,
      fileType: c.fileType
    }));

    if (aiClient) {
      try {
        const systemInstruction = `You are the intelligent visual Copilot for Heptabase, a visual knowledge whiteboard workspace.
The user is working on an interactive canvas with cards, documents, uploaded files, images, code, and notes.
You have access to the current cards on the surface:
${JSON.stringify(cardsContext, null, 2)}

YOUR CORE RESPONSIBILITIES:
1. Answer the user's questions clearly, concisely, and insightfully based on the whiteboard cards and files.
2. CRITICAL FEATURE: Identify which card or file is the PRIMARY SUBJECT you are speaking about so the canvas can AUTO-ZOOM to it smoothly.
3. Also list any secondary referenced card IDs.
4. Output your response as valid JSON with this exact structure:
{
  "reply": "Your markdown answer to the user. Reference cards naturally by title.",
  "focusCardId": "id-of-the-most-relevant-card-to-zoom-into-or-null",
  "referencedCardIds": ["card-id-1", "card-id-2"]
}
Only output pure JSON, nothing else.`;

        const response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [{ text: `User query: "${message}"\nWhiteboard context has ${cards.length} cards.` }]
            }
          ],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.3
          }
        });

        const rawText = response.text || '';
        try {
          const parsed = JSON.parse(rawText);
          return res.json({
            reply: parsed.reply || rawText,
            focusCardId: parsed.focusCardId || undefined,
            referencedCardIds: Array.isArray(parsed.referencedCardIds) ? parsed.referencedCardIds : []
          });
        } catch {
          // If JSON parse fails, return raw text with heuristic card match
          const fallback = generateFallbackResponse(message, cards);
          return res.json({
            reply: rawText || fallback.reply,
            focusCardId: fallback.focusCardId,
            referencedCardIds: fallback.referencedCardIds
          });
        }
      } catch (geminiError) {
        console.warn('Gemini API call failed, falling back to local heuristic:', geminiError);
        const fallback = generateFallbackResponse(message, cards);
        return res.json(fallback);
      }
    } else {
      // Local heuristic response if no API key
      const fallback = generateFallbackResponse(message, cards);
      return res.json(fallback);
    }
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// In-memory board persistence store for TanStack Start Server Functions
const boardsStore: Record<string, any> = {};

app.get('/api/boards', (_req, res) => {
  res.json(Object.values(boardsStore));
});

app.get('/api/boards/:id', (req, res) => {
  const board = boardsStore[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  res.json(board);
});

app.put('/api/boards/:id', (req, res) => {
  boardsStore[req.params.id] = req.body;
  res.json({ success: true, updatedAt: Date.now() });
});

// TanStack AI endpoint compatible with @tanstack/ai
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, cards = [], connections = [] } = req.body;
    const fallback = generateFallbackResponse(message || '', cards);
    return res.json({
      role: 'assistant',
      content: fallback.reply,
      focusCardId: fallback.focusCardId,
      referencedCardIds: fallback.referencedCardIds,
      tools: [
        { name: 'zoom_to_card', executed: Boolean(fallback.focusCardId) }
      ]
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Setup Vite middleware for development or static serving for production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
