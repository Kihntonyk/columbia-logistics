const path = require("path");
const Database = require("better-sqlite3");

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_name TEXT,
    contact_phone TEXT
  );

  CREATE TABLE IF NOT EXISTS inventory (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT,
    stock_count INTEGER,
    shelf_location TEXT,
    supplier_id INTEGER,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ORDER', 'RESTOCK')),
    quantity INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory(item_id)
  );
`;

// Inserts the sample suppliers and inventory in one transaction.
function insertSampleData(db) {
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (supplier_name, contact_phone)
    VALUES (?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO inventory (item_id, item_name, stock_count, shelf_location, supplier_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  const seed = db.transaction(() => {
    const labelSupplyId = insertSupplier.run(
      "Columbia Label Supply",
      "212-555-0141",
    ).lastInsertRowid;

    const packingSupplyId = insertSupplier.run(
      "Hudson Packing Co.",
      "212-555-0198",
    ).lastInsertRowid;

    insertItem.run(101, "Shipping Labels", 12, "A1", labelSupplyId);
    insertItem.run(102, "Packing Tape", 1, "B2", labelSupplyId);
    insertItem.run(103, "Bubble Wrap", 5, "C3", packingSupplyId);
    insertItem.run(104, "Cardboard Boxes", 2, "D4", packingSupplyId);
  });

  seed();
}

// Non-destructive startup setup used by server.js: creates any missing tables
// and loads the sample data only if the suppliers table is empty. Existing
// data is never touched. Returns true if sample data was inserted.
function initializeDatabase(db) {
  db.exec(SCHEMA_SQL);
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM suppliers").get();
  if (count > 0) return false;
  insertSampleData(db);
  return true;
}

// Destructive reset used by `node seed.js`: drops all tables, recreates them
// and reloads the sample data.
function seedDatabase(db) {
  db.exec(`
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS inventory;
    DROP TABLE IF EXISTS suppliers;
  `);
  db.exec(SCHEMA_SQL);
  insertSampleData(db);
}

module.exports = { seedDatabase, initializeDatabase };

// --- CLI entry point: `node seed.js` reseeds warehouse.db ---
if (require.main === module) {
  const dbPath = path.join(__dirname, "warehouse.db");
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  seedDatabase(db);

  // --- Verification output ---
  const suppliers = db.prepare("SELECT * FROM suppliers").all();
  const inventory = db.prepare("SELECT * FROM inventory").all();

  console.log(`Seeded ${dbPath}`);
  console.log("Suppliers:", suppliers);
  console.log("Inventory:", inventory);
  console.log("Transactions table ready (empty).");

  db.close();
}
