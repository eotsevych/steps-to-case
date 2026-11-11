// Content script that runs in isolated world but has full DOM access.

import type { ActionType, DescriptionAnchor, TriggeredRequest } from '../types';
import {
  collectAllDescriptionCandidates,
  collectElementInfo,
  collectPageContext,
  findDescription,
  getDescriptionAnchors,
  getDescriptionHierarchy,
  setDescriptionAnchors,
  setDescriptionHierarchy,
} from '../injected/metadataCollector';
import {
  generateSelectors,
  setCustomSelectorAttributes,
  setLocatorAttributes,
  setLocatorHierarchy,
  setSelectorDebugMode,
} from '../injected/selectorGenerator';
import { stripContainerHtml } from '../injected/containerHtml';
import {
  DEFAULT_SETTINGS,
  type PageRecognitionRule,
  type ComponentRecognitionRule,
} from '../lib/settings';
import { PASSWORD_MASK } from '../lib/exporter';
import {
  DEFAULT_DESCRIPTION_HIERARCHY,
  legacyHighToHierarchy,
  normalizeHierarchyOption,
} from '../lib/hierarchy';

let debugMode = false;

// Runs in every frame (manifest all_frames). The picker and message replies stay in the top frame.
const IS_TOP_FRAME = window === window.top;

let isRecording = false;
let isPickingElement = false;
let highlightOverlay: HTMLElement | null = null;
let pickerBanner: HTMLElement | null = null;
let targetHighlightOverlay: HTMLElement | null = null;
let containerPickTargetEl: Element | null = null;
let isContainerPicking = false; // true when picking a container (pre-pick or post-hoc)
let walkEl: Element | null = null;
let walkStack: Element[] = [];
let pickerHoverRawEl: Element | null = null; // exact element under the cursor, for descending
let pickerLeftShiftPressed = false;
let lastInputElement: Element | null = null;
let lastInputValue = '';
let fillDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Update-in-place fill: track the last fill action so slow typing updates
// the existing step instead of creating duplicates
let lastFillActionId: string | null = null;
let lastFillTarget: Element | null = null;

// Page recognition rules loaded from settings
let pageRecognitionRules: PageRecognitionRule[] = [];

// Component recognition rules loaded from settings
let componentRecognitionRules: ComponentRecognitionRule[] = [];

function isExtensionContextInvalidatedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Extension context invalidated');
}

function teardownInvalidatedContext() {
  isRecording = false;
  isPickingElement = false;
  isContainerPicking = false;
  walkEl = null;
  walkStack = [];
  hideHighlight();
  hidePickerBanner();
  hideTargetHighlight();
  document.removeEventListener('mousemove', handleMouseOver, true);
  document.removeEventListener('keydown', handlePickerKeyDown, true);
  document.removeEventListener('keyup', handlePickerKeyUp, true);
  document.removeEventListener('wheel', handlePickerWheel, true);
  window.removeEventListener('blur', handlePickerWindowBlur);
  document.removeEventListener('mousedown', handleMouseDown, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('dblclick', handleDblClick, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('change', handleChange, true);
  document.removeEventListener('keydown', handleKeyDown, true);
}

/** A user-supplied selector from settings may be invalid; treat that rule as not matching. */
function safeSelectorTest(test: () => Element | null): boolean {
  try {
    return !!test();
  } catch {
    return false;
  }
}

function safeRuntimeSendMessage(message: unknown) {
  try {
    return chrome.runtime.sendMessage(message).catch((error) => {
      if (isExtensionContextInvalidatedError(error)) {
        console.warn('[StepsToCase] Extension context invalidated. Reload the page after reloading the extension.');
        teardownInvalidatedContext();
        return undefined;
      }
      return undefined;
    });
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      console.warn('[StepsToCase] Extension context invalidated. Reload the page after reloading the extension.');
      teardownInvalidatedContext();
      return Promise.resolve(undefined);
    }
    throw error;
  }
}

function applyRecorderSettings(rawSettings: unknown) {
  const s = rawSettings && typeof rawSettings === 'object'
    ? rawSettings as Partial<{
        debugMode: boolean;
        customAttributes: string[];
        descriptionHierarchy: string;
        locatorHierarchy: string;
        high: number;
        descriptionAnchors: DescriptionAnchor[];
        locatorAttributes: typeof DEFAULT_SETTINGS.locatorAttributes;
        pageRecognitionRules: PageRecognitionRule[];
        componentRecognitionRules: ComponentRecognitionRule[];
      }>
    : {};

  const nextDescriptionHierarchy = normalizeHierarchyOption(
    s.descriptionHierarchy,
    DEFAULT_DESCRIPTION_HIERARCHY
  );
  const nextLocatorHierarchy = normalizeHierarchyOption(
    s.locatorHierarchy,
    legacyHighToHierarchy(s.high)
  );
  const nextDescriptionAnchors = Array.isArray(s.descriptionAnchors)
    ? s.descriptionAnchors
    : DEFAULT_SETTINGS.descriptionAnchors;
  const nextLocatorAttributes = Array.isArray(s.locatorAttributes)
    ? s.locatorAttributes
    : DEFAULT_SETTINGS.locatorAttributes;

  debugMode = !!s.debugMode;
  setCustomSelectorAttributes(Array.isArray(s.customAttributes) ? s.customAttributes : []);
  setDescriptionHierarchy(nextDescriptionHierarchy);
  setLocatorHierarchy(nextLocatorHierarchy);
  setSelectorDebugMode(debugMode);
  setDescriptionAnchors(nextDescriptionAnchors);
  setLocatorAttributes(nextLocatorAttributes);
  pageRecognitionRules = Array.isArray(s.pageRecognitionRules) ? s.pageRecognitionRules : [];
  componentRecognitionRules = Array.isArray(s.componentRecognitionRules) ? s.componentRecognitionRules : [];

  if (debugMode) {
    console.log('[StepsToCase] Settings applied', {
      descriptionHierarchy: nextDescriptionHierarchy,
      locatorHierarchy: nextLocatorHierarchy,
      descriptionAnchors: nextDescriptionAnchors.map(anchor => anchor.attr),
    });
  }
}

// Dedup: skip browser-forwarded clicks on the same element (e.g. label → input)
let lastClickTarget: Element | null = null;
let lastClickTime = 0;
// Step id of the last recorded click, replaced if it turns out to start a double-click
let lastClickActionId: string | null = null;

// Dedup: skip native <select> change when custom select already recorded
let lastSelectTarget: Element | null = null;
let lastSelectTime = 0;

// ARIA listbox option clicks are committed on mousedown/mouseup and the
// option is detached before `click` fires. Track the most recent mousedown
// on a `[role="option"]` so the trailing click event can be suppressed.
let lastOptionMouseDownTs = 0;
let lastOptionMouseDownEl: Element | null = null;

// Fix #5: Track network requests triggered by actions
let pendingRequests: TriggeredRequest[] = [];
let lastActionId: string | null = null;
let requestFlushTimer: ReturnType<typeof setTimeout> | null = null;
const requestObserver = new PerformanceObserver((list) => {
  if (!isRecording) return;
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'resource') {
      const res = entry as PerformanceResourceTiming & { responseStatus?: number };
      // Skip extension resources and data URIs
      if (res.name.startsWith('chrome-extension://') || res.name.startsWith('data:')) continue;
      pendingRequests.push({
        url: res.name,
        method: '', // Resource Timing doesn't expose the method; empty is dropped on export
        status: res.responseStatus || undefined, // 0 = unknown (cross-origin without Timing-Allow-Origin)
        type: res.initiatorType,
        duration: Math.round(res.duration),
      });
    }
  }
});

function startRequestTracking() {
  try {
    requestObserver.observe({ entryTypes: ['resource'] });
  } catch { /* not supported */ }
}

function stopRequestTracking() {
  try {
    requestObserver.disconnect();
  } catch { /* ignore */ }
}

function flushRequestsToLastAction() {
  if (lastActionId && pendingRequests.length > 0) {
    safeRuntimeSendMessage({
      type: 'ATTACH_REQUESTS',
      actionId: lastActionId,
      requests: [...pendingRequests],
    });
  }
  pendingRequests = [];
}

// ============================================================
// Element Picker Overlay
// ============================================================

function createHighlightOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'qa-recorder-highlight';
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    border: 2px solid #2563eb;
    background: rgba(37, 99, 235, 0.1);
    z-index: 2147483647;
    transition: none;
    display: none;
  `;
  (document.body ?? document.documentElement).appendChild(overlay);
  return overlay;
}

function createPickerBanner(): HTMLElement {
  const banner = document.createElement('div');
  banner.id = 'qa-recorder-picker-banner';
  banner.style.cssText = `
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    max-width: min(560px, calc(100vw - 24px));
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgba(15, 23, 42, 0.16);
    background: rgba(15, 23, 42, 0.9);
    color: #f8fafc;
    font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0.01em;
    text-align: center;
    pointer-events: none;
    z-index: 2147483647;
    display: none;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.24);
  `;
  banner.textContent = 'Alt/Shift+scroll or ↑/↓ arrows to navigate up/down the tree. Click to confirm, Esc to cancel.';
  (document.body ?? document.documentElement).appendChild(banner);
  return banner;
}

function highlightElement(el: Element) {
  if (!highlightOverlay) highlightOverlay = createHighlightOverlay();
  const rect = el.getBoundingClientRect();
  // Use amber for container picking, blue for element picking
  if (isContainerPicking) {
    highlightOverlay.style.border = '2px solid #f59e0b';
    highlightOverlay.style.background = 'rgba(245, 158, 11, 0.15)';
  } else {
    highlightOverlay.style.border = '2px solid #2563eb';
    highlightOverlay.style.background = 'rgba(37, 99, 235, 0.1)';
  }
  highlightOverlay.style.display = 'block';
  highlightOverlay.style.left = `${rect.left}px`;
  highlightOverlay.style.top = `${rect.top}px`;
  highlightOverlay.style.width = `${rect.width}px`;
  highlightOverlay.style.height = `${rect.height}px`;
}

function showPickerBanner() {
  if (!pickerBanner) pickerBanner = createPickerBanner();
  pickerBanner.style.display = 'block';
}

function hideHighlight() {
  if (highlightOverlay) highlightOverlay.style.display = 'none';
}

function hidePickerBanner() {
  if (pickerBanner) pickerBanner.style.display = 'none';
}

function findTargetElement(
  primarySelector: unknown,
  candidateSelectors?: unknown,
  targetText?: unknown
): Element | null {
  const candidates: string[] = [];
  if (typeof primarySelector === 'string' && primarySelector.trim()) {
    candidates.push(primarySelector.trim());
  }
  if (Array.isArray(candidateSelectors)) {
    for (const s of candidateSelectors) {
      if (typeof s === 'string' && s.trim() && !candidates.includes(s.trim())) {
        candidates.push(s.trim());
      }
    }
  }

  const cleanText = typeof targetText === 'string' ? targetText.trim().toLowerCase() : '';

  // 1. Try finding a selector that uniquely matches 1 element
  for (const sel of candidates) {
    try {
      const matches = document.querySelectorAll(sel);
      if (matches.length === 1) {
        return matches[0];
      }
    } catch {
      // ignore invalid selector
    }
  }

  // 2. If multiple elements match, try disambiguating with target text
  for (const sel of candidates) {
    try {
      const matches = Array.from(document.querySelectorAll(sel));
      if (matches.length > 0) {
        if (cleanText) {
          const textMatch = matches.find(el => {
            const elText = (el.textContent || '').trim().toLowerCase();
            return elText === cleanText || elText.includes(cleanText);
          });
          if (textMatch) return textMatch;
        }
        return matches[0];
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function updateTargetHighlight() {
  if (!targetHighlightOverlay || !containerPickTargetEl) return;
  if (targetHighlightOverlay.style.display === 'none') return;
  const rect = containerPickTargetEl.getBoundingClientRect();
  Object.assign(targetHighlightOverlay.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
}

function highlightTargetElement(
  selector: unknown,
  candidateSelectors?: unknown,
  targetText?: unknown
) {
  const el = findTargetElement(selector, candidateSelectors, targetText);
  if (!el) {
    if (debugMode) console.debug('[StepsToCase] Skipping container highlight: target element not found');
    return;
  }

  containerPickTargetEl = el;
  walkEl = el;
  walkStack = [];

  // Instant scroll with no animation so the user sees the recorded element
  try {
    el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
  } catch {
    // fallback
  }

  // Remove any legacy injected animation styles
  document.getElementById('qa-recorder-target-styles')?.remove();
  document.getElementById('qa-recorder-highlight-styles')?.remove();

  if (!targetHighlightOverlay) {
    targetHighlightOverlay = document.createElement('div');
    targetHighlightOverlay.id = 'qa-recorder-target-highlight';
    targetHighlightOverlay.style.cssText = `
      position: fixed; pointer-events: none;
      border: 2px solid #2563eb; background: rgba(37, 99, 235, 0.15);
      border-radius: 4px;
      z-index: 2147483646; display: none;
      animation: none !important;
      transition: none !important;
      box-shadow: none !important;
    `;
    (document.body ?? document.documentElement).appendChild(targetHighlightOverlay);
  }

  const rect = el.getBoundingClientRect();
  Object.assign(targetHighlightOverlay.style, {
    display: 'block',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  highlightElement(el);
}

function hideTargetHighlight() {
  if (targetHighlightOverlay) targetHighlightOverlay.style.display = 'none';
  containerPickTargetEl = null;
}

function describePickerElement(el: Element | null): string {
  if (!el) return 'null';
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const className = typeof (el as HTMLElement).className === 'string'
    ? (el as HTMLElement).className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')
    : '';
  const classes = className ? `.${className}` : '';
  return `${tag}${id}${classes}`;
}

function logPickerDebug(message: string, extra?: Record<string, unknown>) {
  if (!isPickingElement) return;
  if (extra) {
    console.log('[StepsToCase Picker]', message, extra);
    return;
  }
  console.log('[StepsToCase Picker]', message);
}

function isPickerUiElement(el: Element | null): boolean {
  if (!el) return false;
  return el === highlightOverlay
    || el === targetHighlightOverlay
    || el === pickerBanner
    || !!el.closest('#qa-recorder-highlight, #qa-recorder-picker-banner');
}

// Returns the element itself, only skipping the picker's own overlay/banner.
function getExactCandidate(el: Element | null): Element | null {
  let current = el;
  while (current && isPickerUiElement(current)) {
    current = current.parentElement;
  }
  return current;
}

function getWalkCandidate(el: Element | null): Element | null {
  const current = getExactCandidate(el);
  return current ? getClickableTarget(current) : null;
}

// Sets the walk element exactly as given — used by tree navigation, which
// must move one level at a time without snapping to clickable ancestors.
function applyWalkElement(el: Element) {
  walkEl = el;
  highlightElement(el);
  logPickerDebug('walk element updated', {
    walkEl: describePickerElement(el),
    stackDepth: walkStack.length,
  });
}

function getWalkParent(el: Element): Element | null {
  let parent = el.parentElement;
  while (parent && isPickerUiElement(parent)) {
    parent = parent.parentElement;
  }
  if (!parent || parent === document.documentElement) {
    return null;
  }
  return parent;
}

function handlePickerMove(event: MouseEvent) {
  if (!isPickingElement) return;

  const raw = document.elementFromPoint(event.clientX, event.clientY) ?? (event.target as Element | null);
  pickerHoverRawEl = getExactCandidate(raw);

  // Container picking targets the exact hovered element — snapping to a
  // "clickable" ancestor jumps to huge wrappers (tabpanels etc. carry tabindex).
  const target = isContainerPicking ? pickerHoverRawEl : getWalkCandidate(raw);
  if (!target) {
    logPickerDebug('mousemove ignored: no target', {
      x: event.clientX,
      y: event.clientY,
    });
    return;
  }
  if (target === walkEl && walkStack.length === 0) return;

  walkStack = [];
  logPickerDebug('mousemove target selected', {
    target: describePickerElement(target),
    x: event.clientX,
    y: event.clientY,
  });
  applyWalkElement(target);
}

function getPickerWheelDelta(event: WheelEvent): number {
  return Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
}

// Trackpads fire many small-delta wheel events per gesture; accumulate deltas
// and only step one tree level per threshold so a flick doesn't skip ancestors.
const PICKER_WHEEL_STEP_THRESHOLD = 60;
const PICKER_WHEEL_RESET_MS = 250;
let pickerWheelAccum = 0;
let pickerWheelLastTs = 0;

function consumePickerWheelStep(delta: number): boolean {
  const now = Date.now();
  if (now - pickerWheelLastTs > PICKER_WHEEL_RESET_MS) pickerWheelAccum = 0;
  pickerWheelLastTs = now;

  // Direction change discards leftover accumulation
  if (pickerWheelAccum !== 0 && Math.sign(delta) !== Math.sign(pickerWheelAccum)) {
    pickerWheelAccum = 0;
  }

  pickerWheelAccum += delta;
  if (Math.abs(pickerWheelAccum) < PICKER_WHEEL_STEP_THRESHOLD) return false;
  pickerWheelAccum = 0;
  return true;
}

function walkToParent() {
  if (!walkEl) return;
  const parent = getWalkParent(walkEl);
  if (!parent) {
    logPickerDebug('walk up: no parent available', {
      walkEl: describePickerElement(walkEl),
    });
    return;
  }
  walkStack.push(walkEl);
  logPickerDebug('walk up: moving to parent', {
    from: describePickerElement(walkEl),
    to: describePickerElement(parent),
    stackDepth: walkStack.length,
  });
  applyWalkElement(parent);
}

// When there is no walk-up history, descend one level into the current
// element: toward the hovered element if the cursor is inside it, otherwise
// into the first child.
function getDescendTarget(): Element | null {
  if (!walkEl) return null;

  if (pickerHoverRawEl && pickerHoverRawEl !== walkEl && walkEl.contains(pickerHoverRawEl)) {
    let child: Element | null = pickerHoverRawEl;
    while (child && child.parentElement !== walkEl) {
      child = child.parentElement;
    }
    if (child && !isPickerUiElement(child)) return child;
  }

  let fallback = walkEl.firstElementChild;
  while (fallback && isPickerUiElement(fallback)) {
    fallback = fallback.nextElementSibling;
  }
  return fallback;
}

function walkToChild() {
  if (!walkEl) return;
  const nextEl = walkStack.pop() ?? getDescendTarget();
  if (!nextEl) {
    logPickerDebug('walk down: no child available', {
      walkEl: describePickerElement(walkEl),
    });
    return;
  }
  logPickerDebug('walk down: moving to child', {
    from: describePickerElement(walkEl),
    to: describePickerElement(nextEl),
    stackDepth: walkStack.length,
  });
  applyWalkElement(nextEl);
}

function handlePickerKeyDown(event: KeyboardEvent) {
  if (!isPickingElement) return;
  if (event.code === 'ShiftLeft') {
    pickerLeftShiftPressed = true;
    logPickerDebug('left shift down', {
      code: event.code,
      key: event.key,
    });
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    logPickerDebug('escape pressed: cancelling pick');
    safeRuntimeSendMessage({ type: 'PICK_CANCELLED' });
    stopPicking();
    return;
  }

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.key === 'ArrowUp') {
      walkToParent();
    } else {
      walkToChild();
    }
  }
}

function handlePickerKeyUp(event: KeyboardEvent) {
  if (event.code === 'ShiftLeft') {
    pickerLeftShiftPressed = false;
    logPickerDebug('left shift up', {
      code: event.code,
      key: event.key,
    });
  }
}

function handlePickerWindowBlur() {
  pickerLeftShiftPressed = false;
  logPickerDebug('window blur: cleared left shift state');
}

function handlePickerWheel(event: WheelEvent) {
  if (!isPickingElement) return;
  const hasScrollModifier = event.altKey || event.shiftKey || pickerLeftShiftPressed;
  if (!hasScrollModifier) {
    logPickerDebug('wheel ignored: modifier not active', {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      leftShiftTracked: pickerLeftShiftPressed,
    });
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (!walkEl) {
    logPickerDebug('wheel ignored: walkEl is null');
    return;
  }

  const wheelDelta = getPickerWheelDelta(event);
  logPickerDebug('wheel received', {
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    wheelDelta,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    leftShiftTracked: pickerLeftShiftPressed,
    walkEl: describePickerElement(walkEl),
    stackDepth: walkStack.length,
  });

  if (wheelDelta === 0) return;
  if (!consumePickerWheelStep(wheelDelta)) return;

  if (wheelDelta < 0) {
    walkToParent();
  } else {
    walkToChild();
  }
}

// ============================================================
// Event Handlers
// ============================================================

// Inputs whose value is set through native UI (drag/picker) and reported via
// input/change events — the click that opens them must not become its own step.
const VALUE_CHANGE_INPUT_TYPES = ['range', 'color', 'date', 'time', 'datetime-local', 'month', 'week'];

// Focus targets, not click targets — never snap to these even with tabindex
const CONTAINER_ROLES = new Set(['tabpanel', 'dialog', 'region', 'main']);
// onclick/tabindex are weak clickability signals: UI libraries put tabindex="0"
// on large structural containers (tabpanels, editors, expanders), so only
// trust them close to the clicked element.
const WEAK_CLICKABLE_MAX_HOPS = 3;

function getClickableTarget(el: Element): Element {
  let target: Element | null = el;
  let hops = 0;
  while (target) {
    const tag = target.tagName.toLowerCase();
    const role = target.getAttribute('role');
    if (tag === 'a' || tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea') return target;
    if (role === 'button' || role === 'link' || role === 'menuitem' || role === 'option'
      || role === 'tab') return target;
    if (hops <= WEAK_CLICKABLE_MAX_HOPS
      && !(role && CONTAINER_ROLES.has(role))
      && (target.getAttribute('onclick') || target.getAttribute('tabindex'))) return target;
    // Also stop at li elements (dropdown items)
    if (tag === 'li') return target;
    target = target.parentElement;
    hops++;
  }
  return el;
}

function sendAction(type: ActionType, el: Element, extra?: Record<string, unknown>): string {
  if (!isRecording) return '';

  // Flush any pending network requests from previous action
  if (requestFlushTimer) clearTimeout(requestFlushTimer);
  flushRequestsToLastAction();

  const element = collectElementInfo(el);
  const page = collectPageContext();
  // Inside an iframe: the worker swaps in the tab's page; keep which frame the selectors belong to
  if (!IS_TOP_FRAME) {
    page.frameUrl = location.href.split(/[?#]/)[0];
    // A srcdoc/document.write frame reports its parent's URL, so the <iframe> element is the only way to name it.
    // frameElement is null for cross-origin frames; window.name still carries the name attribute there.
    const frameEl = window.frameElement;
    if (frameEl?.id) page.frameId = frameEl.id;
    const frameName = frameEl?.getAttribute('name') || window.name;
    if (frameName) page.frameName = frameName;
  }

  // Page recognition: check rules and tag the page context
  for (const rule of pageRecognitionRules) {
    if (rule.locator && safeSelectorTest(() => document.querySelector(rule.locator))) {
      page.pageTag = rule.tag;
      break;
    }
  }

  // Component recognition: tag the step if the element is inside a known component root
  let componentTag: string | undefined;
  for (const rule of componentRecognitionRules) {
    if (rule.ancestor && safeSelectorTest(() => el.closest(rule.ancestor))) {
      componentTag = rule.tag;
      break;
    }
  }

  // Algorithm 1: Find best text description using configurable anchors
  const description = findDescription(el, getDescriptionAnchors(), getDescriptionHierarchy());

  // Algorithm 2: Find best locator using configurable attribute list
  const selectors = generateSelectors(el);

  // Always override the fallback contextText from selector generation with
  // the actual description-algorithm result, even when it is empty.
  selectors.contextText = description.primaryText ?? '';
  selectors.descriptionHierarchy = description.mode;
  selectors.descriptionSource = description.sourceLabel;
  selectors.descriptionDepth = description.depth;
  selectors.descriptionCandidates = collectAllDescriptionCandidates(el, getDescriptionAnchors());

  // Generate a temporary ID for request tracking
  const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  safeRuntimeSendMessage({
    type: 'ACTION_CAPTURED',
    action: {
      id: tempId,
      type,
      timestamp: 0,
      element,
      page,
      selectors,
      actionData: extra || undefined,
      componentTag,
    },
  });

  // Start collecting network requests for this action. The background keeps
  // the content script's ID, so requests can be attached to it later — either
  // by the 2s timer below or by the early flush when the next action fires.
  lastActionId = tempId;
  pendingRequests = [];

  // Wait 2s then flush network requests
  requestFlushTimer = setTimeout(() => {
    flushRequestsToLastAction();
  }, 2000);

  return tempId;
}

// ============================================================
// Custom select widget detection (Select2, Chosen, React Select, Vue Select, role="option")
// ============================================================

const CUSTOM_SELECT_OPTION_SELECTORS = [
  '.select2-results__option',           // Select2
  '.chosen-results li',                 // Chosen
  //'[class*="-option"]',                 // React Select (e.g. css-1n7v3ny-option)
  '.vs__dropdown-option',              // Vue Select
];

function detectCustomSelectOption(
  clickTarget: Element,
  rawTarget: Element,
): { widget: Element; optionText: string } | null {
  // 1. Check role="option" (most universal — ARIA-compliant widgets)
  const roleOption = clickTarget.getAttribute('role') === 'option'
    ? clickTarget
    : rawTarget.closest('[role="option"]');
  if (roleOption) {
    const optionText = (roleOption as HTMLElement).innerText?.trim() || '';
    return { widget: findSelectWidget(roleOption) || roleOption, optionText };
  }

  // 2. Check known library-specific option selectors
  for (const selector of CUSTOM_SELECT_OPTION_SELECTORS) {
    const option = rawTarget.closest(selector);
    if (option) {
      const optionText = (option as HTMLElement).innerText?.trim() || '';
      return { widget: findSelectWidget(option) || option, optionText };
    }
  }

  return null;
}

/**
 * The field a dropdown option belongs to, so the step reads "Select X from Country",
 * not "from X": the hidden native <select> of Select2/Chosen, else the combobox
 * that points at the option's listbox via aria-controls / aria-owns.
 */
function findSelectWidget(option: Element): Element | null {
  const listboxId = option.closest('[role="listbox"]')?.id;
  const controller = listboxId
    ? document.querySelector(`[aria-controls~="${CSS.escape(listboxId)}"], [aria-owns~="${CSS.escape(listboxId)}"]`)
    : null;
  // Select2/Chosen insert their container right after the <select> they replace
  const hidden = (controller ?? option).closest('.select2-container, .chosen-container')?.previousElementSibling;
  return hidden?.tagName === 'SELECT' ? hidden : controller;
}

/** The real target, inside open shadow roots too (document listeners only see the host). */
function eventTarget(event: Event): Element | null {
  const first = event.composedPath()[0];
  return first instanceof Element ? first : (event.target as Element | null);
}

/** Send the debounced fill now — before a key press, a switch to another field, or stop. */
function flushPendingFill() {
  if (!fillDebounceTimer || !lastInputElement) return;
  clearTimeout(fillDebounceTimer);
  fillDebounceTimer = null;
  if (lastFillActionId && lastFillTarget === lastInputElement) {
    // Same field — update the existing fill step in place
    safeRuntimeSendMessage({ type: 'UPDATE_FILL', actionId: lastFillActionId, value: lastInputValue });
  } else {
    lastFillActionId = sendAction('fill', lastInputElement, { value: lastInputValue });
    lastFillTarget = lastInputElement;
  }
  lastInputElement = null;
  lastInputValue = '';
}

/**
 * Capture-phase mousedown handler that records selections on ARIA listbox
 * options before the widget tears down the DOM.
 *
 * Widgets like Select2/Chosen/headlessui commit on `mousedown` or `mouseup`
 * and remove the `<li role="option">` immediately, so a subsequent `click`
 * either never reaches us with the right target or fires on a stale parent.
 */
function handleMouseDown(event: MouseEvent) {
  if (!event.isTrusted) return;
  if (!isRecording) return;
  if (event.button !== 0) return;
  const target = eventTarget(event);
  if (!target) return;

  const customSelectOption = detectCustomSelectOption(target, target);
  if (!customSelectOption) return;

  lastOptionMouseDownTs = Date.now();
  lastOptionMouseDownEl = target;
  lastSelectTarget = customSelectOption.widget;
  lastSelectTime = lastOptionMouseDownTs;
  sendAction('select', customSelectOption.widget, {
    selectedOption: customSelectOption.optionText,
  });
}

function handleClick(event: MouseEvent) {
  if (!event.isTrusted) return;
  if (!isRecording && !isPickingElement) return;

  const target = eventTarget(event);
  if (!target) return;

  if (isPickingElement) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Use walkEl as-is — the user may have navigated to a specific ancestor;
    // re-snapping to a clickable target would silently change their choice.
    const pickedTarget = walkEl ?? getWalkCandidate(target);
    if (!pickedTarget) return;

    const elementInfo = collectElementInfo(pickedTarget);
    const selectors = generateSelectors(pickedTarget);
    const description = findDescription(pickedTarget, getDescriptionAnchors(), getDescriptionHierarchy());
    selectors.contextText = description.primaryText ?? '';
    selectors.descriptionHierarchy = description.mode;
    selectors.descriptionSource = description.sourceLabel;
    selectors.descriptionDepth = description.depth;
    selectors.descriptionCandidates = collectAllDescriptionCandidates(pickedTarget, getDescriptionAnchors());

    const pickedMessage: Record<string, unknown> = {
      type: 'ELEMENT_PICKED',
      elementInfo,
      selectors,
    };

    // Include stripped HTML when in container pick mode (pre-pick or post-hoc)
    if (containerPickTargetEl || isContainerPicking) {
      pickedMessage.containerHtml = stripContainerHtml(pickedTarget);
    }

    safeRuntimeSendMessage(pickedMessage);

    stopPicking();
    return;
  }

  // The 2nd click of a double-click: handleDblClick records the double-click itself
  if (event.detail > 1) return;
  lastClickActionId = null;

  // Skip the click that follows a mousedown we already recorded on a
  // `[role="option"]` element. The widget has likely torn down the option by
  // now, so the click event would either miss it or land on a stale parent.
  // Only suppress clicks that belong to that selection — the recorded option,
  // its widget, a detached node, or another option/listbox — so an unrelated
  // click shortly after the selection is still recorded.
  if (Date.now() - lastOptionMouseDownTs < 500) {
    const relatedToOption = lastOptionMouseDownEl
      && (target === lastOptionMouseDownEl || lastOptionMouseDownEl.contains(target) || target.contains(lastOptionMouseDownEl));
    const relatedToWidget = lastSelectTarget
      && (target === lastSelectTarget || lastSelectTarget.contains(target) || target.contains(lastSelectTarget));
    const looksLikeStaleOptionClick = !target.isConnected || !!target.closest('[role="option"], [role="listbox"]');
    if (relatedToOption || relatedToWidget || looksLikeStaleOptionClick) {
      return;
    }
  }

  let clickTarget = getClickableTarget(target);
  let tag = clickTarget.tagName.toLowerCase();

  // Resolve clicks on a <label> — or any element inside one, e.g. a custom
  // switch's slider <span> — to the associated control. Clicking such a label
  // toggles the control and the browser forwards a synthetic click to it; without
  // this the slider records a bogus `click` and the forwarded click records a
  // `check`, producing two steps for one toggle.
  if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') {
    const label = (tag === 'label' ? clickTarget : target.closest('label')) as HTMLLabelElement | null;
    if (label) {
      const input = label.htmlFor
        ? document.getElementById(label.htmlFor)
        : label.querySelector('input, select, textarea');
      if (input && ['input', 'select', 'textarea'].includes(input.tagName.toLowerCase())) {
        clickTarget = input;
        tag = input.tagName.toLowerCase();
      }
    }
  }

  // Dedup: skip browser-forwarded click on the same element within 50ms
  // (e.g. label click → browser forwards click to input → duplicate)
  const now = Date.now();
  if (clickTarget === lastClickTarget && now - lastClickTime < 50) {
    return;
  }
  lastClickTarget = clickTarget;
  lastClickTime = now;

  // Fix #2: Skip click on text input/textarea — typing will be captured as fill
  if (tag === 'input') {
    const inputType = ((clickTarget as HTMLInputElement).type || 'text').toLowerCase();
    // Read-only inputs (date pickers, comboboxes) are never typed into, so their click is the step
    if (['text', 'email', 'password', 'search', 'tel', 'url', 'number'].includes(inputType)
      && !(clickTarget as HTMLInputElement).readOnly) {
      // If clicking a different text input, reset the fill session
      if (lastFillTarget && lastFillTarget !== clickTarget) {
        lastFillActionId = null;
        lastFillTarget = null;
      }
      return;
    }
    // Skip click on value-picker inputs (range slider, color, date/time family).
    // The value change is captured by the input/change event as a single fill;
    // recording the click too would produce two steps for one interaction.
    if (VALUE_CHANGE_INPUT_TYPES.includes(inputType)) {
      if (lastFillTarget && lastFillTarget !== clickTarget) {
        lastFillActionId = null;
        lastFillTarget = null;
      }
      return;
    }
    // Skip click on checkbox/radio — captured by change event after state toggles
    if (inputType === 'checkbox' || inputType === 'radio') {
      return;
    }
  }
  if (tag === 'textarea') {
    if (lastFillTarget && lastFillTarget !== clickTarget) {
      lastFillActionId = null;
      lastFillTarget = null;
    }
    return;
  }
  // Skip click on select — captured by change event
  if (tag === 'select') {
    return;
  }
  // Skip click on contenteditable — captured by input event
  if ((clickTarget as HTMLElement).isContentEditable) {
    if (lastFillTarget && lastFillTarget !== clickTarget) {
      lastFillActionId = null;
      lastFillTarget = null;
    }
    return;
  }

  // Detect custom select widgets (Select2, Chosen, React Select, Vue Select, role="option")
  const customSelectOption = detectCustomSelectOption(clickTarget, target);
  if (customSelectOption) {
    lastSelectTarget = customSelectOption.widget;
    lastSelectTime = Date.now();
    sendAction('select', customSelectOption.widget, {
      selectedOption: customSelectOption.optionText,
    });
    return;
  }

  // Clicking a non-input element ends any active fill session
  lastFillActionId = null;
  lastFillTarget = null;

  lastClickActionId = sendAction('click', clickTarget, {
    button: event.button === 0 ? 'left' : event.button === 1 ? 'middle' : 'right',
    modifiers: [
      event.shiftKey && 'Shift',
      event.ctrlKey && 'Ctrl',
      event.altKey && 'Alt',
      event.metaKey && 'Meta',
    ].filter(Boolean) as string[],
  });
}

function handleDblClick(event: MouseEvent) {
  if (!event.isTrusted) return;
  if (!isRecording) return;
  const target = eventTarget(event);
  if (!target) return;
  const clickTarget = getClickableTarget(target);
  // The 1st click of this double-click was recorded as its own step — replace it
  if (lastClickActionId && lastClickTarget === clickTarget && Date.now() - lastClickTime < 1000) {
    safeRuntimeSendMessage({ type: 'DELETE_ACTION', actionId: lastClickActionId });
  }
  lastClickActionId = null;
  sendAction('dblclick', clickTarget);
}

function handleInput(event: Event) {
  if (!event.isTrusted) return;
  if (!isRecording) return;
  const target = eventTarget(event) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!target) return;

  const tag = target.tagName.toLowerCase();
  if (tag !== 'input' && tag !== 'textarea' && !(target as HTMLElement).isContentEditable) return;

  // Skip checkbox/radio — already handled by handleClick as check/uncheck
  if (tag === 'input') {
    const inputType = ((target as HTMLInputElement).type || 'text').toLowerCase();
    if (inputType === 'checkbox' || inputType === 'radio') return;
  }

  // Typing moved to another field before the debounce fired — save the previous field first
  if (lastInputElement && lastInputElement !== target) flushPendingFill();

  lastInputElement = target;
  // Never let a password leave the page: mask it before it is stored or shown
  const isPassword = tag === 'input' && (target as HTMLInputElement).type === 'password';
  lastInputValue = isPassword ? PASSWORD_MASK : (target.value ?? (target as HTMLElement).innerText ?? '');

  if (fillDebounceTimer) clearTimeout(fillDebounceTimer);
  fillDebounceTimer = setTimeout(flushPendingFill, 500);
}

function handleChange(event: Event) {
  if (!event.isTrusted) return;
  if (!isRecording) return;
  const target = eventTarget(event);
  if (!target) return;

  const tag = target.tagName.toLowerCase();
  if (tag === 'select') {
    // Skip if a custom select widget already recorded this selection
    if (target === lastSelectTarget && Date.now() - lastSelectTime < 500) {
      return;
    }
    const select = target as HTMLSelectElement;
    sendAction('select', target, {
      selectedOption: select.options[select.selectedIndex]?.text,
      value: select.value,
    });
  } else if (tag === 'input') {
    const input = target as HTMLInputElement;
    const inputType = (input.type || 'text').toLowerCase();
    if (inputType === 'checkbox' || inputType === 'radio') {
      sendAction(input.checked ? 'check' : 'uncheck', input);
    }
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (!event.isTrusted) return;
  if (!isRecording) return;
  // Picker owns keyboard input while active — don't record Esc/Enter/Tab presses
  if (isPickingElement) return;

  const keysToCapture = ['Enter', 'Escape', 'Tab'];
  if (!keysToCapture.includes(event.key)) return;

  const target = eventTarget(event) || document.body;

  // Enter in a multi-line field is a newline — part of the text, not a step
  const multiLine = target.tagName.toLowerCase() === 'textarea' || (target as HTMLElement).isContentEditable;
  if (event.key === 'Enter' && multiLine && !event.ctrlKey && !event.metaKey) return;

  // The key ends the fill session — save it first; further typing creates a new fill step
  flushPendingFill();
  lastFillActionId = null;
  lastFillTarget = null;

  // Tab only moves focus to the next field: it ends the fill but is not a step of its own
  if (event.key === 'Tab') return;

  sendAction('press', target, { key: event.key });
}

function handleMouseOver(event: MouseEvent) {
  handlePickerMove(event);
}

// ============================================================
// Lifecycle
// ============================================================

function startRecording() {
  if (isRecording) return;
  isRecording = true;
  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('dblclick', handleDblClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('change', handleChange, true);
  document.addEventListener('keydown', handleKeyDown, true);
  startRequestTracking();
  if (debugMode) console.log('[StepsToCase] Recording started');
}

function stopRecording() {
  // Flush the pending fill first — sendAction ignores calls once isRecording is false
  flushPendingFill();
  lastFillActionId = null;
  lastFillTarget = null;
  flushRequestsToLastAction();
  isRecording = false;
  stopRequestTracking();
  document.removeEventListener('mousedown', handleMouseDown, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('dblclick', handleDblClick, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('change', handleChange, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  if (debugMode) console.log('[StepsToCase] Recording stopped');
}

function startPicking() {
  isPickingElement = true;
  walkEl = containerPickTargetEl ?? document.documentElement;
  walkStack = [];
  pickerHoverRawEl = null;
  pickerLeftShiftPressed = false;
  pickerWheelAccum = 0;
  logPickerDebug('picker started', {
    containerTarget: describePickerElement(containerPickTargetEl),
    initialWalkEl: describePickerElement(walkEl),
  });
  showPickerBanner();
  if (containerPickTargetEl) {
    applyWalkElement(containerPickTargetEl);
  } else if (walkEl) {
    highlightElement(walkEl);
  }
  window.addEventListener('scroll', updateTargetHighlight, true);
  window.addEventListener('resize', updateTargetHighlight, true);
  document.addEventListener('mousemove', handleMouseOver, true);
  document.addEventListener('keydown', handlePickerKeyDown, true);
  document.addEventListener('keyup', handlePickerKeyUp, true);
  document.addEventListener('wheel', handlePickerWheel, { capture: true, passive: false });
  window.addEventListener('blur', handlePickerWindowBlur);
  document.addEventListener('click', handleClick, true);
}

function stopPicking() {
  logPickerDebug('picker stopped', {
    walkEl: describePickerElement(walkEl),
    stackDepth: walkStack.length,
  });
  isPickingElement = false;
  isContainerPicking = false;
  walkEl = null;
  walkStack = [];
  pickerHoverRawEl = null;
  pickerLeftShiftPressed = false;
  hideHighlight();
  hidePickerBanner();
  hideTargetHighlight();
  window.removeEventListener('scroll', updateTargetHighlight, true);
  window.removeEventListener('resize', updateTargetHighlight, true);
  document.removeEventListener('mousemove', handleMouseOver, true);
  document.removeEventListener('keydown', handlePickerKeyDown, true);
  document.removeEventListener('keyup', handlePickerKeyUp, true);
  document.removeEventListener('wheel', handlePickerWheel, true);
  window.removeEventListener('blur', handlePickerWindowBlur);
  if (!isRecording) {
    document.removeEventListener('click', handleClick, true);
  }
}

// ============================================================
// Message listener
// ============================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.source !== 'qa-recorder-control') return;

  if (!IS_TOP_FRAME) {
    // Frames record but never reply: the worker waits for the top frame's reply
    // (it flushes the pending fill), and the picker runs in the top frame only.
    if (message.type === 'START') startRecording();
    if (message.type === 'STOP') stopRecording();
    return;
  }

  try {
    switch (message.type) {
      case 'START':
        startRecording();
        sendResponse({ ok: true });
        break;
      case 'STOP':
        stopRecording();
        sendResponse({ ok: true });
        break;
      case 'PICK_ELEMENT':
        isContainerPicking = false;
        startPicking();
        sendResponse({ ok: true });
        break;
      case 'PICK_CONTAINER':
        isContainerPicking = true;
        startPicking();
        sendResponse({ ok: true });
        break;
      case 'CANCEL_PICK':
        stopPicking();
        sendResponse({ ok: true });
        break;
      case 'PICKER_NAV':
        // Arrow keys pressed while the panel has focus — forwarded via the SW
        if (isPickingElement) {
          if (message.direction === 'up') {
            walkToParent();
          } else {
            walkToChild();
          }
        }
        sendResponse({ ok: true });
        break;
      case 'HIGHLIGHT_AND_PICK':
        isContainerPicking = true;
        highlightTargetElement(message.selector, message.candidateSelectors, message.targetText);
        startPicking();
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ ok: false, error: `Unknown message type: ${String(message.type)}` });
        break;
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    console.warn('[StepsToCase] Content script message handler failed:', message.type, error);
    sendResponse({ ok: false, error: messageText });
  }
  return true;
});

// Load settings
chrome.storage.sync.get('recorderSettings').then(result => {
  applyRecorderSettings(result.recorderSettings);
  if (debugMode) console.log('[StepsToCase] Content script loaded');
}).catch(() => {});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' || !changes.recorderSettings) return;
  applyRecorderSettings(changes.recorderSettings.newValue);
});

// On load, auto-start if this tab is the one being recorded (and not paused)
try {
  chrome.runtime.sendMessage({ type: 'IS_RECORDING' }, (response) => {
    if (chrome.runtime.lastError) {
      if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
        teardownInvalidatedContext();
      }
      return;
    }
    if (response?.on) {
      startRecording();
      if (debugMode) console.log('[StepsToCase] Auto-resumed recording after navigation');
    }
  });
} catch (error) {
  if (isExtensionContextInvalidatedError(error)) {
    teardownInvalidatedContext();
  } else {
    throw error;
  }
}
