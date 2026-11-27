// --- AI natural-language dispatch ---
// Sends a free-text note to /api/ai-dispatch and shows, under the input, how the
// server understood it and whether it was recorded.

import { dispatchForm, dispatchInput, dispatchButton, dispatchResult, dispatchExamples } from "./elements.js";
import { postAiDispatch } from "./api.js";
import { showToast } from "./toast.js";

const BUTTON_LABEL = dispatchButton.textContent.trim();
const ACTION_TAGS = {
  ORDER: { text: "Order", className: "tag-out" },
  RESTOCK: { text: "Received", className: "tag-in" },
};

function el(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// state: "pending" | "success" | "error"
function showResult(state, children) {
  const tone = {
    pending: "border-white/15 text-white/70",
    success: "border-in/60 text-white",
    error: "border-danger/70 text-white",
  }[state];
  dispatchResult.className = `mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border bg-white/5 px-4 py-3 text-[15px] ${tone}`;
  dispatchResult.replaceChildren(...children);
}

function parserNote(interpretation) {
  const label =
    interpretation.parser === "claude" ? `Read by Claude (${interpretation.model})` : "Read by the built-in parser";
  return el("span", "text-sm text-white/50", label);
}

// The "Order  4 × Bubble Wrap (#103)" summary of what the note was understood as.
function interpretationParts(interpretation) {
  const parts = [];
  const tag = ACTION_TAGS[interpretation.action];
  if (tag) parts.push(el("span", tag.className, tag.text));
  const quantity = interpretation.quantity ?? "?";
  const item = interpretation.item_name ? `${interpretation.item_name} (#${interpretation.item_id})` : "unknown item";
  parts.push(el("span", "font-semibold", `${quantity} × ${item}`));
  return parts;
}

function renderOutcome(ok, data, status) {
  const interpretation = data.interpretation;

  if (ok) {
    const r = data.result;
    const outcome =
      interpretation.action === "ORDER"
        ? `${r.remaining_stock.toLocaleString()} left in stock`
        : `${r.new_stock.toLocaleString()} now in stock`;
    const parts = [...interpretationParts(interpretation), el("span", "text-white/80", `Recorded. ${outcome}.`)];
    if (interpretation.notice) parts.push(el("span", "text-sm text-signal", interpretation.notice));
    parts.push(parserNote(interpretation));
    showResult("success", parts);
    showToast(
      "success",
      interpretation.action === "ORDER" ? "Order placed" : "Shipment received",
      `${interpretation.quantity} × ${interpretation.item_name}. ${outcome}.`,
    );
    return r.item_id;
  }

  let message = data.error || `The server returned an error (HTTP ${status}).`;
  if (data.error === "Insufficient stock") {
    message = `Only ${data.available} in stock, so ${data.requested} can't be shipped.`;
  }
  // The server prefixes parse failures with this; the heading already says it.
  message = message.replace(/^Could not understand the note\.\s*/, "");

  const parts = [el("span", "font-semibold text-[#FF9C92]", "Not recorded.")];
  if (interpretation?.action || interpretation?.item_name) parts.push(...interpretationParts(interpretation));
  parts.push(el("span", "basis-full text-white/80", message));
  showResult("error", parts);
  return null;
}

async function handleSubmit(event, onSubmitted) {
  event.preventDefault();
  const prompt = dispatchInput.value.trim();
  if (!prompt) {
    showResult("error", [
      el("span", "text-white/80", "Write a note first, for example “Ship 4 bubble wrap to Columbia hub”."),
    ]);
    dispatchInput.focus();
    return;
  }

  dispatchButton.disabled = true;
  dispatchButton.innerHTML = `<span class="spinner" aria-hidden="true"></span>`;
  dispatchButton.append("Reading note…");
  showResult("pending", [el("span", "", `Reading “${prompt}”…`)]);

  let changedItemId = null;
  try {
    const { ok, status, data } = await postAiDispatch(prompt);
    changedItemId = renderOutcome(ok, data, status);
    if (ok) dispatchInput.value = "";
  } catch (error) {
    console.error("AI dispatch request failed:", error);
    showResult("error", [
      el("span", "font-semibold text-[#FF9C92]", "Not recorded."),
      el("span", "text-white/80", "Can't reach the server. Check your connection and try again."),
    ]);
  } finally {
    dispatchButton.disabled = false;
    dispatchButton.textContent = BUTTON_LABEL;
    onSubmitted({ itemId: changedItemId });
  }
}

// onSubmitted({ itemId }) runs after every note, so the page can reload its data.
export function initDispatch({ onSubmitted }) {
  dispatchForm.addEventListener("submit", (event) => handleSubmit(event, onSubmitted));

  for (const example of dispatchExamples) {
    example.addEventListener("click", () => {
      dispatchInput.value = example.dataset.example;
      dispatchInput.focus();
    });
  }

  // "/" jumps to the dispatch input from anywhere except another text field.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target.closest("input, textarea, select, [contenteditable]")) return;
    event.preventDefault();
    dispatchInput.focus();
  });
}
