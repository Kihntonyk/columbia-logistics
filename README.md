# Columbia Logistics — Inventory & Order Management System

[![Live Demo](https://img.shields.io/badge/Live%20Demo-columbia--logistics.onrender.com-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://columbia-logistics.onrender.com/)

> **[Try the live demo →](https://columbia-logistics.onrender.com/)**
> Hosted on Render's free tier, so the first load can take about 30 seconds while the server wakes up.

A full-stack warehouse management app for tracking stock, placing orders and receiving shipments, built on a relational SQLite database with a REST API and a live web dashboard.

- **Atomic transactions.** Every order and restock runs inside a single database transaction. The stock check, the stock update and the audit-log entry are saved together or not at all, so stock can never go negative and the history always matches the stock levels.
- **Relational data modeling.** Suppliers, inventory and transactions live in separate tables linked by foreign keys, and the API reads them back with `INNER JOIN` queries.
- **Real-time inventory tracking.** The dashboard reloads stock levels after every order or shipment, refreshes quietly every minute while it's open, flags items below 5 units with an amber **Low stock** tag, and shows the 10 most recent stock movements in an activity log.
- **AI Natural-Language Dispatch Bar.** Type a note like "Ship 4 bubble wrap to Columbia hub" and it runs as a regular order or restock. A two-tier parser uses Claude when an API key is set and falls back to a deterministic local keyword parser otherwise, so the feature works offline too.
- **A dashboard built for the warehouse floor.** Search and filter inventory, start an order or shipment from any row, check stock as you type, and get clear toasts. Skeletons show while data loads, empty and error states tell you what to do next, and every view works from a phone to a wide desktop.

## Dashboard

| Area | What it does |
|---|---|
| **Dispatch console** (top band) | Type a note in plain English and press **Run dispatch** (or press `/` from anywhere to jump there). Example notes fill the input with one click. The result line shows what was understood, the outcome, and which parser read it. |
| **Stock summary** | Items, units on hand and low-stock count. Clicking **Low stock** filters the table to those items. |
| **Inventory** | ID, item, stock, shelf (drawn as a bin label), supplier, and an amber **Low stock** tag. Search by item, shelf, supplier or ID, or filter to low stock. Each row's **Order** / **Receive** buttons prefill the form. |
| **Record a movement** | A **Place order** / **Receive shipment** toggle. The submit button turns blue for stock going out and green for stock coming in. Shows how many units are available, blocks orders larger than the stock on hand, and puts errors next to the field. |
| **Recent activity** | Time, type (Order / Received), item and signed quantity (−2 / +20) for the last 10 movements. The newest row flashes once when it arrives. |
| **Refresh** | Reloads everything and shows the last-updated time. Also runs quietly every 60 s and when you come back to the tab. |

The design decisions (palette, type, layout, and the reasoning behind each) are recorded in [`docs/ralph-notes.md`](docs/ralph-notes.md) and summarized in [`docs/2026-11-27-ralph-design-review.md`](docs/2026-11-27-ralph-design-review.md).

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND  ·  public/index.html + public/js/*.js             │
│  Tailwind CSS + Vanilla JavaScript modules (fetch API)       │
│                                                              │
│  • Dispatch console (AI natural-language dispatch)           │
│  • Inventory table: search, low-stock filter, row actions    │
│  • Place order / Receive shipment form                       │
│  • Recent activity log, toasts, auto-refresh                 │
└──────────────────────────────┬───────────────────────────────┘
                               │  HTTP + JSON
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND  ·  server.js                                       │
│  Node.js + Express REST API  (http://localhost:3000)         │
│                                                              │
│  GET  /api/inventory      POST /api/order                    │
│  GET  /api/low-stock      POST /api/restock                  │
│  GET  /api/transactions   POST /api/ai-dispatch              │
│  GET  /api/health                                            │
│                                                              │
│  AI dispatch: note → Claude (if key set) or local parser     │
│               → validated { action, item_id, quantity }      │
│  Orders and restocks run inside db.transaction():            │
│  check stock → update stock → write audit log → commit       │
└──────────────────────────────┬───────────────────────────────┘
                               │  better-sqlite3 (prepared statements)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  DATABASE  ·  warehouse.db  (SQLite)                         │
│                                                              │
│  ┌─────────────────┐     ┌─────────────────┐                 │
│  │ suppliers       │     │ inventory       │                 │
│  ├─────────────────┤     ├─────────────────┤                 │
│  │ supplier_id  PK │◄────┤ supplier_id  FK │                 │
│  │ supplier_name   │     │ item_id      PK │◄──┐             │
│  │ contact_phone   │     │ item_name       │   │             │
│  └─────────────────┘     │ stock_count     │   │             │
│                          │ shelf_location  │   │             │
│                          └─────────────────┘   │             │
│                                                │             │
│                          ┌─────────────────┐   │             │
│                          │ transactions    │   │             │
│                          ├─────────────────┤   │             │
│                          │ transaction_id  │   │             │
│                          │ item_id      FK ├───┘             │
│                          │ type (ORDER |   │                 │
│                          │       RESTOCK)  │                 │
│                          │ quantity        │                 │
│                          │ created_at      │                 │
│                          └─────────────────┘                 │
└──────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | **Node.js** (22 or newer) |
| API server | **Express** 5 |
| Database | **SQLite**, accessed through **better-sqlite3** |
| Styling | **Tailwind CSS** 3, compiled locally by the Tailwind CLI |
| Frontend logic | **Vanilla JavaScript** (`fetch`, DOM APIs, no framework) |

## REST API Endpoints

All endpoints accept and return JSON.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/inventory` | Lists every item with its stock count, shelf location and supplier name, sorted by item ID. |
| `GET` | `/api/low-stock` | Lists only the items with fewer than 5 units in stock, with supplier names. |
| `GET` | `/api/transactions` | Returns the 10 most recent stock movements (orders and restocks), newest first, with item names. |
| `POST` | `/api/order` | Places an order and removes the units from stock. Rejected if there isn't enough stock. |
| `POST` | `/api/restock` | Receives a shipment and adds the units to stock. |
| `POST` | `/api/ai-dispatch` | Interprets a plain-English note (e.g. `"Ship 4 bubble wrap"`) as an order or restock and runs it. |
| `GET` | `/api/health` | Returns `{ "status": "ok" }` when the server and database are working. Use it as Render's health check path. |

### Request body for `POST /api/order` and `POST /api/restock`

```json
{ "item_id": 101, "quantity": 3 }
```

Both values must be positive whole numbers.

### Responses

| Status | When |
|---|---|
| `200 OK` | The order or restock succeeded. The response includes the item name and the updated stock level. |
| `400 Bad Request` | `item_id` or `quantity` is invalid, or an order asks for more units than are in stock. |
| `404 Not Found` | No item has that `item_id`. |
| `500 Internal Server Error` | A database error occurred. Nothing is changed, because the transaction is rolled back. |

Example: an order that asks for more stock than is available.

```json
{ "error": "Insufficient stock", "item_id": 102, "requested": 50, "available": 1 }
```

### AI Natural-Language Dispatch Bar (`POST /api/ai-dispatch`)

The dashboard's dispatch console sends the typed note to this endpoint and shows a result line with what was understood (action, item, quantity, and which parser was used).

Request body:

```json
{ "prompt": "Received 20 packing tape" }
```

The note is turned into `{ "action": "ORDER" | "RESTOCK", "item_id", "quantity" }` and then runs the same database transaction as `/api/order` or `/api/restock`. The response includes an `interpretation` object that shows what was understood and which parser was used.

Parsing uses a dual-tier architecture:

1. **LLM tier.** **With `ANTHROPIC_API_KEY` set**, the note is sent to Claude (`claude-haiku-4-5`) together with the inventory list. If the Claude API can't be reached, the server falls back to the local parser and adds a `notice` to the interpretation.
2. **Deterministic fallback tier.** **Without a key** (or when the LLM call fails or times out after 15 seconds), a local parser matches the item by name or ID, reads the quantity, and looks for keywords: "received", "restock", "arrived" or "added" mean RESTOCK, and "ship", "order", "send" or "deduct" mean ORDER.

Whichever tier answers, the result is validated on the server (known action, existing item, positive whole-number quantity) before any stock is touched, so a wrong or malformed LLM reply can never change the database.

The endpoint returns `400` when the note can't be understood (no item, no action, or more than one possible quantity) or when an order asks for more stock than is available. Nothing is changed in either case.

To enable Claude, start the server with the key set:

```bash
ANTHROPIC_API_KEY=your-key npm start
```

## Local Setup & Installation

**Requirements:** [Node.js](https://nodejs.org/) 22 or newer, and Git. Port 3000 must be free, or set `PORT` to use another one (e.g. `PORT=8080 npm start`).

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kihntonyk/columbia-logistics.git
   cd columbia-logistics
   ```

2. **Install dependencies.** This also installs the Tailwind CSS CLI, which is a dev dependency.
   ```bash
   npm install
   ```

3. **Start the server.** This builds the stylesheet (`public/styles.css`) first, then starts the server.
   ```bash
   npm start
   ```
   On startup the server creates `warehouse.db` and any missing tables, and loads the sample suppliers and inventory if the `suppliers` table is empty. Existing data is never changed, so a fresh cloud deployment (e.g. Render) is ready to use straight away.

   To reset the database to the sample data and clear the transaction history, stop the server and run `node seed.js`.

4. **Open the dashboard** at **http://localhost:3000**.

### Updating an existing copy

The dashboard used to load Tailwind from a CDN. It now uses a stylesheet, `public/styles.css`, that is built locally and isn't committed. If you cloned the project before this change, run these after you pull:

```bash
git pull
npm install   # installs the Tailwind CLI
npm start     # builds public/styles.css, then starts the server
```

Start the server with `npm start` from now on, not `node server.js`. Running `node server.js` on its own skips the CSS build, so on a fresh pull the stylesheet is missing and the dashboard loads with no styling. To keep using `node server.js`, run `npm run build:css` first.

### Working on the dashboard styles

The dashboard's CSS is generated from the Tailwind classes used in `public/index.html` and the files in `public/js/`, so a class you add has no effect until the stylesheet is rebuilt. While you edit, leave the watcher running in a second terminal:

```bash
npm run watch:css
```

| Script | What it does |
|---|---|
| `npm start` | Builds the CSS, then runs `node server.js` |
| `npm run build:css` | Builds a minified `public/styles.css` once |
| `npm run watch:css` | Rebuilds `public/styles.css` every time a scanned file changes |

Tailwind only finds class names written out in full. A name pieced together in code, such as `` `bg-${color}-600` ``, gets no CSS, so write each class out completely, as the `MODES` object in `public/js/form.js` and `STYLES` in `public/js/toast.js` do. The design tokens (colors `ink`, `steel`, `line`, `paper`, `signal`, `out`, `in`, `danger`, and the Barlow font) live in `tailwind.config.js`. Shared component classes (`.panel`, `.field`, `.btn`, `.bin-label`, `.tag-low` and others) live in `styles/input.css`.

To try the API directly from a terminal:

```bash
curl http://localhost:3000/api/inventory

curl -X POST http://localhost:3000/api/order \
  -H "Content-Type: application/json" \
  -d '{"item_id": 101, "quantity": 2}'
```

### Running Automated Tests

The integration tests in `server.test.js` use Node's built-in test runner (`node:test`), so there's nothing extra to install. Run them with:

```bash
npm test
```

You don't need to run `node seed.js` or stop a running server first. The tests set `DB_PATH=":memory:"` before loading `server.js`, so each run gets its own fresh in-memory SQLite database seeded by `initializeDatabase()` from `seed.js`. Your `warehouse.db` is never read or changed. The test server listens on a port the OS picks, so it doesn't clash with a dev server on port 3000.

The suite covers:

- `GET /api/inventory` returns the seeded items with their supplier names
- `POST /api/order` deducts stock and logs an `ORDER` transaction
- `POST /api/order` rejects an order larger than the stock on hand with `400` and leaves stock unchanged
- `POST /api/order` returns `404` for an `item_id` that doesn't exist
- `POST /api/restock` increases stock and logs a `RESTOCK` transaction
- `POST /api/ai-dispatch` executes a natural-language restock note
- `POST /api/ai-dispatch` rejects a note it can't understand with `400` and changes nothing
- `GET /api/health` returns `200` with `{ "status": "ok" }`
- `GET /` serves the dashboard page

## Project Structure

```
columbia-logistics/
├── server.js          Express REST API and static file server
├── seed.js            Database schema and sample data; `node seed.js` resets warehouse.db
├── inventory.js       Standalone command-line script: processes one order and prints low-stock warnings
├── public/
│   ├── index.html     Dashboard page (HTML structure, styled with Tailwind CSS)
│   ├── favicon.svg    App icon
│   ├── js/            Dashboard JavaScript, split into ES modules
│   │   ├── main.js        Entry point: loading, search/filter state, refresh and auto-refresh
│   │   ├── api.js         fetch calls to the REST API
│   │   ├── render.js      Inventory rows, dropdown, stats, activity log, and loading/empty/error states
│   │   ├── form.js        Place order / Receive shipment form: modes, validation, prefill, submission
│   │   ├── dispatch.js    Dispatch console: sends notes, shows the result line, `/` shortcut
│   │   ├── toast.js       Success and error notifications
│   │   └── elements.js    Shared references to page elements
│   └── styles.css     Compiled Tailwind stylesheet (generated by npm run build:css, not committed)
├── styles/
│   └── input.css      Tailwind source stylesheet: base styles and shared component classes
├── tailwind.config.js Tailwind configuration: files to scan, design tokens (colors, font, animations)
├── docs/              Design notes and the dated design review
├── CLAUDE.md          Guide for AI coding assistants working in this repo
├── package.json
└── warehouse.db       SQLite database (created automatically on first start, not committed)
```

## Future Roadmap

**Next up**
- **Persistent storage on Render.** Attach a Render persistent disk and point `DB_PATH` at it, so data survives redeploys. The free tier has an ephemeral filesystem, so `warehouse.db` resets on every deploy or restart.
- **Sign-in and roles.** Shift leads can receive shipments and edit items, and pickers can place orders. Each activity row records who made the change.
- **Item management.** Add, edit and archive items and suppliers from the dashboard instead of `seed.js`.

**Later**
- **Per-item reorder points** in place of the single "fewer than 5" rule, with a reorder list grouped by supplier.
- **Full activity history** with paging, date-range and type filters, and CSV export.
- **Undo** for a movement recorded by mistake (a reversing transaction, so the audit log stays complete).
- **Barcode scanning** from a phone camera to pick the item in the form.
- **Multi-item dispatch notes** ("Ship 2 tape and 5 boxes") recorded as one atomic transaction.
- **Live updates across screens** via Server-Sent Events instead of the 60-second poll.
- **Browser tests** (Playwright) for the main flows at phone and desktop widths, run in CI next to `npm test`.

