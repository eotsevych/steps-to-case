---
name: generate-autotest
description: Generate an automated Playwright (TypeScript) test (and its page objects) from a StepsToCase recording JSON, following this project's conventions. Use when the user runs /generate-autotest, gives or pastes a StepsToCase JSON export, or asks to turn a recorded test into code.
---

# Generate a Playwright test from a StepsToCase recording

Input: the recording JSON, as a file path or pasted into the message. If there is neither, ask for it. Pasted JSON is used as is: do not save it to a file unless the user asks. If pasted JSON does not parse (cut off by the chat, or a broken copy), say so and ask for the file path instead of guessing the missing part.
The JSON is the source of truth for what the test does. This project is the source of truth for how the code looks.
Field reference: [references/recording-json.md](references/recording-json.md). Project facts: [references/framework-profile.md](references/framework-profile.md).

## 0. Read first

1. The recording JSON. If it is an **array**, it is a single-page export: only update the page object for its `pageName` (step 2), and write no test.
2. `## In the team's words` in the profile: the team's own rules. Follow them.
3. The examples. Match their style exactly:
   - Test: `tests/rooms/book-a-room-test.spec.ts` (fixtures, `bookingData()`, union-typed options, one call per step)
   - Page object: `src/pages/BookPage.ts` (fields, a `Locator` method for data-driven elements, `check()`); `src/pages/RoomsPage.ts` (`selectOption`, network wait); `src/pages/ConfirmedPage.ts` (an `assert*` method); base class `src/pages/BasePage.ts`
   - Component: `src/components/TopBar.ts` (element and method style)
   - Data: `src/data/booking.ts`, `src/data/rooms.ts`
4. Before writing a class or method, search for an existing one that already does it (`grep -rn "path = '" src/pages`, `grep -rn "async " src/pages src/components`, `ls src/data`). Reuse it. Never duplicate.
   When you are unsure about an API, check it with the documentation sources in the profile (`## Documentation`) before you write it.
5. Clean the recording with "Quirks in real recordings" in the reference, and write down the result before you code:
   - page types: each recorded page -> its site (`pageDomain`) -> its URL template -> page object;
   - tabs: which tab each step runs in (links with `target="_blank"` open new ones);
   - per step: the verb, the locator source (stable attributes only), the business request to wait for (noise removed), and the page it really belongs to (navigation can be filed one step late);
   - elements that repeat (the same element on several pages or in another language) -> one locator.

   Show this plan in a few lines at the start of your reply, so the user sees how you read the recording.

## 1. Where code lives

| What | Folder | File / class name |
|---|---|---|
| Tests | `tests/<area>/` | `<kebab-case testName>.spec.ts`, one new file per recording. `<area>` = the first page type's path without extension (`rooms.html` -> `rooms`) |
| Page objects | `src/pages/` | `<Name>Page.ts`, class `<Name>Page extends BasePage`, fixture `<name>Page` |
| Components | `src/components/` | `<Name>.ts`, class `<Name>` (no suffix), like `TopBar` |
| Test data | `src/data/` | `<area>.ts` with an interface + `<thing>Data(overrides)` factory, like `booking.ts` |

Registration: every new page object is added to `src/fixtures/test.ts`: an import from `@pages/<Name>Page`, a key in `type Pages`, and a fixture in `base.extend<Pages>({...})`, next to the existing ones:

```ts
import { OrdersPage } from '@pages/OrdersPage';
// type Pages = { ...; ordersPage: OrdersPage; }
ordersPage: async ({ page }, use) => use(new OrdersPage(page)),
```

Keep the comments and the `expect` re-export that are already in the file.

Mapping from the JSON:
- Page type -> page class. The page type comes from the URL template (slugs, IDs and locale prefix as parameters) and `pageTitle`, not from `pageName`, which is often a slug. The class name comes from the last URL path segment without extension or IDs, in PascalCase, plus `Page`: `rooms.html` -> `RoomsPage`, `/orders/123` -> `OrdersPage`, `/` -> `HomePage`. Look for an existing page object with the same route before making a new one (`grep -rn "path = '" src/pages`).
- `path` in the page object is relative to `baseURL`, with **no leading slash** (`'rooms.html'`): `baseURL` can have a sub-path. If the recording was made on a host with a prefix (`/steps-to-case/demo/rooms.html`), drop the part that is the app root.
- Folder and entry object for a page: always `src/pages/`, always a fixture. A page on another site (`pageDomain` differs from `baseUrl`'s host) gets a page object too, with an absolute URL in `path`; say so in the reply.
- `componentTag` `header` -> `TopBar`, reached as `<page>.topBar.<method>()`. Add missing elements and methods to `TopBar`. Another `componentTag` -> a new component class in `src/components/`, created in `BasePage` (if on every page) or in the page that has it.

## 2. Page objects: one method per step

Work page by page. Element declaration style: `readonly <name>: Locator;` fields, assigned in the constructor after `super(page)`, chained from a root locator when the elements share a container (see `TopBar`). Use `this.page` in methods (it is `protected` in `BasePage`). Method style: `async <name>(<params>): Promise<void>`, with the whole body inside `await test.step('<text>', async () => { ... })`.

```ts
import { test, expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '@pages/BasePage';

export class OrdersPage extends BasePage {
  protected readonly path = 'orders.html';
  readonly searchInput: Locator;
  readonly totalLabel: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByLabel('Search');
    this.totalLabel = page.getByTestId('order-total');
  }

  orderRow(name: string): Locator {
    return this.page.getByRole('row').filter({ hasText: name });
  }

  async fillSearch(text: string): Promise<void> {
    await test.step(`Fill Search with ${text}`, async () => {
      await this.searchInput.fill(text);
    });
  }

  async assertTotalIs(expected: string): Promise<void> {
    await test.step('Assert: Total is', async () => {
      await expect(this.totalLabel).toHaveText(expected);
    });
  }
}
```

(`OrdersPage` is an illustration; the real pages are in `src/pages/`.)

- One step = one method. A composed step (`SUBGROUP`, `COMBINED`) is one method that runs its inner steps; the tester decided that size. Never merge or split steps.
- Values: methods take typed values and expected texts as parameters (`fillMeetingTitle(title: string)`, `assertBookingIsCreatedAsRequested(expected: string)`). Use the union types in `src/data/` for option parameters (`selectOffice(office: Office)`). Never hard-code a recorded value inside a page object.
- Report steps: the `test.step` text is the recorded `actionName` with quotes removed and the typed value replaced by the parameter: `Fill "Title" with "Demo"` -> `` `Fill Title with ${title}` ``, `Click on "Book"` -> `'Click on Book'`. For a renamed step, use its name as is.
- Flows: there is no flows layer. Tests call page object methods directly.

Get the verb of a `RECORDED` step from `actionName` (`Click on`, `Fill ... with`, `Press`, `Select ... from`, `Check`, `Uncheck`, `Double-click on`, `Navigate to`). `actionKind` is NOT the verb. If the step was renamed, infer the verb from the element (see "The action verb is NOT a field" in the reference). `Select` on an element that is not a `<select>` is a combobox pick: `await this.x.fill(text)` (or `.click()` if it is not editable), then `await this.page.getByRole('option', { name }).click()`. On a real `<select>`: `await this.x.selectOption(value)`, where `value` is the visible label typed by the `src/data` union (Playwright matches value or label).

| stepType | Code |
|---|---|
| `RECORDED` | One action method. Value from `actionValue`, passed as a parameter. |
| `CAPTURE` | `async captureX(): Promise<string>` that returns `test.step('Capture X', async () => (await this.x.innerText()).trim())`. The test keeps it in a `const` named from `saveAs` (camelCase). Never hard-code its `actionValue`. |
| `ASSERTION_WITH_ELEMENT` | An `assert<What>` method on the page object (`assertBookingIsCreatedAsRequested(expected: string)` in `ConfirmedPage`), body in `test.step`, using the `expect` in section 5. The test only calls it; no `expect` in tests. |
| `ASSERTION_WITHOUT_ELEMENT`, `MANUAL` | A method with an empty body and a `// TODO: <actionName>` comment. The test calls it and continues. Never invent UI actions for them. |
| `MANUAL_WITHOUT_ELEMENT` (comment) | A one-line code comment above the sub-steps it labels. |
| `COMBINED` | One method that does all its sub-actions, named from `actionName`. |
| `SUBGROUP` | One page object method named from `actionName`. Its body does the inner steps by the same rules. A group that ends on another page lives on the page where it starts. |

- Check / Uncheck: set the state with `await this.x.check()` / `await this.x.uncheck()`. Never use a click that toggles.
- A link that opens a new tab: the method returns the new tab: `async clickOnX(): Promise<Page>` that does `const popup = this.page.waitForEvent('popup'); await this.x.click(); return await popup;` inside `test.step`. The test makes the page object for it with `new XPage(popup)` (imported from `@pages/XPage`); fixtures only serve the first tab. Switching back = calling the earlier page object again.

## 3. Locators

Build each locator from the element fields. There are no selectors in the JSON. Pick the first option that is unique on the page (team policy from the README: role/label first, test id when present, CSS last):

1. `getByRole(role, { name: elementAccessibleName })`: role from `role` or the tag (`button`, `a[href]` -> `link`, `input[type=checkbox]` -> `checkbox`, `select` -> `combobox`, headings, ...).
2. `getByLabel(elementLabel)` for form fields.
3. `getByTestId(<data-testid>)` when the element has a unique one (`testIdAttribute` is `data-testid`).
4. `getByPlaceholder(elementPlaceholder)`.
5. `getByText(<first line of elementInnerText>)`; a regex (`/^Signed in as /`) when part of the text is data.
6. `locator(css)` from a readable `id`, `name` or a stable `data-*` / semantic class (like `header.topbar`). Last resort.

- Never use generated IDs, state attributes (`aria-expanded`, `data-state`, ...), the `value` attribute, utility or hashed classes, long absolute CSS paths, XPath, or `nth()` / `first()` to pick one of many (scope by container instead). The full list is in "Quirks" in the reference.
- Text comes from `elementInnerText`, never `elementText`. Role names come from `elementAccessibleName`.
- After a language switch, the same element (same stable attributes) keeps one locator: use its test id or stable attribute, not the translated text.
- `containerLabel` / `containerHtml` present: declare the container as its own field, `page.getByRole('<row|article|listitem|dialog>').filter({ hasText: containerLabel })` (or its test id), and chain the element from it. When the label is data (a room name), make a method that takes it: `roomCard(name: string): Locator`.
  Read `containerHtml` to find a stable attribute of the container and of the element inside it.
- `frameUrl` present: `page.frameLocator('#<frameId>')`, else `iframe[name="<frameName>"]`, else `iframe[src*="<frameUrl path>"]`, then the locator from it. If `frameUrl` equals the page URL, or is missing for an element that is in an iframe, see "Frames" in the reference.
- Every locator a method uses is a `readonly` field set in the constructor. Locators that need a parameter are small methods returning `Locator`.

Example in this project's syntax:

```ts
this.root = page.locator('header.topbar');
const nav = this.root.getByRole('navigation', { name: 'Main' });
this.roomsLink = nav.getByRole('link', { name: 'Rooms' });
this.signedInUser = this.root.getByText(/^Signed in as /);

// a container whose label is data
roomCard(name: string): Locator {
  return this.page.getByRole('article').filter({ hasText: name });
}
```

## 4. Naming

- The method name is the step name the tester recorded (`actionName`), turned into an identifier in the repo's casing (camelCase methods and fields, PascalCase classes, kebab-case spec files). Keep its words and its verb; drop only quotes, punctuation and the typed value:
  - `Click on "Sign in"` -> `clickOnSignIn`
  - `Fill "Email" with "a@b.c"` -> `fillEmail`
  - `Login as admin` (renamed by the tester) -> `loginAsAdmin`
  - `Assert: Welcome message shown` -> `assertWelcomeMessageShown`
- Only when `actionName` names nothing (a selector such as `#_R_2pt4b36_`, or a placeholder such as `Manual step`, see the reference), build the name from `elementAccessibleName` -> `elementLabel` -> `elementAriaLabel` -> `elementInnerText` (3 to 4 words).
- If the name is already taken by a method that does something else, add the element or container to it.
- Locator fields: `<what><Role>` like `TopBar`: `roomsLink`, `titleInput`, `bookButton`, `summary`.

## 5. Assertions

Inside the page object's `assert*` method (`expect` from `@playwright/test`):

| assertElementType | Code |
|---|---|
| `visible` | `await expect(this.x).toBeVisible();` |
| `hidden` | `await expect(this.x).toBeHidden();` |
| `enabled` / `disabled` | `await expect(this.x).toBeEnabled();` / `await expect(this.x).toBeDisabled();` |
| `checked` / `unchecked` | `await expect(this.x).toBeChecked();` / `await expect(this.x).not.toBeChecked();` |
| `text_equals` | `await expect(this.x).toHaveText(expected);` with `actionValue` |
| `text_contains` | `await expect(this.x).toContainText(expected);` with `actionValue` |

- `expected` is a parameter; the test passes `actionValue` (or a data factory field when the value came from one).
- `valueFrom` present: the expected text is the variable of the step whose `saveAs` has that name, not the literal `actionValue`.

## 6. Waits

- `triggeredRequests`: first remove noise (`/cdn-cgi/*`, analytics and tracking, page fetches such as `*.html`, `*.css`, `*.js` of the app itself). If a business request remains (for example `api/rooms.json`): start `const response = this.page.waitForResponse(r => r.url().includes('<stable path>'));` before the action, then `await response;` after it, all inside the method's `test.step` (as in `RoomsPage.clickOnSearch`). Match on the path; the JSON has no HTTP method.
- `triggeredNavigationUrl` present: no explicit wait; the next page's locators auto-wait. Add `await this.page.waitForURL(/<path>/)` at the end of the method only when the next step's element also exists on the current page (for example a `TopBar` link).
- Never: `page.waitForTimeout`, `waitForNavigation` (deprecated), `waitForLoadState('networkidle')`, or any fixed sleep.

## 7. Data and preconditions

- Preconditions (`preconditions[]`): one `// Precondition: <text>` comment each, at the top of the test, before the first step. Do not automate them. There are no login or seeding helpers in this repo.
- Masked password `••••••••`: `process.env.ROOMDESK_PASSWORD!` (one user), or `process.env.ROOMDESK_<ROLE>_PASSWORD!` when a recording uses several users. Say in the reply which variable must be set. Never type the mask.
- Recorded input values: from the matching factory in `src/data/` (`bookingData()` for booking forms). Pass a recorded value as an override only when it matters to the flow (a chosen slot, an option); keep the factory's unique values (titles) otherwise. If no factory fits, add one in `src/data/<area>.ts` in the `bookingData` style (interface + `xData(overrides: Partial<X> = {})`, unique text with `Date.now().toString(36)`). Option labels use or extend the union types in `src/data/rooms.ts`.
- A fill or select with `saveAs`: declare its value once and pass the same variable to the step and to every assertion with a matching `valueFrom`.
- Start URL: `await <firstPage>.open('<query>')`, where `<query>` is the query string of `startUrl` (`'?room=atlas'`), or `open()` when there is none (`baseUrl` in the JSON is only the environment it was recorded on). If `startUrl` is not the page object's `path`, find or make the page object for it.

## 8. The test

- One `test('<testName>', async ({ <page fixtures used> }) => { ... })` per file. No `test.describe`, no `test.step` in the test (the methods have their own), no `beforeEach` unless the recording needs it. Imports: `test` from `@fixtures`, data from `@data/<file>`, page classes from `@pages/...` only for new tabs.
- Tags / IDs: none by default. Add `{ tag: '@smoke' }` only when the user asks.
- Sort **all** top-level steps by `stepOrder` across pages, then write one call per step in that order. No raw locators and no `expect` in the test.
- Test name: from `testName`. If it is `Untitled Test`, name it from what the flow does.
- Generate every recorded step and only the recorded checks. No checks in the recording = no checks in the test.

Skeleton:

Follow `tests/rooms/book-a-room-test.spec.ts`. A `CAPTURE` + `valueFrom` pair adds two lines to that shape:

```ts
  const bookingId = await confirmedPage.captureBookingId();     // saveAs: "Booking ID"
  await confirmedPage.assertReferenceHasText(bookingId);        // valueFrom: "Booking ID"
```

## 9. Check before finishing

1. Run `npm run typecheck`. Fix every error you caused.
2. Every top-level step is covered by a call, in `stepOrder`, and no step is lost.
3. Existing classes and methods were reused; new page objects are registered in `src/fixtures/test.ts`.
4. Locators are scoped by container and frame wherever the JSON has one.
5. No `••••••••`, no hard-coded secrets, no fixed sleeps.
6. Reply with: the files changed; a table `stepOrder | actionName | page object | code call`; env vars to set; TODO steps left for a person.
