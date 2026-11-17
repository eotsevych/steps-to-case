import type { Action, StepPage } from '../types';
import { getElementName } from './stepName';
import { PASSWORD_MASK, displayFillValue } from './exporter';

// The value vault: text a step typed, picked or captured, offered to later
// assertions. It is derived from the steps, so deleting a step removes its value.

export interface VaultEntry {
  actionId: string;
  name: string;
  value: string;
}

/** Every step in run order, a composite step followed by its sub-actions. */
export function flattenActions(actions: Action[]): Action[] {
  return actions.flatMap(a => [a, ...flattenActions(a.subActions ?? [])]);
}

/** Top-level steps of all pages, in page order. */
export function pageActions(pages: StepPage[]): Action[] {
  return pages.slice().sort((a, b) => a.order - b.order).flatMap(p => p.actions);
}

function entryOf(action: Action): { name: string; value: string } | null {
  switch (action.type) {
    case 'capture':
      return { name: action.actionData?.captureName || 'Saved value', value: action.actionData?.value ?? '' };
    case 'fill': {
      const value = displayFillValue(action);
      if (value === PASSWORD_MASK) return null;
      return { name: action.selectors?.contextText || getElementName(action), value };
    }
    case 'select':
      return { name: getElementName(action), value: action.actionData?.selectedOption ?? '' };
    default:
      return null;
  }
}

/** Values of the steps before `untilId` (all steps when absent), each under a unique name. */
export function buildVault(actions: Action[], untilId?: string): VaultEntry[] {
  const entries: VaultEntry[] = [];
  const seen = new Map<string, number>();
  for (const action of flattenActions(actions)) {
    if (action.id === untilId) break;
    const entry = entryOf(action);
    if (!entry?.value) continue;
    const count = (seen.get(entry.name) ?? 0) + 1;
    seen.set(entry.name, count);
    entries.push({ actionId: action.id, name: count > 1 ? `${entry.name} ${count}` : entry.name, value: entry.value });
  }
  return entries;
}
