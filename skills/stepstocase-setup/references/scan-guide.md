# Scanning a test-automation framework

The goal of the scan is a **Framework Profile**: facts about the project, each with evidence (`path:line`, or a count) and a confidence level. Every fact you find here is one question you do not have to ask the user.

Confidence:

- **confirmed**: one convention, used in 3 or more places, with no competing one.
- **mixed**: two or more competing conventions (for example, both `getByTestId` and `page.locator('[data-qa=...]')`). Ask the user and show both.
- **unknown**: not found. Ask the user, or use the recommended default for the framework.

## 1. Quick scan (do it yourself, in the main session)

Read only manifest and config files, and the directory tree. Do not open test files yet.

### 1.1 Language, runner and UI driver

| Look in | Signals |
|---|---|
| `package.json` (all of them in a monorepo) | `@playwright/test`, `playwright`, `cypress`, `webdriverio`/`@wdio/*`, `selenium-webdriver`, `testcafe`, `nightwatch`, `codeceptjs`, `puppeteer`, `@cucumber/cucumber`, `playwright-bdd`, `@badeball/cypress-cucumber-preprocessor`, `allure-*`, `@faker-js/faker`, `typescript` |
| `pom.xml`, `build.gradle(.kts)` | `com.microsoft.playwright`, `selenium-java`, `selenide`, `junit-jupiter`, `testng`, `cucumber-java`, `serenity-*`, `allure-*`, `rest-assured`, `assertj`, `hamcrest`, `lombok`, `datafaker`/`javafaker` |
| `requirements*.txt`, `pyproject.toml`, `Pipfile`, `setup.cfg` | `pytest-playwright`, `playwright`, `selenium`, `pytest`, `behave`, `pytest-bdd`, `robotframework*`, `allure-pytest`, `faker` |
| `*.csproj`, `Directory.Packages.props` | `Microsoft.Playwright*`, `Selenium.WebDriver`, `NUnit`, `xunit`, `MSTest`, `Reqnroll`/`SpecFlow`, `Allure.*` |
| `Gemfile`, `go.mod`, `*.robot` | `capybara`, `watir`, `rspec`, `cucumber`; `playwright-go`, `chromedp`; Robot Framework |

### 1.2 Config and layout

- Runner config: `playwright.config.*`, `cypress.config.*`, `wdio.conf.*`, `testng*.xml`, `junit-platform.properties`, `conftest.py`, `pytest.ini`, `.runsettings`, `cucumber.*`, `behave.ini`.
  From it, read: test directory, `baseURL`, projects/browsers, test-id attribute (`testIdAttribute` in Playwright), reporters, global setup, `storageState`.
- Directory tree (2 to 3 levels; skip `node_modules`, `target`, `build`, `dist`, `.venv`, `bin`, `obj`). Note folders such as `pages`, `page-objects`, `po`, `screens`, `components`, `fragments`, `widgets`, `fixtures`, `support`, `helpers`, `steps`, `step-definitions`, `features`, `flows`, `actions`, `data`, `factories`, `api`.
- Count test files by suffix (`*.spec.*`, `*.test.*`, `*.cy.*`, `*Test.java`, `*Tests.cs`, `test_*.py`, `*.feature`), page object files, and helper files.

### 1.3 AI agents the team uses

List the agent folders and instruction files at the repo root: `.agents/`, `.claude/`, `CLAUDE.md`, `.cursor/`, `.cursorrules`, `.github/copilot-instructions.md`, `.github/prompts/`, `AGENTS.md`, `.windsurf/`, `.roo/`, `.kiro/`, `.junie/`, `.goose/`, `.continue/`, `GEMINI.md`. These become the recommended options for question A3. Also note the agent you are running in.

### 1.4 Several candidates

If you find more than one test project (a monorepo with UI and API tests, a legacy Selenium suite next to a new Playwright suite), list each with its runner and file count. The user picks one in the interview (question A1). Scan only the chosen project in the deep scan.

### 1.5 No UI test framework found

Tell the user. Offer two paths: stop, or define a new framework from scratch with the interview (use the framework defaults from section 4 and mark every rule as "new convention"). Do not invent a framework silently.

## 2. Deep scan

**Size check.** Count the files in the chosen project's test, page object, component, fixture and helper folders.

- **30 files or fewer:** do the deep scan yourself. Use the three briefs below as a checklist.
- **More than 30 files:** if your agent can start subagents, start the three below **in parallel** (read-only search agents, for example `Explore` in Claude Code). Give each one the project root, the quick-scan results, and its brief. Continue with nothing else until all three report. If your agent has no subagents, work through the briefs yourself, one after another, and keep only the report from each.
- **BDD project** (feature files found): also start subagent D.

Every brief ends with the same report contract:

> Report in Markdown. For every finding give: the finding, its evidence (`path:line`, or "N files" with 2 example paths), and `confirmed` / `mixed` / `unknown`. For `mixed`, give one short excerpt (at most 15 lines) of each competing variant with its path. End with "Exemplars": the best 1 to 3 files for your area, with one line on why. Do not suggest changes. Do not write files.

### Subagent A: architecture and code structure

Find:
1. The pattern: Page Object Model, page object + component objects, Screenplay, App Actions, fixtures only, or flat tests with inline locators.
2. Page object base class, and what it provides (navigation `open()`, waits, element helpers).
3. How a page object is made and reached from a test: `new LoginPage(page)`, a fixture (`test.extend`), an App/registry class (`app.loginPage()`), dependency injection, `PageFactory.initElements`, Selenide `page(...)`, Cypress custom commands.
4. Components: how shared parts (header, modal, table row) are modelled and attached to pages.
5. Where elements are declared: class fields, getters, constructor, `@FindBy`, a locator map file, inline in methods.
6. Method style: does an action return `this` / the next page (fluent), or `void`/`Promise<void>`? Are there reporting annotations (`@Step`, `allure.step`, `test.step`)?
7. Folder and file naming for pages, components, tests; class and method naming (casing, prefixes like `click`/`fill`/`assert`/`verify`/`should`).
8. Registration: files that must change when a page is added (App class, fixture file, index/barrel `export`).

### Subagent B: locators, interactions, waits, assertions

Find:
1. Locator API style, with counts of each: `getByTestId`, `getByRole`, `getByLabel`, `getByText`, `locator(css)`, `By.id`, `By.cssSelector`, `By.xpath`, `@FindBy`, `cy.get('[data-cy=..]')`, `$('...')`.
2. The test-id attribute(s) in locators, with counts: `data-testid`, `data-test-id`, `data-test`, `data-qa`, `data-cy`, `data-e2e`, `id`, custom. Also `testIdAttribute` in config.
3. XPath and `nth`/index usage: allowed, or a last resort? Any written locator policy (`README`, `CONTRIBUTING`, lint rules)?
4. Scoping inside a container: chained locators, `filter({ hasText })`, `within()`, a row/card helper, a table component.
5. iframes: `frameLocator`, `contentFrame`, `switchTo().frame`, `cy.iframe`, a helper.
6. Interaction wrappers: custom `click`/`fill`/`type` helpers or element wrapper classes that must be used instead of the raw API.
7. Waits: `waitForResponse`, `route`, `cy.intercept` + `cy.wait('@alias')`, `WebDriverWait`/`ExpectedConditions`, custom wait helpers, fixed sleeps (count them; note if they are banned).
8. Assertion library and style: `expect(locator).toBeVisible()`, `assertThat`, AssertJ, Hamcrest, `should`, soft assertions. Where assertions live: in page objects (`assertX`/`verifyX` methods) or in tests.

### Subagent C: test anatomy, data, preconditions, running

Find:
1. Test file skeleton: imports, `describe`/class, hooks (`beforeEach`, `@BeforeMethod`, fixtures), one test vs many per file.
2. Tags and metadata: `@tag`, `{ tag: ... }`, `@Tag`, `groups`, `@pytest.mark`, test-management IDs (TestRail, Xray, Jira, Allure `@TmsLink`), owner/severity annotations.
3. Preconditions: login helpers (UI login, API login, `storageState`, cookies), user/role selection, data seeding over API or DB, cleanup. List each helper with its signature and path.
4. Test data: hard-coded literals, data files (JSON/YAML/CSV), builders/factories, faker, unique suffixes (timestamps, UUIDs).
5. Secrets and environments: how passwords and users are read (env vars, `.env`, config files, vault helpers), how `baseUrl` per environment is chosen.
6. How to run **one** test file or one test from the command line, and how to type-check/compile without running (`npx tsc --noEmit`, `mvn -q test-compile`, `dotnet build`, `python -m py_compile`). Read `package.json` scripts, CI files (`.github/workflows`, `.gitlab-ci.yml`, `Jenkinsfile`) and README.
7. The 3 best-written recent tests (use `git log` dates if available): follow the conventions, use page objects, no sleeps. Give a reason for each.

### Subagent D (BDD only): step catalog

Find:
1. Feature file layout and language, tags, Background usage, Scenario Outline usage.
2. All step definition files. Build a catalog: step pattern -> file:line -> what it does (one line). Group by page/area.
3. Parameter types and data tables in use.
4. How step definitions reach page objects (World object, DI container, fixtures).

## 3. Merge into the Framework Profile

Write the profile with these sections. Each line is a fact with its evidence and confidence.

```markdown
# Framework Profile
## Stack           language, runner, driver, assertion lib, BDD, reporter
## Layout          folders and file naming for tests, pages, components, fixtures, data
## Architecture    pattern, base classes, how pages are made and reached, registration files
## Locators        API style, test-id attribute, fallback order, scoping, frames, wrappers
## Waits           network waits, UI waits, banned patterns
## Assertions      library, style, where they live
## Tests           skeleton, hooks, tags, test-management IDs
## Preconditions   helper -> signature -> path
## Data & secrets  data style, password source, env/baseUrl handling
## Commands        compile/type-check command, run-one-test command
## Exemplars       gold-standard test, page object, component (paths)
## Open questions  every mixed/unknown item, as a question for the interview
```

Then compare it with the sample recording (if you have one):

- Which attributes do the recorded elements really have? If the app uses `data-qa` but the tests use `data-testid`, that is a question.
- Which `pageName` / `pageTag` values appear? Is there a page object for each already?
- Which `componentTag` values appear? Is there a component class for each?
- Which `preconditions` appear? Is there a helper for each?
- Are there containers, frames, masked passwords, triggered requests, `MANUAL` steps, `SUBGROUP`s? Ask only about those that appear, or that the team will clearly meet.
- Apply "Quirks in real recordings" from recording-json.md and note what this sample has: page types by URL template (and whether a page object with that route exists: search route constants, `goto`/`open` paths and `url` fields), noise requests, custom-combobox selects, a language switch, wrapper clicks, meaningless names, steps filed under the wrong page. Each one drives a question (B5, B6, C4 to C6, D5) or a rule.

## 4. Framework defaults (use when the profile says unknown and the user picks the default)

| Framework | Locator order | Container scoping | Network wait | Assertions |
|---|---|---|---|---|
| Playwright (any language) | test id -> `getByRole(role, { name })` -> `getByLabel` -> `getByPlaceholder` -> `getByText` -> CSS from `id`/`name`/stable `data-*` | `container.locator(...)` or `locator.filter({ hasText })` | `waitForResponse` started before the action | web-first `expect(locator)` |
| Cypress | `[data-cy]`/test id -> `cy.contains(tag, text)` -> CSS from `id`/`name` | `cy.get(container).within(...)` | `cy.intercept` + alias + `cy.wait('@alias')` | `should(...)` |
| Selenium / WebDriver (Java, C#, Python, JS) | `By.cssSelector` with test id -> `By.id` -> `By.name` -> CSS from stable `data-*` -> XPath on text as a last resort | find the container element, then `findElement` inside it | explicit wait for the resulting UI state (no network access by default) | the project's assertion lib (AssertJ, NUnit, pytest `assert`) |
| WebdriverIO | `$('[data-testid=...]')` -> `$('aria/Name')` -> CSS | `$(container).$(...)` | `waitUntil` on UI state, or mocks if used | `expect-webdriverio` |
| Selenide | `$(byTestId)`/`$("[data-testid=...]")` -> `$(byText)` | `$(container).$(...)` | condition waits (`shouldBe(visible)`) | `should*` conditions |
