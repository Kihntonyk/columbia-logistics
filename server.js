const path = require("path");
const express = require("express");
const Database = require("better-sqlite3");
const { initializeDatabase } = require("./seed");

const PORT = process.env.PORT || 3000;
// DB_PATH lets tests point the server at a throwaway database (e.g. ":memory:").
const dbPath = process.env.DB_PATH || path.join(__dirname, "warehouse.db");

// --- Database connection and setup ---
// Creates warehouse.db if it doesn't exist, creates any missing tables, and
// loads the sample suppliers and inventory when the suppliers table is empty.
// A fresh deployment (or an in-memory test DB) is ready without running seed.js.
let db;
try {
  db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  const seeded = initializeDatabase(db);
  console.log(
    `Connected to SQLite database at ${dbPath}${seeded ? " (loaded sample data)" : ""}`,
  );
} catch (error) {
  console.error(
    `Error: Failed to initialize warehouse database. ${error.message}`,
  );
  process.exit(1);
}

// --- Express app ---
const app = express();
app.use(express.json());

// Serves the dashboard (public/index.html) at "/". Resolved from __dirname so it
// works no matter which directory the server is started from.
app.use(express.static(path.join(__dirname, "public")));

// Health check for the hosting platform (Render pings this to know the app is up).
app.get("/api/health", (_req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok" });
  } catch (error) {
    console.error(`Error: Health check failed. ${error.message}`);
    res.status(503).json({ status: "error" });
  }
});

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

// --- AI natural-language dispatch ---
// Turns a free-text note ("Ship 4 bubble wrap to Columbia hub") into an
// ORDER or RESTOCK. Uses Claude when ANTHROPIC_API_KEY is set, and a local
// keyword parser otherwise (or if the Claude API can't be reached).

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5";
const ANTHROPIC_TIMEOUT_MS = 15000;
const MAX_PROMPT_LENGTH = 500;

const RESTOCK_KEYWORDS = new Set([
  "receive", "received", "receiving",
  "restock", "restocked", "restocking",
  "arrive", "arrived", "arriving",
  "add", "added", "adding",
]);
const ORDER_KEYWORDS = new Set([
  "ship", "shipped", "shipping",
  "order", "ordered", "ordering",
  "send", "sent", "sending",
  "deduct", "deducted", "deducting",
]);

// Reduces a word to a simple singular form so "boxes" matches "Box" and
// "labels" matches "Label".
function stem(word) {
  if (/(x|ch|sh|ss)es$/.test(word)) return word.slice(0, -2);
  if (/[^s]s$/.test(word)) return word.slice(0, -1);
  return word;
}

// Lower-cased word and number tokens. "#103" becomes "103".
function tokenize(text) {
  return text.toLowerCase().match(/[a-z]+|\d+/g) ?? [];
}

// Finds the item a note refers to, by ID ("#103", "item 103") or by name.
// Returns { item, idToken, nameStems } or { error }.
function matchItem(tokens, inventoryItems) {
  const idMatches = inventoryItems.filter((item) =>
    tokens.includes(String(item.item_id)),
  );

  const promptStems = new Set(tokens.map(stem));
  let bestScore = 0;
  let nameMatches = [];
  for (const item of inventoryItems) {
    const itemStems = tokenize(item.item_name).map(stem);
    const matched = itemStems.filter((s) => promptStems.has(s)).length;
    // A full-name match always beats a partial one ("Bubble Wrap" vs "Wrap").
    const score = matched === itemStems.length ? 100 + matched : matched;
    if (matched === 0 || score < bestScore) continue;
    if (score > bestScore) {
      bestScore = score;
      nameMatches = [];
    }
    nameMatches.push(item);
  }

  if (idMatches.length > 1) {
    return { error: "The note mentions more than one item ID." };
  }
  if (idMatches.length === 1) {
    const [item] = idMatches;
    if (nameMatches.length > 0 && !nameMatches.includes(item)) {
      return { error: "The item ID and item name in the note don't agree." };
    }
    return {
      item,
      idToken: String(item.item_id),
      nameStems: nameMatches.includes(item)
        ? new Set(tokenize(item.item_name).map(stem))
        : new Set(),
    };
  }
  if (nameMatches.length > 1) {
    return {
      error: `The note could refer to more than one item: ${nameMatches
        .map((item) => item.item_name)
        .join(", ")}.`,
    };
  }
  if (nameMatches.length === 1) {
    const [item] = nameMatches;
    return {
      item,
      idToken: null,
      nameStems: new Set(tokenize(item.item_name).map(stem)),
    };
  }
  return { error: "No inventory item name or ID was found in the note." };
}

// Local fallback parser. Always returns an interpretation object; fields it
// couldn't determine are null and `reason` says why.
function parseLocally(prompt, inventoryItems) {
  const interpretation = {
    action: null,
    item_id: null,
    quantity: null,
    parser: "local",
  };
  const tokens = tokenize(prompt);

  const match = matchItem(tokens, inventoryItems);
  if (match.error) return { ...interpretation, reason: match.error };
  interpretation.item_id = match.item.item_id;

  // Words that belong to the item's name ("Shipping Labels") are not action
  // keywords, and the item ID is not the quantity.
  const remaining = tokens.filter(
    (t) => t !== match.idToken && !match.nameStems.has(stem(t)),
  );

  const isRestock = remaining.some((t) => RESTOCK_KEYWORDS.has(t));
  const isOrder = remaining.some((t) => ORDER_KEYWORDS.has(t));
  if (isRestock && isOrder) {
    return {
      ...interpretation,
      reason: "The note contains both restock and order keywords.",
    };
  }
  if (!isRestock && !isOrder) {
    return {
      ...interpretation,
      reason:
        'No action keyword found. Use e.g. "ship", "order" or "send" to deduct stock, or "received", "restock" or "arrived" to add it.',
    };
  }
  interpretation.action = isRestock ? "RESTOCK" : "ORDER";

  const numbers = [...new Set(remaining.filter((t) => /^\d+$/.test(t)))];
  if (numbers.length !== 1) {
    return {
      ...interpretation,
      reason:
        numbers.length === 0
          ? "No quantity found in the note."
          : "The note contains more than one possible quantity.",
    };
  }
  interpretation.quantity = Number(numbers[0]);
  return interpretation;
}

// Pulls the first JSON object out of a model reply, tolerating code fences
// or stray text around it. Returns null if none parses.
function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function parseWithClaude(prompt, inventoryItems) {
  const catalog = inventoryItems
    .map(
      (item) =>
        `- item_id ${item.item_id}: ${item.item_name} (${item.stock_count} in stock)`,
    )
    .join("\n");

  const system = `You convert warehouse dispatch notes into inventory actions.

Inventory:
${catalog}

Actions:
- "ORDER": units leave the warehouse (ship, order, send, deduct).
- "RESTOCK": units arrive at the warehouse (received, restock, arrived, added).

Reply with ONLY a JSON object, no prose and no code fences:
{"action": "ORDER" | "RESTOCK", "item_id": <number from the inventory list>, "quantity": <positive integer>}

If the note does not clearly name one inventory item, one action and one quantity, reply with:
{"action": null, "item_id": null, "quantity": null}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 256,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(ANTHROPIC_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API responded with ${response.status}`);
  }

  const data = await response.json();
  const interpretation = {
    action: null,
    item_id: null,
    quantity: null,
    parser: "claude",
    model: ANTHROPIC_MODEL,
  };

  if (data.stop_reason === "refusal") {
    return { ...interpretation, reason: "The model declined to interpret the note." };
  }

  const text = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  const parsed = extractJsonObject(text);
  if (!parsed) {
    return { ...interpretation, reason: "The model did not return valid JSON." };
  }

  return {
    ...interpretation,
    action: parsed.action ?? null,
    item_id: parsed.item_id ?? null,
    quantity: parsed.quantity ?? null,
  };
}

// Interprets a dispatch note. Returns { action, item_id, quantity, parser, ... };
// the caller must still validate it, since any field may be null or invalid.
async function parseDispatchNote(prompt, inventoryItems) {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await parseWithClaude(prompt, inventoryItems);
    } catch (error) {
      console.error(
        `Warning: Claude dispatch parsing failed, using local parser. ${error.message}`,
      );
      return {
        ...parseLocally(prompt, inventoryItems),
        notice: "Claude API unavailable; the note was parsed locally.",
      };
    }
  }
  return parseLocally(prompt, inventoryItems);
}

// Returns an error message if the interpretation can't be executed, else null.
function validateInterpretation(interpretation, inventoryItems) {
  if (interpretation.reason) return interpretation.reason;
  if (interpretation.action !== "ORDER" && interpretation.action !== "RESTOCK") {
    return "Could not tell whether the note is an order or a restock.";
  }
  if (!inventoryItems.some((item) => item.item_id === interpretation.item_id)) {
    return "Could not match the note to an inventory item.";
  }
  if (!isPositiveInteger(interpretation.quantity)) {
    return "Could not find a positive whole-number quantity in the note.";
  }
  return null;
}

app.post("/api/ai-dispatch", async (req, res) => {
  const { prompt } = req.body ?? {};

  if (typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ error: "prompt must be a non-empty string" });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({
      error: `prompt must be at most ${MAX_PROMPT_LENGTH} characters`,
    });
  }

  try {
    const inventoryItems = allInventoryQuery.all();
    const interpretation = await parseDispatchNote(prompt.trim(), inventoryItems);

    const item = inventoryItems.find((i) => i.item_id === interpretation.item_id);
    if (item) interpretation.item_name = item.item_name;

    const problem = validateInterpretation(interpretation, inventoryItems);
    if (problem) {
      return res.status(400).json({
        error: `Could not understand the note. ${problem}`,
        prompt,
        interpretation,
      });
    }

    // Same atomic transactions as /api/order and /api/restock.
    const execute = interpretation.action === "ORDER" ? placeOrder : receiveRestock;
    const { status, body } = execute(interpretation.item_id, interpretation.quantity);

    if (status !== 200) {
      return res.status(status).json({ ...body, prompt, interpretation });
    }

    res.json({
      message: `Executed ${interpretation.action}: ${interpretation.quantity} × ${interpretation.item_name}`,
      prompt,
      interpretation,
      result: body,
    });
  } catch (error) {
    console.error(`Error: Failed to execute AI dispatch. ${error.message}`);
    res.status(500).json({ error: "Failed to execute AI dispatch" });
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

module.exports = { app, db };

// --- Listener ---
// Only listen when run directly (`node server.js`). When required by tests,
// the caller starts its own listener, so PORT is never claimed.
if (require.main === module) {
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
}
