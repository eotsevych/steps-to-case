---
name: generate-autotest
description: Generate an automated {{FRAMEWORK}} test (and its page objects) from a StepsToCase recording JSON, following this project's conventions. Use when the user runs /generate-autotest, gives or pastes a StepsToCase JSON export, or asks to turn a recorded test into code.
---

<!--
  TEMPLATE for the stepstocase-setup skill. Fill every {{...}} placeholder from the Framework Profile.
  Delete sections that do not apply (for example "Components" when the project has none).
  Keep it short and specific: real paths, real class names, real method names.
  Remove this comment.
-->

# Generate a {{FRAMEWORK}} test from a StepsToCase recording

Input: the recording JSON, as a file path or pasted into the message. If there is neither, ask for it. Pasted JSON is used as is: do not save it to a file unless the user asks. If pasted JSON does not parse (cut off by the chat, or a broken copy), say so and ask for the file path instead of guessing the missing part.
The JSON is the source of truth for what the test does. This project is the source of truth for how the code looks.
Field reference: [references/recording-json.md](references/recording-json.md). Project facts: [references/framework-profile.md](references/framework-profile.md).

## 0. Read first

1. The recording JSON. If it is an **array**, it is a single-page export: only update the page object for its `pageName` (step 2), and write no test.
2. `## In the team's words` in the profile: the team's own rules. Follow them.
3. The gold-standard examples. Match their style exactly:
   - Test: `{{GOLD_TEST_PATH}}`
   - Page object: `{{GOLD_PAGE_PATH}}`
   - Component: `{{GOLD_COMPONENT_PATH}}`
4. Before writing a class or method, search for an existing one that already does it (`{{SEARCH_HINT}}`). Reuse it. Never duplicate.
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
| Tests | `{{TEST_DIR}}` | {{TEST_NAMING}} |
| Page objects | `{{PAGE_DIR}}` | {{PAGE_NAMING}} |
| Components | `{{COMPONENT_DIR}}` | {{COMPONENT_NAMING}} |

Registration: {{REGISTRATION}}

Mapping from the JSON:
- Page type -> page class. The page type comes from the URL template (slugs, IDs and locale prefix as parameters) and `pageTitle`, not from `pageName`, which is often a slug. {{PAGE_NAME_RULE}} Look for an existing page object with the same route before making a new one ({{ROUTE_HINT}}).
- Folder and entry object for a page: {{AREA_RULE}}
- `componentTag` -> {{COMPONENT_TAG_MAPPING}}

## 2. Page objects: one method per step

Work page by page. Element declaration style: {{ELEMENT_STYLE}}. Method style: {{METHOD_STYLE}}.

- One step = one method. A composed step (`SUBGROUP`, `COMBINED`) is one method that runs its inner steps; the tester decided that size. Never merge or split steps.
- Values: {{VALUES_RULE}}
- Report steps: {{STEP_REPORT_RULE}}
- Flows: {{FLOW_RULE}}

Get the verb of a `RECORDED` step from `actionName` (`Click on`, `Fill ... with`, `Press`, `Select ... from`, `Check`, `Uncheck`, `Double-click on`, `Navigate to`). `actionKind` is NOT the verb. If the step was renamed, infer the verb from the element (see "The action verb is NOT a field" in the reference). `Select` on an element that is not a `<select>` is a combobox pick: {{COMBOBOX_RULE}}

| stepType | Code |
|---|---|
| `RECORDED` | One action method. Value from `actionValue`. |
| `ASSERTION_WITH_ELEMENT` | {{ASSERTION_PLACEMENT}} |
| `ASSERTION_WITHOUT_ELEMENT`, `MANUAL` | A method with an empty body and a `// TODO: <actionName>` comment. The test calls it and continues. Never invent UI actions for them. |
| `MANUAL_WITHOUT_ELEMENT` (comment) | A one-line code comment above the sub-steps it labels. |
| `COMBINED` | One method that does all its sub-actions, named from `actionName`. |
| `SUBGROUP` | One page object method named from `actionName`. Its body does the inner steps by the same rules. A group that ends on another page lives on the page where it starts. |

- Check / Uncheck: set the state with {{CHECK_API}}. Never use a click that toggles.
- A link that opens a new tab: {{TAB_RULE}}

## 3. Locators

Build each locator from the element fields. There are no selectors in the JSON. Pick the first option that is unique on the page:

{{LOCATOR_ORDER}}

- Never use generated IDs, state attributes (`aria-expanded`, `data-state`, ...), the `value` attribute, utility or hashed classes, long absolute CSS paths, or {{BANNED_LOCATORS}}. The full list is in "Quirks" in the reference.
- Text comes from `elementInnerText`, never `elementText`. Role names come from `elementAccessibleName`.
- {{LOCALE_RULE}}
- `containerLabel` / `containerHtml` present: {{CONTAINER_RULE}}
  Read `containerHtml` to find a stable attribute of the container and of the element inside it.
- `frameUrl` present: {{FRAME_RULE}} If `frameUrl` equals the page URL, or is missing for an element that is in an iframe, see "Frames" in the reference.
- {{LOCATOR_STORAGE_RULE}}

Example in this project's syntax:

```{{LANG}}
{{LOCATOR_EXAMPLE}}
```

## 4. Naming

- The method name is the step name the tester recorded (`actionName`), turned into an identifier in the repo's casing ({{CASING}}). Keep its words and its verb; drop only quotes, punctuation and the typed value:
  - `Click on "Sign in"` -> `clickOnSignIn`
  - `Fill "Email" with "a@b.c"` -> `fillEmail`
  - `Login as admin` (renamed by the tester) -> `loginAsAdmin`
  - `Assert: Welcome message shown` -> `assertWelcomeMessageShown`
- Only when `actionName` names nothing (a selector such as `#_R_2pt4b36_`, or a placeholder such as `Manual step`, see the reference), build the name from `elementAccessibleName` -> `elementLabel` -> `elementAriaLabel` -> `elementInnerText` (3 to 4 words).
- If the name is already taken by a method that does something else, add the element or container to it.

## 5. Assertions

| assertElementType | Code |
|---|---|
| `visible` | `{{ASSERT_VISIBLE}}` |
| `hidden` | `{{ASSERT_HIDDEN}}` |
| `enabled` / `disabled` | `{{ASSERT_ENABLED}}` / `{{ASSERT_DISABLED}}` |
| `checked` / `unchecked` | `{{ASSERT_CHECKED}}` / `{{ASSERT_UNCHECKED}}` |
| `text_equals` | `{{ASSERT_TEXT_EQUALS}}` with `actionValue` |
| `text_contains` | `{{ASSERT_TEXT_CONTAINS}}` with `actionValue` |

## 6. Waits

- `triggeredRequests`: first remove noise (`/cdn-cgi/*`, analytics and tracking, page fetches, {{NOISE_REQUESTS}}). If a business request remains: {{NETWORK_WAIT_RULE}} Match on the path; the JSON has no HTTP method.
- `triggeredNavigationUrl` present: {{NAVIGATION_WAIT_RULE}}
- Never: {{BANNED_WAITS}}

## 7. Data and preconditions

- Preconditions (`preconditions[]`): one `// Precondition: <text>` comment each, at the top of the test, before the first step. Do not automate them.
- Masked password `••••••••`: {{PASSWORD_SOURCE}}
- Recorded input values: {{DATA_POLICY}}
- Start URL: {{START_URL_RULE}} (`baseUrl` in the JSON is only the environment it was recorded on).

## 8. The test

- {{TEST_STRUCTURE}}
- Tags / IDs: {{TAGS_RULE}}
- Sort **all** top-level steps by `stepOrder` across pages, then write one call per step in that order. No raw locators in the test.
- Test name: from `testName`. If it is `Untitled Test`, name it from what the flow does.
- Generate every recorded step and only the recorded checks. No checks in the recording = no checks in the test.

Skeleton:

```{{LANG}}
{{TEST_SKELETON}}
```

## 9. Check before finishing

1. Run `{{COMPILE_COMMAND}}`. Fix every error you caused.
2. Every top-level step is covered by a call, in `stepOrder`, and no step is lost.
3. Existing classes and methods were reused; new ones are registered.
4. Locators are scoped by container and frame wherever the JSON has one.
5. No `••••••••`, no hard-coded secrets, no fixed sleeps.
6. Reply with: the files changed; a table `stepOrder | actionName | page object | code call`.
