const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "warehouse.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

db.exec(`
  DROP TABLE IF EXISTS inventory;
  DROP TABLE IF EXISTS suppliers;

  CREATE TABLE suppliers (
    supplier_id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_name TEXT,
    contact_phone TEXT
  );

  CREATE TABLE inventory (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT,
    stock_count INTEGER,
    shelf_location TEXT,
    supplier_id INTEGER,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
  );
`);

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

const suppliers = db.prepare("SELECT * FROM suppliers").all();
const inventory = db.prepare("SELECT * FROM inventory").all();

console.log(`Seeded ${dbPath}`);
console.log("Suppliers:", suppliers);
console.log("Inventory:", inventory);

db.close();
