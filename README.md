# StepsToCase

A Chrome extension (Manifest V3) that records a manual test in the browser and turns it into a readable test case and a structured JSON file for generating automated tests.

- **Documentation:** https://eotsevych.github.io/steps-to-case/
- **Privacy policy:** https://eotsevych.github.io/steps-to-case/privacy
- **Chrome Web Store:** pending review

All recorded data stays in the browser (`chrome.storage.local`). Nothing is sent to any server.

## Build from source

```bash
npm ci
npm run build        # production build into dist/
npm run dev          # watch mode
npm run typecheck    # tsc --noEmit
npm test             # unit tests (vitest)
```

Load it in Chrome: open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and select `dist/`.

## How it is built

Three entry points, built by Vite:

1. **Service worker** (`src/background/service-worker.ts`): holds the recording state and handles all messages from the panel and content scripts. Groups recorded actions into pages by URL.
2. **Content script** (`src/content/content-script.ts`): attaches DOM listeners while recording, collects element info, page context and selectors for each action, and tracks the network requests each action triggers. Also runs the element and container picker.
3. **Side panel** (`sidepanel.html` + `src/panel/`): the React UI. Phases: start screen → recording → review → export.

Key modules:

- `src/injected/selectorGenerator.ts`: generates and scores CSS selector candidates (lower score is better).
- `src/injected/metadataCollector.ts`: element info (tag, text, accessible name, label, attributes) and page context.
- `src/lib/exporter.ts`: builds the export JSON and the readable test case.
- `src/types/index.ts`: shared types and message definitions; the source of truth for the data model.

```
Content script ──ACTION_CAPTURED──► Service worker ──STATE_UPDATED──► Side panel
               ◄──START / STOP────                 ◄──panel commands──
```

`@/*` maps to `src/*` (in `tsconfig.json` and `vite.config.ts`).

## Documentation site

The wiki lives in `docs/` and is published with GitHub Pages.

## License

[GNU AGPL-3.0](LICENSE). You may use, change and share this code, but any version you distribute or run as a service must also be released under the AGPL with its source code.
