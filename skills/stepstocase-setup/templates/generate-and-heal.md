---
name: stepstocase-generate-and-heal
description: Generate a {{FRAMEWORK}} test from a StepsToCase recording JSON, run it, and fix it until it passes, without changing what it checks. Use when the user wants a recording turned into a passing test.
---

<!-- TEMPLATE for the stepstocase-setup skill. Fill every {{...}} placeholder. Remove this comment. -->

# Generate, run and heal

1. Follow the `stepstocase-generate-test` skill (`.agents/skills/stepstocase-generate-test/SKILL.md`) for the recording JSON the user gives. Keep its step table.
2. Run only the new test: `{{RUN_ONE_COMMAND}}`. If it passes, stop and report.
3. If it fails, read the error, trace and screenshot ({{ARTIFACTS_LOCATION}}). Find the step in the step table. Apply the smallest fix. Go back to step 2. At most 5 attempts.

The recording was made during a run that passed. So a failure on the same build and environment is almost always a capture or conversion problem, not a product bug.

Allowed fixes:
- Locators: rebuild from `elementAttributes`, accessible name, label and `containerHtml`.
- Waits: prefer the `triggeredRequests` response, or the next UI state.
- Frames: go through the frame from `frameUrl`. If `frameUrl` is missing or equals the page URL, inspect the live page, find the iframe that holds the element, and locate it by `id`, `name` or `title`.
- Tabs: switch to the tab the step really runs in. Close a menu or popup left open by an earlier step (Escape) when it covers the next element.
- Steps the recorder does not capture: hover, scroll into view, close a cookie banner or overlay, wait for an animation to end.
- Test data that must be unique.
- A step filed under the wrong page (navigation recorded one step late): move the call to the page object where the element really is.
- A wrapper click: click the interactive child with the same text instead.
- A wait on a noise request: remove it, and wait for the UI result or the business request.

Never:
- change an expected value, or remove, skip or weaken an assertion;
- delete a recorded step;
- add force clicks, raise global timeouts, add fixed sleeps, or wrap steps in try/catch;
- {{EXTRA_BANNED}}

Stop and report (do not "fix") when:
- the same failure repeats after a fix;
- the only way to pass is to change an assertion;
- the app behaves differently from the recording (a missing element, different text, a different page);
- the browser is blocked by bot protection (a Cloudflare challenge, a captcha, "verify you are human"). That is an environment problem: report it, and suggest running against a test environment or an allowlisted runner.

These are signs of a real product change or bug.

Report: pass or fail, the number of attempts, each fix with its reason, and for a stop: the step, the error, and why it looks like a product change.
