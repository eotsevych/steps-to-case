/**
 * Inputs that hold a secret. A "show password" toggle turns a password input into
 * type="text", and frameworks like React mirror the typed value into the `value`
 * attribute, so `type === 'password'` alone lets the secret leave the page.
 */

const formerPasswordInputs = new WeakSet<Element>();
let typeObserver: MutationObserver | null = null;

export function isSecretInput(el: Element): boolean {
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.type === 'password' || formerPasswordInputs.has(el)) return true;
  return /\b(current|new)-password\b/i.test(el.getAttribute('autocomplete') ?? '');
}

/** Remember every input that switches away from type="password" while the page is open. */
export function watchSecretInputs(): void {
  if (typeObserver) return;
  typeObserver = new MutationObserver(records => {
    for (const record of records) {
      if (record.oldValue?.toLowerCase() === 'password') formerPasswordInputs.add(record.target as Element);
    }
  });
  // ponytail: an input toggled before this starts (or re-created by the toggle) is only caught by autocomplete
  typeObserver.observe(document, { subtree: true, attributes: true, attributeFilter: ['type'], attributeOldValue: true });
}
