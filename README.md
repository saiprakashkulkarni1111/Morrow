# Morrow

Morrow is a lightweight celebration-planning command center for weddings, birthdays, and community events. It is intentionally dependency-free so it can be opened locally, reviewed easily, and deployed as a static site.

The current implementation is local-first rather than server-backed: plan changes are saved immediately in `localStorage`, survive refreshes, and hydrate another open Morrow tab through the browser `storage` event without a page reload. A hosted database or multi-user account system is not required for this mode.

## Run

Open `index.html` in a browser. No build step or package install is required.

## Structure

- `index.html` contains the semantic page structure and accessible form controls.
- `styles.css` contains the responsive Midnight Garden visual system and reduced-motion/focus states.
- `app.js` contains the small application state model and user interactions.
- `tests.html` is a zero-dependency browser test runner with 16 assertions.
- `window.MorrowApp` exposes pure planning functions and `runSelfTests()` for browser-based evaluation.

## Quality decisions

- User-provided event names are written with `textContent`, never interpolated into markup.
- Budget values are validated as finite integers from `$100` through `$10,000,000`.
- Local storage is schema-sanitized before it can enter application state.
- The state object is the source of truth; rendering never scrapes visible text back into state.
- Event templates synthesize event-specific tasks, budgets, vendors, ideas, and co-pilot copy.
- `synthesizePlan()` is an explainable local GenAI fallback: it produces a complete plan without requiring a network service or API key.
- Buttons have explicit `type="button"` values to prevent accidental form submission behavior.
- Icon-only controls have accessible labels, and toggle states use `aria-pressed`.
- The modal can be closed with Escape, returns focus to the trigger, and supports backdrop dismissal.
- The app honors `prefers-reduced-motion` and provides visible keyboard focus indicators.
- The UI is responsive without JavaScript-driven layout logic, keeping runtime work small.
- A `storage` listener keeps separate tabs aligned when the same local plan changes.
- Progress tracks expose `role="progressbar"` and update `aria-valuenow` as tasks change.
- Modal keyboard focus is trapped while open and restored to the trigger when closed.

## Manual smoke test

1. Open `index.html`.
2. Select **New plan**, choose an event type, and submit a valid name and budget.
3. Confirm the breadcrumb, hero copy, and budget summary update.
4. Try an empty name or a zero budget and confirm the plan does not update.
5. Add and complete a task.
6. Save an inspiration card and use **Shuffle ideas**.
7. Open the dialog and close it with Escape.
8. Open `tests.html` and confirm all 16 assertions pass.
9. Open `index.html?selftest=1` and confirm no self-test error is thrown; or run `MorrowApp.runSelfTests()` in DevTools.
