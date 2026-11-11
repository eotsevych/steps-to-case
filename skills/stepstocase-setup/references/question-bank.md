# Interview: question bank

Ask with your agent's structured question tool if it has one (for example `AskUserQuestion` in Claude Code). If not, ask in chat as numbered questions with lettered options, and wait for the answers. One round is at most 4 questions. Plan for at most 4 rounds. A usual interview is 2 to 3 rounds, about 8 to 10 questions.

If more questions qualify than fit in 4 rounds, keep this order: A, then B1, then the questions whose answer the scan cannot guess. Drop the questions whose Recommended option is backed by strong evidence. Use that option as the rule and show it in the summary at the end.

In this file, "preview" means a short code block shown with an option, and "multi-select" means the user may pick several options. "Other" is always allowed: the user can answer in their own words.

## Rules for every question

1. **Do not ask what the scan already answered.** A `confirmed` fact is not a question. Show it in the summary at the end of the interview, where the user can correct it.
2. **Ask only if the answer changes the generator.** If every answer gives the same rule, do not ask.
3. **Ask about policy, not about facts.** Good: "Where should assertions live?" Bad: "Do you use Playwright?"
4. **The detected option comes first** and is labelled `(Recommended)`. Put the evidence in its description: `"Used in 41 of 44 page objects"`.
5. **Show the user's own code.** For style questions (`preview` field), build each option's preview from the project's code: a real excerpt for the detected variant, and the same step rewritten in the other style. Never show generic code when real code exists.
6. **Use the sample recording.** Build options from real values in the JSON: its `pageName`s, `pageTag`s, `componentTag`s, `preconditions`, element attributes. A question about "the `Delete` button in the `Order #1042` row" is easier to answer than a question about "containers".
7. **Concrete options only.** The tool adds "Other" automatically. Never add a "Not sure" option; the Recommended option is the answer to "not sure".
8. **Questions must stand alone.** The user may see only the question dialog. Name the file, element or value inside the question text.
9. Record every answer in the profile as a rule, with "decided by the user" as its evidence.

## Round A: scope (always, first)

**A1. Test project** (only when the quick scan found more than one)
"This repo has N UI test projects. Which one should generated tests go to?"
Options: each project with its runner and file count, the most active one (most recent commits) first.

**A2. What to generate**
"When you give the generator a recording, what should it write?"
- *Page objects and a test* (Recommended when page objects exist): new or updated page/component classes, then one test that calls them.
- *Test only, reusing existing page objects*: if a needed method does not exist, stop and list what is missing.
- *Flat test with locators inline* (Recommended when no page objects exist).
- *Feature file and step definitions* (only when BDD was detected): reuse catalog steps, add new ones only for steps with no match.

**A3. Agents to install for** (multi-select)
"Which AI coding agents does your team use in this repo? The generator is installed for each one."
Options: the agents found in the quick scan (agent folders and instruction files) first, each marked `(Recommended)` with its evidence (".claude/ found"). Fill the remaining slots, up to 4, from: Claude Code, Cursor, GitHub Copilot, Codex. The user names any other agent under "Other".

**A4. Run and heal** (skip when no run command was found)
"Can the generator also run the new test and fix it until it passes? It would use `<detected run-one-test command>`."
- *Yes, generate, run and heal* (Recommended when tests can run locally against a test environment)
- *Generate and compile only*: no test runs, for example when tests need VPN or CI-only secrets.

## Round B: structure and style (ask only the mixed and unknown items)

**B1. Gold-standard example** (always ask; it is the strongest single signal)
"Which existing test should every generated test look like?"
Options: the up to 3 best tests that subagent C found, each with its reason ("uses fixtures, no sleeps, edited last week"). Preview: the first 20 to 25 lines of each.

**B2. Page object style** (only when `mixed`)
"Your page objects are written in two ways. Which one should new page objects use?"
Options: each variant, with a preview excerpt and its count.

**B3. Where assertions live** (only when `mixed` or `unknown`)
"The recording says: `<a real ASSERTION_WITH_ELEMENT actionName from the sample>`. Where should that check go?"
- *Assertion method in the page object*, for example `assertOrderCreatedVisible()`
- *`expect` in the test*, with the locator exposed by the page object
Preview: that real assertion written both ways.

**B4. Grouped steps (SUBGROUP)** (only when the sample has a `SUBGROUP`, or the team uses them)
"A recorded step `<real SUBGROUP name>` has <n> sub-steps. How should a group become code?"
- *One page object method* named after the group (Recommended for POM)
- *A step block in the test* (`test.step`, `allure.step`, `@Step`): sub-steps stay visible in the report
- *A flow/helper method* shared across pages (only if a flows/actions layer exists)

**B5. Page types** (only when two or more recorded pages share a URL template or a `pageName`)
"The recording visits N pages. By their URLs they look like M page types. Should the generator group them like this?"
Preview: the proposed grouping, one line per page type, with the matching existing page object when there is one:
```
/creators/:owner/:repo          <- pages 2, 5, 7 ("skills", "skills", "skills" /es/)  -> CreatorRepoPage (exists)
/creators/:owner/:repo/:skill   <- pages 1, 6                                        -> SkillPage (new)
/                               <- page 4                                            -> HomePage (exists)
```
- *Group by URL template* (Recommended)
- *One page object per recorded page*: only for apps whose URLs do not show the page type

**B6. Page tags** (only when the sample has `pageTag`)
"Pages <list> are tagged `<pageTag>`. What does that tag mean in your test code?"
- *A separate folder or namespace* (for example a redesign): `<detected folder>` (Recommended when such folders exist)
- *A different base class or layout*
- *Nothing: ignore it* (Recommended when no such split exists)

## Round C: locators and waits

**C1. Test-id attribute** (only when `mixed`, or when it differs from what the recording shows)
"Recorded elements have `<attr seen in the JSON>`; your tests use `<attr seen in code>`. Which attribute should locators prefer?"
Options: each attribute with its counts in code and in the recording.

**C2. Fallback when there is no test id** (only when no written policy exists and the code is `mixed`)
"The element `<a real element from the sample with no test id>` has no test id. Which locator should be the first choice?"
- *Role + accessible name*, for example `getByRole('button', { name: 'Save' })` (Recommended for Playwright and Testing Library)
- *CSS from `id` / `name` / stable `data-*`* (Recommended for Selenium)
- *Visible text*
Preview: the locator for that element in each style, written in the project's syntax.

**C3. Repeated elements in a container** (only when the sample has `containerHtml`, or the code is `mixed`)
"The recording clicks `<element>` inside `<containerLabel>`. How should the code find the right one?"
- *Find the container by its label or test id, then the element inside it* (Recommended)
- *A component class for the container* (row, card, dialog) with a method
- *Your existing helper* `<detected helper name>` (only when found)
Preview: the code for that real step.

**C4. Network waits** (only when the sample has `triggeredRequests`, or the code is `mixed`)
"The step `<real step>` calls `<METHOD path>`. What should the test wait for after it?"
- *That response* (`waitForResponse` / `cy.intercept` + `cy.wait`) (Recommended for Playwright and Cypress)
- *Only the UI result*: the next locator or assertion waits by itself (Recommended for Selenium)
- *Your wait helper* `<detected helper>` (only when found)
In the question text, list the requests you will ignore as noise (`/cdn-cgi/*`, analytics). The user can add more under "Other".

**C5. Autocomplete and custom dropdowns** (only when the sample has a `Select` step on an element that is not a `<select>`)
"The step `<real actionName>` picks an option from a custom dropdown on `<element>`. How should the code pick it?"
- *Your helper* `<detected combobox/autocomplete helper>` (Recommended when found)
- *Type, then click the option by its name*, for example `getByRole('option', { name })` (Recommended otherwise)
- *Type, then keyboard: ArrowDown and Enter*

**C6. Languages** (only when the sample switches language, or the project has i18n helpers)
"The recording switches the site to `<locale>` and then clicks `<translated element>`. Do your tests run in more than one language?"
- *Yes: never locate by visible text; use attributes or your translation helper* `<detected helper>`
- *No: text locators are fine; the language switch is just a step* (Recommended when no i18n helpers exist)

## Round D: data and preconditions (built from the sample recording)

**D1. Preconditions** (one question per precondition in the sample, at most 3 in a round; group similar ones)
"The recording requires: `<precondition text>`. How should the test make this true?"
Options: the matching helpers from subagent C, best match first, with signatures. Plus:
- *Leave a `// Precondition:` comment, do not automate it*
- *Create a new helper* (only when the user wants the generator to write helpers)

**D2. Passwords** (only when the sample has `••••••••`, or login is recorded)
"The recording masks a password on `<field>`. Where should the test take it from?"
Options: the secret sources found (env var name, config key, test-user fixture), then *An environment variable that I will name*.

**D3. Recorded input values** (only when the sample creates data: forms with names, e-mails, titles)
"The recording typed `<real value>` into `<field>`. What should the test type?"
- *A unique value from your data helper* `<faker/factory found>` (Recommended for fields that create records)
- *The recorded value, as is*
- *A value from your test data files*

**D4. Steps the recorder could not automate** (only when the sample has `MANUAL` or `ASSERTION_WITHOUT_ELEMENT`)
"`<real MANUAL actionName>` has no element. What should the generator write for such steps?"
- *A TODO comment, and the test continues* (Recommended)
- *Mark the test as not finished* (`test.fixme`, `@Disabled`, `pytest.mark.skip`) with the step text
- *Map it to an existing helper when one matches, otherwise a TODO*

**D5. Suspicious steps** (only when the sample has one; see "Suspicious steps" in recording-json.md)
"Step <n>, `<actionName>`, looks like it did nothing: <reason, e.g. a click on a wrapper <div> with no navigation or request after it>. What should the generator do with steps like this?"
- *Keep the step with a warning comment, and list it in the report* (Recommended)
- *Skip it with a TODO comment, and list it in the report*
- *Stop and ask me each time*

## Conditional questions (add to any round with space; only when detected)

- **Tags**: "Your tests carry tags like `<examples>`. Which tags should a generated test get?" (options from the tags found; multi-select)
- **Test-management ID**: "Tests link to `<TestRail/Xray/Jira>` with `<annotation>`. Where should the generator take the ID from?" (*Ask me for it each time* / *From the recording name, e.g. `C1234 Create order`* / *Leave it empty*)
- **Report steps**: "Your methods use `<@Step / allure.step>`. Add it to every new page object method?"
- **One test or a file per test**: only when files hold several tests and a "home" file per area is clear.
- **Single-page exports**: "You will also export single pages to build page objects. Should the generator accept those files too?"

## After the last round: confirm the profile

Print a short summary (at most 15 lines): the confirmed facts and the decisions, grouped as in the profile. Then go to step 4 of SKILL.md. Do not ask "Is this right?" as a separate question: the user corrects the summary with a message, and the validation in step 5 shows a real result.
