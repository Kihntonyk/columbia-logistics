// --- Rendering ---
// Turns data from the API into table rows, dropdown options and stats.

import {
  inventoryBody,
  itemSelect,
  statItems,
  statUnits,
  statLow,
  activityBody,
} from "./elements.js";

export const LOW_STOCK_THRESHOLD = 5;

function createCell(text, className = "") {
  const cell = document.createElement("td");
  cell.className = `px-4 py-3 ${className}`;
  cell.textContent = text;
  return cell;
}

function createLowStockBadge() {
  const badge = document.createElement("span");
  badge.className =
    "ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20";
  badge.textContent = "Low Stock";
  return badge;
}

// --- Inventory ---

export function renderTable(items) {
  inventoryBody.replaceChildren();

  if (items.length === 0) {
    const row = document.createElement("tr");
    row.appendChild(createCell("No items in inventory.", "py-6 text-center text-slate-500"));
    row.firstChild.colSpan = 5;
    inventoryBody.appendChild(row);
    return;
  }

  for (const item of items) {
    const isLow = item.stock_count < LOW_STOCK_THRESHOLD;
    const row = document.createElement("tr");
    row.className = isLow ? "bg-red-50/40" : "hover:bg-slate-50";

    row.appendChild(createCell(item.item_id, "font-mono text-slate-500"));

    const nameCell = createCell(item.item_name, "font-medium text-slate-900");
    if (isLow) nameCell.appendChild(createLowStockBadge());
    row.appendChild(nameCell);

    row.appendChild(
      createCell(
        item.stock_count,
        `text-right tabular-nums ${isLow ? "font-semibold text-red-700" : ""}`,
      ),
    );
    row.appendChild(createCell(item.shelf_location, "text-slate-600"));
    row.appendChild(createCell(item.supplier_name, "text-slate-600"));

    inventoryBody.appendChild(row);
  }
}

export function renderItemOptions(items) {
  const previous = itemSelect.value;
  itemSelect.replaceChildren();

  const placeholder = new Option("Select an item…", "");
  placeholder.disabled = true;
  itemSelect.appendChild(placeholder);

  for (const item of items) {
    const label = `#${item.item_id} · ${item.item_name} (${item.stock_count} in stock)`;
    itemSelect.appendChild(new Option(label, item.item_id));
  }

  const stillExists = items.some((item) => String(item.item_id) === previous);
  itemSelect.value = stillExists ? previous : "";
}

export function renderStats(items) {
  const totalUnits = items.reduce((sum, item) => sum + item.stock_count, 0);
  const lowCount = items.filter((item) => item.stock_count < LOW_STOCK_THRESHOLD).length;
  statItems.textContent = items.length;
  statUnits.textContent = totalUnits.toLocaleString();
  statLow.textContent = lowCount;
  statLow.classList.toggle("text-red-600", lowCount > 0);
}

export function renderLoadError() {
  inventoryBody.replaceChildren();
  const row = document.createElement("tr");
  row.appendChild(createCell("Could not load inventory.", "py-6 text-center text-red-600"));
  row.firstChild.colSpan = 5;
  inventoryBody.appendChild(row);
}

// --- Activity log ---

const TYPE_BADGE_STYLES = {
  ORDER: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  RESTOCK: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

// SQLite CURRENT_TIMESTAMP is UTC "YYYY-MM-DD HH:MM:SS"; show it in local time.
function formatTimestamp(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function renderActivityMessage(text, className) {
  activityBody.replaceChildren();
  const row = document.createElement("tr");
  row.appendChild(createCell(text, `py-6 text-center ${className}`));
  row.firstChild.colSpan = 4;
  activityBody.appendChild(row);
}

export function renderActivity(transactions) {
  if (transactions.length === 0) {
    renderActivityMessage("No activity yet.", "text-slate-500");
    return;
  }

  activityBody.replaceChildren();
  for (const tx of transactions) {
    const row = document.createElement("tr");
    row.className = "hover:bg-slate-50";

    row.appendChild(createCell(formatTimestamp(tx.created_at), "whitespace-nowrap text-slate-500"));

    const typeCell = createCell("");
    const badge = document.createElement("span");
    badge.className = `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TYPE_BADGE_STYLES[tx.type] ?? ""}`;
    badge.textContent = tx.type;
    typeCell.appendChild(badge);
    row.appendChild(typeCell);

    row.appendChild(createCell(tx.item_name, "font-medium text-slate-900"));

    const sign = tx.type === "RESTOCK" ? "+" : "−";
    row.appendChild(
      createCell(
        `${sign}${tx.quantity}`,
        `text-right tabular-nums font-medium ${tx.type === "RESTOCK" ? "text-emerald-700" : "text-slate-700"}`,
      ),
    );

    activityBody.appendChild(row);
  }
}
