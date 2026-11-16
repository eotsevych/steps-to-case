/**
 * Inputs that hold a secret. A "show password" toggle turns a password input into
 * type="text", and frameworks like React mirror the typed value into the `value`
 * attribute, so `type === 'password'` alone lets the secret leave the page.
 *
 * A shown password is told from a plain text field in three ways:
 *  1. it was seen as type="password" before, in the document or in an open shadow root;
 *  2. it took the place of such an input (the page swapped the element instead of changing its type);
 *  3. it is called a password: by its attributes, its label, or a "Hide password" control next to it.
 * Only 3 is left when the password was shown before this script was on the page.
 */

import { getAccessibleName } from './selectorGenerator';

const secretInputs = new WeakSet<Element>();
const watchedRoots = new WeakSet<Node>();
let secretSeen = false; // nothing can be replaced before the first secret input is known
let watching = false;

function remember(input: Element) {
  secretInputs.add(input);
  secretSeen = true;
}

// Matches autocomplete="current-password" / "new-password" too. Masking a field too many is the safe mistake.
const SECRET_NAME = /passw|passphrase|pwd|парол/i;
const NAMING_ATTRS = ['autocomplete', 'name', 'id', 'placeholder', 'aria-label'];
// "Hide password", "Toggle password visibility", "Сховати пароль" — not "Reset password", which sits next to an email
const TOGGLE_NAME = /(show|hide|reveal|toggle|view|mask|показ|схова|прихова|скры)\S*\s.{0,20}(passw|парол)/i;
// Inputs nobody types a secret into; their value is a label or a flag
const NOT_TYPED = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'file', 'range', 'color']);

/** A wrapper that holds only this input and a control like "Hide password": the field is a shown password. */
function hasPasswordToggle(el: HTMLInputElement): boolean {
  let box = el.parentElement;
  for (let level = 0; box && level < 3; level++, box = box.parentElement) {
    if (Array.from(box.querySelectorAll('input')).some(i => i !== el && !NOT_TYPED.has(i.type) && i.type !== 'hidden')) return false;
    for (const control of Array.from(box.querySelectorAll('button, label, [role="button"], [aria-label], [title]'))) {
      if (control === el) continue;
      const name = `${control.getAttribute('aria-label') ?? ''} ${control.getAttribute('title') ?? ''} ${control.textContent ?? ''}`;
      if (TOGGLE_NAME.test(name)) return true;
    }
  }
  return false;
}

export function isSecretInput(el: Element): boolean {
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.type === 'password' || secretInputs.has(el)) return true;
  if (NOT_TYPED.has(el.type)) return false;
  const called = NAMING_ATTRS.some(attr => SECRET_NAME.test(el.getAttribute(attr) ?? ''))
    || SECRET_NAME.test(getAccessibleName(el))
    || hasPasswordToggle(el);
  if (called) remember(el);
  return called;
}

/** Every input under `node`, through open shadow roots; `onRoot` is told about each shadow root on the way. */
function deepInputs(node: Node, onRoot?: (root: ShadowRoot) => void): HTMLInputElement[] {
  if (!(node instanceof Element || node instanceof Document || node instanceof ShadowRoot)) return [];
  const found = node instanceof HTMLInputElement ? [node] : Array.from(node.querySelectorAll('input'));
  const hosts = Array.from(node.querySelectorAll('*'));
  if (node instanceof Element) hosts.push(node);
  for (const host of hosts) {
    if (!host.shadowRoot) continue;
    onRoot?.(host.shadowRoot);
    found.push(...deepInputs(host.shadowRoot, onRoot));
  }
  return found;
}

// Secret inputs that just left the page, kept for a moment so their replacement can be matched
let gone: Array<{ input: HTMLInputElement; parent: Node | null; at: number }> = [];
const REPLACE_WINDOW_MS = 1000;

/** True when `input` stands where the removed secret input stood: same value, id or name, or swapped in place. */
function replaces(input: HTMLInputElement, parent: Node | null, old: (typeof gone)[number]): boolean {
  return (old.input.value !== '' && input.value === old.input.value)
    || (old.input.id !== '' && input.id === old.input.id)
    || (old.input.name !== '' && input.name === old.input.name)
    || (old.parent !== null && old.parent === parent);
}

const observer = new MutationObserver(records => {
  const now = Date.now();
  for (const record of records) {
    if (record.type === 'attributes') {
      if (record.oldValue?.toLowerCase() === 'password') remember(record.target as Element);
    } else if (secretSeen) {
      for (const node of Array.from(record.removedNodes)) {
        for (const input of deepInputs(node)) {
          // parent is known only for a direct swap; an input inside a removed wrapper is matched by value, id or name
          if (secretInputs.has(input)) gone.push({ input, parent: node === input ? record.target : null, at: now });
        }
      }
    }
  }

  // A moved input comes back connected: it was not replaced
  gone = gone.filter(old => now - old.at < REPLACE_WINDOW_MS && !old.input.isConnected);
  if (!gone.length) return;
  for (const record of records) {
    for (const node of Array.from(record.addedNodes)) {
      for (const input of deepInputs(node, watchRoot)) {
        if (secretInputs.has(input) || NOT_TYPED.has(input.type)) continue;
        if (gone.some(old => replaces(input, node === input ? record.target : null, old))) remember(input);
      }
    }
  }
});

function watchRoot(root: Document | ShadowRoot) {
  if (watchedRoots.has(root)) return;
  watchedRoots.add(root);
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['type'], attributeOldValue: true });
}

/** Remember the password inputs that exist now, in the document and in every open shadow root, and watch those trees. */
function scan() {
  for (const input of deepInputs(document, watchRoot)) {
    if (input.type === 'password') remember(input);
  }
}

/**
 * Remember every input that is a password field, so it stays secret after the page shows it as text.
 * Runs from page load, not from the start of a recording: a password can be shown before the recording starts.
 */
export function watchSecretInputs(): void {
  if (watching) return;
  watching = true;
  watchRoot(document);
  scan();
  // A person shows a password with a click or a key press: look at the page right before the page reacts to it.
  // This also finds fields and shadow roots the page added after it loaded.
  window.addEventListener('pointerdown', event => { if (event.isTrusted) scan(); }, true);
  window.addEventListener('keydown', event => { if (event.isTrusted && (event.key === 'Enter' || event.key === ' ')) scan(); }, true);
  // shortcut: a field shown as text with no click or key press before it (a timer, a hover) and never focused while
  // it was a password is only caught by what it is called; scan on a timer if such pages turn up
  window.addEventListener('focusin', event => {
    const target = event.composedPath()[0];
    if (target instanceof HTMLInputElement && target.type === 'password') remember(target);
  }, true);
}
