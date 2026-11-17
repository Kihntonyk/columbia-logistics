// --- Banner ---
// The success / error message shown above the dashboard.

import { banner, bannerMessage, bannerClose } from "./elements.js";

const BANNER_STYLES = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-red-200 bg-red-50 text-red-800",
};
let bannerTimer;

export function showBanner(type, message) {
  clearTimeout(bannerTimer);
  banner.className = `mb-6 flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${BANNER_STYLES[type]}`;
  bannerMessage.textContent = message;
  if (type === "success") {
    bannerTimer = setTimeout(hideBanner, 5000);
  }
}

export function hideBanner() {
  banner.classList.add("hidden");
  banner.classList.remove("flex");
}

export function initBanner() {
  bannerClose.addEventListener("click", hideBanner);
}
