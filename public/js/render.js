// --- Rendering ---
// Turns data from the API into table rows, dropdown options and summary numbers.
// Below the md breakpoint, table rows reflow into stacked records (see the max-md: classes),
// so nothing scrolls sideways on a phone.

import {
  inventoryBody,
  inventoryCount,
  itemSelect,
  statItems,
  statUnits,
  statLow,
  statLowDot,
  activityBody,
  lowThreshold,
} from "./elements.js";

export const LOW_STOCK_THRESHOLD = 5;
lowThreshold.textContent = LOW_STOCK_THRESHOLD;

export const isLowStock = (item) => item.stock_count < LOW_STOCK_THRESHOLD;

function el(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// A full-width row used for loading, empty and error states.
// `action` is an optional { label, onClick } shown as a button under the message.
function messageRow(colSpan, title, detail, { tone = "muted", action } = {}) {
  const row = el("tr", "max-md:block");
  const cell = el("td", "px-5 py-10 text-center max-md:block");
  cell.colSpan = colSpan;
  cell.appendChild(el("p", `font-semibold ${tone === "error" ? "text-danger" : "text-ink"}`, title));
  if (detail) cell.appendChild(el("p", "mx-auto mt-1 max-w-sm text-sm text-steel", detail));
  if (action) {
    const button = el("button", "btn-quiet mt-4 py-1.5 text-sm", action.label);
    button.type = "button";
    button.addEventListener("click", action.onClick);
    cell.appendChild(button);
  }
  row.appendChild(cell);
  return row;
}

function skeletonRows(colSpan, count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const row = el("tr", "max-md:block");
    const cell = el("td", "px-5 py-4 max-md:block");
    cell.colSpan = colSpan;
    const bar = el("span", "skeleton");
    bar.style.width = `${70 - i * 12}%`;
    cell.appendChild(bar);
    row.appendChild(cell);
    rows.push(row);
  }
  return rows;
}

// --- Inventory ---

export function renderInventoryLoading() {
  inventoryBody.replaceChildren(...skeletonRows(6, 4));
}

export function renderInventoryError(onRetry) {
  inventoryCount.textContent = "";
  inventoryBody.replaceChildren(
    messageRow(6, "Inventory didn't load", "The server didn't respond. Check your connection, then try again.", {
      tone: "error",
      action: { label: "Try again", onClick: onRetry },
    }),
  );
}

function lowStockTag() {
  return el("span", "tag-low", "Low stock");
}

// items: the filtered list to show. total: how many items exist before filtering.
// onAction(itemId, mode) runs when a row's Order / Receive button is pressed.
// flashId: an item to briefly highlight because its stock just changed.
export function renderInventory(items, { total, onAction, onClearFilters, flashId }) {
  inventoryCount.textContent = total ? `${items.length === total ? total : `${items.length} of ${total}`}` : "";

  if (total === 0) {
    inventoryBody.replaceChildren(
      messageRow(6, "No items yet", "Items added to the warehouse database show up here."),
    );
    return;
  }
  if (items.length === 0) {
    inventoryBody.replaceChildren(
      messageRow(6, "No items match", "Try a different search or show all items.", {
        action: { label: "Clear filters", onClick: onClearFilters },
      }),
    );
    return;
  }

  const rows = items.map((item) => {
    const low = isLowStock(item);
    const row = el(
      "tr",
      "group transition-colors hover:bg-paper/70 max-md:grid max-md:grid-cols-[1fr_auto] max-md:items-center max-md:gap-x-4 max-md:gap-y-1.5 max-md:px-4 max-md:py-3",
    );
    row.dataset.itemId = item.item_id;
    if (item.item_id === flashId) row.classList.add("animate-row-flash");

    // ID (desktop only; shown in the meta line on mobile)
    row.appendChild(el("td", "px-5 py-3 text-steel max-md:hidden", `#${item.item_id}`));

    // Item name, low-stock tag and the mobile meta line
    const nameCell = el("td", "px-3 py-3 max-md:p-0");
    const nameLine = el("div", "flex flex-wrap items-center gap-2");
    nameLine.appendChild(el("span", "font-semibold text-ink", item.item_name));
    if (low) nameLine.appendChild(lowStockTag());
    nameCell.appendChild(nameLine);
    const meta = el("div", "mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-steel md:hidden");
    meta.appendChild(el("span", "", `#${item.item_id}`));
    meta.appendChild(el("span", "bin-label", item.shelf_location));
    meta.appendChild(el("span", "", item.supplier_name));
    nameCell.appendChild(meta);
    row.appendChild(nameCell);

    // Stock
    const stockCell = el("td", "px-3 py-3 text-right max-md:p-0");
    stockCell.appendChild(
      el("span", `text-lg font-semibold md:text-[15px] ${low ? "text-signal-ink" : "text-ink"}`, item.stock_count.toLocaleString()),
    );
    stockCell.appendChild(el("span", "block text-xs text-steel md:hidden", "in stock"));
    row.appendChild(stockCell);

    // Shelf and supplier (desktop only)
    const shelfCell = el("td", "px-3 py-3 max-md:hidden");
    shelfCell.appendChild(el("span", "bin-label", item.shelf_location));
    row.appendChild(shelfCell);
    row.appendChild(el("td", "px-3 py-3 text-steel max-md:hidden", item.supplier_name));

    // Row actions prefill the movement form
    const actions = el("td", "px-5 py-3 text-right max-md:col-span-2 max-md:p-0 max-md:pt-1 max-md:text-left");
    const group = el("div", "inline-flex gap-1 max-md:gap-2");
    const order = el("button", "row-action text-out hover:bg-out-soft max-md:bg-out-soft max-md:px-3 max-md:py-1.5", "Order");
    order.type = "button";
    order.setAttribute("aria-label", `Place an order for ${item.item_name}`);
    order.addEventListener("click", () => onAction(item.item_id, "order"));
    const receive = el("button", "row-action text-in hover:bg-in-soft max-md:bg-in-soft max-md:px-3 max-md:py-1.5", "Receive");
    receive.type = "button";
    receive.setAttribute("aria-label", `Receive a shipment of ${item.item_name}`);
    receive.addEventListener("click", () => onAction(item.item_id, "restock"));
    group.append(order, receive);
    actions.appendChild(group);
    row.appendChild(actions);

    return row;
  });
  inventoryBody.replaceChildren(...rows);
}

export function renderItemOptions(items) {
  const previous = itemSelect.value;
  itemSelect.replaceChildren();

  const placeholder = new Option(items.length ? "Choose an item" : "No items in inventory", "");
  placeholder.disabled = true;
  itemSelect.appendChild(placeholder);

  for (const item of items) {
    const label = `${item.item_name} (#${item.item_id}), ${item.stock_count} in stock`;
    itemSelect.appendChild(new Option(label, item.item_id));
  }

  const stillExists = items.some((item) => String(item.item_id) === previous);
  itemSelect.value = stillExists ? previous : "";
}

// Used when inventory can't be loaded, so the form doesn't promise items that aren't coming.
export function renderItemOptionsUnavailable() {
  itemSelect.replaceChildren(new Option("Items unavailable", ""));
}

export function renderStats(items) {
  const totalUnits = items.reduce((sum, item) => sum + item.stock_count, 0);
  const lowCount = items.filter(isLowStock).length;
  statItems.textContent = items.length.toLocaleString();
  statUnits.textContent = totalUnits.toLocaleString();
  statLow.textContent = lowCount.toLocaleString();
  statLow.classList.toggle("text-signal", lowCount > 0);
  statLowDot.classList.toggle("hidden", lowCount === 0);
}

// --- Activity log ---

const TYPE_LABELS = {
  ORDER: { text: "Order", className: "tag-out" },
  RESTOCK: { text: "Received", className: "tag-in" },
};

// SQLite CURRENT_TIMESTAMP is UTC "YYYY-MM-DD HH:MM:SS". Parse it as UTC.
function parseTimestamp(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "2:41 PM" today, "Yesterday, 2:41 PM", otherwise "Nov 24, 2:41 PM".
function formatTime(date) {
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return time;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

export function renderActivityLoading() {
  activityBody.replaceChildren(...skeletonRows(4, 3));
}

export function renderActivityError(onRetry) {
  activityBody.replaceChildren(
    messageRow(4, "Activity didn't load", "The server didn't respond. Try again in a moment.", {
      tone: "error",
      action: { label: "Try again", onClick: onRetry },
    }),
  );
}

export function renderActivity(transactions, { flashId } = {}) {
  if (transactions.length === 0) {
    activityBody.replaceChildren(
      messageRow(4, "No activity yet", "Orders and received shipments appear here as soon as they're recorded."),
    );
    return;
  }

  const rows = transactions.map((tx) => {
    const type = TYPE_LABELS[tx.type] ?? { text: tx.type, className: "tag bg-paper text-steel" };
    const isIn = tx.type === "RESTOCK";
    const row = el(
      "tr",
      "max-md:grid max-md:grid-cols-[1fr_auto] max-md:gap-x-4 max-md:gap-y-0.5 max-md:px-4 max-md:py-3",
    );
    if (tx.transaction_id === flashId) row.classList.add("animate-row-flash");

    const date = parseTimestamp(tx.created_at);
    const timeCell = el("td", "whitespace-nowrap px-5 py-3 text-steel max-md:order-3 max-md:col-span-2 max-md:p-0 max-md:text-sm");
    const time = el("time", "", date ? formatTime(date) : tx.created_at);
    if (date) {
      time.dateTime = date.toISOString();
      time.title = date.toLocaleString();
    }
    timeCell.appendChild(time);
    row.appendChild(timeCell);

    const typeCell = el("td", "px-3 py-3 max-md:hidden");
    typeCell.appendChild(el("span", type.className, type.text));
    row.appendChild(typeCell);

    const itemCell = el("td", "px-3 py-3 font-semibold text-ink max-md:order-1 max-md:flex max-md:items-center max-md:gap-2 max-md:p-0");
    const mobileTag = el("span", `${type.className} md:hidden`, type.text);
    itemCell.append(mobileTag, document.createTextNode(tx.item_name));
    row.appendChild(itemCell);

    const qtyCell = el(
      "td",
      `px-5 py-3 text-right font-semibold max-md:order-2 max-md:p-0 ${isIn ? "text-in" : "text-ink"}`,
      `${isIn ? "+" : "−"}${tx.quantity.toLocaleString()}`,
    );
    qtyCell.setAttribute("aria-label", `${isIn ? "Added" : "Removed"} ${tx.quantity} units`);
    row.appendChild(qtyCell);

    return row;
  });
  activityBody.replaceChildren(...rows);
}
