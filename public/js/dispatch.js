// --- AI natural-language dispatch bar ---
// Sends a free-text note to /api/ai-dispatch and shows how the server
// interpreted it in the badge under the input.

import { dispatchForm, dispatchInput, dispatchButton, dispatchBadge } from "./elements.js";
import { postAiDispatch } from "./api.js";
import { showBanner } from "./banner.js";

const BADGE_BASE_CLASS =
  "mt-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs ring-1 ring-inset";
const BADGE_STYLES = {
  success: "bg-white text-slate-700 ring-slate-200",
  error: "bg-red-50 text-red-800 ring-red-200",
  pending: "bg-white text-slate-500 ring-slate-200",
};
const ACTION_PILL_STYLES = {
  ORDER: "bg-indigo-100 text-indigo-700",
  RESTOCK: "bg-emerald-100 text-emerald-700",
};
const BUTTON_LABEL = dispatchButton.textContent.trim();

function pill(text, className) {
  const span = document.createElement("span");
  span.className = `inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${className}`;
  span.textContent = text;
  return span;
}

function text(value, className = "") {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = value;
  return span;
}

function parserLabel(interpretation) {
  return interpretation.parser === "claude"
    ? `Parsed by Claude (${interpretation.model})`
    : "Parsed locally";
}

function setBadge(state, children) {
  dispatchBadge.className = `${BADGE_BASE_CLASS} ${BADGE_STYLES[state]}`;
  dispatchBadge.replaceChildren(...children);
}

// Builds "ORDER · 4 × Bubble Wrap (#103)" from whatever fields were understood.
function describeInterpretation(interpretation) {
  const parts = [];
  if (interpretation.action) {
    parts.push(pill(interpretation.action, ACTION_PILL_STYLES[interpretation.action] ?? "bg-slate-100 text-slate-700"));
  }
  const quantity = interpretation.quantity ?? "?";
  const item = interpretation.item_name
    ? `${interpretation.item_name} (#${interpretation.item_id})`
    : "unknown item";
  parts.push(text(`${quantity} × ${item}`, "font-medium"));
  parts.push(text(`· ${parserLabel(interpretation)}`, "text-slate-400"));
  if (interpretation.notice) parts.push(text(`· ${interpretation.notice}`, "text-amber-700"));
  return parts;
}

function showResult(ok, data, status) {
  const interpretation = data.interpretation;

  if (ok) {
    const r = data.result;
    const outcome =
      interpretation.action === "ORDER"
        ? `${r.remaining_stock} remaining`
        : `${r.new_stock} now in stock`;
    setBadge("success", [
      text("Interpreted as", "text-slate-500"),
      ...describeInterpretation(interpretation),
      text(`· Executed, ${outcome}`, "font-medium text-emerald-700"),
    ]);
    showBanner("success", `AI dispatch: ${data.message}.`);
    return;
  }

  let message = data.error || `Request failed (HTTP ${status}).`;
  if (data.error === "Insufficient stock") {
    message = `Insufficient stock: requested ${data.requested}, only ${data.available} available.`;
  }
  setBadge("error", [
    ...(interpretation ? [text("Interpreted as", "text-red-700"), ...describeInterpretation(interpretation)] : []),
    text(`· Not executed: ${message}`, "font-medium"),
  ]);
}

async function handleSubmit(event, onSubmitted) {
  event.preventDefault();
  const prompt = dispatchInput.value.trim();
  if (!prompt) {
    setBadge("error", [text("Type a dispatch note first.", "font-medium")]);
    return;
  }

  dispatchButton.disabled = true;
  dispatchButton.textContent = "Interpreting…";
  setBadge("pending", [text("Interpreting note…")]);

  try {
    const { ok, status, data } = await postAiDispatch(prompt);
    showResult(ok, data, status);
    if (ok) dispatchInput.value = "";
  } catch (error) {
    console.error("AI dispatch request failed:", error);
    setBadge("error", [text("Could not reach the server. Please try again.", "font-medium")]);
  } finally {
    dispatchButton.disabled = false;
    dispatchButton.textContent = BUTTON_LABEL;
    onSubmitted();
  }
}

// onSubmitted runs after every command, so the page can reload its data.
export function initDispatch({ onSubmitted }) {
  dispatchForm.addEventListener("submit", (event) => handleSubmit(event, onSubmitted));
}
