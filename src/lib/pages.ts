import type { Action, StepPage } from '../types';
import { pageKey } from './exporter';
import { pageNameFromUrl } from './pageUrl';
import { generateId } from './recordingImport';

/** Group consecutive actions on the same page (domain + URL) into pages. */
function autoCreatePagesByUrl(actions: Action[]): StepPage[] {
  const pages: StepPage[] = [];
  let currentKey = '';

  for (const action of actions) {
    const url = action.page.url || 'unknown';
    // Include the domain so same-path pages on different sites don't merge.
    const key = `${action.page.domain || ''}|${url}`;
    if (key !== currentKey || pages.length === 0) {
      pages.push({
        id: generateId(),
        name: pageNameFromUrl(url),
        type: 'auto',
        pageContext: { url, title: action.page.title || '' },
        pageTag: action.page.pageTag,
        actions: [],
        order: pages.length,
      });
      currentKey = key;
    }
    pages[pages.length - 1].actions.push({ ...action });
  }

  return pages;
}

/**
 * Pages after a stop. The first stop groups all actions by URL. After "Back to
 * recording" the organized pages are kept as they are (names, order, moved
 * steps) and only the steps recorded since then are grouped and appended.
 */
export function pagesAfterStop(pages: StepPage[], actions: Action[]): StepPage[] {
  const known = new Set(pages.flatMap(p => p.actions.map(a => a.id)));
  const fresh = autoCreatePagesByUrl(actions.filter(a => !known.has(a.id)));
  const kept = [...pages].sort((a, b) => a.order - b.order);
  const last = kept[kept.length - 1];
  // New steps on the same page as the last organized page continue that page
  if (last && fresh[0] && pageKey(last) === pageKey(fresh[0])) {
    last.actions.push(...fresh.shift()!.actions);
  }
  return [...kept, ...fresh].map((page, order) => ({ ...page, order }));
}

