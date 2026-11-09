import type { HierarchyOption, LocatorAttr, SelectorOption, SelectorType, Selectors } from '../types';
import { DEFAULT_LOCATOR_HIERARCHY } from '../lib/hierarchy';
import { DEFAULT_LOCATOR_ATTRIBUTES } from '../lib/settings';

// Custom selector attributes (set from settings before recording)
let customSelectorAttrs: string[] = [];

export function setCustomSelectorAttributes(attrs: string[]) {
  customSelectorAttrs = attrs;
}

export function getCustomSelectorAttrs(): string[] {
  return customSelectorAttrs;
}

// Configurable locator attributes list (Algorithm 2)
let locatorAttrs: LocatorAttr[] = DEFAULT_LOCATOR_ATTRIBUTES;

export function setLocatorAttributes(attrs: LocatorAttr[]) {
  locatorAttrs = attrs;
}

export function getLocatorAttributes(): LocatorAttr[] {
  return locatorAttrs;
}

// Configurable hierarchy source for relationship-based selectors
let locatorHierarchy: HierarchyOption = DEFAULT_LOCATOR_HIERARCHY;

export function setLocatorHierarchy(mode: HierarchyOption) {
  locatorHierarchy = mode;
}

// Debug mode — when enabled, log locators to the page console grouped by hierarchy level
let selectorDebugMode = false;

export function setSelectorDebugMode(enabled: boolean) {
  selectorDebugMode = enabled;
}

export function getSelectorDebugMode(): boolean {
  return selectorDebugMode;
}

// ============================================================
// Stability detection — reject dynamic/generated values
// ============================================================

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_HEAVY_PATTERN = /^[0-9a-f]{8,}$/i;
const DYNAMIC_ID_PATTERN = /[:_-]\d{4,}|__\w+__|ember\d+|react-|ng-|_(?=[a-z]*\d)[0-9a-z]{5,}$/;
const UTILITY_CLASS_PATTERN = /^(p|m|px|py|mx|my|pt|pb|pl|pr|mt|mb|ml|mr|w|h|min-w|min-h|max-w|max-h|flex|grid|gap|text|font|bg|border|rounded|shadow|opacity|z|top|left|right|bottom|overflow|cursor|pointer|block|inline|hidden|relative|absolute|fixed|sticky|col|row)-/;
const TRACKING_HREF_PATTERN = /[?&](utm_|fbclid|gclid|ref=|session|token|nonce|_ga)/i;

function isDynamic(value: string): boolean {
  return GUID_PATTERN.test(value) || HEX_HEAVY_PATTERN.test(value) || DYNAMIC_ID_PATTERN.test(value);
}

function isUtilityClass(cls: string): boolean {
  return UTILITY_CLASS_PATTERN.test(cls) || cls.startsWith('_') || cls.startsWith('ng-') || isDynamic(cls);
}

function isStableHref(href: string): boolean {
  if (!href || href === '#' || href.startsWith('javascript:')) return false;
  if (TRACKING_HREF_PATTERN.test(href)) return false;
  if (isDynamic(href)) return false;
  return true;
}

// ============================================================
// Visibility check — skip hidden elements (display:none, visibility:hidden, etc.)
// ============================================================

function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return true;
  // checkVisibility covers display:none, visibility:hidden, content-visibility (Chrome 105+)
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility();
  }
  // Fallback: zero-size elements are hidden
  return el.offsetWidth > 0 || el.offsetHeight > 0;
}

// ============================================================
// Uniqueness check — only counts visible elements
// ============================================================

// Memo for one generateSelectors() call: ranking re-tests the same selectors,
// and each test scans the whole document. Reset per call because the DOM changes.
let uniqueMemo = new Map<string, boolean>();

function memoized(key: string, compute: () => boolean): boolean {
  const cached = uniqueMemo.get(key);
  if (cached !== undefined) return cached;
  const result = compute();
  uniqueMemo.set(key, result);
  return result;
}

function isUnique(selector: string): boolean {
  return memoized(selector, () => {
    try {
      const matches = document.querySelectorAll(selector);
      let visibleCount = 0;
      for (const m of Array.from(matches)) {
        if (isVisible(m)) {
          visibleCount++;
          if (visibleCount > 1) return false;
        }
      }
      return visibleCount === 1;
    } catch {
      return false;
    }
  });
}

/** Only button-like inputs carry a label in their value; other inputs' value is user data. */
export function buttonLikeInputValue(el: Element): string {
  if (!(el instanceof HTMLInputElement)) return '';
  return ['submit', 'button', 'reset', 'image'].includes(el.type) ? el.value.trim() : '';
}

// ============================================================
// Implicit ARIA roles
// ============================================================

function getImplicitRole(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  const type = el.getAttribute('type')?.toLowerCase();
  const roleMap: Record<string, string> = {
    button: 'button',
    a: 'link',
    input: type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio' : type === 'submit' ? 'button' : 'textbox',
    select: 'combobox',
    textarea: 'textbox',
    img: 'img',
    nav: 'navigation',
    main: 'main',
    header: 'banner',
    footer: 'contentinfo',
    aside: 'complementary',
    form: 'form',
    table: 'table',
    h1: 'heading', h2: 'heading', h3: 'heading',
    h4: 'heading', h5: 'heading', h6: 'heading',
  };
  return roleMap[tag] || null;
}

// ============================================================
// Accessible name computation
// ============================================================

export function getAccessibleName(el: Element): string {
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labels = labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean);
    if (labels.length) return labels.join(' ');
  }

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const labelText = getAssociatedLabelText(el);
  if (labelText) return labelText;

  const title = el.getAttribute('title');
  if (title) return title;

  if (el instanceof HTMLImageElement && el.alt) return el.alt;

  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'link') {
    const text = (el as HTMLElement).innerText?.trim();
    if (text && text.length < 100) return text;
  }

  const placeholder = el.getAttribute('placeholder');
  if (placeholder) return placeholder;

  return '';
}

// ============================================================
// Scoring constants
// ============================================================

// Attribute candidates are scored positionally from the locatorAttrs list
// (first = 1, second = 6, ...); these constants cover the remaining kinds.
const SCORES = {
  // Relationship-based (weaker but still useful)
  sibling_anchor: 65,
  parent_scoped: 70,

  // Structural fallbacks
  css_structural: 85,
  nth_child: 95,
};

const PENALTIES = {
  not_unique: 1000, // disqualify non-unique selectors
  positional: 15,   // nth-child, nth-of-type
  deep_chain: 3,    // per extra level of depth beyond 2
  long_selector: 2, // per 20 chars beyond 40
};

// ============================================================
// Dynamic ancestor scoring
// ============================================================

function ancestorScore(level: number): number {
  if (level <= 1) return SCORES.sibling_anchor; // 65
  if (level === 2) return SCORES.parent_scoped; // 70
  // Each level beyond 2 adds 8 points, capped just below nth_child
  return Math.min(SCORES.parent_scoped + (level - 2) * 8, SCORES.nth_child - 1); // 78, 86, 94, 94...
}

// Earlier siblings checked for anchors. Relationship anchors far away are weak
// anyway, and each check can scan the whole document — a cell in row 2,000 of a
// table would otherwise test all 1,999 rows above it.
const MAX_SIBLINGS_SCANNED = 10;

export function getPreviousSiblings(el: Element): Element[] {
  const parent = el.parentElement;
  if (!parent) return [];
  const siblings = Array.from(parent.children);
  const elIndex = siblings.indexOf(el);
  return elIndex > 0 ? siblings.slice(0, elIndex).reverse() : [];
}

// ============================================================
// Candidate interface
// ============================================================

interface Candidate {
  type: SelectorType;
  value: string;       // human-readable descriptor
  cssSelector: string; // actual CSS for uniqueness testing
  baseScore: number;
  level: number;       // hierarchy level: 0=self, 1=siblings, 2=parent, 3+=ancestor, -1=fallback
}

// ============================================================
// Wildcard expansion — expand patterns like "data-*" to matching attributes
// ============================================================

function expandWildcard(el: Element, pattern: string): { attr: string; value: string }[] {
  const prefix = pattern.slice(0, -1); // "data-*" → "data-"
  const results: { attr: string; value: string }[] = [];
  for (const a of Array.from(el.attributes)) {
    if (a.name.startsWith(prefix) && a.value && !isDynamic(a.value)) {
      results.push({ attr: a.name, value: a.value });
    }
  }
  return results;
}

// ============================================================
// Phase 1: Self-inspection — check the element itself
// Uses the configurable locatorAttrs list for attribute-based candidates
// ============================================================

function selfCandidates(el: Element): Candidate[] {
  const results: Candidate[] = [];
  const tag = el.tagName.toLowerCase();

  // --- Configurable attribute candidates from locatorAttrs ---
  // Each attribute in the list gets a score based on position: first=1, second=6, third=11, etc.
  for (let i = 0; i < locatorAttrs.length; i++) {
    const locAttr = locatorAttrs[i];
    const baseScore = i * 5 + 1;

    if (locAttr.isWildcard) {
      // Expand wildcard pattern (e.g. "data-*")
      const expanded = expandWildcard(el, locAttr.attr);
      if (expanded.length > 0) {
        // Debug: log full array of matches
        if (selectorDebugMode && expanded.length > 1) {
          console.log(`[StepsToCase] Wildcard "${locAttr.attr}" expanded: [${expanded.map(e => `${e.attr}="${e.value}"`).join(', ')}]`);
        }
        // Use first match as the candidate
        const first = expanded[0];
        const css = `${tag}[${first.attr}="${CSS.escape(first.value)}"]`;
        results.push({
          type: 'data-attr',
          value: `[${first.attr}="${first.value}"]`,
          cssSelector: css,
          baseScore,
          level: 0,
        });
      }
      continue;
    }

    // Handle specific known attributes with special selector generation
    switch (locAttr.attr) {
      case 'id': {
        if (el.id && !isDynamic(el.id)) {
          results.push({
            type: 'id',
            value: `#${el.id}`,
            cssSelector: `#${CSS.escape(el.id)}`,
            baseScore,
            level: 0,
          });
        }
        break;
      }
      case 'class': {
        const semanticClasses = Array.from(el.classList).filter(c => !isUtilityClass(c) && !isDynamic(c));
        if (semanticClasses.length > 0) {
          const top = semanticClasses.slice(0, 2);
          const css = `${tag}.${top.map(c => CSS.escape(c)).join('.')}`;
          results.push({
            type: 'css',
            value: css,
            cssSelector: css,
            baseScore,
            level: 0,
          });
        }
        break;
      }
      case 'href': {
        if (tag === 'a') {
          const href = el.getAttribute('href');
          if (href && isStableHref(href)) {
            const css = `a[href="${CSS.escape(href)}"]`;
            results.push({
              type: 'href',
              value: `a[href="${href}"]`,
              cssSelector: css,
              baseScore,
              level: 0,
            });
          }
        }
        break;
      }
      case 'name': {
        const nameVal = el.getAttribute('name');
        if (nameVal && !isDynamic(nameVal)) {
          const css = `${tag}[name="${CSS.escape(nameVal)}"]`;
          results.push({
            type: 'name',
            value: `[name="${nameVal}"]`,
            cssSelector: css,
            baseScore,
            level: 0,
          });
        }
        break;
      }
      case 'aria-label': {
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel && !isDynamic(ariaLabel)) {
          const css = `${tag}[aria-label="${CSS.escape(ariaLabel)}"]`;
          results.push({
            type: 'aria',
            value: `[aria-label="${ariaLabel}"]`,
            cssSelector: css,
            baseScore,
            level: 0,
          });
        }
        break;
      }
      case 'placeholder': {
        const placeholder = el.getAttribute('placeholder');
        if (placeholder) {
          const css = `${tag}[placeholder="${CSS.escape(placeholder)}"]`;
          results.push({
            type: 'placeholder',
            value: placeholder,
            cssSelector: css,
            baseScore,
            level: 0,
          });
        }
        break;
      }
      case 'title': {
        const titleVal = el.getAttribute('title');
        if (titleVal && !isDynamic(titleVal)) {
          const css = `${tag}[title="${CSS.escape(titleVal)}"]`;
          results.push({
            type: 'title',
            value: `[title="${titleVal}"]`,
            cssSelector: css,
            baseScore,
            level: 0,
          });
        }
        break;
      }
      case 'value': {
        // Only button-like values are labels; a text field's value is user input (and may be a password)
        const val = el instanceof HTMLButtonElement ? el.value : buttonLikeInputValue(el);
        if (val && !isDynamic(val)) {
          const css = `${tag}[value="${CSS.escape(val)}"]`;
          results.push({
            type: 'data-attr',
            value: `[value="${val}"]`,
            cssSelector: css,
            baseScore,
            level: 0,
          });
        }
        break;
      }
      default: {
        // Generic attribute (data-testid, data-test, data-cy, data-qa, or any custom attr)
        const val = el.getAttribute(locAttr.attr);
        if (val && !isDynamic(val)) {
          // Determine selector type based on attribute name
          const isTestId = ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa'].includes(locAttr.attr);
          const css = `[${locAttr.attr}="${CSS.escape(val)}"]`;
          results.push({
            type: isTestId ? 'testid' : 'data-attr',
            value: `[${locAttr.attr}="${val}"]`,
            cssSelector: css,
            baseScore,
            level: 0,
          });
        }
        break;
      }
    }
  }

  // --- Non-attribute candidates (always included, scored relative to list) ---
  const afterListScore = locatorAttrs.length * 5 + 1;

  // Role + accessible name
  const role = el.getAttribute('role') || getImplicitRole(el);
  const accName = getAccessibleName(el);
  if (role && accName) {
    const cssApprox = buildRoleCss(el, role, accName);
    results.push({
      type: 'role',
      value: `${role}[name="${accName}"]`,
      cssSelector: cssApprox,
      baseScore: afterListScore,
      level: 0,
    });
  }

  // Associated label (for form elements)
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    const labelText = getAssociatedLabelText(el);
    if (labelText) {
      results.push({
        type: 'label',
        value: labelText,
        cssSelector: buildLabelCss(el, labelText),
        baseScore: afterListScore + 5,
        level: 0,
      });
    }
  }

  // Visible unique text (for buttons, links, li, role elements)
  const text = (el as HTMLElement).innerText?.trim();
  if (text && text.length > 0 && text.length < 80) {
    results.push({
      type: 'text',
      value: text,
      cssSelector: '', // text selectors need special uniqueness check
      baseScore: afterListScore + 10,
      level: 0,
    });
  }

  // alt attribute (for images, areas)
  const alt = el.getAttribute('alt');
  if (alt && !isDynamic(alt)) {
    const css = `${tag}[alt="${CSS.escape(alt)}"]`;
    results.push({
      type: 'alt',
      value: `[alt="${alt}"]`,
      cssSelector: css,
      baseScore: afterListScore + 15,
      level: 0,
    });
  }

  return results;
}

// ============================================================
// Phase 2: Relationship-based candidates
// Check order: siblings above → parent → parent-siblings above parent
// ============================================================

function addSiblingCandidates(
  results: Candidate[],
  el: Element,
  onlyClosest: boolean
) {
  const tag = el.tagName.toLowerCase();
  const elSpec = getMinimalSelfSpecifier(el) || tag;

  for (const sibling of getPreviousSiblings(el).slice(0, MAX_SIBLINGS_SCANNED)) {
    const anchor = getMeaningfulAnchorSelector(sibling);
    if (!anchor) {
      if (onlyClosest) break;
      continue;
    }

    const tildeSimple = `${anchor} ~ ${tag}`;
    const tildeSpecific = `${anchor} ~ ${elSpec}`;

    if (isUnique(tildeSpecific)) {
      results.push({ type: 'sibling', value: tildeSpecific, cssSelector: tildeSpecific, baseScore: ancestorScore(1), level: 1 });
    } else if (isUnique(tildeSimple)) {
      results.push({ type: 'sibling', value: tildeSimple, cssSelector: tildeSimple, baseScore: ancestorScore(1), level: 1 });
    }

    if (onlyClosest) break;
  }
}

function addAncestorCandidates(
  results: Candidate[],
  el: Element,
  currentAncestor: Element,
  level: number,
  includeUpperSiblings: boolean
) {
  const tag = el.tagName.toLowerCase();
  const elSpec = getMinimalSelfSpecifier(el) || tag;
  const score = ancestorScore(level);

  const ancAnchor = getMeaningfulAnchorSelector(currentAncestor);
  if (ancAnchor) {
    const descSimple = `${ancAnchor} ${tag}`;
    const descSpecific = `${ancAnchor} ${elSpec}`;

    if (level === 2) {
      if (isUnique(`${ancAnchor} > ${elSpec}`)) {
        results.push({ type: 'parent-scoped', value: `${ancAnchor} > ${elSpec}`, cssSelector: `${ancAnchor} > ${elSpec}`, baseScore: score, level });
      } else if (isUnique(`${ancAnchor} > ${tag}`)) {
        results.push({ type: 'parent-scoped', value: `${ancAnchor} > ${tag}`, cssSelector: `${ancAnchor} > ${tag}`, baseScore: score, level });
      } else if (isUnique(descSpecific)) {
        results.push({ type: 'parent-scoped', value: descSpecific, cssSelector: descSpecific, baseScore: score + PENALTIES.deep_chain, level });
      } else if (isUnique(descSimple)) {
        results.push({ type: 'parent-scoped', value: descSimple, cssSelector: descSimple, baseScore: score + PENALTIES.deep_chain, level });
      }
    } else {
      if (isUnique(descSpecific)) {
        results.push({ type: 'parent-scoped', value: descSpecific, cssSelector: descSpecific, baseScore: score, level });
      } else if (isUnique(descSimple)) {
        results.push({ type: 'parent-scoped', value: descSimple, cssSelector: descSimple, baseScore: score + PENALTIES.deep_chain, level });
      }
    }
  }

  if (!includeUpperSiblings) return;

  if (!currentAncestor.parentElement) return;

  let found = 0;
  for (const uncle of getPreviousSiblings(currentAncestor).slice(0, MAX_SIBLINGS_SCANNED)) {
    const anchor = getMeaningfulAnchorSelector(uncle);
    if (!anchor) continue;
    found++;
    if (found > 3) break;

    const css1 = `${anchor} ~ ${currentAncestor.tagName.toLowerCase()} ${elSpec}`;
    const css2 = `${anchor} ~ ${currentAncestor.tagName.toLowerCase()} > ${elSpec}`;
    const css3 = `${anchor} ~ ${currentAncestor.tagName.toLowerCase()} ${tag}`;

    if (isUnique(css2)) {
      results.push({ type: 'parent-scoped', value: css2, cssSelector: css2, baseScore: score, level });
    } else if (isUnique(css1)) {
      results.push({ type: 'parent-scoped', value: css1, cssSelector: css1, baseScore: score, level });
    } else if (isUnique(css3)) {
      results.push({ type: 'parent-scoped', value: css3, cssSelector: css3, baseScore: score + PENALTIES.deep_chain, level });
    }
  }
}

function relationshipCandidates(el: Element, mode: HierarchyOption = locatorHierarchy): Candidate[] {
  const results: Candidate[] = [];
  const parent = el.parentElement;
  if (!parent || mode === '0') return results;

  if (mode === '1') {
    addSiblingCandidates(results, el, true);
    return results;
  }

  if (mode === '1+') {
    addSiblingCandidates(results, el, false);
    return results;
  }

  if (mode === '2') {
    addAncestorCandidates(results, el, parent, 2, false);
    return results;
  }

  if (mode === '2+') {
    let currentAncestor: Element | null = parent;
    let level = 2;

    while (currentAncestor) {
      addAncestorCandidates(results, el, currentAncestor, level, true);
      currentAncestor = currentAncestor.parentElement;
      level++;
    }
    return results;
  }

  const grandparent = parent.parentElement;
  if (!grandparent) return results;

  if (mode === '3') {
    addAncestorCandidates(results, el, grandparent, 3, false);
    return results;
  }

  let currentAncestor: Element | null = grandparent;
  let level = 3;

  while (currentAncestor) {
    addAncestorCandidates(results, el, currentAncestor, level, true);
    currentAncestor = currentAncestor.parentElement;
    level++;
  }

  return results;
}

// Get a minimal CSS specifier for the element (class, type attr, etc.) — not standalone unique
function getMinimalSelfSpecifier(el: Element): string | null {
  const tag = el.tagName.toLowerCase();

  // Try tag + type
  const type = el.getAttribute('type');
  if (type) {
    const s = `${tag}[type="${CSS.escape(type)}"]`;
    return s;
  }

  // Try tag + semantic class
  const semClass = Array.from(el.classList).find(c => !isUtilityClass(c) && !isDynamic(c));
  if (semClass) return `${tag}.${CSS.escape(semClass)}`;

  return tag;
}

// Get a meaningful, likely-unique selector for an element to use as an anchor
function getMeaningfulAnchorSelector(el: Element): string | null {
  const tag = el.tagName.toLowerCase();

  // Test IDs
  for (const attr of ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa']) {
    const val = el.getAttribute(attr);
    if (val && !isDynamic(val)) return `[${attr}="${CSS.escape(val)}"]`;
  }

  // Stable ID
  if (el.id && !isDynamic(el.id)) return `#${CSS.escape(el.id)}`;

  // Role + aria-label
  const role = el.getAttribute('role');
  const ariaLabel = el.getAttribute('aria-label');
  if (role && ariaLabel) return `[role="${role}"][aria-label="${CSS.escape(ariaLabel)}"]`;

  // name attribute
  const name = el.getAttribute('name');
  if (name && !isDynamic(name)) return `${tag}[name="${CSS.escape(name)}"]`;

  // Semantic class
  const semClass = Array.from(el.classList).find(c => !isUtilityClass(c) && !isDynamic(c));
  if (semClass) {
    const sel = `${tag}.${CSS.escape(semClass)}`;
    if (isUnique(sel)) return sel;
  }

  // Meaningful data-* attribute
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('data-') && attr.value && !isDynamic(attr.value) && attr.value.length < 40) {
      const sel = `${tag}[${attr.name}="${CSS.escape(attr.value)}"]`;
      if (isUnique(sel)) return sel;
    }
  }

  return null;
}

// ============================================================
// Phase 3: Structural fallback
// ============================================================

function structuralFallback(el: Element): Candidate[] {
  const results: Candidate[] = [];
  const tag = el.tagName.toLowerCase();

  // CSS with classes (may not be unique)
  const classes = Array.from(el.classList)
    .filter(c => !isDynamic(c) && !c.startsWith('_'))
    .slice(0, 3);

  if (classes.length) {
    const css = `${tag}.${classes.map(c => CSS.escape(c)).join('.')}`;
    results.push({
      type: 'css',
      value: css,
      cssSelector: css,
      baseScore: SCORES.css_structural,
      level: 0,
    });
  }

  // nth-child fallback (last resort)
  const parent = el.parentElement;
  if (parent) {
    const parentSel = getMeaningfulAnchorSelector(parent);
    const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);

    if (siblings.length === 1 && parentSel) {
      const css = `${parentSel} > ${tag}`;
      results.push({
        type: 'css',
        value: css,
        cssSelector: css,
        baseScore: SCORES.css_structural,
        level: 2,
      });
    } else if (parentSel) {
      const index = Array.from(parent.children).indexOf(el) + 1;
      const css = `${parentSel} > ${tag}:nth-child(${index})`;
      results.push({
        type: 'css',
        value: css,
        cssSelector: css,
        baseScore: SCORES.nth_child,
        level: 2,
      });
    } else {
      // Build recursive path up
      const css = buildRecursiveCss(el, 3);
      results.push({
        type: 'css',
        value: css,
        cssSelector: css,
        baseScore: SCORES.nth_child,
        level: 2,
      });
    }
  }

  return results;
}

function buildRecursiveCss(el: Element, maxDepth: number): string {
  const tag = el.tagName.toLowerCase();
  if (maxDepth <= 0 || !el.parentElement) return tag;

  const id = el.id;
  if (id && !isDynamic(id)) return `#${CSS.escape(id)}`;

  const parent = el.parentElement;
  const parentSel = buildRecursiveCss(parent, maxDepth - 1);
  const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);

  if (siblings.length === 1) return `${parentSel} > ${tag}`;

  const index = Array.from(parent.children).indexOf(el) + 1;
  return `${parentSel} > ${tag}:nth-child(${index})`;
}

// ============================================================
// Helpers for building CSS approximations
// ============================================================

function buildRoleCss(el: Element, role: string, accName: string): string {
  const tag = el.tagName.toLowerCase();
  const rolePrefix = el.getAttribute('role') ? `[role="${role}"]` : tag;

  // 1. aria-label — direct attribute match
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel === accName) return `${rolePrefix}[aria-label="${CSS.escape(accName)}"]`;

  // 2. aria-labelledby — match by attribute value (the referenced IDs)
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) return `${rolePrefix}[aria-labelledby="${CSS.escape(labelledBy)}"]`;

  // 3. For labeled form elements — use element ID
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return `#${CSS.escape(el.id)}`;
    }
  }

  // 4. title attribute
  const title = el.getAttribute('title');
  if (title === accName) return `${rolePrefix}[title="${CSS.escape(accName)}"]`;

  // 5. Fallback: role or tag only
  return rolePrefix;
}

function buildLabelCss(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, _label: string): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const type = el.getAttribute('type');
  if (type) return `${tag}[type="${CSS.escape(type)}"]`;
  return tag;
}

/** Text of a form control's <label> (via for/id or wrapping), without the control's own text. */
export function getAssociatedLabelText(el: Element): string | null {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement))
    return null;

  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label?.textContent) return label.textContent.trim();
  }

  const parentLabel = el.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, select, textarea').forEach(c => c.remove());
    const text = clone.textContent?.trim();
    if (text) return text;
  }

  return null;
}

// ============================================================
// Scoring — evaluate and rank candidates
// ============================================================

function scoreCandidates(candidates: Candidate[], el: Element): SelectorOption[] {
  const scored: SelectorOption[] = [];

  for (const c of candidates) {
    let score = c.baseScore;

    // --- Uniqueness check ---
    if (c.type === 'text') {
      // Text selectors: check uniqueness by finding elements with same text
      const unique = isTextUnique(el, c.value);
      if (!unique) score += PENALTIES.not_unique;
    } else if (c.cssSelector) {
      // Broken (0 matches) and ambiguous (2+) selectors are equally disqualified
      if (!isUnique(c.cssSelector)) {
        score += PENALTIES.not_unique;
      }
    }

    // --- Positional penalty ---
    if (c.cssSelector.includes('nth-child') || c.cssSelector.includes('nth-of-type')) {
      score += PENALTIES.positional;
    }

    // --- Deep chain penalty ---
    const combinatorCount = (c.cssSelector.match(/ > | /g) || []).length;
    if (combinatorCount > 2) {
      score += (combinatorCount - 2) * PENALTIES.deep_chain;
    }

    // --- Long selector penalty ---
    if (c.value.length > 40) {
      score += Math.floor((c.value.length - 40) / 20) * PENALTIES.long_selector;
    }

    scored.push({
      type: c.type,
      value: c.value,
      score,
    });
  }

  // Sort: lower score = better. Tiebreak: shorter, simpler, non-positional
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    // Prefer non-positional
    const aPosn = a.value.includes('nth-child') ? 1 : 0;
    const bPosn = b.value.includes('nth-child') ? 1 : 0;
    if (aPosn !== bPosn) return aPosn - bPosn;
    // Prefer shorter
    return a.value.length - b.value.length;
  });

  return scored;
}

function isTextUnique(el: Element, text: string): boolean {
  const tag = el.tagName.toLowerCase();
  return memoized(`text\u0000${tag}\u0000${text}`, () => {
    // Check all visible same-tag elements for matching text
    let count = 0;
    for (const c of Array.from(document.querySelectorAll(tag))) {
      if (!isVisible(c)) continue;
      if ((c as HTMLElement).innerText?.trim() === text) {
        count++;
        if (count > 1) return false;
      }
    }
    return count === 1;
  });
}

// ============================================================
// Debug logging — print locators to console grouped by hierarchy level
// ============================================================

const LEVEL_LABELS: Record<number, string> = {
  0: 'Level 0 (self)',
  1: 'Level 1 (siblings)',
  2: 'Level 2 (parent)',
};

function getLevelLabel(level: number): string {
  return LEVEL_LABELS[level] || `Level ${level} (ancestor)`;
}

function logCandidatesByLevel(el: Element, candidates: Candidate[], scored: SelectorOption[], primaryValue: string) {
  const tag = el.tagName.toLowerCase();
  const text = (el as HTMLElement).innerText?.trim().slice(0, 30) || '';
  const header = text ? `<${tag}> "${text}"` : `<${tag}>`;

  // Build a score lookup from scored results
  const scoreMap = new Map<string, number>();
  for (const s of scored) {
    scoreMap.set(s.value, s.score);
  }

  // Bucket candidates by level
  const byLevel = new Map<number, Candidate[]>();
  for (const c of candidates) {
    const arr = byLevel.get(c.level) || [];
    arr.push(c);
    byLevel.set(c.level, arr);
  }

  const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);

  const lines: string[] = [`[StepsToCase] Selectors for ${header}`];

  for (const level of levels) {
    const bucket = byLevel.get(level)!;
    lines.push(`  ${getLevelLabel(level)}:`);
    for (const c of bucket) {
      const finalScore = scoreMap.get(c.value) ?? c.baseScore;
      const isPrimary = c.value === primaryValue;
      const marker = isPrimary ? '\u2605 ' : '  ';
      const pad = `${c.type}:${finalScore}`.padEnd(20);
      lines.push(`    ${marker}${pad} ${c.value}`);
    }
  }

  console.log(lines.join('\n'));
}

// ============================================================
// Main entry point
// ============================================================

export function generateSelectors(el: Element): Selectors {
  uniqueMemo = new Map();
  // Phase 1: Check the element itself
  const self = selfCandidates(el);

  // Check if any self-candidate is strong and unique — if so, we can stop early
  // "Strong" = in the first half of the locator list or has a low base score
  const strongThreshold = Math.max(30, Math.floor(locatorAttrs.length * 5 / 2));
  const strongSelf = self.find(c => {
    if (c.baseScore > strongThreshold) return false;
    if (c.type === 'text') return isTextUnique(el, c.value);
    return c.cssSelector ? isUnique(c.cssSelector) : false;
  });

  let allCandidates: Candidate[];

  if (strongSelf) {
    // Strong self-signal found, still collect others for alternatives
    allCandidates = self;
  } else {
    // Phase 2: Relationship-based selectors
    const relationships = relationshipCandidates(el);
    allCandidates = [...self, ...relationships];
  }

  // Phase 3: Always add structural fallback as last resort
  const fallbacks = structuralFallback(el);
  allCandidates = [...allCandidates, ...fallbacks];

  // Deduplicate by value
  const seen = new Set<string>();
  allCandidates = allCandidates.filter(c => {
    if (seen.has(c.value)) return false;
    seen.add(c.value);
    return true;
  });

  // Score and rank
  const scored = scoreCandidates(allCandidates, el);

  // Filter out non-unique (score >= 1000) for primary, but keep in alternatives for context
  const viable = scored.filter(s => s.score < PENALTIES.not_unique);
  const primary = viable[0] || scored[0] || {
    type: 'css' as SelectorType,
    value: el.tagName.toLowerCase(),
    score: 100,
  };

  // Alternatives: up to 4 more, preferring viable ones
  const alternatives = scored
    .filter(s => s.value !== primary.value)
    .slice(0, 4);

  // Debug: log locators grouped by hierarchy level to the page console
  if (selectorDebugMode) {
    logCandidatesByLevel(el, allCandidates, scored, primary.value);
  }

  // contextText is set by Algorithm 1 (findDescription) in the content script.
  return { primary, alternatives };
}
