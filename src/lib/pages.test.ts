import { describe, expect, it } from 'vitest';
import type { Action, StepPage } from '../types';
import { pagesAfterStop } from './pages';
import { normalizeRecordedPageUrl, pageNameFromUrl } from './pageUrl';

function action(id: string, url: string): Action {
  return {
    id,
    type: 'click',
    timestamp: 0,
    element: { tagName: 'button', textContent: id, accessibleName: id, innerText: id, attributes: {} },
    page: { url, title: '', domain: 'app.test', pathname: url },
    selectors: { primary: { type: 'css', value: `#${id}`, score: 1 }, alternatives: [] },
  };
}

describe('pagesAfterStop', () => {
  it('groups a first recording by page', () => {
    const pages = pagesAfterStop([], [action('a', '/login'), action('b', '/login'), action('c', '/home')]);
    expect(pages.map(p => [p.name, p.actions.map(a => a.id)])).toEqual([
      ['login', ['a', 'b']],
      ['home', ['c']],
    ]);
  });

  it('keeps organized pages after "Back to recording" and only adds the new steps', () => {
    const organized: StepPage[] = [
      { id: 'p2', name: 'Dashboard', type: 'manual', pageContext: { url: '/home', title: '' }, actions: [action('c', '/home'), action('a', '/login')], order: 0 },
      { id: 'p1', name: 'Sign in', type: 'auto', pageContext: { url: '/login', title: '' }, actions: [action('b', '/login')], order: 1 },
    ];
    const actions = [action('c', '/home'), action('a', '/login'), action('b', '/login'), action('d', '/login'), action('e', '/cart')];

    const pages = pagesAfterStop(organized, actions);

    expect(pages.map(p => [p.id, p.name, p.actions.map(a => a.id)])).toEqual([
      ['p2', 'Dashboard', ['c', 'a']],
      ['p1', 'Sign in', ['b', 'd']], // the new step on the same page continues it
      [expect.any(String), 'cart', ['e']],
    ]);
  });
});

describe('page URLs', () => {
  it('keeps hash routes and drops plain anchors and queries', () => {
    expect(normalizeRecordedPageUrl('https://x.test/app/#/users?id=1')).toBe('/app/#/users');
    expect(normalizeRecordedPageUrl('https://x.test/#!/settings')).toBe('/#!/settings');
    expect(normalizeRecordedPageUrl('https://x.test/docs?page=2#intro')).toBe('/docs');
  });

  it('names pages after the last segment that is not a record ID', () => {
    expect(pageNameFromUrl('/orders/123')).toBe('orders');
    expect(pageNameFromUrl('/users/3f2a9c1e-1b2c-4d5e-8f90-a1b2c3d4e5f6/edit')).toBe('edit');
    expect(pageNameFromUrl('/#/settings')).toBe('settings');
    expect(pageNameFromUrl('/')).toBe('Home');
  });
});
