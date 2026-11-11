# StepsToCase test generator: guide and FAQ

Turn [StepsToCase](https://chromewebstore.google.com/detail/stepstocase/eekhjmlfbikagoennaldhdbliogklfec) recordings into automated tests that look like your team wrote them.

You get two commands:

| Command | When | What it does |
|---|---|---|
| `/stepstocase-setup` | Once per test repository | Studies your framework, asks a few questions, and writes the `/generate-autotest` command for your project |
| `/generate-autotest <recording.json>` | For every recording | Writes the page objects and the test for that recording, in your project's style |

## Before you start

- **A test-automation repository** in any language and framework: Playwright (JS/TS, Java, Python, .NET), Cypress, Selenium, Selenide, Serenity BDD, WebdriverIO, Cucumber, and others.
- **An AI coding agent that supports [Agent Skills](https://agentskills.io)**: Claude Code, Cursor, GitHub Copilot, Codex, Gemini CLI, OpenCode, Windsurf, and others.
- **Node.js 22.20 or later** to use the installer. Without Node.js, use the manual install (step 2).
- **The StepsToCase extension** in Chrome, to record tests.

## Step by step

### 1. Open your test repository

Open a terminal in the root of your test-automation repository. Work on a new branch, so you can review everything before you merge:

```bash
git checkout -b add-test-generator
```

### 2. Install the setup skill

```bash
npx skills add eotsevych/steps-to-case --skill stepstocase-setup
```

The installer asks which agents to install for. Pick the ones your team uses. Keep the default **project** scope, so the skill is installed in this repository and not for all your projects.

You do not clone anything yourself. The installer copies only the `skills/stepstocase-setup` folder (about 100 KB) into your agents' skills folders. Nothing else from this repository ends up in your project.

**Manual install** (no Node.js): download only the [`skills/stepstocase-setup`](https://github.com/eotsevych/steps-to-case/tree/main/skills/stepstocase-setup) folder with git, and copy it into your repository:

```bash
# Downloads only the skill folder (about 0.5 MB), not the whole repository
git clone --depth 1 --filter=blob:none --sparse https://github.com/eotsevych/steps-to-case.git /tmp/steps-to-case
git -C /tmp/steps-to-case sparse-checkout set skills/stepstocase-setup

mkdir -p .claude/skills                                   # Claude Code
cp -R /tmp/steps-to-case/skills/stepstocase-setup .claude/skills/
# Cursor, Copilot, Codex, Gemini CLI, OpenCode: use .agents/skills/ instead of .claude/skills/
rm -rf /tmp/steps-to-case
```

### 3. Start a new agent session

Agents load skills when a session starts. Close the agent and open it again in the repository root (for example, run `claude`).

### 4. Run the setup

- Claude Code: `/stepstocase-setup`
- Other agents: "use the stepstocase-setup skill"

It takes no arguments. It does this:

1. **Asks you to describe your framework in a few sentences** (optional). For example: "Page objects in `src/pages`, registered in the `App` class. Tests get pages through fixtures. Never use XPath." Or type `explore`, and it finds everything out from the code.
2. **Scans the repository**: language, test runner, page objects, base classes, fixtures, locator style, waits and helpers. Large repositories are scanned by several agents in parallel. Then it shows a short summary. Check that it is right.
3. **Checks the documentation** for your library versions (Context7 or the official documentation site), so the generated code uses APIs that exist in your version.
4. **Asks a few questions** (usually 2 to 4 rounds). Most questions show a preview of the code it will write, in your own style. Pick an option, or type your own answer. Questions come only where your repository has two styles or no example to follow.
5. **Writes the generator** to `.agents/skills/generate-autotest/` and links it for each of your agents.

It does not change your tests, page objects or configuration.

### 5. Review and commit the generator

Open `.agents/skills/generate-autotest/SKILL.md`. It is plain text: the rules for writing tests in your project. Fix anything that is wrong, then commit it, so the whole team uses the same rules:

```bash
git add .agents/skills .claude/skills
git commit -m "Add StepsToCase test generator"
```

### 6. Record a test

In Chrome, record the flow with StepsToCase. The generator turns what you record into code, so these habits give better tests:

- **Name your steps.** Each step becomes a method named after the step. Rename `Click on "Submit"` to `Submit the order` and you get `submitTheOrder()`.
- **Compose steps for bigger methods.** One step is one method. A composite step is one method too, so compose the steps that belong together (for example, "Sign in").
- **Add assertions.** The generator writes only the checks you recorded.
- **Add preconditions** ("User is logged in"). They become comments at the top of the test.
- **Keep the recording clean.** Every recorded step is generated. Delete steps you do not want, and stay inside the app you test.
- **Use containers** for repeated elements (a button in one table row), so the locator finds the right one.

Then export: **Export → JSON → Download**.

### 7. Generate the test

Start a new agent session (only needed the first time after the setup), then:

- Claude Code: `/generate-autotest path/to/recording.json`
- Other agents: "use the generate-autotest skill on path/to/recording.json"

The agent first shows how it read the recording (pages, tabs, which page object gets which step). Then it adds methods to existing page objects or creates new ones, writes the test, and compiles it. At the end it lists the files it changed and a table: step → page object → method call.

### 8. Review and run

Review the diff like any pull request, then run the test with your usual command. The generator never runs tests.

If a generated test is not what your team wants, **fix the rule in `.agents/skills/generate-autotest/SKILL.md`**, not only the test. The next recording then comes out right.

## FAQ

**Do I give the setup a recording?**
No. The setup learns from your code, not from a recording. A recording shows only a few pages of your app, so it would configure the generator wrongly.

**Which agents can run it?**
Any agent that supports Agent Skills. The setup also works without special tools: if your agent cannot ask multiple-choice questions or start subagents, it asks in chat and scans step by step.

**Which languages and frameworks?**
Any. The setup copies the patterns it finds in your repository: page objects, Screenplay, fixtures, flows, BDD with step definitions, or plain tests.

**Does it run my tests?**
No. The generator writes code and compiles it (for example `tsc --noEmit` or `mvn test-compile`). You run the tests.

**What does the generator change in my repository?**
It adds methods to existing page objects, creates new page objects (and registers them, if your project needs that), and adds one test per recording. It reuses existing methods instead of writing duplicates.

**How are method names chosen?**
From the step names in your recording. To change a method name, rename the step in the extension before you export. Only when a step name says nothing useful (for example a CSS selector) does the generator use the element's name.

**How do I get bigger methods, like `signIn(email, password)`?**
Compose the steps into one composite step in the extension. One step, or one composite step, always becomes one method.

**What happens to preconditions, manual steps and steps without an element?**
Preconditions become `// Precondition: <text>` comments at the top of the test. Manual steps and assertions without an element become empty methods with a `// TODO`, and the test continues.

**Does it add checks I did not record?**
No. Only recorded steps and recorded checks are generated.

**Does my code leave my machine?**
Your AI agent works under its own data policy, as for any other coding task. The documentation check sends only library names, versions and generic questions (for example "assert a checkbox is checked") to Context7 or the documentation sites, never your code. The StepsToCase extension keeps recordings in your browser.

**What is Context7, and do I need it?**
[Context7](https://context7.com) serves up-to-date library documentation to AI agents. It is optional. Without it, the setup reads the official documentation sites. To set it up for your agent, run `npx ctx7 setup`.

**The agent says "Unknown command: /stepstocase-setup".**
- Start a new agent session: skills load at startup.
- Check that `.claude/skills/stepstocase-setup/SKILL.md` (or `.agents/skills/...`) exists in the repository root.
- If the folder is a symlink, check that it points to a path your user can read. A link into another user's home folder does not work. Copy the folder instead.
- In Claude Code, `/skills` lists the skills it found.

**I use Windows.**
Copy folders instead of creating symlinks. The setup does this for you when symlinks are not an option.

**How do I change the rules later?**
Edit `.agents/skills/generate-autotest/SKILL.md` and commit it. After big changes to your framework, run `/stepstocase-setup` again: it scans again and rewrites the generator.

**How do I update or remove the setup skill?**
Update: `npx skills update stepstocase-setup`. Remove: `npx skills remove -s stepstocase-setup`. The generated `/generate-autotest` stays in your repository until you delete `.agents/skills/generate-autotest/`.

**My repository has several test projects (a monorepo).**
The setup lists them and asks which one generated tests go to. Run it again for another project.

**Do I need the newest version of the extension?**
No. The generator reads exports from StepsToCase 1.0.x. The next version, 1.1.0, adds more context to the export (page domain, query string, tab, iframe id and name), so the generator guesses less.
