# StepsToCase recording JSON: field reference

Source of truth: `ExportRecording` and `ExportSingleStep` in `src/types/index.ts`, built by `src/lib/exporter.ts` of the StepsToCase extension. Copy this file next to every generated test generator.

## Two export shapes

| Shape | How to recognize | Made by | Use |
|---|---|---|---|
| Full recording | JSON **object** with `testName` and `pages` | normal recording | a whole test |
| Single-page | JSON **array** of flat steps, each with `pageName` | Single Page mode | one page object, no test |

## Full recording

```jsonc
{
  "testName": "Create order",
  "baseUrl": "https://staging.example.com",   // origin of the tab where recording started
  "startUrl": "/login",                       // path on baseUrl
  "preconditions": ["User is logged in as admin"], // optional, plain strings
  "pages": [{
    "pageOrder": 1,
    "pageName": "Orders",            // human name, often from the URL ("/orders/123" -> "orders")
    "pageUrl": "/orders",            // path (+ "#/route" for hash routers), never a query string
    "pageTitle": "Orders | Shop",
    "pageTag": "newdesign",          // optional, from the user's page recognition rules
    "steps": [ /* see step types */ ]
  }]
}
```

Rules:

- **Order.** Top-level `stepOrder` is global across all pages. A page visited twice (same domain + path) is listed once with all its steps together. Run the steps sorted by `stepOrder`, never page by page.
- **Empty values are removed.** Empty strings and empty objects are dropped from the file. A missing field means "empty". Never fail on a missing field.
- **No selectors.** The file has no CSS/XPath selector. Build locators from the element fields below.
- **Passwords are masked.** A value of `••••••••` is a password. Never type it literally. Use the project's secret source.
- **Other domains.** A page on another domain (an SSO login, for example) still shows only its path in `pageUrl`. `triggeredNavigationUrl` on the step before it shows where the flow went.

## Step types (`stepType`)

Every step has `stepOrder`, `stepType`, `actionKind`, `actionName`.

| stepType | actionKind | Meaning | Element fields |
|---|---|---|---|
| `RECORDED` | `action` | A real user action | `element*` |
| `ASSERTION_WITH_ELEMENT` | `assertion` | Expected result about an element | `assertElement*` |
| `ASSERTION_WITHOUT_ELEMENT` | `assertion` | Expected result in words only (`actionName`) | none |
| `MANUAL` | `action` | A step a person wrote by hand. `actionName` is the whole instruction | none |
| `MANUAL_WITHOUT_ELEMENT` | `comment` | A label inside `COMBINED` / `SUBGROUP`. It names the sub-steps after it | none |
| `COMBINED` | `action` | One step made of several sub-actions in `steps` | in children |
| `SUBGROUP` | `subgroup` | A business step a person built from several steps. `actionName` is its name, `steps` holds them | in children |

Nesting:

- `COMBINED.steps` holds only `RECORDED` steps and comment labels. Its assertions come right **after** it as top-level steps.
- `SUBGROUP.steps` can hold `RECORDED`, `MANUAL`, comment labels and both assertion types. A combined step inside a subgroup is flattened: one comment label, then its sub-actions.
- `stepOrder` inside `COMBINED` / `SUBGROUP` restarts at 1.
- Expected results attached to an action are exported as `ASSERTION_WITH_ELEMENT` steps right after it. Their element is usually the same element as the action.

## The action verb is NOT a field

`actionKind` is only `action` / `assertion` / `comment` / `subgroup`. Get the verb for a `RECORDED` step like this:

1. From the default `actionName` patterns:

   | actionName pattern | verb | value |
   |---|---|---|
   | `Click on "X"` | click | |
   | `Double-click on "X"` | dblclick | |
   | `Fill "X" with "v"` | fill | `actionValue` |
   | `Press Enter` | press | `actionValue` = key name (`Enter`, `Tab`, `Escape`, ...) |
   | `Select "opt" from "X"` | select | `opt` is the visible option label; `actionValue` can be the option `value` |
   | `Check "X"` / `Uncheck "X"` | check / uncheck | |
   | `Navigate to <url>` | navigate | |

   Any of these may end with ` in "<containerLabel>"`.

2. If the user renamed the step (`actionName` matches no pattern), infer from the element: `elementTag` `select` -> select; `input` with `type` checkbox/radio -> check (or uncheck, if the wording says so); `input`/`textarea`/`[contenteditable]` with `actionValue` -> fill; `actionValue` that is a key name and no other text -> press; otherwise click. Use the renamed `actionName` as the method name.

## Element fields (RECORDED)

Assertion steps have the same fields with the `assertElement` prefix (`assertElementTag`, `assertElementAttributes`, ...) and `assertSelectorContextText`.

| Field | Content |
|---|---|
| `actionValue` | Typed text, key, or selected option. On a **click** it is the navigation URL, not input: use it only to wait for the URL |
| `elementTag` | Lowercase tag name |
| `elementAttributes` | **All** DOM attributes of the element (`id`, `name`, `class`, `type`, `href`, `role`, `data-*`, `aria-*`, ...). Classes can be generated hashes (`css-1x2y3z`, `sc-abc`); do not use those |
| `elementAccessibleName` | Best name: accessible name, else label, else text, else parent context |
| `elementLabel` | Text of the associated `<label>` |
| `elementPlaceholder`, `elementAriaLabel`, `elementTitle` | Same-name attributes |
| `elementText`, `elementInnerText` | First line of the text, at most 200 characters |
| `selectorContextText` | Descriptive text found near the element (for example, the label next to an input) |
| `triggeredNavigationUrl` / `triggeredNavigationTitle` | Page the action opened |
| `triggeredRequests` | Up to 3 fetch/XHR calls to the app's own host or a sibling host, made after the action: `{url, status}`. `url` is a path, or `host/path` for a sibling host such as `api.example.com/orders`. There is **no HTTP method**: the browser API that records them does not expose it. Many are noise; see "Quirks" |
| `frameUrl` | The element is inside an iframe loaded from this URL |
| `containerTag` / `containerLabel` / `containerHtml` | The container the user picked for a repeated element (row, card, dialog). `containerHtml` is stripped HTML: no scripts, styles or SVG, attributes cut at 100 characters, at most 2000 characters |
| `componentTag` | Shared component (`header`, `nav`, ...) from the user's component recognition rules |

Assertion fields: `assertElementType` is one of `visible`, `hidden`, `enabled`, `disabled`, `checked`, `unchecked`, `text_equals`, `text_contains`. For text assertions the expected text is `actionValue`. `expectedResultsDescription` is the human description.

## Quirks in real recordings

A recording captures what the browser saw, including noise. Apply these rules before you write code.

### Pages

- **`pageName` is not a page type.** It comes from the last URL segment, so it is often data: a slug, a repo name, a product name. Several recorded pages can be one page type, and different types can share a `pageName`. Find the page type from the **URL template**: replace slugs, IDs and a locale prefix with parameters (`/creators/anthropics/skills` and `/es/creators/mattpocock/skills` are both `/:locale?/creators/:owner/:repo`). Use `pageTitle` to confirm. One page type = one page object.
- **`pageTag` can differ between visits of the same page type** (one visit tagged, the next not). Do not split a page object only because of `pageTag`. Use it the way the framework profile says.
- **Navigation can be filed one step late.** The navigation caused by step N can show up as `triggeredNavigationUrl` / `actionValue` of step N+1, and the step right after a navigation can be listed under the previous page. The order of pages is the truth: when the next step's page has a different `pageUrl`, the step before it caused that navigation. If an element clearly belongs to the next page (for example, a "Copy install prompt" button listed under the search page), put it there.
- **Steps of one page can be split by another page.** A page visited twice is listed once, so its `stepOrder` values can have gaps (13, 15, 16 on one page, 14 on another). Page objects are grouped by page. The test is ordered by `stepOrder`.
- **A `SUBGROUP` can cross pages** (it expands a section, then clicks "Home"). Put its method on the page where it starts. If methods return the next page object, it returns the page where it ends.

### Elements and locators

- **Never use these attributes in a locator:**
  - generated IDs: `radix-*`, `:r1:`, `mui-*`, `react-select-*`, `ember*`, `headlessui-*`, and any ID with a counter or hash;
  - attributes that point to generated IDs: `aria-controls`, `aria-labelledby`, `aria-activedescendant`, `aria-describedby`, `for`;
  - state attributes, which change while the page is used: `aria-expanded`, `aria-hidden`, `aria-selected`, `aria-checked`, `aria-pressed`, `data-state`, `open`, `tabindex`, and a `data-*` whose value is a state (`data-repository-readme="ready"`); test for the presence of such an attribute, never its value;
  - `value` on inputs: it is a snapshot from the moment of capture and can be partial (`"De"` while typing `"Design"`). The real input is `actionValue`;
  - `class` made of utility classes (Tailwind: `inline-flex min-h-11 ...`) or hashed classes. Use a class only when it is semantic and stable (`home-collection-card`).
- **Good attributes:** test IDs, `href`, `name`, `type`, `role`, `title`, `aria-label`, readable `id`s (`repository-install-prompt`), and stable `data-*` that are not states (`data-theme-toggle`, `data-slot="breadcrumb-link"`, `data-sponsor-example`).
- **Text:** use `elementInnerText` (visible text). `elementText` is raw `textContent`: it joins hidden text without spaces (`Expand full READMECollapse README`) and can even contain HTML from `<noscript>`.
- **Accessible name vs label:** `elementAccessibleName` follows `aria-labelledby` first, so it can differ from `elementAriaLabel` and from the quoted text in `actionName`. For role locators, use `elementAccessibleName`. If that does not match, try `elementAriaLabel`.
- **The element can be its own container.** When `containerTag` / `containerLabel` describe the element itself (same tag and the same label, or `containerHtml` starts with the element's own tag and `href`), do not scope it twice.
- **Wrapper clicks.** A click on a non-interactive tag (`div`, `span`, `p`, `li`, `section`) means the user hit padding or a wrapper. If the step caused something (navigation, a business request, the next step depends on it), the real target is the interactive child whose text is `elementInnerText`: a link or button inside it. If nothing followed (no navigation, no business request, the flow continues as before), treat it as a **suspicious step** (see below).
- **Localized UI.** After a language switch (a `select` with a locale value, or a URL that gains `/es/`), the same element has a translated name (`Switch to Light / Dark` -> `Cambiar a Claro / Oscuro`). Recognize it by its stable attributes (`data-theme-toggle`) and reuse one locator. Do not make a second method for the translated text.

### Actions

- **`Select` on an element that is not a `<select>`** is a pick from a custom combobox or autocomplete (`role="combobox"`, `aria-autocomplete`). Do it as: fill or open the combobox, then click the option, for example `getByRole('option', { name })`. `actionValue` is the option's whole text and can have line breaks (`"rea\n\nmorluto/rea"`). Use its first non-empty line as the option name, or the full text with whitespace normalized.
- **`Select` on a real `<select>`:** `actionValue` is the option `value` (`es`) and `actionName` has the visible label (`Español`). Prefer the value: it does not change with the UI language.
- **A renamed step can have a meaningless name.** `actionName` like `Click on custom Text`, `Assert: ASsert` or `Manual step` names nothing. When the quoted text matches no element field, or the description is a single word or clearly a placeholder, name the method from the element (`elementAccessibleName`, `elementInnerText`) and the assertion type instead: `assertReadmeVisible()`.
- **Clipboard, scroll, theme and other UI-only actions** are valid steps. Replay them as clicks. Do not add clipboard checks the recording does not have.

### Network

- **Filter `triggeredRequests` before you use them.** Ignore:
  - infrastructure and bot protection: `/cdn-cgi/*` (Cloudflare challenge, RUM), `/_vercel/*`, `/__nextjs*`;
  - analytics and telemetry: paths with `analytics`, `track`, `collect`, `rum`, `beacon`, `telemetry`, `sentry`, `log`;
  - side widgets unrelated to the step (ads, sponsorships, recommendations), when the step is not about them;
  - a request whose path equals a page URL (`/creators/anthropics/skills` with the navigation to it): that is the framework fetching the next page. Wait for the URL instead.
- What remains is a business call (`/api/catalog-search` after typing in search). Wait for it by URL (and status, if useful). There is no method, so match on the path. For a path with random segments, match on its stable prefix.
- An action with only noise requests has **no network wait**.

### Data

- `preconditions` like "Open any page" or "Go to the site" are already done by opening `startUrl`. Do not write a helper for them.
- Recorded `baseUrl` is the environment the user recorded on. It can be production. The test uses the project's configured base URL.

### Suspicious steps

A step is suspicious when it most likely did nothing or cannot be replayed as recorded: a wrapper click with no effect, a click on an element from a page the user did not reach, a meaningless manual step. Never delete it silently. Do what the framework profile says (keep with a warning comment, or skip with a TODO), and list every suspicious step in the final report with its `stepOrder` and the reason.

## Single-page export

An array. Each item: `stepOrder`, `pageName`, `stepType`, `actionKind`, `actionName`, `elementTag`, `elementAttributes`, `containerTag`, `containerLabel`, `containerHtml`. There is no value, text, label or accessible name: names come from `actionName` and the attributes. Use it to add elements and methods to **one** page object. Do not write a test from it.
