// --- Order / restock form ---
// Switches between the two form modes and submits the form to the API.

import { itemSelect, quantityInput, orderForm, orderButton, formTitle, formHint, modeTabs } from "./elements.js";
import { postStockChange } from "./api.js";
import { showBanner } from "./banner.js";

const MODES = {
  order: {
    title: "Place an order",
    hint: "Deducts units from stock.",
    submitLabel: "Submit order",
    endpoint: "/api/order",
    buttonClass: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500",
    success: (d) =>
      `Order placed: ${d.quantity_ordered} × ${d.item_name}. ${d.remaining_stock} remaining.`,
  },
  restock: {
    title: "Receive shipment (restock)",
    hint: "Adds received units to stock.",
    submitLabel: "Receive shipment",
    endpoint: "/api/restock",
    buttonClass: "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500",
    success: (d) =>
      `Shipment received: ${d.quantity_received} × ${d.item_name}. ${d.new_stock} now in stock.`,
  },
};
const BUTTON_BASE_CLASS = orderButton.className;
let currentMode = "order";

function setMode(mode) {
  currentMode = mode;
  const config = MODES[mode];
  formTitle.textContent = config.title;
  formHint.textContent = config.hint;
  orderButton.textContent = config.submitLabel;
  orderButton.className = `${BUTTON_BASE_CLASS} ${config.buttonClass}`;

  for (const tab of modeTabs) {
    const active = tab.dataset.mode === mode;
    tab.setAttribute("aria-selected", String(active));
    tab.classList.toggle("bg-white", active);
    tab.classList.toggle("shadow-sm", active);
    tab.classList.toggle("text-slate-900", active);
    tab.classList.toggle("text-slate-500", !active);
    tab.classList.toggle("hover:text-slate-700", !active);
  }
}

function describeOrderError(data, status) {
  if (data.error === "Insufficient stock") {
    return `Insufficient stock for item #${data.item_id}: requested ${data.requested}, only ${data.available} available.`;
  }
  return data.error || `Request failed (HTTP ${status}).`;
}

async function handleSubmit(event, onSubmitted) {
  event.preventDefault();

  const itemId = Number(itemSelect.value);
  const quantity = Number(quantityInput.value);

  if (!itemSelect.value) {
    showBanner("error", "Please select an item.");
    return;
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    showBanner("error", "Quantity must be a whole number of at least 1.");
    return;
  }

  const config = MODES[currentMode];
  orderButton.disabled = true;
  modeTabs.forEach((tab) => (tab.disabled = true));
  orderButton.textContent = "Submitting…";

  try {
    const { ok, status, data } = await postStockChange(config.endpoint, itemId, quantity);

    if (ok) {
      showBanner("success", config.success(data));
      quantityInput.value = 1;
    } else {
      showBanner("error", describeOrderError(data, status));
    }
  } catch (error) {
    console.error(`${currentMode} request failed:`, error);
    showBanner("error", "Could not reach the server. Please try again.");
  } finally {
    orderButton.disabled = false;
    modeTabs.forEach((tab) => (tab.disabled = false));
    orderButton.textContent = config.submitLabel;

    onSubmitted();
  }
}

// onSubmitted runs after every submit (success or failure), so the page can reload its data.
export function initForm({ onSubmitted }) {
  for (const tab of modeTabs) {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
  }
  orderForm.addEventListener("submit", (event) => handleSubmit(event, onSubmitted));
  setMode("order");
}
