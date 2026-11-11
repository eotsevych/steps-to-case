import type { Action, BackgroundMessage, RecordingState } from '../types';
import { normalizeRecordedPageUrl, parseRecordedPageContext } from '../lib/pageUrl';
import { pagesAfterStop } from '../lib/pages';
import { NAME_TOKEN } from '../lib/stepName';
import { filterAndShortenTriggeredRequests } from '../lib/triggeredRequests';
import {
  generateId,
  normalizeActions,
  normalizeImportedRecording,
  normalizeManualSteps,
  normalizePages,
  normalizePreconditions,
} from '../lib/recordingImport';

const defaultState: RecordingState = {
  phase: 'idle',
  mode: 'full',
  testMetadata: {},
  actions: [],
  pages: [],
  manualSteps: [],
  preconditions: [],
  startTime: undefined,
  isElementPickerActive: false,
};

const state: RecordingState = { ...defaultState };

let activeTabId: number | undefined;
let stateReady = false;
let containerPickActionId: string | undefined;
let containerPrePickMode = false;

function normalizeStateShape() {
  const rawState = state as unknown as Record<string, unknown>;
  state.actions = normalizeActions(rawState.actions);
  state.pages = normalizePages(rawState.pages);
  state.manualSteps = normalizeManualSteps(rawState.manualSteps);
  state.preconditions = normalizePreconditions(rawState.preconditions);
}

// ============================================================
// Persistence — survive service worker restarts
// ============================================================

function saveState(): Promise<void> {
  return chrome.storage.local.set({
    recorderState: {
      phase: state.phase,
      mode: state.mode,
      testMetadata: state.testMetadata,
      actions: state.actions,
      pages: state.pages,
      manualSteps: state.manualSteps,
      preconditions: state.preconditions,
      startTime: state.startTime,
      isPaused: state.isPaused,
      lastPagePath: state.lastPagePath,
      baseUrl: state.baseUrl,
    },
    activeTabId,
  }).catch((error) => {
    // Most likely the 10 MB storage quota; the in-memory state is still intact.
    console.warn('[StepsToCase] Could not save recorder state:', error);
  });
}

async function restoreState() {
  const stored = await chrome.storage.local.get(['recorderState', 'activeTabId']);
  if (stored.recorderState) {
    Object.assign(state, stored.recorderState);
    normalizeStateShape();
    state.isElementPickerActive = false;
    if (!state.mode) state.mode = 'full';
    if (!state.manualSteps) state.manualSteps = [];
    if (!state.preconditions) state.preconditions = [];
  }
  if (stored.activeTabId) {
    activeTabId = stored.activeTabId;
  }
  stateReady = true;
}

function resetState() {
  Object.assign(state, {
    phase: 'idle',
    mode: 'full',
    testMetadata: {},
    actions: [],
    pages: [],
    manualSteps: [],
    preconditions: [],
    startTime: undefined,
    isPaused: false,
    lastPagePath: undefined,
    baseUrl: undefined,
    pendingContainer: undefined,
    isElementPickerActive: false,
  });
  activeTabId = undefined;
  saveState();
}

// Restore state immediately on service worker start.
// Store the promise so message handlers can await it before touching state.
const stateReadyPromise = restoreState().then(() => {
  // After restoration, push the recovered state to any open panels so they
  // don't keep showing stale data from before the service worker was killed.
  if (state.phase !== 'idle') {
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED', state: { ...state } }).catch(() => {});
  }
});

/** Find an action by ID, searching sub-actions too */
function findAction(actions: Action[], id: string): Action | undefined {
  for (const a of actions) {
    if (a.id === id) return a;
    if (a.subActions) {
      const sub = a.subActions.find(s => s.id === id);
      if (sub) return sub;
    }
  }
  return undefined;
}

/** Run fn on the live action list and on every page's list (review keeps both). */
function eachList(fn: (actions: Action[]) => void) {
  fn(state.actions);
  for (const page of state.pages) fn(page.actions);
}

const EXTENSION_ORIGIN = chrome.runtime.getURL('');

/** True for a content script in a web page; extension pages (side panel, popup window) are excluded. */
function isContentScript(sender: chrome.runtime.MessageSender): boolean {
  return !!sender.tab && !sender.url?.startsWith(EXTENSION_ORIGIN);
}

/** The recording tab, or a tab it opened (login popup, target=_blank link) — those record too. */
function isRecordedTab(tab: chrome.tabs.Tab | undefined): boolean {
  return !!tab && activeTabId !== undefined && (tab.id === activeTabId || tab.openerTabId === activeTabId);
}

/** Start/stop the tabs the recording tab opened, so they follow the recording state. */
async function sendToChildTabs(type: 'START' | 'STOP') {
  if (activeTabId === undefined) return;
  for (const tab of await chrome.tabs.query({})) {
    if (tab.id !== undefined && tab.openerTabId === activeTabId) {
      chrome.tabs.sendMessage(tab.id, { source: 'qa-recorder-control', type }).catch(() => {});
    }
  }
}

/** Tell the recording tab to stop; it flushes a pending fill before it answers. */
function stopActiveTab(): Promise<void> {
  if (!activeTabId) return Promise.resolve();
  void sendToChildTabs('STOP');
  return sendToTab(activeTabId, { source: 'qa-recorder-control', type: 'STOP' });
}

/** Short message for the panel's notice banner. */
function notify(text: string) {
  chrome.runtime.sendMessage({ type: 'NOTICE', text }).catch(() => { /* panel closed */ });
}

/** Tab the current pick runs in, so cancel/arrow-nav reach the same tab. */
let pickTabId: number | undefined;

/**
 * Picking must happen on the step's page — otherwise the element belongs to some other page.
 * The recording tab wins when it shows the page; else any tab the user has open on it.
 */
async function findPickTab(pageUrl: string | undefined): Promise<number | undefined> {
  if (!pageUrl) return getResolvedTabId(undefined);
  const recorded = await getTabIfUsable(activeTabId);
  const viewed = await chrome.tabs.query({ active: true, windowType: 'normal' }).catch(() => []);
  const tab = [recorded, ...viewed].find(t => t?.id !== undefined && (!t.url || getPath(t.url) === pageUrl));
  return tab?.id;
}

/** Resolve the pick tab, or tell the user to open the step's page. */
async function startPick(pageUrl: string | undefined, message: Record<string, unknown>) {
  const tabId = await findPickTab(pageUrl);
  if (tabId === undefined) {
    state.isElementPickerActive = false;
    containerPrePickMode = false;
    containerPickActionId = undefined;
    broadcastState();
    notify(`Open ${pageUrl} in the browser first — the element has to come from that step's page.`);
    return;
  }
  pickTabId = tabId;
  sendToTab(tabId, message);
}

const getPath = normalizeRecordedPageUrl;


// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Keep the service worker alive while the panel is open.
// The panel reconnects this port after a SW restart, so the keepalive resets.
// NOTE: we intentionally do NOT call resetState() on disconnect — losing the
// port connection (e.g. SW killed by Chrome) must never discard user work.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'panel') {
    // Send current state immediately so a reconnecting panel is in sync.
    stateReadyPromise.then(() => {
      try { port.postMessage({ type: 'STATE_UPDATED', state: { ...state } }); } catch { /* panel already gone */ }
    });
  }
});

async function getTabIfUsable(tabId: number | undefined): Promise<chrome.tabs.Tab | undefined> {
  if (tabId === undefined) return undefined;
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return undefined;
  }
}

async function getTargetTab(): Promise<chrome.tabs.Tab | undefined> {
  const activeTab = await getTabIfUsable(activeTabId);
  if (activeTab) {
    return activeTab;
  }
  activeTabId = undefined;

  try {
    const windows = await chrome.windows.getAll({
      populate: true,
      windowTypes: ['normal'],
    });
    const targetWindow = windows.find(window => window.focused) ?? windows[0];
    return targetWindow?.tabs?.find(tab => tab.active);
  } catch {
    return undefined;
  }
}

// Resolve target tab for element picker and recorder commands.
// Validates the cached recording tab first, then falls back to the current normal browser tab.
async function getResolvedTabId(preferredTabId?: number): Promise<number | undefined> {
  const preferredTab = await getTabIfUsable(preferredTabId);
  if (preferredTab?.id !== undefined) return preferredTab.id;

  const targetTab = await getTargetTab();
  if (targetTab?.id !== undefined) {
    activeTabId = targetTab.id;
    saveState();
    return targetTab.id;
  }

  return undefined;
}

// Ensure content script is running on the tab, then send a command
async function sendToTab(tabId: number | undefined, message: Record<string, unknown>) {
  let targetTabId = await getResolvedTabId(tabId);
  if (targetTabId === undefined) {
    console.warn('[StepsToCase] Could not resolve a valid target tab for message:', message.type);
    return;
  }

  try {
    await chrome.tabs.sendMessage(targetTabId, message);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const canRetryByInjecting = errorMessage.includes('Receiving end does not exist')
      || errorMessage.includes('Could not establish connection');

    if (!canRetryByInjecting) {
      console.warn('[StepsToCase] Could not send message to tab:', e);
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: targetTabId, allFrames: true },
        files: ['content/content-script.js'],
      });
    } catch (injectError) {
      console.warn('[StepsToCase] Could not inject content script:', injectError);
      const fallbackTabId = await getResolvedTabId(undefined);
      if (fallbackTabId === undefined || fallbackTabId === targetTabId) return;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: fallbackTabId, allFrames: true },
          files: ['content/content-script.js'],
        });
        targetTabId = fallbackTabId;
        activeTabId = fallbackTabId;
      } catch (retryError) {
        console.warn('[StepsToCase] Retry inject failed:', retryError);
        return;
      }
    }

    await new Promise(r => setTimeout(r, 50));

    try {
      await chrome.tabs.sendMessage(targetTabId, message);
    } catch (retrySendError) {
      console.warn('[StepsToCase] Could not send message to tab after injection:', retrySendError);
    }
  }
}

// Handle messages from panel and content scripts
chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  // If state hasn't been restored yet (SW just restarted), queue this message
  // until restoration is complete. Without this guard any handler that runs on
  // the default empty state will wipe real data via broadcastState/saveState.
  if (!stateReady) {
    stateReadyPromise.then(() => handleMessage(message, sender, sendResponse));
    return true; // keep the response channel open
  }
  handleMessage(message, sender, sendResponse);
  return true;
});

function handleMessage(
  message: BackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (r?: unknown) => void,
) {
  // Captures only count from the recording tab while recording — other tabs
  // (or tabs that auto-started earlier and never got STOP) must not leak in.
  const contentScript = isContentScript(sender);
  const fromOtherTab = contentScript && !isRecordedTab(sender.tab);
  if ((message.type === 'ACTION_CAPTURED' || message.type === 'UPDATE_FILL' || message.type === 'DELETE_ACTION')
    && (fromOtherTab || (contentScript && state.phase !== 'recording'))) {
    sendResponse({ ok: true });
    return;
  }
  if (message.type === 'ATTACH_REQUESTS' && fromOtherTab) {
    sendResponse({ ok: true });
    return;
  }

  switch (message.type) {
    case 'GET_STATE':
      normalizeStateShape();
      sendResponse({ ...state });
      return;

    case 'IS_RECORDING':
      sendResponse({
        on: state.phase === 'recording' && !state.isPaused && contentScript && isRecordedTab(sender.tab),
      });
      return;

    case 'GET_TARGET_TAB':
      getTargetTab()
        .then(tab => sendResponse(tab ? { id: tab.id, url: tab.url, title: tab.title } : null))
        .catch(() => sendResponse(null));
      return;

    case 'RESET_RECORDING':
      resetState();
      broadcastState();
      sendResponse({ ok: true });
      return;

    case 'UPDATE_METADATA':
      state.testMetadata = { ...state.testMetadata, ...message.metadata };
      broadcastState();
      sendResponse({ ok: true });
      return;

    case 'START_RECORDING': {
      activeTabId = message.tabId;
      state.phase = 'recording';
      state.mode = 'full';
      state.startTime = Date.now();
      state.actions = [];
      state.pages = [];
      state.testMetadata.timestamp = new Date().toISOString();

      chrome.tabs.get(activeTabId, (tab) => {
        if (tab?.url) {
          state.testMetadata.startUrl = getPath(tab.url);
          try {
            state.baseUrl = new URL(tab.url).origin;
          } catch { /* ignore */ }
          // This callback can run after the initial broadcast — persist again
          // so startUrl/baseUrl survive a service worker restart.
          broadcastState();
        }
      });

      sendToTab(activeTabId, {
        source: 'qa-recorder-control',
        type: 'START',
      }).then(() => broadcastState());

      sendResponse({ ok: true });
      return;
    }

    case 'START_SINGLE_STEP': {
      activeTabId = message.tabId;
      state.phase = 'recording';
      state.mode = 'single';
      state.startTime = Date.now();
      state.actions = [];
      state.pages = [];
      state.manualSteps = [];
      state.preconditions = [];
      state.isPaused = false;
      state.pendingContainer = undefined;
      // Lock the current page; single-page mode only records steps from here.
      state.lastPagePath = undefined;
      state.testMetadata = { timestamp: new Date().toISOString() };

      chrome.tabs.get(activeTabId, (tab) => {
        if (tab?.url) {
          state.testMetadata.startUrl = getPath(tab.url);
          state.lastPagePath = getPath(tab.url);
          try {
            state.baseUrl = new URL(tab.url).origin;
          } catch { /* ignore */ }
          broadcastState();
        }
      });

      sendToTab(activeTabId, {
        source: 'qa-recorder-control',
        type: 'START',
      }).then(() => broadcastState());

      sendResponse({ ok: true });
      return;
    }

    case 'STOP_RECORDING': {
      if (state.startTime) {
        state.testMetadata.duration = Date.now() - state.startTime;
      }

      if (activeTabId) {
        chrome.tabs.get(activeTabId, (tab) => {
          if (tab?.url) {
            state.testMetadata.endUrl = getPath(tab.url);
            // Runs after the broadcast below — persist endUrl separately.
            broadcastState();
          }
        });
      }

      // Stay in 'recording' until the tab has answered STOP: the fill it flushes
      // on stop must be accepted and land in state.actions before pages are built.
      stopActiveTab().then(() => {
        state.phase = 'review';
        state.pages = pagesAfterStop(state.pages, state.actions);

        // Re-map manualSteps pageIds to the pages (new pages get new IDs)
        if (state.manualSteps.length > 0) {
          const actionToPageId = new Map<string, string>();
          for (const page of state.pages) {
            for (const action of page.actions) {
              actionToPageId.set(action.id, page.id);
            }
          }
          state.manualSteps = state.manualSteps
            .map(ms => {
              // Find the rebuilt page that contains the first action of this manual step
              const newPageId = ms.actionIds.length > 0 ? actionToPageId.get(ms.actionIds[0]) : undefined;
              return newPageId ? { ...ms, pageId: newPageId } : ms;
            })
            .filter(ms => {
              // Drop manual steps whose actions no longer exist in any page
              return ms.actionIds.some(id => actionToPageId.has(id));
            });
        }

        broadcastState();
        sendResponse({ ok: true });
      });
      return;
    }

    case 'PAUSE_RECORDING': {
      // Record the page path at pause time
      if (activeTabId) {
        chrome.tabs.get(activeTabId, (tab) => {
          if (tab?.url) {
            state.lastPagePath = getPath(tab.url);
            saveState();
          }
        });
      }
      // Flag paused only after the tab answered STOP, so its flushed fill is still accepted
      stopActiveTab().then(() => {
        state.isPaused = true;
        broadcastState();
        sendResponse({ ok: true });
      });
      return;
    }

    case 'CONTINUE_RECORDING': {
      state.isPaused = false;
      activeTabId = message.tabId;

      // Track the page path at resume time (page splitting itself is driven by
      // each action's recorded URL in autoCreatePagesByUrl).
      chrome.tabs.get(activeTabId, (tab) => {
        if (tab?.url) {
          state.lastPagePath = getPath(tab.url);
          saveState();
        }
      });

      sendToTab(activeTabId, {
        source: 'qa-recorder-control',
        type: 'START',
      }).then(() => broadcastState());
      void sendToChildTabs('START');

      sendResponse({ ok: true });
      return;
    }

    case 'ACTION_CAPTURED': {
      // When paused, only allow manually added steps and assertions (not auto-captured actions)
      const isManualAction = message.action.type === 'step' || message.action.type === 'assert';
      if (state.isPaused && !isManualAction) {
        sendResponse({ ok: true });
        return;
      }
      const action: Action = {
        ...message.action,
        // Keep the content script's ID so ATTACH_REQUESTS can find it
        id: message.action.id || generateId(),
        timestamp: state.startTime ? Date.now() - state.startTime : 0,
      };

      // A step inside an iframe belongs to the tab's page; the frame stays as frameUrl
      if (contentScript && sender.frameId && sender.tab?.url) {
        action.page = {
          ...parseRecordedPageContext(sender.tab.url, sender.tab.title ?? ''),
          pageTag: action.page.pageTag,
          frameUrl: action.page.frameUrl,
        };
      }

      // Attach pending container (pre-action pick) — single-shot, cleared after use
      if (state.pendingContainer && !action.containerContext) {
        action.containerContext = state.pendingContainer;
        state.pendingContainer = undefined;
      }

      if (state.mode === 'single') {
        // Single-page recorder: record every step, but only from the page the
        // recording started on. Lock the page on the first capture, then drop
        // any later action that happened after navigating elsewhere.
        const actionPath = action.page?.url ? getPath(action.page.url) : '';
        if (!state.lastPagePath && actionPath) state.lastPagePath = actionPath;
        if (actionPath && state.lastPagePath && actionPath !== state.lastPagePath) {
          notify(`Single-page mode records only on ${state.lastPagePath} — this step on ${actionPath} was skipped.`);
          sendResponse({ ok: true });
          return;
        }
      }
      state.actions.push(action);

      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'BACK_TO_RECORDING': {
      // Flatten pages back into actions so steps/assertions added in organize view are preserved.
      // The pages themselves stay: the next stop keeps their names, order and moves,
      // and only groups the newly recorded steps (see pagesAfterStop).
      if (state.pages.length > 0) {
        state.actions = [...state.pages].sort((a, b) => a.order - b.order).flatMap(g => g.actions);
      }
      // Return to recording phase so user can add more steps.
      // Full mode resumes paused; single mode resumes live.
      state.phase = 'recording';
      state.isPaused = state.mode !== 'single';
      if (state.mode === 'single') {
        // Re-arm capture on the recording tab.
        sendToTab(activeTabId, { source: 'qa-recorder-control', type: 'START' });
      }
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'LOAD_RECORDING': {
      const imported = normalizeImportedRecording(message.recording);
      Object.assign(state, {
        phase: 'review',
        mode: 'full',
        testMetadata: imported.testMetadata,
        actions: [],
        pages: imported.pages,
        manualSteps: imported.manualSteps,
        preconditions: imported.preconditions,
        startTime: undefined,
        isPaused: false,
        lastPagePath: undefined,
        // Never pair the file's paths with the previous recording's site
        baseUrl: imported.baseUrl,
        pendingContainer: undefined,
        isElementPickerActive: false,
      });
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'UPDATE_EXPECTED_RESULT': {
      eachList(actions => {
        const action = findAction(actions, message.actionId);
        if (!action?.expectedResults || message.resultIndex >= action.expectedResults.length) return;
        action.expectedResults[message.resultIndex] = message.result;
        // A re-picked element replaces the assert step's own element, which is what the exporter reads
        if (action.type === 'assert' && message.element && message.selectors) {
          action.element = message.element;
          action.selectors = message.selectors;
        }
      });
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'UPDATE_FILL': {
      eachList(actions => {
        const action = findAction(actions, message.actionId);
        if (!action) return;
        if (!action.actionData) action.actionData = {};
        action.actionData.value = message.value;
      });
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'ATTACH_REQUESTS': {
      // Attach triggered network requests to the action (searches sub-actions too)
      eachList(actions => {
        const action = findAction(actions, message.actionId);
        if (!action) return;
        if (!action.actionData) action.actionData = {};
        action.actionData.triggeredRequests = filterAndShortenTriggeredRequests(
          message.requests,
          action.page.domain,
        );
      });
      // No broadcastState here to avoid UI noise; just persist
      saveState();
      sendResponse({ ok: true });
      return;
    }

    case 'REMOVE_SUB_ACTION': {
      eachList(actions => {
        const parent = actions.find(a => a.id === message.parentActionId);
        if (!parent?.subActions) return;
        parent.subActions = parent.subActions.filter(s => s.id !== message.subActionId);
        // Clean up manualSubSteps
        if (parent.manualSubSteps) {
          parent.manualSubSteps = parent.manualSubSteps
            .map(ms => ({ ...ms, subActionIds: ms.subActionIds.filter(id => id !== message.subActionId) }))
            .filter(ms => ms.subActionIds.length > 0);
          if (parent.manualSubSteps.length === 0) parent.manualSubSteps = undefined;
        }
      });
      // Remove deleted sub-action ID from manual steps; drop steps that become empty
      state.manualSteps = state.manualSteps
        .map(ms => ({ ...ms, actionIds: ms.actionIds.filter(id => id !== message.subActionId) }))
        .filter(ms => ms.actionIds.length > 0);
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'DELETE_ACTION': {
      eachList(actions => {
        const index = actions.findIndex(a => a.id === message.actionId);
        if (index >= 0) actions.splice(index, 1);
      });
      // Remove deleted action ID from manual steps; drop steps that become empty
      state.manualSteps = state.manualSteps
        .map(ms => ({ ...ms, actionIds: ms.actionIds.filter(id => id !== message.actionId) }))
        .filter(ms => ms.actionIds.length > 0);
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'UPDATE_ACTION_TEXT': {
      eachList(actions => {
        const action = findAction(actions, message.actionId);
        if (action) action.customText = message.customText;
      });
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'SELECT_DESCRIPTION': {
      eachList(actions => {
        const action = findAction(actions, message.actionId);
        if (!action) return;
        action.selectors.contextText = message.text;
        if (message.source !== undefined) action.selectors.descriptionSource = message.source;
        if (message.level !== undefined) action.selectors.descriptionHierarchy = message.level;
        // Clear any earlier manual override so the selected text drives the step
        // title — except a {name} template, whose whole point is to keep the
        // user's wording while the picker swaps the element name inside it
        if (!action.customText?.includes(NAME_TOKEN)) action.customText = undefined;
      });
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'UPDATE_SUB_STEP_NAME': {
      eachList(actions => {
        const action = findAction(actions, message.actionId);
        if (action) action.subStepName = message.subStepName;
      });
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'REORDER_SUB_ACTIONS': {
      eachList(actions => {
        const parent = actions.find(a => a.id === message.parentActionId);
        if (!parent?.subActions) return;
        const idOrder = message.subActionIds;
        const subMap = new Map(parent.subActions.map(s => [s.id, s]));
        const reordered: Action[] = [];
        for (const id of idOrder) {
          const s = subMap.get(id);
          if (s) reordered.push(s);
        }
        // Append any sub-actions not in the new order (safety)
        for (const s of parent.subActions) {
          if (!idOrder.includes(s.id)) reordered.push(s);
        }
        parent.subActions = reordered;
      });
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'UPDATE_MANUAL_SUB_STEPS': {
      eachList(actions => {
        const parent = actions.find(a => a.id === message.parentActionId);
        if (parent) {
          parent.manualSubSteps = message.manualSubSteps.length > 0 ? message.manualSubSteps : undefined;
        }
      });
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'UPDATE_PAGES':
      state.pages = message.pages;
      broadcastState();
      sendResponse({ ok: true });
      return;

    case 'UPDATE_MANUAL_STEPS':
      state.manualSteps = message.manualSteps;
      broadcastState();
      sendResponse({ ok: true });
      return;

    case 'UPDATE_PRECONDITIONS':
      state.preconditions = message.preconditions;
      broadcastState();
      sendResponse({ ok: true });
      return;

    case 'ELEMENT_PICKER_START': {
      state.isElementPickerActive = true;
      void startPick(message.pageUrl, { source: 'qa-recorder-control', type: 'PICK_ELEMENT' });
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'ELEMENT_PICKER_STOP': {
      state.isElementPickerActive = false;
      containerPrePickMode = false;
      containerPickActionId = undefined;
      const resolveStopTab = getResolvedTabId(message.tabId ?? pickTabId);
      resolveStopTab.then(tabId => {
        if (tabId) {
          sendToTab(tabId, {
            source: 'qa-recorder-control',
            type: 'CANCEL_PICK',
          });
        }
      });
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'PICKER_NAV': {
      // Forward panel arrow-key navigation to the content script picker
      const resolveNavTab = getResolvedTabId(message.tabId ?? pickTabId);
      resolveNavTab.then(tabId => {
        if (tabId) {
          sendToTab(tabId, {
            source: 'qa-recorder-control',
            type: 'PICKER_NAV',
            direction: message.direction,
          });
        }
      });
      sendResponse({ ok: true });
      return;
    }

    case 'PICK_CANCELLED':
      // Content script cancelled the pick (Esc) — reset picker state
      state.isElementPickerActive = false;
      containerPrePickMode = false;
      containerPickActionId = undefined;
      broadcastState();
      sendResponse({ ok: true });
      return;

    case 'ELEMENT_PICKED':
      state.isElementPickerActive = false;
      if (containerPickActionId) {
        // Post-hoc container pick — extract label + tag and update existing action
        const label = message.selectors?.contextText
          || message.elementInfo.accessibleName
          || message.elementInfo.ariaLabel
          || message.elementInfo.innerText
          || message.elementInfo.title
          || '';
        const containerContext: { containerTag: string; containerLabel: string; containerHtml?: string } = {
          containerTag: message.elementInfo.tagName,
          containerLabel: label,
        };
        if (message.containerHtml) {
          containerContext.containerHtml = message.containerHtml;
        }
        // Find and update the action
        const pickedForId = containerPickActionId;
        eachList(actions => {
          const action = findAction(actions, pickedForId);
          if (action) action.containerContext = containerContext;
        });
        containerPickActionId = undefined;
        broadcastState();
      } else if (containerPrePickMode) {
        // Pre-action container pick — forward to the panel so the user can
        // name the container; the panel replies with SET_PENDING_CONTAINER.
        containerPrePickMode = false;
        chrome.runtime.sendMessage({
          type: 'CONTAINER_PRE_PICKED',
          elementInfo: message.elementInfo,
          selectors: message.selectors,
          containerHtml: message.containerHtml,
        }).catch(() => {});
        broadcastState();
      } else {
        // Existing assertion picker flow — forward to panel
        chrome.runtime.sendMessage({
          type: 'ELEMENT_PICKED',
          elementInfo: message.elementInfo,
          selectors: message.selectors,
        }).catch(() => {});
        broadcastState();
      }
      sendResponse({ ok: true });
      return;

    case 'REMOVE_ACTION_CONTAINER': {
      eachList(actions => {
        const action = findAction(actions, message.actionId);
        if (action) delete action.containerContext;
      });
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'HIGHLIGHT_AND_PICK_CONTAINER': {
      state.isElementPickerActive = true;
      containerPickActionId = message.actionId;
      const stepAction = findAction(state.actions, message.actionId)
        ?? state.pages.map(page => findAction(page.actions, message.actionId)).find(Boolean);
      const stepPageUrl = stepAction?.page.url || undefined;
      void startPick(stepPageUrl, {
        source: 'qa-recorder-control',
        type: 'HIGHLIGHT_AND_PICK',
        selector: message.selector,
        candidateSelectors: message.candidateSelectors,
        targetText: message.targetText,
      });
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'PICK_CONTAINER_PRE': {
      state.isElementPickerActive = true;
      containerPrePickMode = true;
      containerPickActionId = undefined;
      void startPick(message.pageUrl, { source: 'qa-recorder-control', type: 'PICK_CONTAINER' });
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'SET_PENDING_CONTAINER': {
      state.pendingContainer = message.containerContext;
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    case 'CLEAR_PENDING_CONTAINER': {
      state.pendingContainer = undefined;
      broadcastState();
      sendResponse({ ok: true });
      return;
    }

    default:
      // Close the response channel for message types this handler doesn't own
      // (the listener always returns true, so without this the port dangles).
      sendResponse(undefined);
      return;
  }
}

// Listen for tab URL changes — attach navigation to previous action instead of creating a separate step
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === activeTabId && state.phase === 'recording' && !state.isPaused && changeInfo.url) {
    try {
      const navUrl = getPath(changeInfo.url);
      const navTitle = changeInfo.title || '';
      const lastAction = state.actions[state.actions.length - 1];

      if (lastAction) {
        // Attach navigation to the most recent action
        if (!lastAction.actionData) lastAction.actionData = {};
        lastAction.actionData.triggeredNavigation = {
          url: navUrl,
          title: navTitle,
        };
      }
      // Don't broadcast for navigation — it's metadata on existing action, not a new step
      saveState();
    } catch {
      // Invalid URL
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId !== activeTabId) return;
  activeTabId = undefined;
  saveState();
});

function broadcastState() {
  saveState();
  chrome.runtime.sendMessage({ type: 'STATE_UPDATED', state: { ...state } }).catch(() => {
    // Panel may not be open
  });
}
