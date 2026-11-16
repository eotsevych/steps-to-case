# RoomDesk end-to-end tests (Playwright + TypeScript)

Example test framework for the RoomDesk demo app in [`docs/demo`](../../docs/demo). Use it to try the StepsToCase test generator on a real project.

## Run

```bash
npm install
npx playwright install chromium
npm test            # all tests; starts the demo app on http://127.0.0.1:8000
npm run test:smoke  # only @smoke
npm run report      # last HTML report
```

`BASE_URL=https://… npm test` runs against another server and skips starting the local one.

## Structure

| Path | What |
|---|---|
| `src/pages/` | Page objects. Each extends `BasePage`: sets its own `path`, gets the shared `topBar` and `open(query)`. |
| `src/components/` | Parts shared by several pages (`TopBar`). |
| `src/fixtures/test.ts` | `test` with the page objects as fixtures. Tests import `test` and `expect` from `@fixtures`. |
| `src/data/` | Test data: typed option labels, known rooms, and `bookingData()` for a valid booking. |
| `tests/<area>/*.spec.ts` | Tests (to be written). |

Locators: `getByRole` / `getByLabel` first, `getByTestId` (`data-testid`) when the element has one, CSS only as a last resort.

## Try the generator

1. Record the flow in StepsToCase on http://127.0.0.1:8000/rooms.html: search, book a room, fill the form, confirm. Use **Capture** for the booking reference and link the summary assertion to the saved values. Download the JSON.
2. Start your agent in **this folder** and run the setup skill (`/stepstocase-setup` in Claude Code). It scans this framework and writes `/generate-autotest`.
3. Run `/generate-autotest path/to/recording.json`, then `npm test`.
