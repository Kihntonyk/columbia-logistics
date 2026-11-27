// --- Entry point ---
// Loaded by index.html. Loads the data and connects the other modules together.

import { refreshButton } from "./elements.js";
import { fetchInventory, fetchTransactions } from "./api.js";
import { showBanner, initBanner } from "./banner.js";
import {
  renderTable,
  renderItemOptions,
  renderStats,
  renderLoadError,
  renderActivity,
  renderActivityMessage,
} from "./render.js";
import { initForm } from "./form.js";
import { initDispatch } from "./dispatch.js";

// --- Data loading ---

async function loadInventory() {
  try {
    const items = await fetchInventory();
    renderTable(items);
    renderItemOptions(items);
    renderStats(items);
  } catch (error) {
    console.error("Failed to load inventory:", error);
    renderLoadError();
    showBanner("error", "Could not load inventory. Is the server running?");
  }
}

async function loadActivity() {
  try {
    renderActivity(await fetchTransactions());
  } catch (error) {
    console.error("Failed to load activity:", error);
    renderActivityMessage("Could not load activity.", "text-red-600");
  }
}

function refreshAll() {
  loadInventory();
  loadActivity();
}

// --- Start-up ---

initBanner();
initForm({ onSubmitted: refreshAll });
initDispatch({ onSubmitted: refreshAll });
refreshButton.addEventListener("click", refreshAll);
refreshAll();
