/**
 * What could tell a picked container from its look-alikes (the other rows or cards):
 * its texts and attributes, each with the look-alikes that have the same value.
 * The tester chooses; nothing here decides the identity.
 */

import type { ContainerIdentityCandidate } from '../types';
import { isUtilityClass, rootOf } from './selectorGenerator';

const TEST_ATTRS = ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa'];
const IDENTITY_ATTRS = new Set(['id', 'name', 'title', 'aria-label']);
const NO_TEXT_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
const MAX_VALUE_LENGTH = 80;
const MAX_TEXT_CANDIDATES = 12;
// shortcut: only the first 200 look-alikes are compared, so a longer table can hide a duplicate; raise it if testers hit that
const MAX_SIMILAR = 200;

/** Text an element holds itself, without the text of its children. */
function ownText(el: Element): string {
  // Text nodes side by side are one text (React renders "(17)" as "(" + "17" + ")"): a space only where a child element stands
  return Array.from(el.childNodes)
    .map(node => (node.nodeType === Node.TEXT_NODE ? node.textContent : node.nodeType === Node.ELEMENT_NODE ? ' ' : ''))
    .join('').replace(/\s+/g, ' ').trim();
}

const semanticClass = (el: Element) => Array.from(el.classList).find(c => !isUtilityClass(c));

/** Short CSS for an element inside the container: test id, else tag.class, else tag. */
function hint(el: Element): string {
  for (const attr of TEST_ATTRS) {
    const value = el.getAttribute(attr);
    if (value) return `[${attr}="${CSS.escape(value)}"]`;
  }
  const tag = el.tagName.toLowerCase();
  const cls = semanticClass(el);
  return cls ? `${tag}.${CSS.escape(cls)}` : tag;
}

/** Containers of the same kind: same tag and class anywhere in the tree, or same-tag siblings when there is no class. */
function similarContainers(container: Element): Element[] {
  const cls = semanticClass(container);
  const pool = cls
    ? Array.from(rootOf(container).querySelectorAll(`${container.tagName.toLowerCase()}.${CSS.escape(cls)}`))
    : Array.from(container.parentElement?.children ?? []).filter(el => el.tagName === container.tagName);
  return pool
    .filter(el => el !== container && !el.contains(container) && !container.contains(el))
    .slice(0, MAX_SIMILAR);
}

export function collectContainerIdentity(container: Element): {
  identityCandidates: ContainerIdentityCandidate[];
  similarContainers: number;
} {
  const similar = similarContainers(container);
  const candidates: ContainerIdentityCandidate[] = [];
  const add = (source: string, value: string, hasSame: (other: Element) => boolean) => {
    if (!value || value.length > MAX_VALUE_LENGTH || candidates.some(c => c.source === source && c.value === value)) return;
    candidates.push({ source, value, sharedWith: similar.flatMap((other, i) => (hasSame(other) ? [i] : [])) });
  };

  // Texts first: the name on a card is what a tester reads
  const text = ownText(container);
  add('text', text, other => ownText(other) === text);
  for (const el of Array.from(container.querySelectorAll('*'))) {
    if (candidates.length >= MAX_TEXT_CANDIDATES) break;
    if (NO_TEXT_TAGS.has(el.tagName)) continue;
    const elText = ownText(el);
    const source = hint(el);
    add(source, elText, other => Array.from(other.querySelectorAll(source)).some(o => ownText(o) === elText));
  }

  for (const attr of Array.from(container.attributes)) {
    if (IDENTITY_ATTRS.has(attr.name) || attr.name.startsWith('data-')) {
      add(`@${attr.name}`, attr.value.trim(), other => other.getAttribute(attr.name) === attr.value);
    }
  }

  return { identityCandidates: candidates, similarContainers: similar.length };
}
