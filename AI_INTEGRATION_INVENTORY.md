# AI Integration Inventory

Generated for Heptasurface / Heptagon_Cntx while implementing the AI Note Canvas build doc.

| Inspect | Record |
|---|---|
| **Framework/build** | React **19.2**, Vite **8**, Express **4** (`tsx server.ts`), TanStack React Router **1.170**, package manager **npm**. SPA with Express middleware (Vite in dev, static `dist` in prod). No Next.js / no TanStack Start runtime despite some naming. |
| **Canvas** | Custom canvas in `SurfaceCanvas.tsx` (not React Flow / Konva). World coords via CSS `translate3d` + pan/zoom transform (`panX`, `panY`, `zoom`). Selection: `selectedCardId` in `App.tsx`. Viewport events: pointer pan, wheel zoom, fit/zoom-to-card. **No formal undo/history API yet** — local React state + `localStorage`; AI apply will introduce a command history stack. |
| **Notes** | `SurfaceCard` in `src/types/surface.ts`: `id`, `type`, `title`, `content`, `x/y/width/height`, `color`, `tags`, `sectionId`, optional file/table/map metadata, `createdAt`/`updatedAt`. Edges: `Connection` (`fromId`, `toId`, `label`, semantics). Boards: `Whiteboard` (`cards`, `connections`, `viewState`). Groups ≈ `type: 'section'` cards + `sectionId` membership. **No `boardVersion` field yet** — added by canvas AI adapter. |
| **Persistence** | Primary: `localStorage` key `heptasurface_data_v4_scale_datagrid`. Secondary: in-memory Express `boardsStore` via `PUT/GET /api/boards/:id` (`saveWhiteboardServerFn`). **No auth / multi-tenant DB**. Migrations: none; versioned storage keys. |
| **Existing AI** | `@google/genai` on server (`GEMINI_API_KEY`) — `/api/chat`, `/api/google/organize`. Client: `ChatPanel` + `TanStackAiSurfaceClient`. Google Keep bridge via Python `gkeepapi`. Browser never holds Gemini key. Model hard-coded `gemini-3.8-flash` in places. |
| **Retrieval** | Heuristic keyword scoring in chat fallback + Google organize clustering. **No embeddings / FTS index**. Canvas AI will add board-scoped hybrid keyword search first; embeddings optional later. |
| **UI chrome to preserve** | Hepta Dark / Dark / Light skins, orange/cyan accents, Mantine + Tailwind, existing ChatPanel and LatentToolbar. AI composer mounts inside existing canvas chrome (not a generic floating bubble as primary UX). |
| **Auth** | None. Single-user local demo. Board access checks are soft (boardId membership) until auth is added. |
| **CopilotKit / LangGraph plan** | React 19 compatible. Server: `@copilotkit/runtime/v2` `CopilotRuntime` + `BuiltInAgent` (Gemini) with tools; LangGraph `StateGraph` owns classify→retrieve→answer/propose→validate. Frontend: `@copilotkit/react-core` provider + compact `CanvasAiPanel`. AG-UI `LangGraphAgent` remote Platform path deferred (needs deployment URL); in-process LangGraph is authoritative. |

## Gaps closed by this work

1. Typed canvas adapter (`CanvasContext`, `CanvasOperation`, `ChangeProposal`).
2. Server board command handler with versions, idempotent apply, undo.
3. Model registry (allowlisted profiles; keys server-side only).
4. LangGraph note-canvas agent + CopilotKit runtime bridge.
5. Selection → grounded answer → citation focus vertical slice.
6. Proposal preview (ghost cards/edges) → review → apply/discard.
