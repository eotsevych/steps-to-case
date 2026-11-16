import { describe, expect, it } from 'vitest';
import type { Action, RecordingState } from '../types';
import { buildExportRecording, exportToJson } from './exporter';
import { normalizeActions, normalizeImportedRecording } from './recordingImport';

function action(id: string, overrides: Partial<Action> = {}): Action {
  return {
    id,
    type: 'click',
    timestamp: 0,
    element: { tagName: 'button', textContent: id, accessibleName: id, innerText: id, attributes: {} },
    page: { url: '/', title: '', domain: 'app.test', pathname: '/' },
    selectors: { primary: { type: 'css', value: `#${id}`, score: 1 }, alternatives: [] },
    ...overrides,
  };
}

const noElement = { tagName: '', textContent: '', accessibleName: '', innerText: '', attributes: {} };

describe('normalizeActions', () => {
  it('keeps the iframe a step was recorded in', () => {
    const [kept] = normalizeActions([action('a', { page: { url: '/', title: '', domain: 'app.test', pathname: '/', frameUrl: 'https://pay.test/frame' } })]);
    expect(kept.page.frameUrl).toBe('https://pay.test/frame');
  });
});

describe('normalizeImportedRecording', () => {
  it('survives null entries and a malformed triggeredRequests', () => {
    const load = () => normalizeImportedRecording({
      pages: [{ actions: [{ expectedResults: [null], actionData: { triggeredRequests: 'oops' } }] }],
    });

    expect(load).not.toThrow();
    const [imported] = load().pages[0].actions;
    expect(imported.expectedResults).toEqual([]);
    expect(imported.actionData?.triggeredRequests).toEqual([]);
  });

  it('round-trips an export: step types, iframe, linked value, combined and subgroup structure', () => {
    const typed = action('t', { type: 'fill', element: { ...action('t').element, tagName: 'input', accessibleName: 'Title' }, actionData: { value: 'demo' } });
    const framed = action('f', { type: 'dblclick', customText: 'Open the order', page: { url: '/', title: '', domain: 'app.test', pathname: '/', frameUrl: 'https://pay.test/frame' } });
    const check = action('c', {
      type: 'assert',
      expectedResults: [{ description: 'Title shown', assertion: { type: 'text_equals', expectedValue: 'demo', expectedValueFrom: 't' } }],
    });
    const combined = action('d', {
      type: 'step',
      element: noElement,
      selectors: { primary: { type: 'css', value: '', score: 100 }, alternatives: [] },
      customText: 'Fill the form',
      subActions: [action('s1', { type: 'check' }), action('s2')],
    });
    const state: RecordingState = {
      phase: 'review',
      testMetadata: { name: 'T' },
      actions: [],
      pages: [{ id: 'p', name: 'Home', type: 'auto', pageContext: { url: '/', title: '' }, actions: [typed, framed, check, combined], order: 0 }],
      manualSteps: [{ id: 'ms', name: 'Open it', actionIds: ['f'], pageId: 'p', order: 0 }],
      preconditions: [],
      isElementPickerActive: false,
    };

    const imported = normalizeImportedRecording(JSON.parse(exportToJson(buildExportRecording(state))));
    const actions = imported.pages[0].actions;
    const byName = (text: string) => actions.find(a => a.customText === text)!;

    expect(byName('Open the order')).toMatchObject({ type: 'dblclick', page: { frameUrl: 'https://pay.test/frame' } });
    expect(actions.find(a => a.type === 'fill')?.actionData?.value).toBe('demo');
    const link = actions.find(a => a.type === 'assert')!.expectedResults![0].assertion!.expectedValueFrom;
    expect(link).toBe(actions.find(a => a.type === 'fill')!.id);
    expect(byName('Fill the form').subActions?.map(s => s.type)).toEqual(['check', 'click']);
    expect(imported.manualSteps.map(ms => [ms.name, ms.actionIds.length])).toEqual([['Open it', 1]]);
  });
});
