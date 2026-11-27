// --- Element references ---
// Every element the dashboard reads or updates, looked up once and shared by the other modules.

const byId = (id) => document.getElementById(id);

// Header
export const refreshButton = byId("refresh-button");
export const refreshIcon = byId("refresh-icon");
export const lastUpdated = byId("last-updated");

// Stock summary
export const statItems = byId("stat-items");
export const statUnits = byId("stat-units");
export const statLow = byId("stat-low");
export const statLowDot = byId("stat-low-dot");
export const statLowButton = byId("stat-low-button");

// Dispatch
export const dispatchForm = byId("dispatch-form");
export const dispatchInput = byId("dispatch-input");
export const dispatchButton = byId("dispatch-button");
export const dispatchResult = byId("dispatch-result");
export const dispatchExamples = document.querySelectorAll(".dispatch-example");

// Inventory
export const inventoryBody = byId("inventory-body");
export const inventoryCount = byId("inventory-count");
export const inventorySearch = byId("inventory-search");
export const filterButtons = document.querySelectorAll(".filter-btn");
export const lowThreshold = byId("low-threshold");

// Movement form
export const movementPanel = byId("movement");
export const modeTabs = document.querySelectorAll(".mode-tab");
export const formHint = byId("form-hint");
export const orderForm = byId("order-form");
export const itemSelect = byId("item-select");
export const itemError = byId("item-error");
export const quantityInput = byId("quantity-input");
export const quantityHint = byId("quantity-hint");
export const quantityError = byId("quantity-error");
export const qtyDec = byId("qty-dec");
export const qtyInc = byId("qty-inc");
export const orderButton = byId("order-button");

// Activity
export const activityBody = byId("activity-body");

// Toasts
export const toastRegion = byId("toast-region");
