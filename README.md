# Columbia Logistics — Inventory & Order Management System

A full-stack warehouse management app for tracking stock, placing orders and receiving shipments, built on a relational SQLite database with a REST API and a live web dashboard.

- **Atomic transactions.** Every order and restock runs inside a single database transaction. The stock check, the stock update and the audit-log entry are saved together or not at all, so stock can never go negative and the history always matches the stock levels.
- **Relational data modeling.** Suppliers, inventory and transactions live in separate tables linked by foreign keys, and the API reads them back with `INNER JOIN` queries.
- **Real-time inventory tracking.** The dashboard reloads stock levels after every order or shipment, flags items below 5 units with a **Low Stock** badge, and shows the 10 most recent stock movements in an activity log.
- **AI Natural-Language Dispatch Bar.** Type a note like "Ship 4 bubble wrap to Columbia hub" and it runs as a regular order or restock. A two-tier parser uses Claude when an API key is set and falls back to a deterministic local keyword parser otherwise, so the feature works offline too.

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND  ·  public/index.html + public/js/*.js             │
│  Tailwind CSS + Vanilla JavaScript modules (fetch API)       │
│                                                              │
│  • AI Natural-Language Dispatch Bar                          │
│  • Inventory table with Low Stock badges                     │
│  • Place Order / Receive Shipment form                       │
│  • Recent Activity Log                                       │
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

The dashboard's dispatch bar sends the typed note to this endpoint and shows a badge with what was understood (action, item, quantity, and which parser was used).

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

Tailwind only finds class names written out in full. A name pieced together in code, such as `` `bg-${color}-600` ``, gets no CSS, so write each class out completely, as the `MODES` object in `public/js/form.js` and `BANNER_STYLES` in `public/js/banner.js` do.

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

## Project Structure

```
columbia-logistics/
├── server.js          Express REST API and static file server
├── seed.js            Database schema and sample data; `node seed.js` resets warehouse.db
├── inventory.js       Standalone command-line script: processes one order and prints low-stock warnings
├── public/
│   ├── index.html     Dashboard page (HTML structure, styled with Tailwind CSS)
│   ├── js/            Dashboard JavaScript, split into ES modules
│   │   ├── main.js        Entry point: loads the data and connects the modules
│   │   ├── api.js         fetch calls to the REST API
│   │   ├── render.js      Builds the inventory table, dropdown, stats and activity log
│   │   ├── form.js        Order / restock form: modes and submission
│   │   ├── dispatch.js    AI Natural-Language Dispatch Bar: sends notes, shows the interpretation badge
│   │   ├── banner.js      Success and error messages
│   │   └── elements.js    Shared references to page elements
│   └── styles.css     Compiled Tailwind stylesheet (generated by npm run build:css, not committed)
├── styles/
│   └── input.css      Tailwind source stylesheet (@tailwind directives)
├── tailwind.config.js Tailwind configuration: which files to scan for class names
├── package.json
└── warehouse.db       SQLite database (created automatically on first start, not committed)
```
