# Columbia Logistics — Inventory & Order Management System

A full-stack warehouse management app for tracking stock, placing orders and receiving shipments, built on a relational SQLite database with a REST API and a live web dashboard.

- **Atomic transactions.** Every order and restock runs inside a single database transaction. The stock check, the stock update and the audit-log entry are saved together or not at all, so stock can never go negative and the history always matches the stock levels.
- **Relational data modeling.** Suppliers, inventory and transactions live in separate tables linked by foreign keys, and the API reads them back with `INNER JOIN` queries.
- **Real-time inventory tracking.** The dashboard reloads stock levels after every order or shipment, flags items below 5 units with a **Low Stock** badge, and shows the 10 most recent stock movements in an activity log.

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND  ·  public/index.html                              │
│  Tailwind CSS + Vanilla JavaScript (fetch API)               │
│                                                              │
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
│  GET  /api/transactions                                      │
│                                                              │
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
| Styling | **Tailwind CSS** (via CDN) |
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

## Local Setup & Installation

**Requirements:** [Node.js](https://nodejs.org/) 22 or newer, and Git. Port 3000 must be free.

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kihntonyk/columbia-logistics.git
   cd columbia-logistics
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create and seed the database.** This creates `warehouse.db` with sample suppliers and inventory.
   ```bash
   node seed.js
   ```
   Running it again resets the database to the sample data and clears the transaction history.

4. **Start the server**
   ```bash
   node server.js
   ```

5. **Open the dashboard** at **http://localhost:3000**.

To try the API directly from a terminal:

```bash
curl http://localhost:3000/api/inventory

curl -X POST http://localhost:3000/api/order \
  -H "Content-Type: application/json" \
  -d '{"item_id": 101, "quantity": 2}'
```

## Project Structure

```
columbia-logistics/
├── server.js          Express REST API and static file server
├── seed.js            Creates the database schema and loads sample data
├── inventory.js       Standalone command-line script: processes one order and prints low-stock warnings
├── public/
│   └── index.html     Dashboard (Tailwind CSS + vanilla JavaScript)
├── package.json
└── warehouse.db       SQLite database (created by seed.js, not committed)
```
