const path = require("path");
const Database = require("better-sqlite3");

// --- Database connection ---
const dbPath = path.join(__dirname, "warehouse.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

// --- Low-stock report ---
function checkLowStock() {
  let lowStockItems;

  try {
    lowStockItems = db
      .prepare(
        `
      SELECT
        inventory.item_id,
        inventory.item_name,
        inventory.stock_count,
        inventory.shelf_location,
        suppliers.supplier_name
      FROM inventory
      INNER JOIN suppliers
        ON inventory.supplier_id = suppliers.supplier_id
      WHERE inventory.stock_count < 5
    `,
      )
      .all();
  } catch (error) {
    console.error(`Error: Failed to check low stock levels. ${error.message}`);
    return;
  }

  for (const item of lowStockItems) {
    console.warn(
      `Low stock: ${item.item_name} (ID ${item.item_id}) has ${item.stock_count} left at ${item.shelf_location} (supplier: ${item.supplier_name})`,
    );
  }
}

// --- Order processing ---
function processOrder(itemID, quantity) {
  try {
    // Look up the item to validate the order before changing anything.
    const item = db
      .prepare(
        `
      SELECT item_name, stock_count
      FROM inventory
      WHERE item_id = ?
    `,
      )
      .get(itemID);

    if (!item) {
      console.error(`Error: No item found with ID ${itemID}`);
      return false;
    }

    if (quantity > item.stock_count) {
      console.error(
        `Error: Insufficient stock for ${item.item_name}. Only ${item.stock_count} left.`,
      );
      return false;
    }

    db.prepare(
      `
      UPDATE inventory
      SET stock_count = stock_count - ?
      WHERE item_id = ?
    `,
    ).run(quantity, itemID);
  } catch (error) {
    console.error(
      `Error: Database failure while processing order for item ${itemID}. ${error.message}`,
    );
    return false;
  }

  checkLowStock();
  return true;
}

processOrder(103, 3);

db.close();
