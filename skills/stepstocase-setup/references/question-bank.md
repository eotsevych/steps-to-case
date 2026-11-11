# Interview: question bank

The interview is about **how this framework is built**: its structure, page objects, test bodies, patterns and flows. The goal: the user recognises their own code in what `/generate-autotest` will write.

Ask with your agent's structured question tool if it has one (for example `AskUserQuestion` in Claude Code). If not, ask in chat as numbered questions with lettered options, and wait for the answers. One round is at most 4 questions. Plan for 3 to 4 rounds. Round 1 is always asked; every other question has a condition, so a consistent repo gets few of them.

In this file, "preview" means a short code block shown with an option, and "multi-select" means the user may pick several options. "Other" is always allowed: the user can answer in their own words.

## Rules for every question

1. **Show, then ask.** Structure questions show a preview: the code `/generate-autotest` would write, built from the patterns the scan found, in the project's own syntax, class names and folders. The user confirms the shape or picks another variant found in the repo.
2. **The scan decides what exists; the user decides only what is ambiguous.** Never ask whether the project uses page objects, fixtures or BDD: the scan knows. Follow the pattern the repo uses. Ask only where the repo has two patterns, where no example exists, or where the preview is the only way to confirm the scan read the code right.
3. **The detected variant comes first** and is labelled `(Recommended)`, with its evidence in the description: `"Used in 41 of 44 page objects"`.
4. **Never ask about running tests, environments or URLs.** The generator writes code and compiles it. Nothing else.
5. **Ask about the framework, not about one recording.** Each answer becomes a rule for every recording.
6. **Concrete options only.** The tool adds "Other" automatically. Never add a "Not sure" option.
7. **Questions must stand alone.** Name the files, classes and helpers inside the question text.
8. Record every answer in the profile as a rule, with "decided by the user" as its evidence.
9. **Use the team's description** (step 0 of SKILL.md). Do not ask what it already says and the code confirms. Ask about every point where it and the code disagree, showing both.

## Round 1: structure (always)

**S1. Gold-standard test**
"Which existing test should every generated test look like?"
Options: the up to 3 best tests that subagent C found, each with its reason ("uses fixtures and test.step, no sleeps, edited last week"). Preview: the first 20 to 25 lines of each.

**S2. Page object shape**
"This is how /generate-autotest will write a new page object, following `<exemplar path>`. Is this the shape you want?"
Preview: a short page object for an imaginary "Orders" page, in the project's exact style: imports, base class, constructor, how elements are declared (fields, getters, locator map, `@FindBy`), one action method, one assertion method if the project puts them there, and what methods return (`this`, the next page, nothing).
- *Yes, like this* (Recommended)
- *Like `<other variant path>`* (only when the repo has a second style; preview it the same way)

**S3. Test body shape**
"This is how a generated test will look, following `<gold-standard path>`. Is this the shape you want?"
Preview: a short test in the project's exact style: imports, how page objects are obtained (fixture, `new`, App registry, DI), setup and hooks, preconditions, test steps (plain calls, `test.step`, `@Step`), where assertions are, tags and annotations.
- *Yes, like this* (Recommended)
- *Like `<other variant path>`* (only when the repo has a second style)

## Round 2: core conventions (ask each only when the repo has two styles or no example; otherwise it is a rule)

**N1. Page naming**
"How should a recorded page get its page object name? For the pages `/orders/123` (title 'Order #123 | Shop'), `/` and `/settings/profile`:"
- *From the page name in the recording*: `OrderPage`, `HomePage`, `ProfilePage`
- *From the URL path, IDs removed*: `OrdersPage`, `HomePage`, `SettingsProfilePage`
- *From the page title*: `OrderPage`, `ShopPage`, `ProfilePage`
Build the examples with the repo's real suffix and casing. Mark as Recommended the option that matches how existing page objects relate to their URLs.

**N2. Areas and entry points** (only when the repo has several entry objects, registries or app classes, such as `app`, `adminApp`, `mailApp`, or page folders per area)
"Your tests reach pages through `<entry objects found>`, and pages live in `<area folders>`. How should a new page choose its folder and entry object?"
- *By the `pageTag` of the recording*: the user gives the mapping `<tag> -> <folder> + <entry object>`
- *By URL path*: the user gives the mapping `<path prefix> -> <folder> + <entry object>`
- *By domain*, for apps on several hosts
Preview: two pages placed by the chosen rule, and the test lines that reach them.

**N3. Where locators live**
"Where should a page object keep its locators?"
- *Every locator as a field* (or getter / `@FindBy`, in the repo's syntax)
- *By use*: a field if used in 2+ methods, a local variable if used twice in one method, inline if used once
- *In a separate locator map or file*: `<detected file>` (only if the repo has one)
Preview: the same small page object written each way. Put the counts found in the descriptions.

## Round 3: values, report steps and the test

**N4. Values**
"Where do recorded values come from, such as the typed e-mail or the expected text 'Order created'?"
- *Parameters, passed from the test*: `fillEmail(String email)`, `assertMessageHasText(String expected)`
- *Inside the page object*: `fillEmail()` types the recorded value
- *Test data constants or files*: `<detected test data location>`, passed from the test
Preview: one fill and one text check, in each style.

**N5. Report steps** (only when the repo uses `@Step`, `test.step`, `allure.step`, Serenity steps or a similar wrapper)
"Your methods use `<detected annotation>`. How should a generated method be described in the report?"
Preview, per option, two methods with their step text, for example `@Step("Fill username with {0}")` and `@Step("Assert welcome message is visible")`:
- *The repo's existing wording*, with parameter placeholders as the repo writes them (Recommended)
- *The recorded `actionName`*, for example `@Step("Fill \"Username\" with {0}")`
- *No step text on new methods*

**N6. How a test starts**
"How should a generated test reach the first recorded page?"
- *The repo's open helper with the start URL*: `<detected helper, e.g. open(startUrl)>`
- *Direct navigation*: `page.goto(...)`, `driver.get(...)`, `cy.visit(...)`
- *Start from the home page and navigate through the UI as recorded*
Preview: the first lines of a test for each.

**N7. Test file and name**
"Where should a generated test go, and how is it named? For a recording named 'Create order with discount':"
- *A new file per recording*: `<CreateOrderWithDiscountTest / create-order-with-discount.spec.ts>` with `<shouldCreateOrderWithDiscount / 'create order with discount'>`
- *Added to the existing spec of that feature area*, for example `<detected spec file>`
Build the names with the repo's real patterns.

## Round 4: patterns and flows (ask only what the scan left ambiguous)

**P1. Flows** (only when the repo has a layer between tests and page objects: flows, steps, actions, tasks, helpers that call several pages)
"Your repo has `<flows layer path>` (for example `<real flow method>`). When a recording goes through several pages for one business goal, where should that code go?"
- *A flow method in `<flows layer>`, called from the test* (Recommended when tests mostly call flows)
- *Page object calls directly in the test*
Preview: both, in the project's syntax.

**P2. Shared components** (only when the repo has component classes, or `mixed`)
"Parts shared by many pages (header, menu, modal, table row) are modelled as `<detected pattern, e.g. components/HeaderComponent attached to BasePage>`. Should new shared parts follow it?"
Preview: a small component and how a page exposes it.
- *Yes, a component class like `<exemplar>`* (Recommended)
- *Methods on each page object*

**P3. Registration** (only when `mixed`, or a new page must be wired in several places)
"A new page object has to be wired in: `<files found, e.g. fixtures/pages.ts and App.ts>`. Should /generate-autotest update them every time it adds a page?"
Preview: the lines it would add.

**P4. Locator policy** (only when `mixed`)
"Your locators prefer different attributes: `<variant A>` (N uses) and `<variant B>` (M uses). Which should generated locators prefer, and what comes next when an element has none?"
Preview: one element located both ways. Where locators are declared is N3, not this question.

**P5. Where assertions live** (only when `mixed`)
"Some checks live in page objects (`<example assert method>`) and some in tests (`<example expect>`). Where should generated checks go?"
Preview: one check both ways.

**P6. Network waits** (only when the code is `mixed` or `unknown`)
"When a recorded step calls the backend (for example a click that calls `/api/cart`), what should the code wait for?"
- *That response* (`waitForResponse` / `cy.intercept` + `cy.wait`) (Recommended for Playwright and Cypress)
- *Only the UI result*: the next locator or assertion waits by itself (Recommended for Selenium)
- *Your wait helper* `<detected helper>`
In the question text, list the requests the generator ignores as noise (`/cdn-cgi/*`, analytics, tracking).

**P7. Repeated elements** (only when the code is `mixed`, or a row/card helper or component exists)
"A recording can click a button inside one table row or card, picked by its label. How should the code find the right one?"
- *Find the container by its label or test id, then the element inside it* (Recommended)
- *A component class for the container* (row, card, dialog) with a method
- *Your existing helper* `<detected helper name>`
Preview: the code for one such step, in the project's syntax.

## Fixed rules (never ask)

- Preconditions: always a `// Precondition: <text>` comment at the top of the test.
- One step = one method. Every recorded, manual or assertion step is one page object method, and the test makes one call per step. A composed step (`SUBGROUP`, `COMBINED`) is one method too: composing is how the tester decides method size. Never merge or split steps.
- Method names follow the step name the tester recorded (`actionName`), turned into an identifier in the repo's casing. Never rename steps into other verbs.
- Steps without an element (`MANUAL`, `ASSERTION_WITHOUT_ELEMENT`): a method with an empty body and a `// TODO: <actionName>` comment; the test calls it and continues.
- Every recorded step is generated, even one that looks pointless. The user curates the recording.
- Only recorded checks are generated. A recording without checks gives a test without checks.

## Gaps (only when the scan found no existing pattern; add to any round with space)

Ask each only when the repo has no example to follow. Otherwise the generator copies what the repo does.

**G3. Passwords and test data** (only when the scan found no secret source or no data helpers)
"Recordings mask passwords as `••••••••`, and contain the values the tester typed. Where should tests take passwords and test data from?"
Options: the sources found (env var names, config keys, fixtures, factories), then *An environment variable that I will name*.

## Install target (ask only when it is not clear)

**I1. Agents** (multi-select; skip when only the agent running this setup is detected: install for it and say so)
"Which AI coding agents does your team use in this repo? /generate-autotest is installed for each one."
Options: the agents detected (agent folders, instruction files), then Claude Code, Cursor, GitHub Copilot, Codex.

## Test project (ask first, only when there is more than one)

**T1.** "This repo has N UI test projects. Which one should generated tests go to?" Options: each project with its runner and file count.

## After the last round: confirm the profile

Print a short summary (at most 15 lines): the structure the generator will follow (folders, page object shape, test body shape, flows, components), the decisions, and the rules that came from framework defaults. Then go to step 3 of SKILL.md. The user corrects the summary with a message if needed.
