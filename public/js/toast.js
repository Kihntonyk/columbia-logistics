// --- Toasts ---
// Short confirmations and errors that appear in the bottom corner and don't move the layout.
// Success toasts close on their own after a few seconds. Error toasts stay until dismissed.

import { toastRegion } from "./elements.js";

const STYLES = {
  success: { bar: "bg-in", icon: "M5 10.5l3.2 3.2L15 7" },
  error: { bar: "bg-danger", icon: "M10 6v5M10 14h.01" },
};
const MAX_TOASTS = 3;

export function showToast(type, title, detail = "") {
  const style = STYLES[type];
  const toast = document.createElement("div");
  toast.className =
    "pointer-events-auto flex w-full max-w-sm animate-toast-in overflow-hidden rounded-md bg-ink text-white shadow-lg shadow-ink/20";
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const bar = document.createElement("span");
  bar.className = `w-1 shrink-0 ${style.bar}`;

  const body = document.createElement("div");
  body.className = "flex flex-1 items-start gap-3 px-4 py-3";
  body.innerHTML = `<svg class="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${style.icon}"/></svg>`;

  const text = document.createElement("div");
  text.className = "flex-1 text-[15px]";
  const titleEl = document.createElement("p");
  titleEl.className = "font-semibold";
  titleEl.textContent = title;
  text.appendChild(titleEl);
  if (detail) {
    const detailEl = document.createElement("p");
    detailEl.className = "mt-0.5 text-white/70";
    detailEl.textContent = detail;
    text.appendChild(detailEl);
  }

  const close = document.createElement("button");
  close.type = "button";
  close.className = "-mr-1 rounded p-1 text-white/60 hover:text-white";
  close.setAttribute("aria-label", "Dismiss notification");
  close.innerHTML = `<svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>`;
  close.addEventListener("click", () => toast.remove());

  body.append(text, close);
  toast.append(bar, body);
  toastRegion.appendChild(toast);

  while (toastRegion.children.length > MAX_TOASTS) toastRegion.firstElementChild.remove();
  if (type === "success") setTimeout(() => toast.remove(), 5000);
}
