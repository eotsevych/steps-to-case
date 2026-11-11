# Checking the framework's documentation

The generator must write API calls that exist in the **version this repo uses**: `getByRole` options differ between Playwright for JS, Java and Python; Selenium 3 and 4 differ; Serenity has its own Screenplay API. Memory is not enough. After the quick scan finds the core libraries and their versions, check the APIs the generator will use against the official documentation.

## What to look up

Only what the generator writes. For each core library (UI driver, test runner, assertion library, BDD or reporting library), in the version from the lock file, `pom.xml`, `build.gradle`, `requirements*.txt` or `*.csproj`:

1. Locators: by test id (and how to configure the test-id attribute), by role and accessible name, by label, placeholder, text.
2. Locators inside a container (chaining, filtering by text), and inside an iframe.
3. A link that opens a new tab or popup, and switching between tabs.
4. Check, uncheck, select option, double-click, press key.
5. The 8 assertions: visible, hidden, enabled, disabled, checked, unchecked, text equals, text contains.
6. Waiting for a network response after an action.
7. Report steps (`@Step`, `test.step`, `allure.step`, Serenity steps or Screenplay tasks), if the repo uses them.

## How to look it up (use the first one that works)

1. **Context7 tools** (an MCP server, if your agent has it): call `resolve-library-id` with the library name (for example `playwright java`, `serenity bdd`, `selenium`), pick the result that matches the language and version, then call `query-docs` with that library ID and one question per topic, for example "check a checkbox and assert it is checked".
2. **Context7 CLI** (needs Node.js 22.13+ and network; no install, no API key needed):
   ```bash
   npx -y ctx7 library "playwright" "java locators getByRole" --json   # find the library ID
   npx -y ctx7 docs <libraryId from the first command> "assert a checkbox is checked"
   ```
   Use the ID the first command returns; do not guess IDs. A versioned ID looks like `/org/repo/v1.2.3`.
3. **Official documentation pages** (your agent's web fetch tool). Open the page for the topic, not the home page:

   | Library | Documentation |
   |---|---|
   | Playwright (JS/TS) | https://playwright.dev/docs/intro |
   | Playwright for Java | https://playwright.dev/java/docs/intro |
   | Playwright for Python | https://playwright.dev/python/docs/intro |
   | Playwright for .NET | https://playwright.dev/dotnet/docs/intro |
   | Selenium | https://www.selenium.dev/documentation/ |
   | Selenide | https://selenide.org/documentation.html |
   | Serenity BDD (Java) | https://serenity-bdd.github.io/docs/ |
   | Serenity/JS | https://serenity-js.org/handbook/ |
   | Cypress | https://docs.cypress.io/ |
   | WebdriverIO | https://webdriver.io/docs/gettingstarted |
   | Cucumber | https://cucumber.io/docs/ |

   Any other library: the documentation link in its package metadata (`homepage` in `package.json`, `url` in the POM) or its README.
4. **None works** (no network, no tools): continue from the repo's own code and your knowledge. Mark each API rule in the profile as `not verified`, and list them in the hand-off.

## Privacy

Send only library names, versions and generic questions ("assert a checkbox is checked"). Never send the project's code, class names, URLs or any data from the repo or from recordings.

## Using the results

- **The repo wins on style, the docs win on API.** Copy how the team writes code (wrappers, naming, structure). Use the docs to check that every call the generator will write exists in this version and is written correctly.
- If the repo uses a deprecated API (for example `waitForNavigation`, `driver.findElementBy*`), keep the team's style but tell the user in the hand-off.
- Write the verified calls into the generator: the assertion table, the locator order, the tab, frame and network-wait rules, the check/select calls. For each rule, keep the source (Context7 library ID or documentation URL) in `framework-profile.md` under `## Documentation`.
- Give the generator the same lookup for later: copy the library IDs and documentation URLs into `framework-profile.md`, with one line in the generator: "When you are unsure about an API, check it with the documentation sources in the profile before you write it."
