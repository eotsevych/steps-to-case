---
name: stepstocase-setup
description: Set up a /generate-autotest command that turns StepsToCase recording JSON into automated tests written the way this project writes them. Scans the test-automation framework (Playwright, Cypress, Selenium, WebdriverIO, Selenide, BDD, any language), asks the user only what the scan cannot settle, then writes the command as a skill and installs it for the team's AI coding agents. Takes no arguments. Use when the user wants to generate tests from StepsToCase recordings in their own framework, or says "set up StepsToCase" or "create a test generator".
license: AGPL-3.0
---

# StepsToCase: set up /generate-autotest for this project

You are building a **generator**, not a test. The output is the `generate-autotest` skill: give it any StepsToCase recording JSON and it writes a test that looks hand-written by this team. Success means: a recording becomes a compiling, convention-following test **on the first run** of the generator, with no follow-up prompts.

The setup describes the **framework**, never one recording. A recording shows only a few pages of the app, so do not ask for one and do not configure anything from one. Everything that depends on a recording (which pages group together, which sites are the app, tabs, frames, steps that cannot be automated) becomes a rule the generator applies each time it runs.

Run from the root of the user's **test-automation** repository. If the working directory looks like the StepsToCase extension itself (`manifest.json` + `src/injected/selectorGenerator.ts`), stop and ask for the test repo path.

Reference files (read each one when its step starts):
- [references/recording-json.md](references/recording-json.md): the JSON format, and the quirks the generator must handle.
- [references/scan-guide.md](references/scan-guide.md): what to scan, subagent briefs, the Framework Profile.
- [references/docs-lookup.md](references/docs-lookup.md): checking the APIs against the official documentation (Context7 or the docs sites).
- [references/question-bank.md](references/question-bank.md): the interview.
- [templates/generate-autotest.md](templates/generate-autotest.md): the output.

## Works in any agent

This skill uses three capabilities. Use the best one your agent has:

| Capability | If your agent has it | If not |
|---|---|---|
| Structured questions | A question tool with selectable options and previews (for example `AskUserQuestion` in Claude Code). | Ask in chat: numbered questions, lettered options, the recommended option first. Show previews as short code blocks under each option. Wait for the answer before the next round. |
| Subagents | Start the scan subagents in parallel. | Do the scans yourself, one brief after another. |
| Shell | Run the compile command, create symlinks. | Give the user the exact commands to run and wait for the output. |

Tell the user the plan in 4 lines before you start: an optional description in their own words, scan the framework, a few questions, write and install `/generate-autotest`. Do not name the language or framework yet: a folder name or a first impression is not evidence. Name them only in the scan summary.

## Step 0. The team's own words (optional)

Ask once, in plain chat (free text, not a question with options), then wait for the answer:

"Optional: describe your test framework in a few sentences, in your own words. For example: the patterns you use (page objects, Screenplay, fixtures, flows), where things live, the base classes and helpers that matter, and the rules a new test must follow. Or say `explore`, and I will find it all out from the code."

- `explore` (or no description): go straight to the scan. The scan runs the same way in both cases; a description only points it to the right places sooner.
- Use a description as **hints** for the scan: where to look first, what the names mean, which patterns to confirm. Not as facts: the scan checks every claim in the code.
- When the code confirms a claim, it is `confirmed` with the user's words as extra evidence. When the code contradicts it (the user says "we use fixtures", the tests use `new LoginPage(page)`), ask about it in the interview and show both.
- Rules the code cannot show ("never use XPath", "every test needs a Jira tag") become rules as they are, marked "from the team".
- Keep the answer word for word in `framework-profile.md` under `## In the team's words`.

## Step 1. Scan the framework

Read [references/recording-json.md](references/recording-json.md) first, so you know what the generator will have to map. Then follow [references/scan-guide.md](references/scan-guide.md):

1. Quick scan yourself (manifests, configs, tree, file counts, agent folders).
2. Deep scan: yourself for 30 files or fewer; otherwise start subagents A, B, C (and D for BDD) **in parallel**, with the briefs from the guide.
3. Check the documentation for the core libraries and versions the quick scan found: follow [references/docs-lookup.md](references/docs-lookup.md). Do it while the deep scan runs (a subagent can do it), not after.
4. Merge the results into the Framework Profile. Mark each fact `confirmed`, `mixed` or `unknown`, with evidence.

Give the user a 5-line summary of what you found before the questions.

## Step 2. Interview

Follow [references/question-bank.md](references/question-bank.md). Ask only the `mixed` and `unknown` items and the policy questions, with the detected option first and previews built from the project's own code. At most 4 rounds. Write each answer into the profile.

## Step 3. Write and install the generator

The generator uses the open Agent Skills format (a folder with `SKILL.md`, frontmatter `name` and `description` only), so every agent that supports skills can use the same files.

1. Fill [templates/generate-autotest.md](templates/generate-autotest.md) from the profile:
   - Every `{{...}}` becomes a real, project-specific rule: real paths, class names, method names, commands. Code examples are written in the project's language and style, copied or adapted from the exemplars.
   - Delete rows and sections that do not apply. Keep it short: rules, not essays.
   - Point to exemplar files by path. Do not paste long code or snapshot the list of existing page objects: the generator searches the repo when it runs, so it does not go stale.
2. Write it to the canonical folder `.agents/skills/generate-autotest/`:
   - `SKILL.md`: the filled template;
   - `references/recording-json.md`: copied as is;
   - `references/framework-profile.md`: the profile, with evidence and the user's decisions.
3. Check: search the new files for `{{` and `[YOUR:`. None may remain.
4. Install for each agent from I1 (or the agent running this setup). `.agents/skills/` already serves Codex, Cursor, GitHub Copilot, Gemini CLI, OpenCode, Amp, Cline, Warp, Zed, Kilo Code and Droid. For the others, link the generator folder into the agent's own skills folder:

   | Agent | Project folder |
   |---|---|
   | Claude Code | `.claude/skills/` |
   | Windsurf | `.windsurf/skills/` |
   | Roo Code | `.roo/skills/` |
   | Kiro | `.kiro/skills/` |
   | Junie | `.junie/skills/` |
   | Goose | `.goose/skills/` |
   | Continue | `.continue/skills/` |
   | Augment | `.augment/skills/` |
   | Trae | `.trae/skills/` |
   | Qwen Code | `.qwen/skills/` |
   | OpenHands | `.openhands/skills/` |

   - macOS / Linux: a relative symlink, for example `ln -s ../../.agents/skills/generate-autotest .claude/skills/generate-autotest`. One copy of the rules stays the truth.
   - Windows, or the team does not commit symlinks: copy the folder, and tell the user to copy again after editing the rules.
   - An agent not in either list: if Node.js 22.20+ is available, run `npx skills add ./.agents/skills -a <agent-id> -y` (the `skills` CLI knows each agent's folder). Otherwise ask the user where their agent reads skills from.
   - An agent with no skills support: add one line to `AGENTS.md` (create it if missing): "To generate a test from a StepsToCase recording, follow `.agents/skills/generate-autotest/SKILL.md`."

Do not change any existing test, page object or config.

## Step 4. Hand off

Report in at most 12 lines:
- the files created, and the agent folders they are linked into;
- how to use it: in Claude Code `/generate-autotest path/to/recording.json`, or `/generate-autotest` followed by the pasted JSON; in other agents, "use the generate-autotest skill on path/to/recording.json";
- the rules that came from defaults rather than evidence or answers, and the API rules marked `not verified`, so the team can check them;
- if Context7 was not available, one line: the user can set it up with `npx ctx7 setup` (it changes their agent configuration, so never run it yourself);
- the open items: any helper that is missing, any convention the team should still decide;
- how to change it later: edit `.agents/skills/generate-autotest/SKILL.md`, or run `/stepstocase-setup` again to re-scan;
- the first recordings are the real test: when a generated test is not what the team wants, fix the rule in the generator, not only the test.

Suggest committing `.agents/skills/` and the agent links so the whole team uses the same rules.
