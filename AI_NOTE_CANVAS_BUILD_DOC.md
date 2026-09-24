# AI Note Canvas Build Doc

This repository implements the AI Note Canvas architecture described in the product brief:

- **Canonical board state** — notes/edges/groups/positions/versions/history via board command API
- **Agent state** — LangGraph checkpointed conversation + proposals (user+board+thread)
- **Ephemeral UI context** — selection/viewport published through CopilotKit / canvas adapter

See `AI_INTEGRATION_INVENTORY.md` for the mapped systems. Prefer extending existing React canvas + Express Gemini stack over replacing them.

## Phases

| Phase | Status |
|---|---|
| A — Inspect + CopilotKit/LangGraph connect + one model | Done |
| B — Grounded note intelligence (search/fetch/citations/threads) | Done |
| C — Proposal system (preview/review/apply/undo) | Done |
| D — Model registry polish + presets | Done (single-provider; more providers when keys exist) |

## Runtime endpoints

- `POST /api/copilotkit` — CopilotKit v2 single-route runtime (`agentId: note-canvas`)
- `GET/PUT /api/boards/:id` — board sync (also upserts command-store version)
- `POST /api/canvas-ai/context` — resolve notes for a canvas context
- `POST /api/canvas-ai/search` — board-scoped note search
- `POST /api/canvas-ai/run` — LangGraph agent run (answer and/or proposal)
- `POST /api/canvas-ai/proposals/:id/apply` — atomic apply (idempotent by proposalId)
- `POST /api/canvas-ai/proposals/:id/discard` — discard
- `POST /api/canvas-ai/undo` — undo last applied proposal
- `GET /api/canvas-ai/models` — allowlisted model profiles

## Vertical slice

Select a note → ask in Canvas AI panel → server retrieves note text → streams grounded answer → citation badge focuses the card. Propose clusters/cards → ghost preview → Apply / Discard / Undo.

## Infrastructure notes

- Model credentials: `GEMINI_API_KEY` (aliased to `GOOGLE_API_KEY` for CopilotKit).
- Threads: LangGraph `MemorySaver` keyed by `boardId:threadId` (swap for durable store in production).
- No multi-user auth yet; board access is soft membership by `boardId`.
