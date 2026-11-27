# Ralph Loop working notes

Running notes from the Ralph Loop design passes on the Warehouse Dashboard.
Each round records what review found, what changed, and the verdict from
checking the result against `.agents/skills/frontend-design/SKILL.md`.
Screenshots are taken with headless Chrome at 1440 px (desktop) and 390 px (mobile).

---

## Round 1: review of the starting point

**Already working:** AI dispatch bar, inventory table (ID, item, stock, shelf,
supplier, low-stock badge), order/receive toggle with submit button, activity log
(time, type, item, quantity), refresh button, success/error banner.

**Problems found**

| Area | Finding |
| --- | --- |
| Identity | Stock "SaaS card kit": indigo accent, identical white cards with the same shadow, gradient wash on the dispatch bar. Nothing says "warehouse". |
| Typography | Default system stack. All-caps tracked labels on every stat and table header (a templated tell). Header subtitle uses a middle-dot meta string. |
| Hierarchy | Three equal stat cards take a full row to say "4, 20, 2". The dispatch bar, which is the most distinctive feature, looks like any other card. |
| Mobile | Inventory and activity tables overflow horizontally at 390 px. The supplier column is cut off, and so is the "Receive shipment" tab label. |
| Workflow | To order an item you see in the table, you have to find it again in a dropdown. You can't search or filter inventory. There's no hint of how much stock is available while typing a quantity. |
| Feedback | Validation errors appear in a banner at the top of the page, far from the field. The banner pushes the layout down. Refresh gives no sign that it's working and no "last updated" time. |
| States | Loading is a single line of text. There's no "no results" state and no retry when loading fails. |
| Copy | "Execute AI Command" and "Submit order" are system words. "Restock" and "Receive shipment" are mixed. |
| Details | No favicon (404 in console). No page meta description. No keyboard shortcut for dispatch. |

## Round 1: design plan

**Subject:** the daily stock desk for a small 3PL warehouse. The people using it
are shift leads and pickers working at a desk or on a phone on the floor. Its main
job is to see what's on the shelves and record what leaves or arrives, fast.

**Color**

| Token | Hex | Role |
| --- | --- | --- |
| Ink | `#13233A` | Dock band, headings, primary text |
| Steel | `#5A6B7E` | Secondary text, icons |
| Line | `#DDE3E9` | Borders, dividers |
| Paper | `#F3F5F7` | Page background (cool, not cream) |
| Signal | `#F2A900` | Safety amber. Used only for low stock and the focus/primary action in the dock |
| Order / Receive | `#1F5FBF` / `#1E7D4F` | Direction of movement: units out (blue) and units in (green) |

**Type:** Barlow, one family. It was drawn from the road and rail signage of
California, which suits logistics. Semibold for headings, medium for labels,
tabular figures for every count. Sentence-case labels and no all-caps eyebrows.

**Layout**

```
┌─ ink dock band ───────────────────────────────────────────────────┐
│ Columbia Logistics  Warehouse          Updated 2:41 PM  [Refresh] │
│ Tell the warehouse what happened                                   │
│ [ Ship 4 bubble wrap to Columbia hub ..................] [Run]     │
│ Try: (Ship 3 packing tape) (Received 20 cardboard boxes)           │
│                               4 items   20 units   2 low stock     │
└────────────────────────────────────────────────────────────────────┘
┌ Inventory   [search……] [All | Low stock] ┐ ┌ Record a movement ┐
│ ID  Item        Stock  Shelf  Supplier ⋯ │ │ (Ship out|Receive) │
│ row actions: Ship / Receive              │ │ item, qty, submit  │
└──────────────────────────────────────────┘ └────────────────────┘
┌ Recent activity ───────────────────────────────────────────────────┐
```

Content is left-aligned and numbers are right-aligned. Below `md`, table rows
reflow into stacked records so nothing scrolls sideways.

**Principles**
1. Spend the boldness in one place: the ink "dock" band that holds the dispatch
   console. Everything below it is quiet paper and hairlines.
2. Use warehouse vernacular where it carries information. Shelf codes appear as
   small bin labels and low stock as safety amber. Movement direction is shown
   with color and a +/− sign.
3. Every action happens next to its cause. Row actions prefill the form,
   validation errors sit under the field, and results appear as a toast.

**Review against the brief / generic defaults**
- First draft used three stat cards again, which is trait 4. *Changed:* the stats
  became a single inline summary inside the dock band.
- First draft had all-caps table headers, which is trait 5. *Changed:* they are now
  sentence case in Steel.
- I considered monospace for IDs, a trait 5 tell. *Changed:* IDs use Barlow with
  tabular figures. Shelf codes get a bin-label treatment because they really are
  physical labels.
- Indigo became ink navy plus safety amber. The amber is tied to a real meaning
  (low stock) and isn't decoration.

## Round 1: what was built

- **Dock band.** Ink header holding the brand, last-updated time, refresh with a spinner, the dispatch
  console (large input, amber "Run dispatch", two example notes you can click, a `/` shortcut) and a
  three-cell stock summary. The low-stock cell filters the table.
- **Inventory.** Search (item, shelf, supplier, ID), All / Low stock filter, an item count, shelf codes
  drawn as bin labels and an amber low-stock tag. Order and Receive buttons on each row prefill the form.
  A footnote explains the low-stock rule. On phones, rows reflow into stacked records.
- **Movement form.** Place order / Receive shipment tabs (with arrow-key support) that recolor the submit
  button blue (out) or green (in). Inline field errors. An "N available" hint, a client-side check that
  stops ordering more than is in stock, a −/+ stepper, and a spinner on the button while it submits.
- **Activity.** Order / Received tags, signed quantities (+10 / −2), readable times ("Yesterday, 2:41 PM"),
  and the full timestamp on hover. Reflows on mobile.
- **States.** Skeleton rows while loading, empty states that tell you what to do, error rows with
  "Try again", "No items match" with "Clear filters". A refresh that fails keeps the last good data.
- **Feedback.** Toasts (bottom right, stacked, max 3). Success toasts close on their own and errors stay
  until dismissed. The row that changed flashes amber once.
- **Details.** Favicon, meta description, theme color, skip link, `:focus-visible` amber ring,
  `prefers-reduced-motion` respected.
- **Server.** `GET /api/health` for Render health checks. Tests added for it and for serving the page
  (9/9 pass).

## Round 1: design-skill verdict

| Skill check | Result |
| --- | --- |
| Grounded in subject | Pass. Bin labels, safety amber and in/out colors all come from warehouse practice. |
| Boldness in one place | Pass. The ink dock band is the one loud element and everything below is quiet. |
| Typography | Pass. One family (Barlow), sentence case, no all-caps eyebrows, tabular figures. |
| Generic tells avoided | Mostly. The title still uses a middle dot ("Warehouse · Columbia Logistics"). Panels share one radius, which is acceptable for a data tool but worth a look. |
| Copy | Pass. "Run dispatch", "Place order" → toast "Order placed", "Receive shipment" → "Shipment received". Errors say what happened and what to do. |
| Quality floor | Pass on mobile (390 px), focus ring and reduced motion. Not yet checked: keyboard order through row actions, toast contrast, dark-band contrast of `white/60` text. |
| Verdict | **Not yet at the bar.** Fixed in-round: the filter label wrapping, activity column widths, row-action tap targets on mobile, hiding the `/` hint on phones. Carried to round 2: contrast audit, title middle dot, the form panel's height mismatch with inventory on desktop, and checking the success-path screenshots (toast, row flash, prefill). |

---

## Round 2: review

Screenshots this round covered the flows round 1 never looked at: row prefill, order success (toast and
row flash), over-stock validation, "no items match", a slow API (skeletons) and an unreachable API on mobile.
I also measured keyboard tab order and computed WCAG contrast for every text/background pair.

| Finding | Fix |
| --- | --- |
| First load with the server down showed the toast "Your last data is still shown" when nothing had loaded. The toast also covered the inline "Try again". | Error toast only when data was already on screen. On first load the inline error rows do the explaining. |
| Item dropdown said "Loading items…" forever when inventory failed, and the submit button stayed active. | It now shows "Items unavailable" and the submit button is disabled until items load. |
| Browser number spinner appeared beside the custom −/+ stepper. | Native spinner hidden (WebKit and Firefox). |
| Form hint left a one-word orphan line ("warehouse.") at the desktop width. | `text-pretty` on the hint. |
| Placeholder grey `#8A99AA` was 2.91:1 on white. | Darkened to `#6F7F92` (4.1:1). All other text pairs measured 4.96:1 or better (most 6–8:1). |
| Page title used the middle-dot meta pattern. | Now "Columbia Logistics Warehouse". |
| **Race (code review):** a background refresh in progress silently swallowed the refresh after an order, so stock could look unchanged. | Refresh requests made mid-refresh are queued and run once when the current one ends. |
| Stock goes stale when several people work the same warehouse. | Quiet auto-refresh every 60 s while the tab is visible, and when it becomes visible again. No spinner and no toasts. |

Tab order verified: filters → each row's Order/Receive → mode tabs → item → − → quantity → + → submit.
No page errors in any flow. `npm test` 9/9, `npm run build:css` OK.

## Round 2: design-skill verdict

| Skill check | Result |
| --- | --- |
| Failure and emptiness as direction | Pass. Every error says what happened and offers the next step ("Try again", "Clear filters", "Lower the quantity or receive a shipment first"). Errors don't apologize. |
| Motion answers actions | Pass. The only motion is the refresh spinner, button spinners, the toast entrance and a one-time amber flash on the changed row. None of it runs unprompted. |
| Quality floor | Pass. AA contrast measured, keyboard order logical, focus ring visible on ink and paper, reduced motion respected. |
| Consistency of vocabulary | Pass. "Place order" → "Order placed", "Receive shipment" → "Shipment received", and activity tags say "Order" / "Received". |
| Verdict | **Close.** Left for round 3: a tablet-width (768–1023 px) check, an empty-database state, the dispatch success screenshot, and the desktop gap under a short inventory list. |

---

## Round 3: review

| Check | Finding | Fix |
| --- | --- | --- |
| Tablet, 820 px | Single column, so the movement form stretched to 770 px: huge tabs and a full-width quantity stepper. | Between `md` and `lg`, the tabs are capped at 28 rem and item + quantity sit side by side, with submit spanning both. |
| Empty database | Inventory showed "No items yet", but the form dropdown still said "Choose an item". | The dropdown says "No items in inventory" and the submit button is disabled. |
| Dispatch success | "Received 20 × Cardboard Boxes (#104) Recorded. 28 now in stock. Read by the built-in parser", plus a toast and a row flash. | None needed. |
| `/` shortcut | Focuses the dispatch input. Ignored while typing in another field. | None needed. |
| Desktop gap under a 4-row inventory | The form panel is taller than a 4-item table. With a real catalog the table is the taller column, and the form stays in view (`lg:sticky`). | Accepted on purpose. Stretching the table panel would leave a large empty white box. |

`npm test` 9/9, `npm run build:css` OK, no page errors at 390 / 820 / 1440 px.

## Round 3: design-skill verdict — PASS

| Skill check | Result |
| --- | --- |
| Grounded in subject | Pass. Bin-label shelf codes, safety-amber low stock, blue out / green in, signed quantities. |
| One bold element, the rest disciplined | Pass. The ink dock band with the dispatch console. Panels below are hairline and quiet. |
| Typography | Pass. Barlow only, a clear scale (28 / 16 / 15 / 14 / 12), sentence case, tabular figures, no all-caps eyebrows, and no single-word accent in headlines. |
| Generic tells | Pass. No cream/terracotta, no gradient washes, no identical shadowed card grid, no middle-dot meta strings, no `→` buttons, and no monospace labels. |
| Copy | Pass. Active, specific and consistent. Errors explain and direct. Empty states invite action. |
| Quality floor | Pass. Responsive at 390 / 820 / 1440 px, AA contrast measured, visible focus, keyboard reachable, reduced motion respected. |
| "Remove one accessory" | Removed the hover-only row actions (hidden affordances), the gradient on the dispatch bar, and the redundant form title that repeated the selected tab. |

**The design meets the brief.** Moving to the documentation pass.
