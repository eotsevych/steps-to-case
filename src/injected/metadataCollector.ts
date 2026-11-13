import type { DescriptionAnchor, DescriptionCandidate, ElementInfo, HierarchyOption, PageContext } from '../types';
import { DEFAULT_DESCRIPTION_HIERARCHY } from '../lib/hierarchy';
import { DEFAULT_DESCRIPTION_ANCHORS } from '../lib/settings';
import { parseRecordedPageContext } from '../lib/pageUrl';
import {
  buttonLikeInputValue,
  getAccessibleName,
  getAssociatedLabelText,
  getCustomSelectorAttrs,
  getPreviousSiblings,
  getSelectorDebugMode,
} from './selectorGenerator';
import { isSecretInput } from './secretInputs';

// ============================================================
// Algorithm 1: Description Finder — configurable anchor list
// ============================================================

let descriptionAnchors: DescriptionAnchor[] = DEFAULT_DESCRIPTION_ANCHORS;
let descriptionHierarchy: HierarchyOption = DEFAULT_DESCRIPTION_HIERARCHY;

export function setDescriptionAnchors(anchors: DescriptionAnchor[]) {
  descriptionAnchors = anchors;
}

export function setDescriptionHierarchy(mode: HierarchyOption) {
  descriptionHierarchy = mode;
}

export function getDescriptionHierarchy(): HierarchyOption {
  return descriptionHierarchy;
}

interface DescriptionSource {
  label: string;
  node: Element;
  depth: number;
}

export interface DescriptionMatch {
  results: string[];
  primaryText?: string;
  mode: HierarchyOption;
  sourceLabel?: string;
  depth: number | null;
}

/** Extract the value of a single anchor attribute from an element */
function extractAnchorValue(el: Element, attr: string): string {
  switch (attr) {
    case 'innerText': {
      if (el.tagName.toLowerCase() === 'select') return '';
      const raw = (el as HTMLElement).innerText?.trim();
      if (!raw) return '';
      // Use only the first line — multi-line innerText means it's a container
      // aggregating text from many children, which is not a useful descriptor.
      const text = raw.split('\n')[0].trim();
      return text && text.length < 200 ? text : '';
    }
    case 'textContent': {
      if (el.tagName.toLowerCase() === 'select') return '';
      const raw = el.textContent?.trim();
      if (!raw) return '';
      const text = raw.split('\n')[0].trim();
      return text && text.length < 200 ? text : '';
    }
    case 'aria-label':
      return el.getAttribute('aria-label')?.trim() || '';
    case 'placeholder':
      return el.getAttribute('placeholder')?.trim() || '';
    case 'value':
      return buttonLikeInputValue(el);
    case 'title':
      return el.getAttribute('title')?.trim() || '';
    default:
      // Custom attribute
      return el.getAttribute(attr)?.trim() || '';
  }
}

/**
 * The <label> associated with a form control, either via `for`/`id` or by
 * wrapping the control. Gives inputs a stable, human name (e.g. "Quantity",
 * "Date") even when they have no placeholder/aria-label of their own.
 */
function getAssociatedLabel(el: Element): Element | null {
  const tag = el.tagName.toLowerCase();
  if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') return null;
  if (el.id) {
    try {
      const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (forLabel) return forLabel;
    } catch { /* invalid id for selector */ }
  }
  return el.closest('label');
}

function getAncestorAtDepth(el: Element, depth: number): Element | null {
  let current: Element | null = el;
  let currentDepth = 0;
  while (current && currentDepth < depth) {
    current = current.parentElement;
    currentDepth++;
  }
  return current;
}

function collectDescriptionSources(
  el: Element,
  mode: HierarchyOption
): DescriptionSource[] {
  switch (mode) {
    case '0': {
      const sources: DescriptionSource[] = [{ label: '0 exact element', node: el, depth: 0 }];
      // For form controls, treat the associated <label> as part of the element
      // itself so a labeled field is named after its label. Appended last, so
      // the element's own text/placeholder still wins when present.
      const labelEl = getAssociatedLabel(el);
      if (labelEl) sources.push({ label: '0 field label', node: labelEl, depth: 0 });
      return sources;
    }
    case '1': {
      const [closestSibling] = getPreviousSiblings(el);
      return closestSibling ? [{ label: '1 closest upper sibling', node: closestSibling, depth: 1 }] : [];
    }
    case '1+':
      return getPreviousSiblings(el).map((node, index) => ({
        label: index === 0 ? '1+ closest upper sibling' : `1+ upper sibling ${index + 1}`,
        node,
        depth: 1,
      }));
    case '2': {
      const parent = el.parentElement;
      return parent ? [{ label: '2 closest parent', node: parent, depth: 2 }] : [];
    }
    case '2+': {
      const sources: DescriptionSource[] = [];
      let current = el.parentElement;
      let depth = 1;
      while (current) {
        sources.push({
          label: depth === 1 ? '2+ closest parent' : `2+ parent ${depth}`,
          node: current,
          depth: 2,
        });
        for (const sibling of getPreviousSiblings(current)) {
          sources.push({
            label: `2+ upper sibling of parent ${depth}`,
            node: sibling,
            depth: 2,
          });
        }
        current = current.parentElement;
        depth++;
      }
      return sources;
    }
    case '3': {
      const grandparent = getAncestorAtDepth(el, 2);
      return grandparent ? [{ label: '3 grandparent', node: grandparent, depth: 3 }] : [];
    }
    case '3+': {
      const sources: DescriptionSource[] = [];
      let current = getAncestorAtDepth(el, 2);
      let depth = 2;
      while (current) {
        sources.push({
          label: depth === 2 ? '3+ grandparent' : `3+ ancestor ${depth}`,
          node: current,
          depth: 3,
        });
        for (const sibling of getPreviousSiblings(current)) {
          sources.push({
            label: `3+ upper sibling of ancestor ${depth}`,
            node: sibling,
            depth: 3,
          });
        }
        current = current.parentElement;
        depth++;
      }
      return sources;
    }
  }
}

/**
 * Algorithm 1: Inspect only the sources allowed by the configured hierarchy mode.
 * Collect all non-empty values found. The first element of the returned array is the step title.
 */
export function findDescription(
  el: Element,
  anchors: DescriptionAnchor[],
  mode: HierarchyOption
): DescriptionMatch {
  const results: string[] = [];
  const seen = new Set<string>();
  const debug = getSelectorDebugMode();
  const debugBySource: Map<string, { attr: string; value: string }[]> = new Map();
  let matchedSource: DescriptionSource | undefined;
  let usedFallback = false;

  const collectFrom = (sources: DescriptionSource[]) => {
    for (const source of sources) {
      // Only the first match is used; debug mode keeps scanning to log every source.
      // Without this, '2+'/'3+' read the text of every sibling of every ancestor.
      if (!debug && results.length > 0) return;
      for (const anchor of anchors) {
        const value = extractAnchorValue(source.node, anchor.attr);
        if (!value || seen.has(value)) continue;

        if (!matchedSource) {
          matchedSource = source;
        }
        seen.add(value);
        results.push(value.slice(0, 200));

        if (debug) {
          if (!debugBySource.has(source.label)) debugBySource.set(source.label, []);
          debugBySource.get(source.label)!.push({ attr: anchor.attr, value: value.slice(0, 80) });
        }
      }
    }
  };

  collectFrom(collectDescriptionSources(el, mode));

  // Fallback: if the chosen hierarchy level produced no description (e.g. mode 1
  // on an element with no preceding sibling), fall back to level 0 (the element
  // itself) so we still get a step title from its own text/attributes.
  if (results.length === 0 && mode !== '0') {
    usedFallback = true;
    collectFrom(collectDescriptionSources(el, '0'));
  }

  if (debug) {
    const tag = el.tagName.toLowerCase();
    const selfText = (el as HTMLElement).innerText?.trim().slice(0, 30) || '';
    const header = selfText ? `<${tag}> "${selfText}"` : `<${tag}>`;
    const lines: string[] = [
      `[StepsToCase] Description for ${header}`,
      `  Mode: ${mode}${usedFallback ? ' (fell back to level 0)' : ''}`,
    ];

    const labels = Array.from(debugBySource.keys());
    for (const label of labels) {
      lines.push(`  ${label}:`);
      for (const entry of debugBySource.get(label)!) {
        const marker = entry === debugBySource.get(labels[0])![0] && label === labels[0] ? '\u2605 ' : '  ';
        lines.push(`    ${marker}${entry.attr.padEnd(16)} "${entry.value}"`);
      }
    }

    if (results.length > 0) {
      lines.push(`  Matched source: ${matchedSource?.label ?? '(unknown)'}`);
      lines.push(`  Matched depth: ${matchedSource?.depth ?? '(unknown)'}`);
      lines.push(`  Step title: "${results[0]}"`);
    } else {
      lines.push('  Matched source: (none)');
      lines.push('  Matched depth: (none)');
      lines.push('  Step title: (none found)');
    }

    console.log(lines.join('\n'));
  }

  return {
    results,
    primaryText: results[0],
    mode,
    sourceLabel: matchedSource?.label,
    depth: matchedSource?.depth ?? null,
  };
}

/** Get the current description anchors (for use in content-script) */
export function getDescriptionAnchors(): DescriptionAnchor[] {
  return descriptionAnchors;
}

// Caps to keep the per-action payload bounded: '2+'/'3+' walk to the document
// root and can otherwise produce dozens of entries on deeply nested DOMs.
const MAX_CANDIDATES_PER_LEVEL = 6;
const MAX_CANDIDATES_TOTAL = 24;
// Sources whose text is read per level — empty or repeated texts don't count
// toward the per-level cap, so without this a long list scans every row.
const MAX_SOURCES_PER_LEVEL = 40;

/**
 * Scan ALL hierarchy levels ('0' → '3+') and collect every distinct text the
 * anchors produce, tagged with the level and source it came from. Levels are
 * scanned closest-first, so a text repeated at several levels is attributed to
 * the closest one ('1' before '1+', '2' before '2+', '3' before '3+').
 */
export function collectAllDescriptionCandidates(
  el: Element,
  anchors: DescriptionAnchor[]
): DescriptionCandidate[] {
  const candidates: DescriptionCandidate[] = [];
  const seen = new Set<string>();
  const levels: HierarchyOption[] = ['0', '1', '1+', '2', '2+', '3', '3+'];

  for (const level of levels) {
    let perLevel = 0;
    for (const source of collectDescriptionSources(el, level).slice(0, MAX_SOURCES_PER_LEVEL)) {
      if (perLevel >= MAX_CANDIDATES_PER_LEVEL) break;
      for (const anchor of anchors) {
        const value = extractAnchorValue(source.node, anchor.attr);
        if (!value || seen.has(value)) continue;
        seen.add(value);
        candidates.push({
          text: value.slice(0, 200),
          level,
          source: source.label,
          attr: anchor.attr,
        });
        perLevel++;
        if (candidates.length >= MAX_CANDIDATES_TOTAL) return candidates;
        if (perLevel >= MAX_CANDIDATES_PER_LEVEL) break;
      }
    }
  }

  return candidates;
}

// Better text extraction for buttons, inputs, li, and other elements
function getElementDisplayText(el: Element): string {
  const htmlEl = el as HTMLElement;
  const tag = el.tagName.toLowerCase();

  // Custom selector attributes win first — clean their value for display
  for (const attr of getCustomSelectorAttrs()) {
    const val = el.getAttribute(attr);
    if (val) return val.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  }

  // For input[type=submit] or input[type=button], use value
  if (tag === 'input') {
    const input = el as HTMLInputElement;
    const type = (input.type || '').toLowerCase();
    if (type === 'submit' || type === 'button') {
      return input.value || el.getAttribute('aria-label') || input.title || '';
    }
    // For other inputs, return placeholder or name (cleaned up)
    if (input.placeholder) return input.placeholder;
    if (input.name) return input.name.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
    return '';
  }

  // For buttons, get the inner text (including nested spans/icons text)
  if (tag === 'button') {
    const text = htmlEl.innerText?.trim();
    if (text) return text;
    // Try nested img alt, svg title, or aria-label
    const img = el.querySelector('img[alt]');
    if (img) return img.getAttribute('alt') || '';
    return el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('value') || '';
  }

  // For select, get its own label/aria-label/title/name
  if (tag === 'select') {
    const select = el as HTMLSelectElement;
    return select.getAttribute('aria-label') || select.title || select.name || select.id || '';
  }

  // For links, get text
  if (tag === 'a') {
    const text = htmlEl.innerText?.trim();
    if (text) return text;
    const img = el.querySelector('img[alt]');
    if (img) return img.getAttribute('alt') || '';
    return el.getAttribute('aria-label') || el.getAttribute('title') || '';
  }

  if (tag === 'textarea') {
    const textarea = el as HTMLTextAreaElement;
    // Use full id or name so similar textareas are distinguishable
    if (textarea.id) return textarea.id.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
    if (textarea.name) return textarea.name.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
    return textarea.placeholder || '';
  }


  // For li elements (dropdown items), get the full inner text
  if (tag === 'li') {
    const text = htmlEl.innerText?.trim();
    if (text) return text;
    return el.getAttribute('aria-label') || (el.textContent || '').trim() || '';
  }

  // For elements with interactive roles, try inner text then attributes
  const role = el.getAttribute('role');
  if (role) {
    const text = htmlEl.innerText?.trim();
    if (text) return text;
    return el.getAttribute('aria-label') || (el.textContent || '').trim() || '';
  }

  // Generic fallback: try innerText, then textContent (first line only)
  const text = (htmlEl.innerText || '').trim().split('\n')[0].trim();
  if (text) return text;
  return (el.textContent || '').trim().split('\n')[0].trim();
}

/** Walk up ancestors looking for contextual name from data-field, data-title, aria-label, title */
function getParentContextName(el: Element): string {
  const maxDepth = 3;
  let ancestor = el.parentElement;
  let depth = 0;
  while (ancestor && depth < maxDepth) {
    depth++;
    const field = ancestor.getAttribute('data-field');
    const title = ancestor.getAttribute('data-title') || ancestor.getAttribute('title');
    const ariaLabel = ancestor.getAttribute('aria-label');
    const accName = getAccessibleName(ancestor);

    // Prefer: "title field" (e.g. "Edit cost"), then field, then title, then aria-label
    if (title && field) return `${title} ${field.replace(/[_-]/g, ' ')}`;
    if (field) return field.replace(/[_-]/g, ' ');
    if (ariaLabel) return ariaLabel;
    if (title) return title;
    if (accName) return accName;

    ancestor = ancestor.parentElement;
  }
  return '';
}

export function collectElementInfo(el: Element): ElementInfo {
  const htmlEl = el as HTMLElement;

  // Collect all attributes
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    attributes[attr.name] = attr.value;
  }
  // React mirrors the typed value into the `value` attribute — never export a password
  if (isSecretInput(el)) delete attributes.value;

  const label = getAssociatedLabelText(el) ?? undefined;

  const isSelect = el.tagName.toLowerCase() === 'select';
  const displayText = getElementDisplayText(el);
  const innerText = isSelect ? '' : (htmlEl.innerText || '').trim().split('\n')[0].trim().slice(0, 200);
  const textContent = isSelect ? '' : (el.textContent || '').trim().split('\n')[0].trim().slice(0, 200);
  const accessibleName = getAccessibleName(el);

  // Build the best possible name with multiple fallbacks
  // If element has no meaningful text, inherit context from parent/ancestors
  let bestName = accessibleName || label || displayText || innerText || textContent;
  if (!bestName) {
    bestName = getParentContextName(el);
  }

  return {
    tagName: el.tagName.toLowerCase(),
    textContent: textContent || displayText,
    accessibleName: bestName,
    innerText: innerText || displayText || textContent,
    label,
    placeholder: el.getAttribute('placeholder') || undefined,
    ariaLabel: el.getAttribute('aria-label') || undefined,
    title: el.getAttribute('title') || undefined,
    attributes,
  };
}

export function collectPageContext(): PageContext {
  return parseRecordedPageContext(window.location.href, document.title);
}
