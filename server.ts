import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import { CopilotRuntime, BuiltInAgent } from '@copilotkit/runtime/v2';
import { createCopilotEndpointSingleRouteExpress } from '@copilotkit/runtime/v2/express';
import { boardCommandStore, resolveContextNotes } from './src/ai/boardCommandStore';
import { listEnabledModels, resolveModelProfile, toCopilotKitModelId } from './src/ai/modelRegistry';
import { runNoteCanvasAgent } from './src/ai/langgraph/noteCanvasAgent';
import type { CanvasContext } from './src/ai/canvasTypes';

dotenv.config();

// CopilotKit BuiltInAgent reads GOOGLE_API_KEY; alias Gemini Studio secret.
if (process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
  process.env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || `${APP_URL}/api/google/auth/callback`;
const GKEEP_BRIDGE_PATH = path.resolve(__dirname, 'scripts/gkeep_bridge.py');
const GKEEP_PYTHON = process.env.GKEEP_PYTHON || 'python3';
const GKEEP_EMAIL_ENV = process.env.GKEEP_EMAIL || '';
const GKEEP_MASTER_TOKEN_ENV = process.env.GKEEP_MASTER_TOKEN || '';
const GKEEP_PASSWORD_ENV = process.env.GKEEP_PASSWORD || '';

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

/** In-memory Google OAuth token store (single-user / demo) */
const googleTokenStore: {
  accessToken?: string;
  refreshToken?: string;
  expiry?: number;
  email?: string;
} = {};

/** In-memory unofficial Keep session (gkeepapi master token) — never written to disk */
const keepSessionStore: {
  email?: string;
  masterToken?: string;
  lastSyncAt?: number;
  noteCount?: number;
} = {};

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
].join(' ');

function runGkeepBridge(payload: Record<string, unknown>): Promise<{
  ok: boolean;
  error?: string;
  hint?: string;
  notes?: any[];
  count?: number;
  email?: string;
  master_token?: string;
  warning?: string;
  via?: string;
}> {
  return new Promise((resolve) => {
    const child = spawn(GKEEP_PYTHON, [GKEEP_BRIDGE_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({
        ok: false,
        error: 'gkeepapi bridge timed out after 60s',
        hint: 'Check network access to Google and that master_token is valid.',
      });
    }, 60_000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        error: `Failed to start gkeep bridge: ${err.message}`,
        hint: 'Install Python deps with: pip install -r requirements.txt',
      });
    });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(stdout.trim() || '{}');
        if (!parsed.ok && stderr && !parsed.hint) {
          parsed.hint = stderr.slice(0, 400);
        }
        resolve(parsed);
      } catch {
        resolve({
          ok: false,
          error: 'gkeep bridge returned invalid JSON',
          hint: (stderr || stdout).slice(0, 500) || undefined,
        });
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
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
        const googleCards = (cards as CardContext[]).filter(
          (c) => (c.tags || []).some((t) => String(t).toUpperCase() === 'GOOGLE')
        );
        const systemInstruction = `You are the intelligent visual Copilot for Heptasurface, a visual knowledge whiteboard workspace.
The user is working on an interactive canvas with cards, documents, uploaded files, images, code, and notes — including imported Google Keep / Docs / Drive knowledge.
You have access to the current cards on the surface:
${JSON.stringify(cardsContext, null, 2)}

${googleCards.length > 0 ? `GOOGLE NOTES CONTEXT: ${googleCards.length} cards were imported from Google sources. Prefer synthesizing themes, contradictions, open decisions, and cross-note connections. When useful, cite Keep labels and overview/cluster cards.` : ''}

YOUR CORE RESPONSIBILITIES:
1. Answer the user's questions clearly, concisely, and insightfully based on the whiteboard cards and files.
2. When asked to organize, summarize, or find connections: synthesize across multiple cards and name the themes.
3. CRITICAL FEATURE: Identify which card or file is the PRIMARY SUBJECT you are speaking about so the canvas can AUTO-ZOOM to it smoothly.
4. Also list any secondary referenced card IDs.
5. Output your response as valid JSON with this exact structure:
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
  try {
    const snap = boardCommandStore.upsertBoard({
      ...req.body,
      version:
        typeof req.body?.version === 'number'
          ? req.body.version
          : boardCommandStore.getBoard(req.params.id)?.version || 0,
    });
    return res.json({ success: true, updatedAt: snap.updatedAt, version: snap.version });
  } catch {
    return res.json({ success: true, updatedAt: Date.now() });
  }
});

// ---------------------------------------------------------------------------
// Canvas AI: model registry, LangGraph agent, proposal apply/undo
// ---------------------------------------------------------------------------

app.get('/api/canvas-ai/models', (_req, res) => {
  const models = listEnabledModels();
  const fallback = resolveModelProfile(undefined, 'chat');
  res.json({ models, defaultId: fallback.id });
});

app.post('/api/canvas-ai/context', (req, res) => {
  try {
    const { context, query, board } = req.body || {};
    if (!context?.boardId) {
      return res.status(400).json({ error: 'context.boardId is required' });
    }
    if (board) boardCommandStore.upsertBoard(board);
    else if (boardsStore[context.boardId]) {
      boardCommandStore.upsertBoard(boardsStore[context.boardId]);
    }
    const notes = resolveContextNotes(boardCommandStore, context as CanvasContext, query);
    const live = boardCommandStore.getBoard(context.boardId);
    res.json({ notes, boardVersion: live?.version || context.boardVersion || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/canvas-ai/search', (req, res) => {
  try {
    const { boardId, query = '', limit = 12, board } = req.body || {};
    if (!boardId) return res.status(400).json({ error: 'boardId is required' });
    if (board) boardCommandStore.upsertBoard(board);
    else if (boardsStore[boardId]) boardCommandStore.upsertBoard(boardsStore[boardId]);
    const notes = boardCommandStore.searchNotes(boardId, query, limit);
    res.json({ notes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/canvas-ai/run', async (req, res) => {
  try {
    const {
      query,
      context,
      threadId,
      modelProfileId,
      task = 'chat',
      board,
    } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required' });
    }
    if (!context?.boardId) {
      return res.status(400).json({ error: 'context.boardId is required' });
    }
    if (board) {
      boardCommandStore.upsertBoard(board);
      boardsStore[board.id] = board;
    } else if (boardsStore[context.boardId]) {
      boardCommandStore.upsertBoard(boardsStore[context.boardId]);
    }

    const result = await runNoteCanvasAgent({
      query,
      context: context as CanvasContext,
      threadId,
      modelProfileId,
      task,
    });
    res.json(result);
  } catch (err: any) {
    console.error('canvas-ai/run error:', err);
    res.status(500).json({ error: err.message || 'Agent run failed' });
  }
});

app.post('/api/canvas-ai/proposals/:id/apply', (req, res) => {
  try {
    const result = boardCommandStore.applyProposal(req.params.id);
    boardsStore[result.board.id] = result.board;
    res.json(result);
  } catch (err: any) {
    const status = err.code === 'STALE_VERSION' ? 409 : 400;
    res.status(status).json({
      error: err.message,
      code: err.code,
      currentVersion: err.currentVersion,
      baseBoardVersion: err.baseBoardVersion,
    });
  }
});

app.post('/api/canvas-ai/proposals/:id/discard', (req, res) => {
  try {
    const proposal = boardCommandStore.discardProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    res.json({ proposal });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/canvas-ai/undo', (req, res) => {
  try {
    const { boardId } = req.body || {};
    if (!boardId) return res.status(400).json({ error: 'boardId is required' });
    const board = boardCommandStore.undoLast(boardId);
    if (board) boardsStore[boardId] = board;
    res.json({ board });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// CopilotKit v2 single-route runtime (BuiltInAgent bridge; LangGraph owns canvas runs)
try {
  const googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  if (googleKey && !process.env.GOOGLE_API_KEY) {
    process.env.GOOGLE_API_KEY = googleKey;
  }
  const defaultProfile = resolveModelProfile('gemini-flash', 'chat');
  const copilotRuntime = new CopilotRuntime({
    agents: {
      'note-canvas': new BuiltInAgent({
        model: toCopilotKitModelId(defaultProfile) as any,
        apiKey: googleKey || undefined,
        temperature: 0.2,
        prompt: `You are the Heptasurface canvas AI bridge. Prefer the /api/canvas-ai/run LangGraph endpoint for grounded board answers and proposals. Do not invent canvas coordinates. Never expose API keys.`,
      }),
      default: new BuiltInAgent({
        model: toCopilotKitModelId(defaultProfile) as any,
        apiKey: googleKey || undefined,
        temperature: 0.2,
        prompt: `You are the Heptasurface assistant. Ground answers in board notes when context is provided.`,
      }),
    },
  });
  app.use(
    createCopilotEndpointSingleRouteExpress({
      runtime: copilotRuntime,
      basePath: '/api/copilotkit',
    })
  );
  console.log('CopilotKit runtime mounted at /api/copilotkit (agent: note-canvas)');
} catch (err) {
  console.warn('CopilotKit runtime not mounted:', err);
}

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

// ---------------------------------------------------------------------------
// Google Notes intelligence: organize / summarize / connect
// ---------------------------------------------------------------------------

interface ImportedNotePayload {
  id: string;
  source?: string;
  title: string;
  content: string;
  labels?: string[];
  isPinned?: boolean;
}

const CLUSTER_COLORS = ['blue', 'orange', 'green', 'purple', 'yellow', 'red', 'gray'];

function tokenizeLocal(text: string): string[] {
  const stop = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'have',
    'are', 'was', 'were', 'will', 'about', 'their', 'them', 'they', 'note', 'notes',
    'keep', 'google', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'by', 'or', 'as', 'is',
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
}

function organizeNotesHeuristic(notes: ImportedNotePayload[]) {
  if (!notes.length) {
    return {
      overview: 'No Google notes were provided.',
      clusters: [],
      connections: [],
      highlights: [],
      suggestedQuestions: ['Import Keep Takeout notes to begin.'],
    };
  }

  const tokenSets = notes.map(
    (n) => new Set(tokenizeLocal(`${n.title} ${n.content} ${(n.labels || []).join(' ')}`))
  );
  const byLabel = new Map<string, number[]>();
  notes.forEach((note, idx) => {
    const labels = note.labels && note.labels.length > 0 ? note.labels : ['general'];
    for (const label of labels) {
      const key = label.toLowerCase();
      if (!byLabel.has(key)) byLabel.set(key, []);
      byLabel.get(key)!.push(idx);
    }
  });

  const rankedLabels = [...byLabel.entries()].sort((a, b) => {
    const multiA = a[1].length > 1 ? 1 : 0;
    const multiB = b[1].length > 1 ? 1 : 0;
    if (multiB !== multiA) return multiB - multiA;
    return b[1].length - a[1].length;
  });

  const clusters: any[] = [];
  let colorIdx = 0;
  const assigned = new Set<number>();

  for (const [label, idxs] of rankedLabels) {
    const uniqueIdxs = [...new Set(idxs)].filter((i) => !assigned.has(i));
    if (uniqueIdxs.length === 0) continue;
    if (uniqueIdxs.length === 1 && idxs.length === 1) continue;

    const keywordFreq = new Map<string, number>();
    for (const i of uniqueIdxs) {
      for (const t of tokenSets[i]) keywordFreq.set(t, (keywordFreq.get(t) || 0) + 1);
    }
    const keywords = [...keywordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);
    clusters.push({
      id: `cluster-${label}-${clusters.length}`,
      name: label.charAt(0).toUpperCase() + label.slice(1),
      summary: `${uniqueIdxs.length} notes under “${label}”. Keywords: ${keywords.slice(0, 3).join(', ') || 'n/a'}.`,
      noteIds: uniqueIdxs.map((i) => notes[i].id),
      color: CLUSTER_COLORS[colorIdx++ % CLUSTER_COLORS.length],
      keywords,
    });
    uniqueIdxs.forEach((i) => assigned.add(i));
  }

  notes.forEach((note, idx) => {
    if (assigned.has(idx)) return;
    const group = [idx];
    assigned.add(idx);
    for (let j = idx + 1; j < notes.length; j++) {
      if (assigned.has(j)) continue;
      const a = tokenSets[idx];
      const b = tokenSets[j];
      let inter = 0;
      for (const t of a) if (b.has(t)) inter += 1;
      const union = a.size + b.size - inter || 1;
      if (inter / union >= 0.12) {
        group.push(j);
        assigned.add(j);
      }
    }
    const keywordFreq = new Map<string, number>();
    for (const gi of group) {
      for (const t of tokenSets[gi]) keywordFreq.set(t, (keywordFreq.get(t) || 0) + 1);
    }
    const keywords = [...keywordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);
    const title = notes[group[0]].title.slice(0, 40);
    clusters.push({
      id: `cluster-kw-${clusters.length}`,
      name: keywords[0]
        ? keywords
            .slice(0, 2)
            .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
            .join(' · ')
        : title,
      summary: `Auto-clustered ${group.length} related notes around ${keywords.slice(0, 3).join(', ') || 'shared themes'}.`,
      noteIds: group.map((i) => notes[i].id),
      color: CLUSTER_COLORS[colorIdx++ % CLUSTER_COLORS.length],
      keywords,
    });
  });

  const connections: any[] = [];
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const a = tokenSets[i];
      const b = tokenSets[j];
      let inter = 0;
      for (const t of a) if (b.has(t)) inter += 1;
      const union = a.size + b.size - inter || 1;
      const score = inter / union;
      const sharedLabels = (notes[i].labels || []).filter((l) =>
        (notes[j].labels || []).map((x) => x.toLowerCase()).includes(l.toLowerCase())
      );
      const sharedTokens = [...a].filter((t) => b.has(t)).slice(0, 4);
      const minConfidence = notes.length <= 8 ? 0.08 : 0.15;
      const confidence = Math.min(
        0.95,
        score + (sharedLabels.length ? 0.28 : 0) + (sharedTokens.length >= 2 ? 0.1 : 0)
      );
      if (confidence < minConfidence && sharedTokens.length === 0 && sharedLabels.length === 0) {
        continue;
      }
      connections.push({
        fromNoteId: notes[i].id,
        toNoteId: notes[j].id,
        label: sharedLabels[0] || sharedTokens[0] || 'related',
        reasoning:
          sharedLabels.length > 0
            ? `Share label(s): ${sharedLabels.join(', ')}`
            : `Overlap on: ${sharedTokens.join(', ')}`,
        confidence: Math.max(confidence, 0.2),
      });
    }
  }
  connections.sort((a, b) => b.confidence - a.confidence);

  const pinned = notes.filter((n) => n.isPinned).map((n) => n.title);
  const highlights = [
    ...pinned.map((t) => `Pinned: ${t}`),
    ...clusters.slice(0, 3).map((c) => `${c.name}: ${c.noteIds.length} notes`),
  ].slice(0, 6);

  return {
    overview: `Imported ${notes.length} Google notes into ${clusters.length} thematic clusters. Dominant themes: ${clusters
      .slice(0, 3)
      .map((c) => c.name)
      .join(', ')}.${connections.length ? ` Detected ${Math.min(12, connections.length)} cross-note connections worth exploring in chat.` : ''}`,
    clusters,
    connections: connections.slice(0, 12),
    highlights,
    suggestedQuestions: [
      'What are the main themes across my Google notes?',
      'Which notes contradict each other?',
      'Summarize product and AI related notes together.',
      'What decisions are still open?',
    ],
  };
}

app.get('/api/google/status', (_req, res) => {
  res.json({
    driveConfigured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
    connected: Boolean(googleTokenStore.accessToken),
    email: googleTokenStore.email || null,
    keepApiAvailable: false,
    keepUnofficialBridge: true,
    keepBridgeVia: 'gkeepapi',
    keepEnvConfigured: Boolean(
      GKEEP_EMAIL_ENV && (GKEEP_MASTER_TOKEN_ENV || GKEEP_PASSWORD_ENV)
    ),
    keepSession: {
      connected: Boolean(keepSessionStore.masterToken || keepSessionStore.email),
      email: keepSessionStore.email || null,
      lastSyncAt: keepSessionStore.lastSyncAt || null,
      noteCount: keepSessionStore.noteCount || null,
    },
    keepImportMethods: [
      'gkeepapi-live',
      'takeout-zip',
      'takeout-json',
      'takeout-html',
      'paste',
    ],
  });
});

/**
 * Live Keep sync via unofficial gkeepapi (Python bridge).
 * Body: { email?, master_token?, password?, include_archived?, max_notes?, use_env? }
 */
app.post('/api/google/keep/sync', async (req, res) => {
  try {
    const body = req.body || {};
    const useEnv = Boolean(body.use_env || body.useEnv);
    const email =
      (typeof body.email === 'string' && body.email.trim()) ||
      keepSessionStore.email ||
      (useEnv ? GKEEP_EMAIL_ENV : '') ||
      GKEEP_EMAIL_ENV;
    const masterToken =
      (typeof body.master_token === 'string' && body.master_token.trim()) ||
      (typeof body.masterToken === 'string' && body.masterToken.trim()) ||
      keepSessionStore.masterToken ||
      (useEnv ? GKEEP_MASTER_TOKEN_ENV : '') ||
      GKEEP_MASTER_TOKEN_ENV;
    const password =
      (typeof body.password === 'string' && body.password.trim()) ||
      (useEnv ? GKEEP_PASSWORD_ENV : '') ||
      (!masterToken ? GKEEP_PASSWORD_ENV : '');

    if (!email) {
      return res.status(400).json({
        error: 'email is required (or set GKEEP_EMAIL)',
        hint: 'Prefer master_token auth. Password login is deprecated in gkeepapi.',
      });
    }
    if (!masterToken && !password) {
      return res.status(400).json({
        error: 'master_token or password required',
        hint: 'Obtain a Google oauth master token for gkeepapi.authenticate, or set GKEEP_MASTER_TOKEN.',
      });
    }

    const result = await runGkeepBridge({
      email,
      master_token: masterToken || undefined,
      password: password || undefined,
      include_archived: Boolean(body.include_archived ?? body.includeArchived),
      include_trashed: Boolean(body.include_trashed ?? body.includeTrashed),
      max_notes: body.max_notes ?? body.maxNotes ?? 200,
    });

    if (!result.ok) {
      return res.status(401).json({
        error: result.error || 'Keep sync failed',
        hint: result.hint,
      });
    }

    keepSessionStore.email = result.email || email;
    if (result.master_token) {
      keepSessionStore.masterToken = result.master_token;
    } else if (masterToken) {
      keepSessionStore.masterToken = masterToken;
    }
    keepSessionStore.lastSyncAt = Date.now();
    keepSessionStore.noteCount = result.count || (result.notes || []).length;

    return res.json({
      notes: result.notes || [],
      count: keepSessionStore.noteCount,
      email: keepSessionStore.email,
      via: 'gkeepapi',
      warning: result.warning,
      // Never auto-return master_token to browser unless password login just minted one
      masterTokenHint: result.master_token
        ? 'A master token was minted from password login — store it as GKEEP_MASTER_TOKEN and stop sending passwords.'
        : undefined,
    });
  } catch (err: any) {
    console.error('Keep sync error:', err);
    res.status(500).json({ error: err.message || 'Keep sync failed' });
  }
});

app.post('/api/google/keep/logout', (_req, res) => {
  keepSessionStore.email = undefined;
  keepSessionStore.masterToken = undefined;
  keepSessionStore.lastSyncAt = undefined;
  keepSessionStore.noteCount = undefined;
  res.json({ ok: true });
});

app.post('/api/google/organize', async (req, res) => {
  try {
    const notes = (req.body?.notes || []) as ImportedNotePayload[];
    if (!Array.isArray(notes) || notes.length === 0) {
      return res.status(400).json({ error: 'notes array is required' });
    }

    const compact = notes.slice(0, 80).map((n) => ({
      id: n.id,
      title: n.title,
      source: n.source,
      labels: n.labels || [],
      isPinned: n.isPinned,
      excerpt: (n.content || '').slice(0, 400),
    }));

    if (aiClient) {
      try {
        const systemInstruction = `You are a knowledge organization engine for Heptasurface.
Given imported Google Keep / Docs notes, produce thematic clusters, cross-note connections, an overview summary, highlights, and suggested chat questions.

Return ONLY valid JSON with this schema:
{
  "overview": "2-4 sentence synthesis of the corpus",
  "clusters": [
    {
      "id": "cluster-slug",
      "name": "Short theme name",
      "summary": "1-2 sentence cluster summary",
      "noteIds": ["id1","id2"],
      "color": "blue|orange|green|purple|yellow|red|gray",
      "keywords": ["kw1","kw2"]
    }
  ],
  "connections": [
    {
      "fromNoteId": "id",
      "toNoteId": "id",
      "label": "short edge label",
      "reasoning": "why these notes connect",
      "confidence": 0.0
    }
  ],
  "highlights": ["bullet insight"],
  "suggestedQuestions": ["question a user should ask the copilot"]
}

Rules:
- Every note id must appear in exactly one cluster when possible.
- Prefer 3-7 clusters.
- Connections should be insightful (shared entities, decisions→evidence, contradictions, follow-ups), confidence 0-1.
- Do not invent note ids.`;

        const response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Organize these ${compact.length} Google notes:\n${JSON.stringify(compact, null, 2)}`,
                },
              ],
            },
          ],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.35,
          },
        });

        const rawText = response.text || '';
        const parsed = JSON.parse(rawText);
        if (parsed && Array.isArray(parsed.clusters)) {
          return res.json({
            overview: parsed.overview || '',
            clusters: parsed.clusters,
            connections: Array.isArray(parsed.connections) ? parsed.connections : [],
            highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
            suggestedQuestions: Array.isArray(parsed.suggestedQuestions)
              ? parsed.suggestedQuestions
              : [],
          });
        }
      } catch (geminiError) {
        console.warn('Google organize Gemini call failed, using heuristic:', geminiError);
      }
    }

    return res.json(organizeNotesHeuristic(notes));
  } catch (error: any) {
    console.error('Organize error:', error);
    res.status(500).json({ error: error.message || 'Failed to organize notes' });
  }
});

// ---------------------------------------------------------------------------
// Optional Google Drive / Docs OAuth (when client credentials are configured)
// ---------------------------------------------------------------------------

app.get('/api/google/auth/start', (_req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).send(
      'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or use Keep Takeout import.'
    );
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get('/api/google/auth/callback', async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    if (!code) {
      return res.status(400).send('Missing OAuth code');
    }
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Google token exchange failed:', errText);
      return res.status(502).send('Failed to exchange Google OAuth code');
    }
    const tokenJson: any = await tokenRes.json();
    googleTokenStore.accessToken = tokenJson.access_token;
    if (tokenJson.refresh_token) googleTokenStore.refreshToken = tokenJson.refresh_token;
    googleTokenStore.expiry = Date.now() + (tokenJson.expires_in || 3600) * 1000;

    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${googleTokenStore.accessToken}` },
      });
      if (profileRes.ok) {
        const profile: any = await profileRes.json();
        googleTokenStore.email = profile.email;
      }
    } catch {
      // non-fatal
    }

    res.redirect('/?google_connected=1');
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    res.status(500).send(err.message || 'OAuth failed');
  }
});

async function ensureGoogleAccessToken(): Promise<string | null> {
  if (googleTokenStore.accessToken && (googleTokenStore.expiry || 0) > Date.now() + 30_000) {
    return googleTokenStore.accessToken;
  }
  if (!googleTokenStore.refreshToken || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return googleTokenStore.accessToken || null;
  }
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: googleTokenStore.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!tokenRes.ok) return null;
  const tokenJson: any = await tokenRes.json();
  googleTokenStore.accessToken = tokenJson.access_token;
  googleTokenStore.expiry = Date.now() + (tokenJson.expires_in || 3600) * 1000;
  return googleTokenStore.accessToken || null;
}

app.get('/api/google/drive/files', async (_req, res) => {
  try {
    const token = await ensureGoogleAccessToken();
    if (!token) {
      return res.status(401).json({ error: 'Not connected to Google. Visit /api/google/auth/start' });
    }
    const q = encodeURIComponent(
      "(mimeType='application/vnd.google-apps.document' or mimeType='text/plain' or mimeType='text/markdown') and trashed=false"
    );
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?pageSize=40&fields=files(id,name,mimeType,modifiedTime,webViewLink)&q=${q}&orderBy=modifiedTime desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!driveRes.ok) {
      const errText = await driveRes.text();
      return res.status(502).json({ error: 'Drive list failed', detail: errText });
    }
    const data: any = await driveRes.json();
    res.json({ files: data.files || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/google/drive/import', async (req, res) => {
  try {
    const fileIds: string[] = req.body?.fileIds || [];
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'fileIds required' });
    }
    const token = await ensureGoogleAccessToken();
    if (!token) {
      return res.status(401).json({ error: 'Not connected to Google' });
    }

    const notes: ImportedNotePayload[] = [];
    for (const fileId of fileIds.slice(0, 25)) {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,webViewLink,modifiedTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!metaRes.ok) continue;
      const meta: any = await metaRes.json();

      let content = '';
      if (meta.mimeType === 'application/vnd.google-apps.document') {
        const exportRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (exportRes.ok) content = await exportRes.text();
      } else {
        const mediaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (mediaRes.ok) content = await mediaRes.text();
      }

      notes.push({
        id: `gdrive-${fileId}`,
        source: meta.mimeType?.includes('document') ? 'docs' : 'drive',
        title: meta.name || 'Untitled Drive file',
        content: content.slice(0, 20000),
        labels: ['DRIVE'],
      });
    }

    res.json({ notes });
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
