// --- API calls ---
// Talks to the Express server. These functions return data and never touch the page.

async function getJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}`);
  }
  return response.json();
}

export function fetchInventory() {
  return getJSON("/api/inventory");
}

export function fetchTransactions() {
  return getJSON("/api/transactions");
}

// Sends an order or restock. Returns { ok, status, data } so the caller can show
// the server's error message. Throws only if the server can't be reached.
export async function postStockChange(endpoint, itemId, quantity) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId, quantity }),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}
