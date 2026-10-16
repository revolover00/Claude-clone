# Claude UI Clone

A high-fidelity web application clone of Claude.ai powered by Google's Gemini models via the official `@google/genai` SDK. Built with React 19, TypeScript, Tailwind CSS, Express, and Server-Sent Events (SSE) streaming.

---

## Architecture Diagram

```
+--------------------------------------------------------------------------+
|                                CLIENT SPA                                |
|   (React 19 + TypeScript + Tailwind CSS + Lucide Icons + Vite)           |
+--------------------------------------------------------------------------+
  |                   |                     |                      |
  | [Tree State]      | [Chat Views]        | [Projects / Knowledge| [SSE Reader]
  | conversations     | MainChat            | /projects/:id        | SSEParser
  | Reducer (parentId,| MessageList         | ProjectInstructions  | token, thinking,
  | activeChildId)    | ChatMessage         | KnowledgeList        | sources, error
  |                   | ("‹ 2/3 ›" switcher)| ProjectsGrid         | [DONE]
+--------------------------------------------------------------------------+
                                    |
                    HTTP / SSE API (Port 3000 / Same-Origin)
                                    |
+--------------------------------------------------------------------------+
|                             BACKEND GATEWAY                              |
|                   (Node.js + Express 5 + TSX + CORS)                     |
+--------------------------------------------------------------------------+
  |                   |                     |                      |
  | CORS Validation   | Body Validation     | Rate Limiter         | Health Check
  | ALLOWED_ORIGIN    | <= 25MB, <= 100 msgs| 20 req/min / IP      | /api/health
  | (Same-origin def) | <= 100k char/msg    | express-rate-limit   | {ok, hasKey,
  |                   | <= 20MB attachments |                      |  models}
+--------------------------------------------------------------------------+
  |
  +----> /api/chat  (SSE Streaming: tokens, thoughts, grounding sources, errors)
  +----> /api/title (Fast 3-6 word auto-titling via gemini-3.1-flash-lite)
  |
  | [Abort Signal on Client Disconnect: req.on("close") -> abortCtrl.abort()]
  v
+--------------------------------------------------------------------------+
  |            /api/providers/:id/models  (live catalog + bundled fallback)
  |            /api/catalog               (merged catalog + facets/sync, no key needed)
  v
+--------------------------------------------------------------------------+
|                       BUNDLED MODEL CATALOG (committed)                  |
|  15 providers · 400+ models with context, pricing, modalities, dates     |
|  gemini · openai · xai · mistral · deepseek · groq · cerebras ·          |
|  togetherai · fireworks · nvidia · qwen · moonshotai · zai ·             |
|  perplexity · openrouter                                                 |
+--------------------------------------------------------------------------+
  |
  v
+--------------------------------------------------------------------------+
|                         GOOGLE GEMINI API (SDK)                          |
|             gemini-3.8-flash / gemini-3.1-pro-preview                    |
|         Google Search Grounding Tool + Extended Thinking Budget          |
+--------------------------------------------------------------------------+
```

---

## Features

- **Full Message Versioning & Branching**:
  - Editing any user message or clicking "Retry response" creates a new sibling branch in the conversation tree (`parentId` + `activeChildId`) without destructive overwrites.
  - Interactive `‹ 2/3 ›` switcher under user messages and assistant responses to freely toggle between variants.
  - Switching versions instantly swaps the downstream dialogue branch.
- **Projects Workspace (`/projects/:id`)**:
  - Custom system instructions configured per project and automatically injected into every conversation started within the project.
  - Knowledge base supporting file uploads (`.txt`, `.md`, `.json`, code files) and text snippets.
  - Dedicated conversations list scoped to each project.
- **Google Search Grounding**:
  - Live web search enabled with real-time SSE source streaming.
  - Displays "Searched the web" indicator during generation and an interactive "Sources" row with site favicons and external domain links.
- **Bundled Model Catalog (zero manual setup)**:
  - Every supported provider ships with its complete model list in the repository (`src/shared/catalog`), with full details: context window, max output, input/output modalities, tools, reasoning, structured output, vision, open weights, pricing per 1M tokens, knowledge cutoff, release date and lifecycle status.
  - Nothing has to be added by hand: a background **sync service** keeps the `provider_catalog` table fresh — OpenRouter from its public endpoint (no key), Gemini with the server's `GEMINI_API_KEY` (source `app-key`) and Groq with an optional `GROQ_API_KEY` (skipped when unset). Rows are upserted on `(provider, model_id)`; a model is only marked `removed` after it is missing from two consecutive successful full syncs, and never on a failed fetch or when the response shrinks below 50% of the previous count.
  - **Settings → Providers** lists all providers (connected or not) with their bundled model counts, and the **Model Catalog** browser shows every model of every provider, searchable and filterable by kind and capability, with live provider data merged on top when a key is connected.
  - The composer model picker shows the same catalog grouped per provider (Recommended first, then pinned, then provider/vendor groups); models whose provider has no key yet stay visible but dimmed with **Connect <provider> to use**, and selecting one opens Settings › Providers.
  - Providers without a bespoke adapter are wired through a single OpenAI-compatible factory (`server/lib/providers/openaiCompatible.ts`), so adding a provider is a data change.
  - Refresh the snapshot from the public models.dev dataset (MIT) with `npm run catalog:sync` (optionally `-- --from ./api.json` or `-- --only openai,groq`); the generator rewrites `src/shared/catalog/providers/*.ts` and `snapshot.ts`. Model names excluded by the repository naming policy are filtered out during generation.
- **Interactive Artifacts**:
  - Detects React components, HTML/Tailwind, SVGs, and documents with a live right-hand preview panel, version history, copy, and export options.
- **Harden & Secure Server Gateway**:
  - Strict CORS validation (`ALLOWED_ORIGIN`), express-rate-limit (20 req/min), 25MB body limit, 100 messages cap, 100,000 characters per message, and 20MB attachment caps.
  - Live stream cancellation via `AbortController` on client disconnect (`req.on("close")`).
  - Dynamic Vite loading ensuring zero dev dependencies imported in production.

---

## Environment Variables

Create a `.env` file in the root directory (based on `.env.example`):

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `GEMINI_API_KEY` | **Yes** | - | Your Google Gemini API key from Google AI Studio. Used for chat and to sync the Gemini catalog (source `app-key`). |
| `GROQ_API_KEY` | No | - | Optional Groq API key. When set, the Groq catalog is synced automatically; when missing, the Groq sync is skipped (bundled/offline data still serves the UI). |
| `PORT` | No | `3000` | Port for the full-stack server (default is 3000). |
| `ALLOWED_ORIGIN` | No | Same-origin only | Allowed CORS origin (e.g. `https://yourdomain.com`). If unset, requests are restricted to same-origin. |
| `ALLOW_GUEST` | No | `false` | Development only: lets `requireAuth` accept the guest/mock bearer token. Never honoured when `NODE_ENV=production`. |
| `VITE_ALLOW_LOCAL_MODE` | No | `false` | Development only: the client creates a local mock session so the app can be used without a Supabase project. |
| `VITE_BRAND_LOGO_URL` | No | unset | Opt-in URL for externally hosted brand artwork; the app uses its local vector mark by default. |
| `NODE_ENV` | No | `development` | Set to `production` when building for deployment. |

---

## Local Development Without Supabase

Every user-scoped endpoint (`/api/chat`, `/api/skills`, `/api/providers`, `/api/models/prefs`, ...) is guarded by `requireAuth` and expects the bearer token of the active session, so they answer `401` by default. To try the app locally with no Supabase project, set both flags:

```bash
ALLOW_GUEST=true VITE_ALLOW_LOCAL_MODE=true npm run dev
```

- `VITE_ALLOW_LOCAL_MODE=true` makes the client create a local mock session, so the app skips the login screen and `authFetch` (`src/utils/authHeaders.ts`) has a token to attach.
- `ALLOW_GUEST=true` lets the Express middleware accept that mock/guest token in development.

Requests never carry a hard-coded token: `authFetch` reads the access token from the live Supabase session on every call. Tokens are never copied into `localStorage` (the session already lives in Supabase's own storage; a leftover `supabase_token` key from older builds is deleted on startup).

---

## Authentication Failures & Diagnostics

**Server (`requireAuth`).** Every rejection is still `401` with a short human message, plus a machine-readable `code`:

| Code | Meaning |
|---|---|
| `AUTH_HEADER_MISSING` | No `Authorization` header was sent. |
| `AUTH_HEADER_MALFORMED` | The header is not `Bearer <token>` or the token is empty. |
| `AUTH_TOKEN_INVALID` | Supabase rejected the token. |
| `AUTH_TOKEN_EXPIRED` | Supabase rejected the token because it expired. |
| `AUTH_UNAVAILABLE` | The server could not verify the token (Supabase unreachable, timed out, or auth not configured). |

Each failure writes one log line with only metadata: method, path (no query string), code, whether a header was present, its scheme, the token length, host, origin and browser family. The token, or any part of it, is never logged.

`GET /api/auth/debug` needs no auth and is rate-limited (20 requests/minute per IP). It returns only `{ serverMode, hasAuthHeader, scheme, tokenLength, verified, userIdPrefix, errorCode }`, where `userIdPrefix` is the first 6 characters of the user id.

**Client (`authFetch`).** Before a request, the session is refreshed if it is missing or expires within 60 seconds. A `401` with an `AUTH_*` code triggers one refresh and one retry. If that still fails, `authFetch` dispatches `claude:session-expired`. Only one refresh runs at a time; concurrent callers share the same promise. `AUTH_UNAVAILABLE` is retried once without a refresh and never signs the user out. On `claude:session-expired`, or when Supabase drops the session after a failed background refresh, `AuthContext` signs out locally and shows the login screen with "Your session expired, please sign in again". After signing in, the user returns to the page they were on.

**UI.** Settings sections show "Your session is not valid" (with **Sign in again**, **Retry** and the code under **Details**) instead of raw HTTP errors. **Settings → About → Connection diagnostics** shows:

- client mode (real Supabase or local mock)
- session state and minutes until the token expires
- whether storage works and whether the app is framed
- the `/api/auth/debug` result

**Copy report** copies all of this without any token. When the app runs inside an iframe, a banner offers to open it in its own tab, because embedded previews can block storage and cookies.

---

## Bundled Model Catalog

The app never starts with an empty model list. `src/shared/catalog` holds a committed
snapshot of every model of every supported provider:

| Provider | Models | Provider | Models |
| :--- | ---: | :--- | ---: |
| Google AI Studio (`gemini`) | 26 | NVIDIA NIM | 65 |
| OpenAI | 39 | Qwen (Model Studio) | 38 |
| xAI | 22 | Moonshot AI (Kimi) | 5 |
| Mistral | 26 | Z.AI (GLM) | 7 |
| DeepSeek | 2 | Perplexity | 3 |
| Groq | 17 | OpenRouter | 129 |
| Cerebras | 4 | Together AI | 10 |
| Fireworks AI | 16 | | |

Each entry carries its details: context window, max output tokens, input/output
modalities, tools, reasoning, structured output, vision, open weights, USD pricing
per 1M tokens (input/output/cache read), knowledge cutoff, release date, and
`alpha`/`deprecated` status.

How it stays current, automatically:

- **Sync service** (`server/lib/catalog/`): fetches through the existing provider
  adapters — OpenRouter's public models endpoint (no key), Gemini with
  `GEMINI_API_KEY` (source `app-key`), Groq with an optional `GROQ_API_KEY`
  (skipped when unset). Every run upserts on `(provider, model_id)`; `first_seen_at`
  is written only on insert, while `last_seen_at` / `last_synced_at` always update.
- **Removal rule**: a row is marked `status: "removed"` only after it is missing from
  two consecutive *successful* full syncs. Rows are never deleted (conversations can
  still reference them), and no removals are recorded on a failed fetch or when the
  new count is under 50% of the previous one.
- **Schedule**: the scheduler runs once at startup and then every 6 hours, guarded
  by a database lock (a run started less than 5 minutes ago makes other instances
  skip). Each run writes a `catalog_sync_runs` row (time, added/updated/removed,
  status, error).
- **`GET /api/catalog`** serves the merged catalog (filters for `provider`, `kind`,
  `vendor`, `family`, `capability`, `status`, `free`, `q`, `sort`, cursor
  pagination) and triggers a background sync when the newest `last_synced_at` is
  older than 12 hours. `GET /api/catalog/facets` returns facet counts;
  `GET /api/catalog/sync-runs` and `POST /api/catalog/sync` are admin-only.
- **Settings → Model Catalog** is read-only for regular users; admins can hide a
  model, force-recommend it or set an alias (stored in `catalog_overrides`), and run
  **Sync now** per provider with the run history rendered from `catalog_sync_runs`.
- **App models**: the Gemini chat list is derived from `provider_catalog` (chat
  kind, active/preview) instead of manual rows; the default is the best recommended
  Gemini Flash model unless an admin overrides it. The legacy `models` table stays
  read-only, and `src/shared/fallbackModels.ts` is used only when both the catalog
  and a live fetch fail.
- **`GET /api/providers/:provider/models`** merges the live provider catalog over the
  bundled one. Missing keys are not an error: the bundled list is returned with
  `source: "bundled"` and a `liveError` when a live refresh was attempted.
- **`npm run catalog:sync`** regenerates the committed `src/shared/catalog`
  snapshot from the public models.dev dataset (MIT). The generator filters out names
  excluded by the repository naming policy before writing, and
  `tests/modelCatalog.test.ts` keeps the data, the runtime kind inference and the
  generator in sync.

---

## Available Scripts

```bash
# Start development server (serves frontend + backend via tsx)
npm run dev

# Refresh the bundled provider/model catalog from models.dev (models.dev/api.json)
npm run catalog:sync

# Run full Vitest test suite
npm run test

# Type-check with TypeScript compiler
npm run lint

# Build the frontend single-page application into dist/
npm run build

# Start production server (runs Node.js runtime on dist/)
npm run start
```

---

## Manual Verification Checklist for Message Versioning ("‹ 2/3 ›")

To manually test and verify the Claude.ai message version switcher in the UI:

- [ ] **1. Create Initial Message**:
  - Open the app and start a new chat. Send: `"Explain photosynthesis in two sentences."`
  - Assistant responds with version 1.
- [ ] **2. Retry Assistant Response**:
  - Hover over the assistant message and click the **Retry response** button (circular arrow).
  - A new response variant is streamed.
  - Verify that the `‹ 2/3 ›` switcher appears in the action row below the assistant message.
  - Click `‹` to view version `1/2`; verify the text immediately switches back to the first response.
  - Click `›` to view version `2/2`; verify the text updates to the retried response.
- [ ] **3. Edit User Message**:
  - Hover over the original user message and click the **Edit** (pencil) icon.
  - Change the text to: `"Explain cellular respiration in two sentences."` and press **Save & Submit**.
  - A new branch is created.
  - Under the user bubble, verify the `‹ 2/2 ›` version switcher appears cleanly below the bubble.
  - Toggle between `1/2` and `2/2` using `‹` and `›`.
  - Notice that switching between user message versions automatically swaps the entire downstream branch (including the corresponding assistant reply).
- [ ] **4. Multi-level Branching**:
  - Send a follow-up question while on branch 2.
  - Switch back to user version 1; confirm the conversation history cleanly reflects only the branch-1 lineage.

---

## Extended Thinking & Model Configuration

Extended thinking produces reasoning and thought summaries during response streaming. By default, `Gemini 3.1 Pro (Preview)` (`gemini-3.1-pro-preview`) is configured with `supports_thinking: true`.

> **Note for Administrators**: reasoning capability is derived from the bundled model catalog (`supportsReasoning` per model) and can be overridden per App model with `supports_thinking` in **Settings > Models**. The thinking router also reads the catalog directly for provider models, so non-Gemini providers get the right reasoning level without configuration.

---

## Deployment Notes

This application uses a full-stack architecture where `server.ts` hosts the Express backend API (`/api/chat`, `/api/title`, `/api/health`) and serves the static production build files from `./dist`.

### Deployment Requirements:
1. **Node.js Environment**: The hosting environment must support a persistent Node.js process (e.g. Google Cloud Run, Railway, Render, Fly.io, or an AWS/GCP VPS).
2. **Build Step**:
   ```bash
   npm install
   npm run build
   ```
3. **Execution Command**:
   ```bash
   npm run start
   # Executes: NODE_ENV=production tsx server.ts
   ```
4. **Environment Variables**: Configure `GEMINI_API_KEY` in your platform's environment configuration.
