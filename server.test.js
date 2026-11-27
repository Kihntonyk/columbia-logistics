// Integration tests for the warehouse API.
//
// Each run uses a fresh in-memory SQLite database seeded by seed.js, so the
// real warehouse.db is never touched. Run with `npm test`.

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

// Must be set before server.js is required: it reads DB_PATH at load time.
process.env.DB_PATH = ":memory:";
const { app, db } = require("./server");

let server;
let baseUrl;

// Start the app on port 0 so the OS assigns a free port.
before(async () => {
  await new Promise((resolve, reject) => {
    server = app.listen(0, (error) => (error ? reject(error) : resolve()));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

// --- Helpers ---

// Reads an item's current stock straight from the database, so assertions
// don't depend on the API reporting it correctly.
function getStock(itemId) {
  return db
    .prepare("SELECT stock_count FROM inventory WHERE item_id = ?")
    .get(itemId).stock_count;
}

// Returns the most recent transaction row for an item, or undefined.
function getLatestTransaction(itemId) {
  return db
    .prepare(
      `SELECT type, quantity FROM transactions
       WHERE item_id = ?
       ORDER BY transaction_id DESC
       LIMIT 1`,
    )
    .get(itemId);
}

function countTransactions() {
  return db.prepare("SELECT COUNT(*) AS n FROM transactions").get().n;
}

// POSTs a JSON body and returns { status, body }.
async function postJson(path, payload) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

// --- Tests ---

test("GET /api/inventory returns 200 and the seeded items with supplier_name", async () => {
  const res = await fetch(`${baseUrl}/api/inventory`);
  assert.equal(res.status, 200);

  const items = await res.json();
  assert.ok(Array.isArray(items), "response should be an array");
  // seed.js inserts four items: 101–104.
  assert.deepEqual(
    items.map((item) => item.item_id),
    [101, 102, 103, 104],
  );

  // Every row should carry the joined supplier name.
  for (const item of items) {
    assert.equal(typeof item.supplier_name, "string");
    assert.ok(item.supplier_name.length > 0);
  }
  assert.equal(items[0].supplier_name, "Columbia Label Supply");
});

test("POST /api/order deducts stock and logs an ORDER transaction", async () => {
  // Item 101 (Shipping Labels) is seeded with 12 units.
  const stockBefore = getStock(101);

  const { status, body } = await postJson("/api/order", {
    item_id: 101,
    quantity: 3,
  });

  assert.equal(status, 200);
  assert.equal(body.remaining_stock, stockBefore - 3);
  assert.equal(getStock(101), stockBefore - 3);
  assert.deepEqual(getLatestTransaction(101), { type: "ORDER", quantity: 3 });
});

test("POST /api/order rejects insufficient stock with 400 and leaves stock unchanged", async () => {
  // Item 102 (Packing Tape) is seeded with only 1 unit.
  const stockBefore = getStock(102);
  const transactionsBefore = countTransactions();

  const { status, body } = await postJson("/api/order", {
    item_id: 102,
    quantity: stockBefore + 10,
  });

  assert.equal(status, 400);
  assert.equal(body.error, "Insufficient stock");
  assert.equal(body.available, stockBefore);
  // Neither the stock nor the audit log should have changed.
  assert.equal(getStock(102), stockBefore);
  assert.equal(countTransactions(), transactionsBefore);
});

test("POST /api/order rejects a non-existent item_id with 404", async () => {
  const transactionsBefore = countTransactions();

  const { status, body } = await postJson("/api/order", {
    item_id: 9999,
    quantity: 1,
  });

  assert.equal(status, 404);
  assert.match(body.error, /not found/);
  assert.equal(countTransactions(), transactionsBefore);
});

test("POST /api/restock increases stock and logs a RESTOCK transaction", async () => {
  // Item 104 (Cardboard Boxes) is seeded with 2 units.
  const stockBefore = getStock(104);

  const { status, body } = await postJson("/api/restock", {
    item_id: 104,
    quantity: 20,
  });

  assert.equal(status, 200);
  assert.equal(body.new_stock, stockBefore + 20);
  assert.equal(getStock(104), stockBefore + 20);
  assert.deepEqual(getLatestTransaction(104), {
    type: "RESTOCK",
    quantity: 20,
  });
});
