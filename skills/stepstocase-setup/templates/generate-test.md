---
name: stepstocase-generate-test
description: Generate an automated {{FRAMEWORK}} test (and its page objects) from a StepsToCase recording JSON, following this project's conventions. Use when the user gives a StepsToCase .json export or asks to turn a recorded test into code.
---

<!--
  TEMPLATE for the stepstocase-setup skill. Fill every {{...}} placeholder from the Framework Profile.
  Delete sections that do not apply (for example "Components" when the project has none).
  Keep it short and specific: real paths, real class names, real method names.
  Remove this comment.
-->

# Generate a {{FRAMEWORK}} test from a StepsToCase recording

Input: the path to the recording JSON that the user gives with the request. If there is no path, ask for it.
The JSON is the source of truth for what the test does. This project is the source of truth for how the code looks.
Field reference: [references/recording-json.md](references/recording-json.md). Project facts: [references/framework-profile.md](references/framework-profile.md).

## 0. Read first

1. The recording JSON. If it is an **array**, it is a single-page export: only update the page object for its `pageName` (step 2), and write no test.
2. The gold-standard examples. Match their style exactly:
   - Test: `{{GOLD_TEST_PATH}}`
   - Page object: `{{GOLD_PAGE_PATH}}`
   - Component: `{{GOLD_COMPONENT_PATH}}`
3. Before writing a class or method, search for an existing one that already does it (`{{SEARCH_HINT}}`). Reuse it. Never duplicate.

## 1. Where code lives

| What | Folder | File / class name |
|---|---|---|
| Tests | `{{TEST_DIR}}` | {{TEST_NAMING}} |
| Page objects | `{{PAGE_DIR}}` | {{PAGE_NAMING}} |
| Components | `{{COMPONENT_DIR}}` | {{COMPONENT_NAMING}} |

Registration: {{REGISTRATION}}

Mapping from the JSON:
- `pageName` -> page class name {{PAGE_NAME_RULE}}. Use `pageUrl` and `pageTitle` to find an existing page object for the same page before making a new one.
- `pageTag` -> {{PAGE_TAG_MAPPING}}
- `componentTag` -> {{COMPONENT_TAG_MAPPING}}

## 2. Page objects: one method per step

Work page by page. Element declaration style: {{ELEMENT_STYLE}}. Method style: {{METHOD_STYLE}}.

Get the verb of a `RECORDED` step from `actionName` (`Click on`, `Fill ... with`, `Press`, `Select ... from`, `Check`, `Uncheck`, `Double-click on`, `Navigate to`). `actionKind` is NOT the verb. If the step was renamed, infer the verb from the element (see "The action verb is NOT a field" in the reference).

| stepType | Code |
|---|---|
| `RECORDED` | One action method. Value from `actionValue`. |
| `ASSERTION_WITH_ELEMENT` | {{ASSERTION_PLACEMENT}} |
| `ASSERTION_WITHOUT_ELEMENT`, `MANUAL` | {{MANUAL_POLICY}} Never invent UI actions for them. |
| `MANUAL_WITHOUT_ELEMENT` (comment) | A one-line code comment above the sub-steps it labels. |
| `COMBINED` | One method that does all its sub-actions, named from `actionName`. |
| `SUBGROUP` | {{SUBGROUP_POLICY}} |

## 3. Locators

Build each locator from the element fields. There are no selectors in the JSON. Pick the first option that is unique on the page:

{{LOCATOR_ORDER}}

- Never use generated class names (`css-1x2y3z`, `sc-...`, `jsx-...`), long absolute CSS paths, or {{BANNED_LOCATORS}}.
- `containerLabel` / `containerHtml` present: {{CONTAINER_RULE}}
  Read `containerHtml` to find a stable attribute of the container and of the element inside it.
- `frameUrl` present: {{FRAME_RULE}}
- {{LOCATOR_STORAGE_RULE}}

Example in this project's syntax:

```{{LANG}}
{{LOCATOR_EXAMPLE}}
```

## 4. Naming

- Action methods: {{ACTION_NAMING}}
- Assertion methods: {{ASSERT_NAMING}}
- Name source, in order: `actionName` -> `elementAccessibleName` -> `elementLabel` -> `elementAriaLabel` -> `elementInnerText` (3 to 4 words) -> `elementPlaceholder`.
- Drop filler words (button, field, input, link) unless the name becomes ambiguous.

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

- `triggeredRequests` present: {{NETWORK_WAIT_RULE}}
- `triggeredNavigationUrl` present: {{NAVIGATION_WAIT_RULE}}
- Never: {{BANNED_WAITS}}

## 7. Data and preconditions

- Preconditions (`preconditions[]`):
{{PRECONDITION_MAP}}
  A precondition with no match: {{PRECONDITION_FALLBACK}} Never build preconditions from scratch through the UI.
- Masked password `••••••••`: {{PASSWORD_SOURCE}}
- Recorded input values: {{DATA_POLICY}}
- Start URL: {{START_URL_RULE}} (`baseUrl` in the JSON is only the environment it was recorded on).

## 8. The test

- {{TEST_STRUCTURE}}
- Tags / IDs: {{TAGS_RULE}}
- Sort **all** top-level steps by `stepOrder` across pages, then write one call per step. No raw locators in the test.

Skeleton:

```{{LANG}}
{{TEST_SKELETON}}
```

## 9. Check before finishing

1. Run `{{COMPILE_COMMAND}}`. Fix every error you caused.
2. Every top-level step is exactly one call, in `stepOrder`.
3. Existing classes and methods were reused; new ones are registered.
4. Locators are scoped by container and frame wherever the JSON has one.
5. No `••••••••`, no hard-coded secrets, no fixed sleeps.
6. Reply with: the files changed, and a table `stepOrder | actionName | code call`. The heal loop uses this table.
