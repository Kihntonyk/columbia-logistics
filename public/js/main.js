// --- Entry point ---
// Loaded by index.html. Loads the data, keeps the search/filter state and
// connects the other modules together.

import {
  refreshButton,
  refreshIcon,
  lastUpdated,
  inventorySearch,
  filterButtons,
  statLowButton,
} from "./elements.js";
import { fetchInventory, fetchTransactions } from "./api.js";
import { showToast } from "./toast.js";
import {
  isLowStock,
  renderInventory,
  renderInventoryLoading,
  renderInventoryError,
  renderItemOptions,
  renderItemOptionsUnavailable,
  renderStats,
  renderActivity,
  renderActivityLoading,
  renderActivityError,
} from "./render.js";
import { initForm, prefillForm, setFormItems } from "./form.js";
import { initDispatch } from "./dispatch.js";

const state = {
  items: null, // null until the first successful load
  query: "",
  filter: "all", // "all" | "low"
  flashItemId: null,
  lastTransactionId: null,
};

// --- Inventory filtering ---

function visibleItems() {
  const query = state.query.trim().toLowerCase();
  return state.items.filter((item) => {
    if (state.filter === "low" && !isLowStock(item)) return false;
    if (!query) return true;
    return [item.item_name, item.shelf_location, item.supplier_name, `#${item.item_id}`, String(item.item_id)]
      .some((value) => value.toLowerCase().includes(query));
  });
}

function drawInventory() {
  if (!state.items) return;
  renderInventory(visibleItems(), {
    total: state.items.length,
    onAction: prefillForm,
    onClearFilters: () => {
      inventorySearch.value = "";
      state.query = "";
      setFilter("all");
    },
    flashId: state.flashItemId,
  });
  state.flashItemId = null;
}

function setFilter(filter) {
  state.filter = filter;
  for (const button of filterButtons) {
    const active = button.dataset.filter === filter;
    button.setAttribute("aria-checked", String(active));
    button.classList.toggle("bg-white", active);
    button.classList.toggle("text-ink", active);
    button.classList.toggle("shadow-sm", active);
    button.classList.toggle("text-steel", !active);
  }
  drawInventory();
}

// --- Data loading ---

async function loadInventory() {
  if (!state.items) renderInventoryLoading();
  try {
    state.items = await fetchInventory();
    drawInventory();
    renderItemOptions(state.items);
    renderStats(state.items);
    setFormItems(state.items);
    return true;
  } catch (error) {
    console.error("Failed to load inventory:", error);
    // Keep showing the last good data if there is any; otherwise show the error state.
    if (!state.items) {
      renderInventoryError(() => refreshAll());
      renderItemOptionsUnavailable();
      setFormItems([]);
    }
    return false;
  }
}

async function loadActivity({ firstLoad }) {
  if (firstLoad) renderActivityLoading();
  try {
    const transactions = await fetchTransactions();
    const newest = transactions[0]?.transaction_id ?? null;
    // Highlight the newest row only when it appeared since the last load.
    const flashId = !firstLoad && newest !== state.lastTransactionId ? newest : null;
    state.lastTransactionId = newest;
    renderActivity(transactions, { flashId });
    return true;
  } catch (error) {
    console.error("Failed to load activity:", error);
    if (firstLoad) renderActivityError(() => refreshAll());
    return false;
  }
}

let refreshing = false;
let refreshQueued = false; // a refresh was requested while one was already running
let firstLoad = true;

// announce: show a toast when done (manual refresh). quiet: background refresh, no spinner or error toast.
async function refreshAll({ announce = false, quiet = false } = {}) {
  if (refreshing) {
    // Don't drop it: an order may have just changed stock. Run once more when this one ends.
    refreshQueued = true;
    return;
  }
  refreshing = true;
  if (!quiet) {
    refreshButton.disabled = true;
    refreshButton.setAttribute("aria-busy", "true");
    refreshIcon.classList.add("animate-spin");
  }

  const hadData = state.items !== null;
  const [inventoryOk, activityOk] = await Promise.all([loadInventory(), loadActivity({ firstLoad })]);
  firstLoad = false;

  refreshing = false;
  refreshButton.disabled = false;
  refreshButton.removeAttribute("aria-busy");
  refreshIcon.classList.remove("animate-spin");

  if (inventoryOk && activityOk) {
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    lastUpdated.textContent = `Updated ${time}`;
    if (announce) showToast("success", "Up to date", "Inventory and activity were reloaded.");
  } else if (hadData && !quiet) {
    // On a first load the inline error rows already explain the problem and offer "Try again".
    showToast("error", "Couldn't refresh", "The server didn't respond. The last loaded data is still shown.");
  }

  if (refreshQueued) {
    refreshQueued = false;
    refreshAll({ quiet: true });
  }
}

// Keep numbers current while several people work the same warehouse:
// reload quietly every minute while the tab is visible, and when the tab comes back into view.
const AUTO_REFRESH_MS = 60_000;
setInterval(() => {
  if (document.visibilityState === "visible") refreshAll({ quiet: true });
}, AUTO_REFRESH_MS);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshAll({ quiet: true });
});

// After an order, shipment or dispatch note: highlight the changed item and reload.
function afterMovement({ itemId }) {
  state.flashItemId = itemId;
  refreshAll();
}

// --- Start-up ---

initForm({ onSubmitted: afterMovement });
initDispatch({ onSubmitted: afterMovement });

refreshButton.addEventListener("click", () => refreshAll({ announce: true }));

inventorySearch.addEventListener("input", () => {
  state.query = inventorySearch.value;
  drawInventory();
});
for (const button of filterButtons) {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
}
statLowButton.addEventListener("click", () => {
  setFilter("low");
  document.getElementById("inventory").scrollIntoView({ behavior: "smooth", block: "start" });
});

setFilter("all");
refreshAll();
