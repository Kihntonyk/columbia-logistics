const path = require("path");
const express = require("express");
const Database = require("better-sqlite3");

const PORT = 3000;
const dbPath = path.join(__dirname, "warehouse.db");

// --- Database connection ---
let db;
try {
  // fileMustExist prevents silently creating an empty DB if seed.js hasn't been run.
  db = new Database(dbPath, { fileMustExist: true });
  db.pragma("foreign_keys = ON");
  console.log(`Connected to SQLite database at ${dbPath}`);
} catch (error) {
  console.error(
    `Error: Failed to connect to warehouse database. ${error.message}`,
  );
  process.exit(1);
}

// --- Schema migration ---
// Databases seeded before the transactions table existed get it created here.
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('ORDER', 'RESTOCK')),
      quantity INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES inventory(item_id)
    );
  `);
} catch (error) {
  console.error(
    `Error: Failed to ensure transactions table exists. ${error.message}`,
  );
  db.close();
  process.exit(1);
}

// --- Express app ---
const app = express();
app.use(express.json());

// Serves the dashboard (public/index.html) at "/". Resolved from __dirname so it
// works no matter which directory the server is started from.
app.use(express.static(path.join(__dirname, "public")));

const allInventoryQuery = db.prepare(`
  SELECT
    inventory.item_id,
    inventory.item_name,
    inventory.stock_count,
    inventory.shelf_location,
    suppliers.supplier_name
  FROM inventory
  INNER JOIN suppliers ON inventory.supplier_id = suppliers.supplier_id
  ORDER BY inventory.item_id
`);

app.get("/api/inventory", (_req, res) => {
  try {
    const items = allInventoryQuery.all();
    res.json(items);
  } catch (error) {
    console.error(`Error: Failed to fetch inventory. ${error.message}`);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

const lowStockQuery = db.prepare(`
  SELECT
    inventory.item_id,
    inventory.item_name,
    inventory.stock_count,
    inventory.shelf_location,
    suppliers.supplier_name
  FROM inventory
  INNER JOIN suppliers ON inventory.supplier_id = suppliers.supplier_id
  WHERE inventory.stock_count < 5
`);

app.get("/api/low-stock", (_req, res) => {
  try {
    const items = lowStockQuery.all();
    res.json(items);
  } catch (error) {
    console.error(`Error: Failed to fetch low-stock items. ${error.message}`);
    res.status(500).json({ error: "Failed to fetch low-stock items" });
  }
});

const findItemQuery = db.prepare(`
  SELECT item_id, item_name, stock_count
  FROM inventory
  WHERE item_id = ?
`);

const decrementStockQuery = db.prepare(`
  UPDATE inventory
  SET stock_count = stock_count - ?
  WHERE item_id = ?
`);

const incrementStockQuery = db.prepare(`
  UPDATE inventory
  SET stock_count = stock_count + ?
  WHERE item_id = ?
`);

const insertTransactionQuery = db.prepare(`
  INSERT INTO transactions (item_id, type, quantity)
  VALUES (?, ?, ?)
`);

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

// Each transaction function returns { status, body }. The lookup, stock
// update, and log insert all run inside one SQLite transaction, so the stock
// change and its log row either both commit or both roll back.
const placeOrder = db.transaction((item_id, quantity) => {
  const item = findItemQuery.get(item_id);

  if (!item) {
    return { status: 404, body: { error: `Item ${item_id} not found` } };
  }

  if (item.stock_count < quantity) {
    return {
      status: 400,
      body: {
        error: "Insufficient stock",
        item_id: item.item_id,
        requested: quantity,
        available: item.stock_count,
      },
    };
  }

  decrementStockQuery.run(quantity, item_id);
  insertTransactionQuery.run(item_id, "ORDER", quantity);

  return {
    status: 200,
    body: {
      message: "Order placed",
      item_id: item.item_id,
      item_name: item.item_name,
      quantity_ordered: quantity,
      remaining_stock: item.stock_count - quantity,
    },
  };
});

const receiveRestock = db.transaction((item_id, quantity) => {
  const item = findItemQuery.get(item_id);

  if (!item) {
    return { status: 404, body: { error: `Item ${item_id} not found` } };
  }

  incrementStockQuery.run(quantity, item_id);
  insertTransactionQuery.run(item_id, "RESTOCK", quantity);

  return {
    status: 200,
    body: {
      message: "Restock received",
      item_id: item.item_id,
      item_name: item.item_name,
      quantity_received: quantity,
      new_stock: item.stock_count + quantity,
    },
  };
});

app.post("/api/order", (req, res) => {
  const { item_id, quantity } = req.body ?? {};

  if (!isPositiveInteger(item_id) || !isPositiveInteger(quantity)) {
    return res
      .status(400)
      .json({ error: "item_id and quantity must be positive integers" });
  }

  try {
    const { status, body } = placeOrder(item_id, quantity);
    res.status(status).json(body);
  } catch (error) {
    console.error(`Error: Failed to place order. ${error.message}`);
    res.status(500).json({ error: "Failed to place order" });
  }
});

app.post("/api/restock", (req, res) => {
  const { item_id, quantity } = req.body ?? {};

  if (!isPositiveInteger(item_id) || !isPositiveInteger(quantity)) {
    return res
      .status(400)
      .json({ error: "item_id and quantity must be positive integers" });
  }

  try {
    const { status, body } = receiveRestock(item_id, quantity);
    res.status(status).json(body);
  } catch (error) {
    console.error(`Error: Failed to receive restock. ${error.message}`);
    res.status(500).json({ error: "Failed to receive restock" });
  }
});

// transaction_id breaks ties for rows created within the same second.
const recentTransactionsQuery = db.prepare(`
  SELECT
    transactions.transaction_id,
    transactions.item_id,
    inventory.item_name,
    transactions.type,
    transactions.quantity,
    transactions.created_at
  FROM transactions
  INNER JOIN inventory ON transactions.item_id = inventory.item_id
  ORDER BY transactions.created_at DESC, transactions.transaction_id DESC
  LIMIT 10
`);

app.get("/api/transactions", (_req, res) => {
  try {
    res.json(recentTransactionsQuery.all());
  } catch (error) {
    console.error(`Error: Failed to fetch transactions. ${error.message}`);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// --- Listener ---
let server;
try {
  server = app.listen(PORT, (error) => {
    if (error) {
      console.error(`Error: Server failed to start. ${error.message}`);
      db.close();
      process.exit(1);
    }
    console.log(`Warehouse API listening on http://localhost:${PORT}`);
  });
} catch (error) {
  console.error(`Error: Failed to initialize server. ${error.message}`);
  db.close();
  process.exit(1);
}

// --- Graceful shutdown ---
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
