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

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

app.post("/api/order", (req, res) => {
  const { item_id, quantity } = req.body ?? {};

  if (!isPositiveInteger(item_id) || !isPositiveInteger(quantity)) {
    return res
      .status(400)
      .json({ error: "item_id and quantity must be positive integers" });
  }

  try {
    const item = findItemQuery.get(item_id);

    if (!item) {
      return res.status(404).json({ error: `Item ${item_id} not found` });
    }

    if (item.stock_count < quantity) {
      return res.status(400).json({
        error: "Insufficient stock",
        item_id: item.item_id,
        requested: quantity,
        available: item.stock_count,
      });
    }

    decrementStockQuery.run(quantity, item_id);

    res.status(200).json({
      message: "Order placed",
      item_id: item.item_id,
      item_name: item.item_name,
      quantity_ordered: quantity,
      remaining_stock: item.stock_count - quantity,
    });
  } catch (error) {
    console.error(`Error: Failed to place order. ${error.message}`);
    res.status(500).json({ error: "Failed to place order" });
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
