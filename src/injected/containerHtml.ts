/**
 * Strips a container element's outerHTML of noise (styles, scripts, event handlers,
 * long attributes, SVGs) so an LLM can use the structural context for locator generation.
 */

import { isSecretInput } from './secretInputs';

const REMOVE_TAGS = new Set(['script', 'style', 'svg']);
const STRIP_ATTRS = new Set(['style', 'src', 'srcset']);
const EVENT_ATTR_RE = /^on/i;
const SVG_PATH_ATTRS = new Set(['d', 'points']);
const MAX_ATTR_LEN = 100;
const MAX_HTML_LEN = 2000;

export function stripContainerHtml(container: Element): string {
  const clone = container.cloneNode(true) as Element;

  // A secret input's typed value can sit in its `value` attribute; the clone has the same shape, so match by index
  const originals = [container, ...Array.from(container.querySelectorAll('*'))];
  const copies = [clone, ...Array.from(clone.querySelectorAll('*'))];
  originals.forEach((el, i) => { if (isSecretInput(el)) copies[i].removeAttribute('value'); });

  // Remove noisy child elements entirely
  for (const tag of REMOVE_TAGS) {
    const els = clone.querySelectorAll(tag);
    for (let i = els.length - 1; i >= 0; i--) {
      els[i].remove();
    }
  }

  // Walk all elements and clean attributes
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
  let node: Element | null = clone;
  while (node) {
    const attrs = Array.from(node.attributes);
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();

      if (STRIP_ATTRS.has(name) || EVENT_ATTR_RE.test(name) || SVG_PATH_ATTRS.has(name)) {
        node.removeAttribute(attr.name);
        continue;
      }

      // Truncate long attribute values
      if (attr.value.length > MAX_ATTR_LEN) {
        node.setAttribute(attr.name, attr.value.slice(0, MAX_ATTR_LEN));
      }
    }
    node = walker.nextNode() as Element | null;
  }

  // Get outerHTML and collapse whitespace
  let html = clone.outerHTML.replace(/\s+/g, ' ').trim();

  // Truncate if needed
  if (html.length > MAX_HTML_LEN) {
    html = html.slice(0, MAX_HTML_LEN) + '<!-- truncated -->';
  }

  return html;
}
