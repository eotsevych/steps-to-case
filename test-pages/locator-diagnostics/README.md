# Manual use case: duplicate penalty versus positional fallback

Run from the repository root after installing the root dependencies:

```sh
node scripts/serve-locator-use-case.mjs
```

Open http://127.0.0.1:4174. The server bundles the current `src/injected/selectorGenerator.ts` in memory; the fixture uses its default settings. No extension change is needed. Stop the server with Ctrl+C. Set `LOCATOR_DEMO_PORT` if port 4174 is occupied.

## Case A: the penalty works, but position becomes the best remaining candidate

1. Leave the initial customer order: Ada, Ben, Cara. Every Edit button has `data-testid="edit"`; the rows have no unique attributes.
2. Click Edit beside Ben. The fixture calls the actual selector generator and displays its primary and alternatives.
3. Verify that the duplicate test-ID candidate has score **1001**. The algorithm has penalized it correctly.
4. Verify the selected primary: `#customers > div:nth-child(2) > button`, score **110**. It currently identifies Ben once.
5. Click Move Ben to top. The order becomes Ben, Ada, Cara. The exact same DOM nodes are moved, not replaced.
6. Click Check captured locator. It still matches one button, but that button belongs to **Ada**.

The existing non-unique penalty cannot reject this primary: it is unique both before and after the reorder. Its positional penalty is also already applied; it remains the best available candidate in this fixture.

The proposed optional diagnostic at capture time would say:

> The selected candidate uses row position. Choose the customer row as a container if row order can change.

The tester can then pick Ben's row as a container and name it. The recording gains row context for automation generation. This action does not automatically recompute or prove the final generated locator; generated code still needs validation.

## Case B: a useful candidate wins, so duplicate warnings add nothing

1. Click Reset, then Use stable attributes. Each Edit button receives its own test ID.
2. Click Edit beside Ben. Verify the primary is `[data-testid="edit-ben"]`, score **1**.
3. Click Move Ben to top, then Check captured locator.
4. It still identifies **Ben**. No positional warning is justified.

## Check the actual extension too

Optionally enable extension Settings → Development → Debug Mode, open the page's console and record the Edit click. Its selector log marks the primary with a star. The extension uses your saved settings, so it may choose differently from the fixture's defaults. The fixture's check button evaluates its own stored candidate, not the extension's state.

## Limits and product decision

This demonstrates the current capture algorithm. Exported JSON omits the ranked candidate set, and an automation generator may choose a better locator from attributes and container metadata. The fixture is not evidence that a generated test must use the positional candidate or will select Ada.

Diagnostics would explain an unresolved fallback to QA; they would not duplicate the ranking algorithm. If this information would not change how your testers review a recording or add containers, there is little reason to prioritize the UI for 1.0.3.

Both cases were verified in Chrome using the actual source module. No diagnostics feature was added to the extension.
