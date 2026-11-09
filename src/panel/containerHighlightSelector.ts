import type { Action, SelectorOption } from '../types';

const DATA_ATTRS = ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa'];
const ATTRS = ['name', 'aria-label', 'placeholder', 'title', 'alt', 'href', 'value'];
const CSS_SELECTOR_TYPES = new Set<SelectorOption['type']>([
  'testid',
  'css',
  'id',
  'name',
  'aria',
  'href',
  'alt',
  'title',
  'data-attr',
  'sibling',
  'parent-scoped',
]);

function escapeCssIdentifier(value: string): string {
  const css = typeof globalThis.CSS !== 'undefined'
    ? globalThis.CSS as { escape?: (value: string) => string }
    : undefined;

  if (typeof css?.escape === 'function') {
    return css.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`);
}

function escapeCssString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\A ')
    .replace(/\r/g, '\\D ')
    .replace(/\f/g, '\\C ');
}

function getTagName(action: Action): string {
  const tagName = action.element?.tagName?.toLowerCase();
  return tagName && /^[a-z][a-z0-9-]*$/.test(tagName) ? tagName : '*';
}

function getAttr(action: Action, name: string): string {
  return action.element?.attributes?.[name]?.trim() ?? '';
}

function attrSelector(tagName: string, name: string, value: string): string {
  if (!value || !/^[a-zA-Z_][\w:-]*$/.test(name)) return '';
  return `${tagName}[${name}="${escapeCssString(value)}"]`;
}

function firstCssSelectorCandidate(action: Action): string {
  const candidates = [action.selectors?.primary, ...(action.selectors?.alternatives ?? [])];
  return candidates.find(candidate => (
    candidate &&
    CSS_SELECTOR_TYPES.has(candidate.type) &&
    candidate.value.trim()
  ))?.value.trim() ?? '';
}

export function getAllContainerHighlightSelectors(action: Action): string[] {
  const list: string[] = [];
  const add = (sel: string) => {
    const trimmed = sel.trim();
    if (trimmed && !list.includes(trimmed)) list.push(trimmed);
  };

  const id = getAttr(action, 'id');
  if (id) add(`#${escapeCssIdentifier(id)}`);

  const primary = firstCssSelectorCandidate(action);
  if (primary) add(primary);

  const tagName = getTagName(action);
  for (const attr of DATA_ATTRS) {
    const sel = attrSelector(tagName, attr, getAttr(action, attr));
    if (sel) add(sel);
  }

  for (const candidate of [action.selectors?.primary, ...(action.selectors?.alternatives ?? [])]) {
    if (candidate && CSS_SELECTOR_TYPES.has(candidate.type) && candidate.value.trim()) {
      add(candidate.value.trim());
    }
  }

  for (const attr of ATTRS) {
    const sel = attrSelector(tagName, attr, getAttr(action, attr));
    if (sel) add(sel);
  }

  const className = getAttr(action, 'class');
  const classes = className.split(/\s+/).filter(Boolean).slice(0, 2);
  if (classes.length > 0) {
    add(`${tagName}.${classes.map(escapeCssIdentifier).join('.')}`);
  }

  return list;
}

export function getContainerHighlightSelector(action: Action): string {
  const all = getAllContainerHighlightSelectors(action);
  return all[0] ?? '';
}
