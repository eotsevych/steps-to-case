// Shared display helpers for rendering recorded steps in the panel UI.
import type { Action, AssertionType } from '../types';
import { NAME_TOKEN, expandNameTemplate, getElementName } from '../lib/stepName';
import { displayFillValue } from '../lib/exporter';

export const assertionLabels: Record<AssertionType, string> = {
  text_equals: 'Text equals',
  text_contains: 'Text contains',
  visible: 'Visible',
  hidden: 'Hidden',
  enabled: 'Enabled',
  disabled: 'Disabled',
  checked: 'Checked',
  unchecked: 'Unchecked',
};

export function getStepTypeBadge(type: string): { label: string; variant: 'blue' | 'green' | 'amber' } {
  switch (type) {
    case 'assert': return { label: 'A', variant: 'green' };
    case 'step': return { label: 'M', variant: 'amber' };
    default: return { label: 'R', variant: 'blue' };
  }
}

function getAssertionSummary(action: Action): string {
  const description = action.expectedResults?.[0]?.description?.trim();
  if (description) return `Assert: ${description}`;
  return `Assert element is ${action.expectedResults?.[0]?.assertion?.type?.replace('_', ' ') || 'visible'}`;
}

export interface StepSummaryParts {
  prefix: string;
  name: string;
  suffix: string;
}

/**
 * Split the step summary into prefix + element-name + suffix so the name can
 * be rendered as an interactive control (description picker chip). Custom text
 * is split on its {name} token, so a user-reworded line ("Select {name}
 * method") keeps the chip. Returns null when the summary has no element name
 * to expose (tokenless custom text, press, navigate, assert, manual step).
 */
export function getStepSummaryParts(action: Action): StepSummaryParts | null {
  if (action.customText) {
    const idx = action.customText.indexOf(NAME_TOKEN);
    if (idx === -1) return null;
    return {
      prefix: action.customText.slice(0, idx).trimEnd(),
      name: shortName(action),
      suffix: action.customText.slice(idx + NAME_TOKEN.length).trimStart(),
    };
  }
  return getNameParts(action);
}

/** Element name, truncated for display inside the step row. */
function shortName(action: Action): string {
  const name = getElementName(action);
  return name.length > 40 ? name.slice(0, 40) + '...' : name;
}

/**
 * Same split as getStepSummaryParts, but ignoring any manual override — used to
 * decide whether an edit should replace the element name or the whole line.
 */
function getNameParts(action: Action): StepSummaryParts | null {
  const short = shortName(action);

  switch (action.type) {
    case 'click':
      return { prefix: 'Click on', name: short, suffix: '' };
    case 'dblclick':
      return { prefix: 'Double-click', name: short, suffix: '' };
    case 'fill':
      return { prefix: 'Fill', name: short, suffix: `with "${displayFillValue(action)}"` };
    case 'select':
      return { prefix: `Select "${action.actionData?.selectedOption || ''}" in`, name: short, suffix: '' };
    case 'check':
      return { prefix: 'Check', name: short, suffix: '' };
    case 'uncheck':
      return { prefix: 'Uncheck', name: short, suffix: '' };
    case 'press':
    case 'navigate':
    case 'assert':
    case 'step':
      return null;
    default:
      return { prefix: `${action.type} on`, name: short, suffix: '' };
  }
}

/** True when the step renders its element name as a description-picker chip. */
function isNameDriven(action: Action): boolean {
  if (action.type === 'assert') return false;
  if (!action.selectors?.descriptionCandidates?.length) return false;
  return getNameParts(action) !== null;
}

/**
 * Text to prefill the inline editor with. The pencil edits the whole line —
 * verb included — but for name-driven steps the element name is shown as the
 * {name} token so the user rewords around it and the picker chip survives the
 * edit.
 */
export function getStepTextTemplate(action: Action): string {
  if (action.customText) return action.customText;
  if (!isNameDriven(action)) return getStepSummary(action);
  const parts = getNameParts(action)!;
  return [parts.prefix, NAME_TOKEN, parts.suffix].filter(Boolean).join(' ');
}

/**
 * Prepare edited text for saving. If the user removed the {name} token but
 * left the element name typed out verbatim, re-anchor the token there so the
 * chip is not lost to a stray keystroke; otherwise the line is stored as-is
 * (deliberately dropping the chip).
 */
export function normalizeStepTemplate(text: string, action: Action): string {
  if (text.includes(NAME_TOKEN) || !isNameDriven(action)) return text;
  const name = getElementName(action);
  if (!name) return text;
  const idx = text.toLowerCase().indexOf(name.toLowerCase());
  if (idx === -1) return text;
  return text.slice(0, idx) + NAME_TOKEN + text.slice(idx + name.length);
}

/** One-line human-readable summary of a recorded step. */
export function getStepSummary(action: Action): string {
  if (action.customText) return expandNameTemplate(action.customText, action);

  const short = shortName(action);

  switch (action.type) {
    case 'click':
      return `Click on ${short}`;
    case 'dblclick':
      return `Double-click ${short}`;
    case 'fill':
      return `Fill ${short} with "${displayFillValue(action)}"`;
    case 'press':
      return `Press ${action.actionData?.key || 'key'}`;
    case 'navigate':
      return `Navigate to ${action.page.pathname}`;
    case 'select':
      return `Select "${action.actionData?.selectedOption || ''}" in ${short}`;
    case 'check':
      return `Check ${short}`;
    case 'uncheck':
      return `Uncheck ${short}`;
    case 'assert':
      return getAssertionSummary(action);
    case 'step':
      return short;
    default:
      return `${action.type} on ${short}`;
  }
}
