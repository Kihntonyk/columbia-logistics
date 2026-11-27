// --- Movement form ---
// The "Place order" / "Receive shipment" toggle, inline validation and submission.

import {
  modeTabs,
  formHint,
  orderForm,
  itemSelect,
  itemError,
  quantityInput,
  quantityHint,
  quantityError,
  qtyDec,
  qtyInc,
  orderButton,
  movementPanel,
} from "./elements.js";
import { postStockChange } from "./api.js";
import { showToast } from "./toast.js";

const MODES = {
  order: {
    hint: "Takes units off stock as they leave the warehouse.",
    submitLabel: "Place order",
    busyLabel: "Placing order…",
    endpoint: "/api/order",
    buttonClass: "bg-out hover:bg-out-dark",
    tabClass: "bg-white text-out shadow-sm",
    success: (d) => ({
      title: "Order placed",
      detail: `${d.quantity_ordered.toLocaleString()} × ${d.item_name}. ${d.remaining_stock.toLocaleString()} left in stock.`,
    }),
  },
  restock: {
    hint: "Adds units to stock as they arrive at the warehouse.",
    submitLabel: "Receive shipment",
    busyLabel: "Receiving…",
    endpoint: "/api/restock",
    buttonClass: "bg-in hover:bg-in-dark",
    tabClass: "bg-white text-in shadow-sm",
    success: (d) => ({
      title: "Shipment received",
      detail: `${d.quantity_received.toLocaleString()} × ${d.item_name}. ${d.new_stock.toLocaleString()} now in stock.`,
    }),
  },
};
const BUTTON_BASE_CLASS = orderButton.className;
const TAB_BASE_CLASS = modeTabs[0].className;

let currentMode = "order";
let items = [];

const selectedItem = () => items.find((item) => String(item.item_id) === itemSelect.value);

function setFieldError(field, errorEl, message) {
  field.setAttribute("aria-invalid", message ? "true" : "false");
  errorEl.textContent = message;
  errorEl.classList.toggle("hidden", !message);
}

function clearErrors() {
  setFieldError(itemSelect, itemError, "");
  setFieldError(quantityInput, quantityError, "");
}

// Shows how much stock the chosen item has, so the user knows the limit before submitting.
function updateQuantityHint() {
  const item = selectedItem();
  if (!item) {
    quantityHint.textContent = "";
    quantityInput.removeAttribute("max");
    return;
  }
  if (currentMode === "order") {
    quantityHint.textContent = `${item.stock_count.toLocaleString()} available`;
    quantityInput.max = item.stock_count;
  } else {
    quantityHint.textContent = `${item.stock_count.toLocaleString()} on shelf ${item.shelf_location}`;
    quantityInput.removeAttribute("max");
  }
}

function setMode(mode) {
  currentMode = mode;
  const config = MODES[mode];
  formHint.textContent = config.hint;
  orderButton.textContent = config.submitLabel;
  orderButton.className = `${BUTTON_BASE_CLASS} ${config.buttonClass}`;

  for (const tab of modeTabs) {
    const active = tab.dataset.mode === mode;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    tab.className = `${TAB_BASE_CLASS} ${active ? config.tabClass : "text-steel hover:text-ink"}`;
  }
  clearErrors();
  updateQuantityHint();
}

// Returns { itemId, quantity } or null after showing the problem under the field.
function validate() {
  clearErrors();
  const item = selectedItem();
  const quantity = Number(quantityInput.value);
  let valid = true;

  if (!item) {
    setFieldError(itemSelect, itemError, "Choose an item.");
    valid = false;
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    setFieldError(quantityInput, quantityError, "Enter a whole number of 1 or more.");
    valid = false;
  } else if (item && currentMode === "order" && quantity > item.stock_count) {
    setFieldError(
      quantityInput,
      quantityError,
      item.stock_count === 0
        ? `${item.item_name} is out of stock.`
        : `Only ${item.stock_count.toLocaleString()} in stock. Lower the quantity or receive a shipment first.`,
    );
    valid = false;
  }

  if (!valid) {
    (itemSelect.getAttribute("aria-invalid") === "true" ? itemSelect : quantityInput).focus();
    return null;
  }
  return { itemId: item.item_id, quantity };
}

function describeServerError(data, status) {
  if (data.error === "Insufficient stock") {
    return `Only ${data.available} in stock, so ${data.requested} can't be shipped.`;
  }
  return data.error || `The server returned an error (HTTP ${status}).`;
}

async function handleSubmit(event, onSubmitted) {
  event.preventDefault();
  const values = validate();
  if (!values) return;

  const config = MODES[currentMode];
  orderButton.disabled = true;
  modeTabs.forEach((tab) => (tab.disabled = true));
  orderButton.innerHTML = `<span class="spinner" aria-hidden="true"></span>`;
  orderButton.append(config.busyLabel);

  let changedItemId = null;
  try {
    const { ok, status, data } = await postStockChange(config.endpoint, values.itemId, values.quantity);
    if (ok) {
      const { title, detail } = config.success(data);
      showToast("success", title, detail);
      quantityInput.value = 1;
      changedItemId = values.itemId;
    } else {
      showToast("error", currentMode === "order" ? "Order not placed" : "Shipment not received", describeServerError(data, status));
    }
  } catch (error) {
    console.error(`${currentMode} request failed:`, error);
    showToast("error", "Can't reach the server", "Nothing was recorded. Check your connection and try again.");
  } finally {
    orderButton.disabled = items.length === 0;
    modeTabs.forEach((tab) => (tab.disabled = false));
    orderButton.textContent = config.submitLabel;
    onSubmitted({ itemId: changedItemId });
  }
}

function stepQuantity(delta) {
  const current = Number(quantityInput.value) || 0;
  quantityInput.value = Math.max(1, current + delta);
  setFieldError(quantityInput, quantityError, "");
}

// Called when the inventory list reloads. With no items (or a failed load) the form can't be submitted.
export function setFormItems(newItems) {
  items = newItems;
  orderButton.disabled = items.length === 0;
  updateQuantityHint();
}

// Called from an inventory row's Order / Receive button.
export function prefillForm(itemId, mode) {
  setMode(mode);
  itemSelect.value = String(itemId);
  updateQuantityHint();
  const smallScreen = window.matchMedia("(max-width: 1023px)").matches;
  if (smallScreen) movementPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  quantityInput.focus({ preventScroll: smallScreen });
  quantityInput.select();
}

// onSubmitted({ itemId }) runs after every submit, so the page can reload its data.
export function initForm({ onSubmitted }) {
  for (const tab of modeTabs) {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
    // Arrow keys move between the two tabs.
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const next = tab.dataset.mode === "order" ? "restock" : "order";
      setMode(next);
      document.querySelector(`.mode-tab[data-mode="${next}"]`).focus();
    });
  }
  itemSelect.addEventListener("change", () => {
    setFieldError(itemSelect, itemError, "");
    updateQuantityHint();
  });
  quantityInput.addEventListener("input", () => setFieldError(quantityInput, quantityError, ""));
  qtyDec.addEventListener("click", () => stepQuantity(-1));
  qtyInc.addEventListener("click", () => stepQuantity(1));
  orderForm.addEventListener("submit", (event) => handleSubmit(event, onSubmitted));
  setMode("order");
}
