# Framework Profile: roomdesk-e2e

Scanned 2026-11-13 (second scan: 3 page objects, 1 component, 1 test). Confidence: `confirmed` (in the code), `decided by the user` (setup interview), `default` (framework default, no example in the repo yet).

## In the team's words

"explore": the team gave no description.

## Stack

| Fact | Evidence | Confidence |
|---|---|---|
| TypeScript 7.0.2, strict mode, path aliases `@pages/*`, `@components/*`, `@fixtures`, `@data/*` | `package-lock.json`, `tsconfig.json:11-16` | confirmed |
| `@playwright/test` 1.65.0 (runner, driver, assertions) | `node_modules/@playwright/test/package.json` | confirmed |
| No BDD, no Allure. Reporters: `list` + `html` | `package.json`, `playwright.config.ts:10` | confirmed |

## Layout

| Fact | Evidence | Confidence |
|---|---|---|
| Page objects: `src/pages/<Name>Page.ts`, one class per file | 3 files: `RoomsPage.ts`, `BookPage.ts`, `ConfirmedPage.ts` | confirmed |
| Components: `src/components/<Name>.ts` (`TopBar`) | `src/components/TopBar.ts` | confirmed |
| Fixtures: `src/fixtures/test.ts` | file | confirmed |
| Test data: `src/data/*.ts` | `src/data/booking.ts`, `src/data/rooms.ts` | confirmed |
| Tests: `tests/<area>/<kebab-testName>.spec.ts`, one file per recording | `tests/rooms/book-a-room-test.spec.ts` ("Book a Room Test") | confirmed (1 file) + decided by the user |

## Architecture

| Fact | Evidence | Confidence |
|---|---|---|
| Page Object Model + component objects | `BasePage`, 3 pages, `TopBar` | confirmed |
| Every page extends `BasePage`: sets `protected readonly path` (relative to `baseURL`, no leading slash), gets `topBar` and `open(query = ''): Promise<this>` | `src/pages/BasePage.ts:5-20`, 3 pages | confirmed |
| Pages are fixtures: key in `type Pages`, `xPage: async ({ page }, use) => use(new XPage(page))` | `src/fixtures/test.ts:7-18` (3 entries) | confirmed |
| Tests import `test` from `@fixtures`; page objects and components import from `@playwright/test` | `test.ts:13`, test file, 4 page/component files | confirmed |
| Elements: `readonly x: Locator` fields set in the constructor; data-driven elements as `Locator` methods (`slotRadio(slot)`) | `BookPage.ts:6-21`, `RoomsPage.ts`, `TopBar.ts` | confirmed |
| Methods: `async`, `Promise<void>` (only `open` returns `this`), body in `test.step` | 11 methods in 4 files | confirmed + decided by the user (non-fluent) |
| `test.step` text = recorded `actionName` without quotes, values as `${param}` (`` `Select ${office} from Office` ``, `'Assert: Booking is created as requested'`) | `RoomsPage.ts:24`, `ConfirmedPage.ts:14` | confirmed |
| Method names from `actionName` (`clickOnSearch`, `pickMeetingTimeAt`, `checkAddAVideoCallLink`) | 3 pages | confirmed |
| Class name from the URL path: `rooms.html` -> `RoomsPage`, fixture `roomsPage` | 3 pages | confirmed |
| Assertions are `assert*` methods on page objects; tests contain no `expect` | `ConfirmedPage.ts:13-17`, test file | confirmed (1 example) + decided by the user |
| Shared header = `TopBar`, reached as `<page>.topBar` | `BasePage.ts:8-11` | confirmed |
| No flows layer, no App/registry class | tree | confirmed |

## Locators

| Fact | Evidence | Confidence |
|---|---|---|
| Policy: `getByRole` / `getByLabel` first, `getByTestId` (`data-testid`) when the element has one, CSS only as a last resort | README "Structure"; `testIdAttribute: 'data-testid'` in `playwright.config.ts:14` | confirmed |
| Usage: `getByRole` 9, `getByLabel` 5, `getByTestId` 1, `getByText` 1 (regex), `locator(css)` 1 (root `header.topbar`) | `src/` | confirmed |
| `exact: true` with a comment when a name is a substring of another (`'Book'` vs "My bookings") | `RoomsPage.ts:19-20`, `BookPage.ts:20` | confirmed |
| Scoping by chaining from a root / landmark | `TopBar.ts:13-17` | confirmed |
| Containers: `getByRole(...).filter({ hasText })`, then the element inside | | default |
| iframes: `page.frameLocator(selector)` / `locator.contentFrame()` | | default |
| Custom combobox: fill or click it, then `page.getByRole('option', { name })` | | default |

## Waits

| Fact | Evidence | Confidence |
|---|---|---|
| Business request after an action: `waitForResponse` (path match) started before the action, inside the method's `test.step` | `RoomsPage.ts:41-47` | confirmed |
| Navigation: no explicit wait; `waitForURL` only when the next locator also exists on the current page | | default |
| Banned: `waitForTimeout`, `waitForNavigation` (deprecated), `waitForLoadState('networkidle')` | none in repo | default |

## Assertions

Web-first `expect(locator)` inside page object `assert*` methods (`ConfirmedPage.assertBookingIsCreatedAsRequested`). Mapping in SKILL.md section 5.

## Tests

| Fact | Evidence | Confidence |
|---|---|---|
| `test('<testName>', async ({ <fixtures> }) => { ... })`, no `describe`, no `test.step` in the test body, one call per step | `tests/rooms/book-a-room-test.spec.ts` | confirmed + decided by the user (gold standard) |
| `// Precondition:` comment first, then the data factory call, then `open()` | same file, lines 6-9 | confirmed |
| Tags: none by default. `@smoke` exists as a grep tag (`npm run test:smoke`); add `{ tag: '@smoke' }` only when the user asks | `package.json` scripts | default |
| No test-management IDs | | confirmed |

## Preconditions

No login, seeding or cleanup helpers exist. The app shows a signed-in user without login (`TopBar.signedInUser`). Preconditions stay comments.

## Data & secrets

| Fact | Evidence | Confidence |
|---|---|---|
| Factories with overrides and a unique suffix: `bookingData(overrides)` | `src/data/booking.ts:10-18`, used in the test | confirmed |
| Option labels as string-literal union types (`Office`, `Day`, `People`) typing method parameters; `rooms` constants for expected texts | `src/data/rooms.ts`, `RoomsPage.ts:3,23`, test line 22 | confirmed |
| Values reach methods as parameters; the test overrides the factory only where the test is about it | test file | confirmed + decided by the user |
| Masked passwords -> `process.env.ROOMDESK_PASSWORD!` (or `ROOMDESK_<ROLE>_PASSWORD` for several users); name the variable in the reply | no secrets in repo | decided by the user |
| `baseURL` from `BASE_URL` env, default `http://127.0.0.1:8000/` | `playwright.config.ts:3` | confirmed |

## Commands

- Type-check: `npm run typecheck` (`tsc --noEmit`). Passes on the repo as scanned.
- Run: `npm test` (starts the demo app from `../../docs/demo`).

## Exemplars

- Test (gold standard): `tests/rooms/book-a-room-test.spec.ts`
- Page objects: `src/pages/BookPage.ts`, `src/pages/RoomsPage.ts`, `src/pages/ConfirmedPage.ts`; base `src/pages/BasePage.ts`
- Component: `src/components/TopBar.ts`
- Data factory: `src/data/booking.ts`
- Fixtures: `src/fixtures/test.ts`

## Documentation

| Library | Version | Source | Status |
|---|---|---|---|
| Playwright Test (TS) | 1.65.0 | Context7 `/microsoft/playwright` (latest indexed v1.64.1, queried `main` on 2026-11-13); https://playwright.dev/docs/intro | verified: `frameLocator` / `contentFrame()`, `waitForEvent('popup')`, `check`/`uncheck`/`selectOption`, `toBeVisible`/`toBeHidden`/`toBeEnabled`/`toBeDisabled`/`toBeChecked`/`toHaveText`/`toContainText`, `waitForResponse` before the action, `test.step` return value |

Lookup later: `npx -y ctx7 docs /microsoft/playwright "<question>"`, or the playwright.dev page for the topic.

## Open questions

- Containers, iframes, new tabs and custom comboboxes have no example in the repo: their rules are Playwright defaults. The first recording that uses one sets the pattern.
- The gold-standard test was itself generated; if the team changes it, the generator follows.
