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
| `actionValue` | Typed text, key, selected option, or navigation URL |
| `elementTag` | Lowercase tag name |
| `elementAttributes` | **All** DOM attributes of the element (`id`, `name`, `class`, `type`, `href`, `role`, `data-*`, `aria-*`, ...). Classes can be generated hashes (`css-1x2y3z`, `sc-abc`); do not use those |
| `elementAccessibleName` | Best name: accessible name, else label, else text, else parent context |
| `elementLabel` | Text of the associated `<label>` |
| `elementPlaceholder`, `elementAriaLabel`, `elementTitle` | Same-name attributes |
| `elementText`, `elementInnerText` | First line of the text, at most 200 characters |
| `selectorContextText` | Descriptive text found near the element (for example, the label next to an input) |
| `triggeredNavigationUrl` / `triggeredNavigationTitle` | Page the action opened |
| `triggeredRequests` | Up to 3 API calls (fetch/XHR) to the app's own backend: `{url, method, status}`. `url` is a path, or `host/path` for a sibling host such as `api.example.com/orders` |
| `frameUrl` | The element is inside an iframe loaded from this URL |
| `containerTag` / `containerLabel` / `containerHtml` | The container the user picked for a repeated element (row, card, dialog). `containerHtml` is stripped HTML: no scripts, styles or SVG, attributes cut at 100 characters, at most 2000 characters |
| `componentTag` | Shared component (`header`, `nav`, ...) from the user's component recognition rules |

Assertion fields: `assertElementType` is one of `visible`, `hidden`, `enabled`, `disabled`, `checked`, `unchecked`, `text_equals`, `text_contains`. For text assertions the expected text is `actionValue`. `expectedResultsDescription` is the human description.

## Single-page export

An array. Each item: `stepOrder`, `pageName`, `stepType`, `actionKind`, `actionName`, `elementTag`, `elementAttributes`, `containerTag`, `containerLabel`, `containerHtml`. There is no value, text, label or accessible name: names come from `actionName` and the attributes. Use it to add elements and methods to **one** page object. Do not write a test from it.
