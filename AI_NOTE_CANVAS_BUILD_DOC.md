# AI Note Canvas Build Doc

This repository implements the AI Note Canvas architecture described in the product brief:

- **Canonical board state** — notes/edges/groups/positions/versions/history via board command API
- **Agent state** — LangGraph checkpointed conversation + proposals (user+board+thread)
- **Ephemeral UI context** — selection/viewport published through canvas adapter / server fns

See `AI_INTEGRATION_INVENTORY.md` for the mapped systems. Prefer extending existing React canvas + Express Gemini stack over replacing them.

## Phases

| Phase | Status |
|---|---|
| A — Inspect + CopilotKit/LangGraph connect + one model | Done |
| B — Grounded note intelligence (search/fetch/citations/threads) | Done |
| C — Proposal system (preview/review/apply/undo) | Done |
| D — Model registry polish + presets | Done (single-provider; more providers when keys exist) |

## Server functions (TanStack Start–friendly)

UI calls typed server functions — no hand-rolled `/api/canvas-ai/*` REST clients.

| Function | Purpose |
|---|---|
| `listCanvasModelsFn` | Allowlisted model profiles |
| `syncBoardFn` / `saveBoardFn` | Upsert board into command store |
| `resolveCanvasNotesFn` | Resolve notes for canvas context |
| `searchCanvasNotesFn` | Board-scoped note search |
| `runCanvasAiFn` | LangGraph agent run |
| `applyCanvasProposalFn` | Atomic apply |
| `discardCanvasProposalFn` | Discard |
| `undoCanvasProposalFn` | Undo last apply |

Handlers are registered in `src/server/registerServerFns.ts` and invoked in-process on the server. The browser uses a single Start-style transport: `POST /_server/fn`.

Optional: `POST /api/copilotkit` — CopilotKit v2 bridge (`agentId: note-canvas`).

## Vertical slice

Select a note → ask in the forever dock → `runCanvasAiFn` retrieves note text → grounded answer → citation chips focus cards. Propose → ghost preview → Apply / Discard / Undo.

## Forever dock

Viewport-fixed composer above latent/control bars. Framed solid shell. Dialogue panel spring-slides up; folds 5s after click-away. No quick-prompt suggestion chips — only model dialogue.

## Infrastructure notes

- Model credentials: `GEMINI_API_KEY` (aliased to `GOOGLE_API_KEY` for CopilotKit).
- Threads: LangGraph `MemorySaver` keyed by `boardId:threadId` (swap for durable store in production).
- No multi-user auth yet; board access is soft membership by `boardId`.
