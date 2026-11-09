---
title: StepsToCase Privacy Policy
---

# StepsToCase — Privacy Policy

_Last updated: July 9, 2026_

StepsToCase is a Chrome extension that records your manual QA session in the
browser and turns it into a structured, exportable test case. It is designed
so that **your data never leaves your browser**.

## What the extension captures

When — and only when — you explicitly start a recording, StepsToCase captures,
on the pages you interact with:

- Your interactions: clicks, typed text, select changes, and key presses.
- Metadata about the elements you interact with: tag, attributes, generated
  CSS selectors, and visible text.
- Page context: the URL and title of the tab being recorded.
- Network requests triggered by your interactions (URLs and methods), used to
  annotate steps.

Nothing is captured while a recording is not active.

## Where the data is stored

All recorded data is stored **locally in your browser** using Chrome's
`chrome.storage.local`. It exists only on your device.

## What is transmitted

**Nothing.** StepsToCase has no server, makes no network requests of its own,
and never transmits recordings, analytics, telemetry, or any other data to the
developer or to any third party. Exported test cases (text, JSON, or AI
prompt) are generated locally and only leave your browser if you copy or
download them yourself.

## Data sharing and selling

StepsToCase does not share, sell, or transfer user data to anyone. Data is not
used for any purpose unrelated to the extension's single purpose (creating
test cases from recorded steps), and is not used for creditworthiness or
lending purposes.

## How to delete your data

- Use **Reset** in the extension's side panel to discard the current
  recording, or
- Uninstall the extension — Chrome removes all of its locally stored data.

## Permissions

The extension requests the minimum permissions needed to record the tab you
choose (`activeTab`, `tabs`, `scripting`, host access), show its UI in the
side panel (`sidePanel`), and keep your in-progress recording across restarts
(`storage`). None of these are used to collect or transmit data.

## Changes to this policy

If this policy changes, the updated version will be published at the same URL
with a new "Last updated" date.

## Contact

Questions about this policy: **evgeniy.otsevich@gmail.com**
