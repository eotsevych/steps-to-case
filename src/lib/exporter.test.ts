import { describe, expect, it } from 'vitest';
import type { Action, RecordingState, StepPage } from '../types';
import { buildExportRecording, exportToJson } from './exporter';
import { generateTestCase } from './testCaseGenerator';
import { normalizeImportedRecording } from './recordingImport';

function action(id: string, domain: string, overrides: Partial<Action> = {}): Action {
  return {
    id,
    type: 'click',
    timestamp: 0,
    element: { tagName: 'button', textContent: id, accessibleName: id, innerText: id, attributes: {} },
    page: { url: '/', title: '', domain, pathname: '/' },
    selectors: { primary: { type: 'css', value: `#${id}`, score: 1 }, alternatives: [] },
    ...overrides,
  };
}

function page(id: string, url: string, actions: Action[], order: number): StepPage {
  return { id, name: id, type: 'auto', pageContext: { url, title: '' }, actions, order };
}

function state(pages: StepPage[], manualSteps: RecordingState['manualSteps'] = []): RecordingState {
  return {
    phase: 'review',
    testMetadata: { name: 'T' },
    actions: [],
    pages,
    manualSteps,
    preconditions: [],
    isElementPickerActive: false,
  };
}

describe('buildExportRecording', () => {
  it('never exports a password, in the value or in the step name', () => {
    const fill = action('pw', 'app.test', {
      type: 'fill',
      element: { tagName: 'input', textContent: '', accessibleName: 'Password', innerText: '', attributes: { type: 'password' } },
      actionData: { value: 'hunter2' },
    });
    const recording = buildExportRecording(state([page('p', '/', [fill], 0)]));

    expect(exportToJson(recording)).not.toContain('hunter2');
    expect(generateTestCase(recording)).not.toContain('hunter2');
  });

  it('keeps same-path pages on different domains apart, but merges revisits of one page', () => {
    const recording = buildExportRecording(state([
      page('login', '/', [action('a', 'accounts.test')], 0),
      page('app', '/', [action('b', 'app.test')], 1),
      page('login-again', '/', [action('c', 'accounts.test')], 2),
    ]));

    expect(recording.pages.map(p => p.steps.length)).toEqual([2, 1]);
  });

  it('maps an action the same way at top level and inside a composite step', () => {
    const withResult = (id: string) => action(id, 'app.test', {
      expectedResults: [{ description: 'saved', assertion: { type: 'visible' } }],
    });
    const topLevel = buildExportRecording(state([page('p', '/', [withResult('a')], 0)]));
    const grouped = buildExportRecording(state(
      [page('p', '/', [withResult('a'), withResult('b')], 0)],
      [{ id: 'ms', name: 'Group', actionIds: ['a', 'b'], pageId: 'p', order: 0 }],
    ));

    expect(topLevel.pages[0].steps.map(s => s.stepType)).toEqual(['RECORDED', 'ASSERTION_WITH_ELEMENT']);
    const group = grouped.pages[0].steps[0];
    expect(group.stepType).toBe('SUBGROUP');
    expect('steps' in group && group.steps.map(s => s.stepType)).toEqual([
      'RECORDED', 'ASSERTION_WITH_ELEMENT', 'RECORDED', 'ASSERTION_WITH_ELEMENT',
    ]);
  });
});

describe('export → load JSON → export', () => {
  type Shape = [string, string, Shape[]?];
  const shape = (steps: Array<{ stepType: string; actionName: string; steps?: unknown[] }>): Shape[] =>
    steps.map(step => step.steps
      ? [step.stepType, step.actionName, shape(step.steps as typeof steps)]
      : [step.stepType, step.actionName]);

  it('keeps composite steps, the assertions inside them, labels and manual steps', () => {
    const assertion = action('c', 'app.test', {
      type: 'assert',
      expectedResults: [{ description: 'Welcome shown', assertion: { type: 'visible' } }],
    });
    const combined = action('d', 'app.test', {
      type: 'step',
      element: { tagName: '', textContent: '', accessibleName: '', innerText: '', attributes: {} },
      selectors: { primary: { type: 'css', value: '', score: 100 }, alternatives: [] },
      customText: 'Fill the form',
      subActions: [action('s1', 'app.test'), action('s2', 'app.test')],
      manualSubSteps: [{ id: 'l', name: 'Personal data', subActionIds: ['s1', 's2'], parentActionId: 'd', order: 0 }],
    });
    const manual = action('e', 'app.test', {
      type: 'step',
      element: { tagName: '', textContent: '', accessibleName: '', innerText: '', attributes: {} },
      selectors: { primary: { type: 'css', value: '', score: 100 }, alternatives: [] },
      customText: 'Click on Save when it turns green',
    });
    const original = buildExportRecording({
      ...state(
        [page('p', '/', [action('a', 'app.test'), action('b', 'app.test'), assertion, combined, manual], 0)],
        [{ id: 'ms', name: 'Sign in', actionIds: ['b', 'c'], pageId: 'p', order: 0 }],
      ),
      baseUrl: 'https://app.test',
    });

    const imported = normalizeImportedRecording(JSON.parse(exportToJson(original)));
    const again = buildExportRecording({ ...state(imported.pages, imported.manualSteps), baseUrl: imported.baseUrl });

    expect(shape(again.pages[0].steps)).toEqual(shape(original.pages[0].steps));
    expect(shape(original.pages[0].steps).map(s => s[0])).toEqual(['RECORDED', 'SUBGROUP', 'COMBINED', 'MANUAL']);
    expect(again.baseUrl).toBe('https://app.test');
  });
});
