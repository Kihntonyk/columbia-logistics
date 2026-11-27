# Design review: Ralph Loop, 27 November 2026

**Scope:** Warehouse dashboard UI (`public/`, `styles/`, `tailwind.config.js`) plus small server additions.
**Method:** three Ralph Loop rounds. Each round was: review (screenshots in headless Chrome at 390, 820
and 1440 px, plus scripted flows) → implement → verify against `.agents/skills/frontend-design/SKILL.md`
→ `npm test` and `npm run build:css`. Round-by-round detail is in [`ralph-notes.md`](ralph-notes.md).

## What Ralph found

The starting app was functionally complete. Dispatch, inventory, the order/receive toggle, the activity
log and refresh all worked. The problem was the look and feel, which read as a template:

- **Generic look.** Indigo accent, three identical stat cards, the same shadow on every card, a gradient
  wash, and all-caps tracked labels. These are the design skill's "SaaS card kit" and "template chrome" tells.
- **Broken on phones.** Both tables scrolled sideways at 390 px. The supplier column and a tab label were cut off.
- **Friction.** To act on an item in the table you had to find it again in a dropdown. There was no
  search or filter and no stock hint while typing a quantity. Validation errors appeared in a banner far
  from the field.
- **Thin states.** Loading was one line of text. There was no "no results" state, no retry, and no sign that
  refresh was working.
- **Details.** No favicon (console 404), system-word copy ("Execute AI Command", "Submit"), mixed vocabulary
  ("restock" / "receive shipment").

Later rounds found problems that only show up in specific states:
- A misleading "your last data is still shown" toast on a first load that failed.
- A dropdown stuck on "Loading items…".
- A placeholder grey at 2.91:1 contrast.
- A native number spinner doubling the custom stepper.
- A clumsy full-width form at tablet width.
- **A real bug:** an in-progress background refresh swallowed the refresh after an order, so stock could look
  unchanged after a successful order.

## What was improved

**Visual identity:** grounded in the subject (a small 3PL's stock desk) rather than a generic dashboard.

| Token | Choice | Why |
| --- | --- | --- |
| Ink `#13233A` | Dock band and text | One bold, calm surface that holds the main action |
| Safety amber `#F2A900` | Low stock and the primary dock button only | Warehouse hazard color, tied to meaning |
| Out blue `#1F5FBF` / In green `#1E7D4F` | Order vs. receive | The direction of movement is visible at a glance |
| Barlow | The only typeface | Drawn from road and rail signage, so it suits logistics; tabular figures for counts |
| Bin labels | Shelf codes | Drawn like the physical rack labels they represent |

**Layout:** a single ink "dock band" (brand, refresh, dispatch console, stock summary) above quiet
hairline panels. Inventory and the movement form sit side by side on desktop, and the form stays in view
while scrolling. Between 768 and 1023 px the form fields sit side by side, and below 768 px every table
reflows into stacked records.

**Features and UX added**
- Inventory search (item, shelf, supplier, ID), an All / Low stock filter, item count, and "Clear filters".
- Clicking the low-stock number in the summary filters the table.
- Order / Receive buttons on every row that prefill the form and focus the quantity.
- "N available" hint, a client-side over-stock check, inline field errors, a −/+ stepper, and a spinner on
  submit buttons.
- Dispatch console: clickable example notes, a `/` keyboard shortcut, and a result line showing what was
  understood, the outcome and which parser read it.
- Toast notifications instead of a layout-shifting banner. The changed row flashes amber once.
- Skeleton loading, empty states with next steps, and error states with "Try again". A refresh that fails
  keeps the last good data.
- Last-updated time, a refresh spinner, a quiet 60-second auto-refresh while visible, and queued refreshes
  so none are lost.
- Favicon, meta description, theme color, skip link, an amber focus ring, `prefers-reduced-motion` support,
  and ARIA roles on tabs, filters and live regions.
- Server: `GET /api/health` for Render's health check, plus tests for it and for serving the page
  (suite now 9/9).

## How the design skill verified it

Each round ended with a check against the frontend-design skill's criteria, using screenshots rather than
code reading alone:

| Criterion | Evidence |
| --- | --- |
| Ground the design in the subject | Palette, bin labels and in/out colors all map to warehouse practice (round 1 plan). |
| Spend boldness in one place | Only the dock band is loud. Panels below are hairline and quiet. |
| Avoid generic tells | Plan reviewed against the five clusters. Removed the stat-card trio, all-caps labels, middle-dot meta strings, the gradient wash and monospace IDs. |
| Typography | One family, a clear scale, sentence case, tabular numerals. |
| Motion only in answer to actions | Only spinners, the toast entrance and the changed-row flash. Nothing moves unprompted. |
| Copy | Active and consistent ("Place order" → "Order placed"). Errors explain and direct. Empty states invite action. |
| Quality floor | WCAG contrast computed for every pair (all text ≥ 4.96:1 after the placeholder fix). Tab order measured. Visible focus. 390 / 820 / 1440 px checked. Reduced motion respected. No console errors. |
| "Remove one accessory" | Dropped hover-only row actions, the gradient, and a duplicate form title. |

**Verdicts:** Round 1, not yet at the bar (states, contrast and mobile details unverified). Round 2, close
(tablet and empty-database states untested). **Round 3, pass.**

## Known limitations

- With only 4 sample items, the desktop form panel is taller than the inventory table, which leaves a gap
  below it. With a real catalog this reverses. Accepted on purpose.
- Barlow loads from Google Fonts and falls back to the system sans-serif if it's blocked. Self-hosting the
  font is a small follow-up.
- There are no browser-level automated tests yet. The UI flows were verified with scripted screenshots
  (see the Future Roadmap in the README).
