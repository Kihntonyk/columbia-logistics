# CLAUDE.md

Guide for AI coding assistants working in this repository.

## What this is

Columbia Logistics Warehouse: an inventory and order management app for a small warehouse.
Node.js + Express 5 REST API (`server.js`), SQLite through better-sqlite3, and a vanilla-JS
dashboard (`public/`) styled with Tailwind CSS 3 compiled locally. It's deployed on Render:
https://columbia-logistics.onrender.com/

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Builds `public/styles.css`, then runs `node server.js` on `PORT` (default 3000) |
| `npm test` | API integration tests (`server.test.js`, `node:test`, in-memory DB). Must pass before committing. |
| `npm run build:css` | One-off Tailwind build. Run it after changing classes if the server is already running. |
| `npm run watch:css` | Rebuilds CSS on change while editing the UI |
| `node seed.js` | **Destructive.** Drops and reseeds `warehouse.db` |

Environment: `PORT`, `DB_PATH` (tests use `:memory:`), and `ANTHROPIC_API_KEY` (optional; it enables
Claude parsing in `/api/ai-dispatch`, and without it the local keyword parser is used).

## Architecture

- `server.js`: all routes. Orders and restocks run inside `db.transaction()` (check → update → log),
  and `/api/ai-dispatch` reuses those same transactions after validating the parsed note.
  `GET /api/health` is the Render health check.
- `seed.js`: schema plus sample data. `initializeDatabase()` runs on every start and is non-destructive.
- `public/js/`: ES modules, no framework and no bundler.
  - `main.js`: state (items, search query, filter), loading, refresh, 60 s auto-refresh, and queued refreshes.
  - `render.js`: all DOM building for inventory, stats, dropdown and activity, including the loading, empty and error rows.
  - `form.js`: Place order / Receive shipment toggle, inline validation, `prefillForm()` for row actions.
  - `dispatch.js`: dispatch console, example chips, the `/` shortcut.
  - `toast.js`: notifications. `api.js`: fetch wrappers. `elements.js`: element lookups.

## Design system (keep to it)

The UI went through three Ralph Loop design rounds. The reasoning is in `docs/ralph-notes.md` and
`docs/2026-11-27-ralph-design-review.md`. When you change the UI:

- **Tokens** live in `tailwind.config.js`: `ink` (dock band, text), `steel` (secondary text), `line`
  (borders), `paper` (page), `signal` (safety amber, **only** for low stock and the primary dock action),
  `out` (blue, stock leaving), `in` (green, stock arriving), `danger`. Don't add raw hex values or
  Tailwind's default palette (indigo, red, etc.).
- **Font:** Barlow only. Sentence-case labels. No all-caps eyebrows. Numbers use tabular figures (set globally).
- **Components** in `styles/input.css`: `.panel`, `.panel-head`, `.field`, `.field-label`, `.field-error`,
  `.btn`, `.btn-quiet`, `.bin-label` (shelf codes), `.tag-low`, `.tag-out`, `.tag-in`, `.skeleton`, `.spinner`.
- **Responsive:** tables reflow into stacked records below `md` using `max-md:` classes on rows and cells.
  Check 390, 820 and 1440 px.
- **Every data view needs** a loading state (skeleton), an empty state that says what to do, and an
  error state with "Try again".
- **Copy:** an action keeps one name through the flow ("Place order" → toast "Order placed").
  Errors say what happened and how to fix it, and don't apologize.
- **Tailwind only sees full class names.** Never build classes like `` `bg-${x}` ``.
- Respect `prefers-reduced-motion` (handled globally) and keep the amber `:focus-visible` ring.

## Conventions

- Validate on the server even when the client already validated (the client check is for UX only).
- New endpoints need a test in `server.test.js`. Tests must not touch `warehouse.db` or call the Claude API.
- Build DOM with `textContent` / `createElement`, never `innerHTML` with data (XSS).
- `public/styles.css` and `*.db` are generated and git-ignored.

## Next Steps

1. **Deploy to Render.** Push `main` and Render redeploys automatically. Confirm the service settings:
   - Build command: `npm install && npm run build:css`
   - Start command: `node server.js` (or `npm start`)
   - Health check path: `/api/health`
   - Environment: `NODE_VERSION=22` or newer, and optionally `ANTHROPIC_API_KEY` to enable Claude parsing.

   After it deploys, open the live URL and check the dashboard at phone and desktop widths. Then place an
   order, receive a shipment, and run a dispatch note.
2. **Keep data across deploys.** Render's free tier has an ephemeral filesystem, so `warehouse.db` resets to
   the sample data on each deploy or restart. Attach a persistent disk (paid plan) and set
   `DB_PATH=/var/data/warehouse.db`, or move to a hosted database.
3. **Add browser tests** (Playwright) for the main flows at 390 and 1440 px, run in CI.
4. Work through the **Future Roadmap** in `README.md`: sign-in and roles, item management, per-item
   reorder points, and full activity history.
