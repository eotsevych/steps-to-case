// Capture in the built extension: click Capture, click an element, the step appears named after the text next to
// the element, with no form. The name can be picked from the texts around the element or typed with the pencil.
// Run after `npm run build`: node scripts/probe-capture-flow.mjs  (needs Playwright from examples/roomdesk-playwright)
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { chromium } = createRequire(`${root}examples/roomdesk-playwright/package.json`)('playwright');

const html = '<main><div class="card"><p>Sent Messages</p><div class="info-value">214</div></div><div id="empty" style="width:80px;height:40px"></div></main>';
const server = createServer((_, res) => res.setHeader('content-type', 'text/html').end(html)).listen(0);
const ctx = await chromium.launchPersistentContext(mkdtempSync(`${tmpdir()}/stc-capture-`), {
  channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${root}dist`, `--load-extension=${root}dist`],
});

try {
  const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const site = await ctx.newPage();
  await site.goto(`http://localhost:${server.address().port}/`);
  const tabId = await sw.evaluate(async url => (await chrome.tabs.query({ url }))[0].id, site.url());

  const panel = await ctx.newPage();
  await panel.goto(`chrome-extension://${new URL(sw.url()).host}/sidepanel.html`);
  await panel.evaluate(id => chrome.runtime.sendMessage({ type: 'START_RECORDING', tabId: id }), tabId);
  const capture = panel.locator('[data-qa="capture-value-btn"]');
  const steps = panel.locator('[data-qa="action-description"]');
  const nameInput = panel.locator('[data-qa="action-edit-input"]');

  const pick = async selector => {
    await site.bringToFront();
    await site.click(selector);
    await panel.bringToFront();
  };

  // 1. Capture, pick: the step is there, named after the label above the value, and no edit form opens
  // (the row follows the worker's state, so wait for the name instead of reading it at once)
  const chip = name => panel.locator('[data-qa="description-picker-btn"]', { hasText: name });
  await capture.click();
  await pick('.info-value');
  await panel.getByText('Save var', { exact: true }).waitFor();
  await chip('Sent Messages').waitFor();
  assert.equal(await nameInput.count(), 0);
  assert.equal(await panel.locator('[data-qa="capture-value"]').innerText(), 'value: 214');
  if (process.env.SHOT) await panel.screenshot({ path: process.env.SHOT }); // to look at the row

  // 2. The pencil edits the name only; the text is selected, so typing replaces it
  await panel.locator('[data-qa="edit-action-btn"]').click();
  assert.equal(await nameInput.inputValue(), 'Sent Messages');
  assert.equal(await panel.evaluate(() => getSelection().toString()), 'Sent Messages');
  await panel.keyboard.type('Sent count');
  await panel.keyboard.press('Enter');
  await chip('Sent count').waitFor();

  // 2b. The chip offers the texts around the element; a picked one becomes the name
  await chip('Sent count').click();
  await panel.locator('[data-qa="description-picker-option"]', { hasText: 'Sent Messages' }).first().click();
  await chip('Sent Messages').waitFor();

  // 3. An element with no text: a notice, no step
  await capture.click();
  await pick('#empty');
  await panel.locator('[data-qa="notice"]').waitFor();
  assert.equal(await steps.count(), 1);

  // 4. Capture cancelled with Esc: the next pick, for an assertion, is not taken for a capture
  await capture.click();
  await panel.keyboard.press('Escape');
  await panel.getByRole('button', { name: 'Assertion', exact: true }).click();
  await panel.locator('[data-qa="pick-element-btn"]').click();
  await pick('.info-value');
  await panel.locator('[data-qa="picked-element-info"]').waitFor(); // the pick went to the assertion dialog
  assert.equal(await steps.count(), 1);

  console.log(JSON.stringify({ ok: true, steps: await steps.allInnerTexts() }));
} finally {
  await ctx.close();
  server.close();
}
