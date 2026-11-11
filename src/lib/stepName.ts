import type { Action } from '../types';

/** Extract a human-readable name from a CSS selector fragment. */
function extractReadableFragment(fragment: string): string | null {
  // Try attribute value: [data-testid="email"] → "email"
  const attrMatch = fragment.match(/\[[\w-]+="([^"]+)"\]/);
  if (attrMatch) return attrMatch[1];

  // Try ID: "#my-element" → "my-element"
  const idMatch = fragment.match(/#([a-zA-Z][\w-]*)/);
  if (idMatch) return idMatch[1];

  // Try class name: "div.switch-button" → "switch-button"
  const classMatch = fragment.match(/\.([a-zA-Z][\w-]*)/);
  if (classMatch) return classMatch[1];

  return null;
}

/**
 * Derive a human-readable element name for step descriptions.
 * Falls back through element metadata, then selector info, before resorting to bare <tagName>.
 */
export function getElementName(action: Action): string {
  const el = action.element;
  const hasDescriptionHierarchy = action.selectors?.descriptionHierarchy !== undefined;

  // 1. Hierarchy-driven description text
  if (action.selectors?.contextText) return action.selectors.contextText;

  // 2. Rich element metadata
  // If description hierarchy ran and found nothing, respect that result instead
  // of silently switching to label/accessibility-derived text from elsewhere.
  if (!hasDescriptionHierarchy) {
    const isSelect = el.tagName?.toLowerCase() === 'select';
    const textOrInner = isSelect ? '' : (el.innerText || el.textContent);
    const metaName = el.accessibleName || textOrInner
      || el.label || el.placeholder || el.title || el.ariaLabel;
    if (metaName) return metaName;
  }

  // 3. Try to extract a readable name from the primary selector
  const sel = action.selectors?.primary;
  if (sel) {
    // For selector types that carry a meaningful human-readable value
    switch (sel.type) {
      case 'testid':
      case 'id':
      case 'name':
      case 'aria':
      case 'alt':
      case 'title':
      case 'label':
      case 'placeholder':
      case 'text':
      case 'data-attr':
      case 'href':
      case 'role':
        if (sel.value) return sel.value;
        break;
    }

    // For sibling/parent-scoped selectors, extract the anchor part (before ~ or > or space)
    // e.g. "#property_fallbackReader ~ div.switch-button-background" → "#property_fallbackReader" → "property_fallbackReader"
    if (sel.type === 'sibling' || sel.type === 'parent-scoped') {
      const anchorPart = sel.value.split(/\s*[~>]\s*|\s+/)[0];
      if (anchorPart) {
        const readable = extractReadableFragment(anchorPart);
        if (readable) return readable;
      }
    }

    // For other CSS selectors, extract a readable fragment from the whole value
    if (sel.value) {
      const readable = extractReadableFragment(sel.value);
      if (readable) return readable;
    }
  }

  // 4. Check element attributes directly for any useful info
  if (el.attributes) {
    for (const attr of ['data-testid', 'data-test', 'data-qa', 'data-name', 'data-field', 'name', 'id']) {
      const val = el.attributes[attr];
      if (val) return val;
    }
    // Try class attribute — pick the first semantic-looking class
    const cls = el.attributes['class'];
    if (cls) {
      const classes = cls.split(/\s+/).filter(c => c.length > 2 && !/^(p|m|px|py|mx|my|w|h|flex|grid|gap|text|font|bg|border|rounded|shadow)-/.test(c));
      if (classes.length > 0) return classes[0];
    }
  }

  // 5. Last resort
  return `<${el.tagName}>`;
}

/**
 * Placeholder for the element name inside a user-edited step description.
 * Custom step text is stored as a template (e.g. `Select {name} method`) so the
 * element name stays a live description-picker chip: the user owns the wording
 * around it, the picker owns the name itself.
 */
export const NAME_TOKEN = '{name}';

/** Substitute the current element name into a custom step-text template. */
export function expandNameTemplate(template: string, action: Action): string {
  return template.split(NAME_TOKEN).join(getElementName(action));
}

/** Custom step text with the {name} token resolved; undefined when unset. */
export function resolveCustomText(action: Action): string | undefined {
  return action.customText ? expandNameTemplate(action.customText, action) : undefined;
}
