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
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || `${APP_URL}/api/google/auth/callback`;

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

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
].join(' ');

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
    const label = (note.labels && note.labels[0]) || 'general';
    const key = label.toLowerCase();
    if (!byLabel.has(key)) byLabel.set(key, []);
    byLabel.get(key)!.push(idx);
  });

  const clusters: any[] = [];
  let colorIdx = 0;
  const assigned = new Set<number>();

  for (const [label, idxs] of byLabel) {
    const keywordFreq = new Map<string, number>();
    for (const i of idxs) {
      for (const t of tokenSets[i]) keywordFreq.set(t, (keywordFreq.get(t) || 0) + 1);
    }
    const keywords = [...keywordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);
    clusters.push({
      id: `cluster-${label}-${clusters.length}`,
      name: label.charAt(0).toUpperCase() + label.slice(1),
      summary: `${idxs.length} notes under “${label}”. Keywords: ${keywords.slice(0, 3).join(', ') || 'n/a'}.`,
      noteIds: idxs.map((i) => notes[i].id),
      color: CLUSTER_COLORS[colorIdx++ % CLUSTER_COLORS.length],
      keywords,
    });
    idxs.forEach((i) => assigned.add(i));
  }

  // Catch any unassigned (shouldn't happen with general fallback)
  notes.forEach((note, idx) => {
    if (assigned.has(idx)) return;
    clusters.push({
      id: `cluster-misc-${idx}`,
      name: note.title.slice(0, 40),
      summary: 'Standalone imported note.',
      noteIds: [note.id],
      color: CLUSTER_COLORS[colorIdx++ % CLUSTER_COLORS.length],
      keywords: tokenizeLocal(note.title).slice(0, 3),
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
      const confidence = Math.min(0.95, score + (sharedLabels.length ? 0.25 : 0));
      if (confidence < 0.18) continue;
      const sharedTokens = [...a].filter((t) => b.has(t)).slice(0, 4);
      connections.push({
        fromNoteId: notes[i].id,
        toNoteId: notes[j].id,
        label: sharedLabels[0] || sharedTokens[0] || 'related',
        reasoning:
          sharedLabels.length > 0
            ? `Share label(s): ${sharedLabels.join(', ')}`
            : `Overlap on: ${sharedTokens.join(', ')}`,
        confidence,
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
      .join(', ')}.`,
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
    keepImportMethods: ['takeout-zip', 'takeout-json', 'takeout-html', 'paste'],
  });
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
