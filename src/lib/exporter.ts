import type {
  Action,
  ExpectedResult,
  ManualStep,
  ManualSubStep,
  RecordingState,
  StepPage,
  ExportActionStep,
  ExportAssertionStep,
  ExportAssertionType,
  ExportCommentStep,
  ExportCombinedStep,
  ExportPage,
  ExportRecording,
  ExportStep,
  ExportSingleStep,
  ExportSubgroupChildStep,
  ExportSubgroupStep,
} from '../types';
import { getElementName, resolveCustomText } from './stepName';
import { filterAndShortenTriggeredRequests } from './triggeredRequests';

// ── Action name formatting ──────────────────────────────────

function formatActionName(action: Action): string {
  const name = getElementName(action);
  let result: string;

  switch (action.type) {
    case 'click':
      result = `Click on "${name}"`;
      break;
    case 'dblclick':
      result = `Double-click on "${name}"`;
      break;
    case 'fill': {
      const label = action.selectors?.contextText || name;
      result = `Fill "${label}" with "${displayFillValue(action)}"`;
      break;
    }
    case 'press':
      result = `Press ${action.actionData?.key || ''}`;
      break;
    case 'select':
      result = `Select "${action.actionData?.selectedOption || ''}" from "${name}"`;
      break;
    case 'check':
      result = `Check "${name}"`;
      break;
    case 'uncheck':
      result = `Uncheck "${name}"`;
      break;
    case 'navigate':
      result = `Navigate to ${action.page.url}`;
      break;
    case 'assert':
      result = `Verify: ${action.expectedResults?.[0]?.description || name}`;
      break;
    default:
      result = `${action.type} on "${name}"`;
  }

  if (action.containerContext?.containerLabel) {
    result += ` in "${action.containerContext.containerLabel}"`;
  }
  return result;
}

// ── Password detection ──────────────────────────────────────

export const PASSWORD_MASK = '••••••••';

function isPasswordField(action: Action): boolean {
  if (action.type !== 'fill') return false;
  return !!(
    action.element.attributes['type'] === 'password' ||
    action.selectors?.primary?.value?.toLowerCase().includes('password') ||
    action.element.ariaLabel?.toLowerCase().includes('password') ||
    action.element.label?.toLowerCase().includes('password') ||
    action.element.placeholder?.toLowerCase().includes('password')
  );
}

/** Fill value safe to show or export: masked for anything that looks like a password field. */
export function displayFillValue(action: Action): string {
  return isPasswordField(action) ? PASSWORD_MASK : action.actionData?.value ?? '';
}

// ── Map a single Action to ExportActionStep ─────────────────

function mapActionToStep(
  action: Action,
  stepOrder: number,
): ExportActionStep {
  const actionValue = isPasswordField(action)
    ? PASSWORD_MASK
    : (action.actionData?.value ??
       action.actionData?.key ??
       action.actionData?.selectedOption ??
       action.actionData?.triggeredNavigation?.url ??
       '');

  const step: ExportActionStep = {
    stepOrder,
    stepType: 'RECORDED',
    actionKind: 'action',
    actionName: resolveCustomText(action) || formatActionName(action),
    actionValue,
    triggeredNavigationUrl: action.actionData?.triggeredNavigation?.url ?? '',
    triggeredNavigationTitle: action.actionData?.triggeredNavigation?.title ?? '',
    elementTag: action.element.tagName ?? '',
    elementText: action.element.textContent ?? '',
    elementInnerText: action.element.innerText ?? '',
    elementAccessibleName: action.element.accessibleName ?? '',
    elementLabel: action.element.label ?? '',
    elementPlaceholder: action.element.placeholder ?? '',
    elementAriaLabel: action.element.ariaLabel ?? '',
    elementTitle: action.element.title ?? '',
    elementAttributes: action.element.attributes ?? {},
    selectorContextText: action.selectors?.contextText ?? '',
    ...(action.page?.frameUrl ? { frameUrl: action.page.frameUrl } : {}),
  };

  const triggeredRequests = filterAndShortenTriggeredRequests(
    action.actionData?.triggeredRequests,
    action.page.domain,
  );

  if (triggeredRequests.length) {
    step.triggeredRequests = triggeredRequests.map(r => ({
      url: r.url,
      method: r.method,
      status: r.status,
    }));
  }

  if (action.containerContext) {
    step.containerTag = action.containerContext.containerTag;
    step.containerLabel = action.containerContext.containerLabel;
    if (action.containerContext.containerHtml) {
      step.containerHtml = action.containerContext.containerHtml;
    }
  }

  if (action.componentTag) step.componentTag = action.componentTag;

  return step;
}

// ── Map an assert Action to ExportAssertionStep ─────────────

function mapAssertToStep(
  action: Action,
  stepOrder: number,
  er: ExpectedResult | undefined = action.expectedResults?.[0],
): ExportAssertionStep {
  const step: ExportAssertionStep = {
    stepOrder,
    stepType: 'ASSERTION_WITH_ELEMENT',
    actionKind: 'assertion',
    actionName: `Assert: ${er?.description ?? action.element.accessibleName ?? action.element.textContent ?? ''}`,
    actionValue: er?.assertion?.expectedValue ?? '',
    expectedResultsDescription: er?.description ?? '',
    assertElementType: (er?.assertion?.type ?? 'visible') as ExportAssertionType,
    assertElementTag: action.element.tagName ?? '',
    assertElementText: action.element.textContent ?? '',
    assertElementInnerText: action.element.innerText ?? '',
    assertElementAccessibleName: action.element.accessibleName ?? '',
    assertElementLabel: action.element.label ?? '',
    assertElementPlaceholder: action.element.placeholder ?? '',
    assertElementAriaLabel: action.element.ariaLabel ?? '',
    assertElementTitle: action.element.title ?? '',
    assertElementAttributes: action.element.attributes ?? {},
    assertSelectorContextText: action.selectors?.contextText ?? '',
    ...(action.page?.frameUrl ? { frameUrl: action.page.frameUrl } : {}),
  };

  if (action.containerContext) {
    step.containerTag = action.containerContext.containerTag;
    step.containerLabel = action.containerContext.containerLabel;
    if (action.containerContext.containerHtml) {
      step.containerHtml = action.containerContext.containerHtml;
    }
  }

  if (action.componentTag) step.componentTag = action.componentTag;

  return step;
}

// ── Determine if an action is ASSERTION_WITHOUT_ELEMENT ─────

function isAssertWithoutElement(action: Action): boolean {
  return (
    action.type === 'assert' &&
    (!action.element?.tagName || !action.selectors?.primary?.value)
  );
}

// ── Determine if a manual step has a real element ───────────

function isManualWithElement(action: Action): boolean {
  return !!(action.element?.tagName && action.selectors?.primary?.value);
}

// ── Map a COMBINED action ───────────────────────────────────

function mapToCombined(action: Action, stepOrder: number): ExportCombinedStep {
  const combinedSteps: Array<ExportActionStep | ExportCommentStep> = [];
  let localOrder = 0;

  // Build a map: first subActionId of each ManualSubStep → ManualSubStep
  const subActionToLabel = new Map<string, ManualSubStep>();
  for (const mss of action.manualSubSteps ?? []) {
    const firstId = mss.subActionIds[0];
    if (firstId) subActionToLabel.set(firstId, mss);
  }
  const emittedLabelIds = new Set<string>();

  for (const sub of action.subActions ?? []) {
    const label = subActionToLabel.get(sub.id);
    if (label && !emittedLabelIds.has(label.id)) {
      combinedSteps.push({
        stepOrder: ++localOrder,
        stepType: 'MANUAL_WITHOUT_ELEMENT',
        actionKind: 'comment',
        actionName: label.name,
      });
      emittedLabelIds.add(label.id);
    }

    if (sub.type === 'assert') continue; // assertions not allowed in COMBINED — emitted after it instead
    combinedSteps.push(mapActionToStep(sub, ++localOrder));
  }

  return {
    stepOrder,
    stepType: 'COMBINED',
    actionKind: 'action',
    actionName: action.subStepName || resolveCustomText(action) || (action.subActions?.[0] ? formatActionName(action.subActions[0]) : ''),
    steps: combinedSteps,
  };
}

// ── Map a leaf action (no sub-actions) ──────────────────────

/** Assertion, manual step or regular action, plus a regular action's expected results. */
function mapLeafSteps(
  action: Action,
  nextOrder: () => number,
): ExportSubgroupChildStep[] {
  if (action.type === 'assert') {
    if (!isAssertWithoutElement(action)) return [mapAssertToStep(action, nextOrder())];
    return [{
      stepOrder: nextOrder(),
      stepType: 'ASSERTION_WITHOUT_ELEMENT',
      actionKind: 'assertion',
      actionName: `Assert: ${action.expectedResults?.[0]?.description ?? ''}`,
    } as ExportCommentStep];
  }

  // MANUAL step (type === 'step') — added manually during recording or on the organize stage
  if (action.type === 'step') {
    if (isManualWithElement(action)) return [mapActionToStep(action, nextOrder())];
    return [{
      stepOrder: nextOrder(),
      stepType: 'MANUAL',
      actionKind: 'action',
      actionName: resolveCustomText(action) || '',
    } as ExportCommentStep];
  }

  // Regular action, then its expected results as assertion steps right after it
  const result: ExportSubgroupChildStep[] = [mapActionToStep(action, nextOrder())];
  for (const er of action.expectedResults ?? []) {
    result.push(mapAssertToStep(action, nextOrder(), er));
  }
  return result;
}

// ── Map action to top-level steps ───────────────────────────

function mapActionToTopLevelSteps(
  action: Action,
  nextOrder: () => number,
): ExportStep[] {
  if (!action.subActions?.length) return mapLeafSteps(action, nextOrder);

  // COMBINED: its assert sub-steps and the parent's expected results follow it
  const result: ExportStep[] = [mapToCombined(action, nextOrder())];
  for (const sub of action.subActions) {
    if (sub.type === 'assert') result.push(...mapLeafSteps(sub, nextOrder));
  }
  for (const er of action.expectedResults ?? []) {
    result.push(mapAssertToStep(action, nextOrder(), er));
  }
  return result;
}

// ── Map action to local steps (inside SUBGROUP) ─────────────

function mapActionToLocalSteps(
  action: Action,
  nextOrder: () => number,
): ExportSubgroupChildStep[] {
  if (!action.subActions?.length) return mapLeafSteps(action, nextOrder);

  // COMBINED inside a SUBGROUP: a comment label, then the sub-actions flattened
  const result: ExportSubgroupChildStep[] = [];
  const combinedName = action.subStepName || resolveCustomText(action) || formatActionName(action);
  if (combinedName) {
    result.push({
      stepOrder: nextOrder(),
      stepType: 'MANUAL_WITHOUT_ELEMENT',
      actionKind: 'comment',
      actionName: combinedName,
    } as ExportCommentStep);
  }
  for (const sub of action.subActions) {
    result.push(...mapLeafSteps(sub, nextOrder));
  }
  // Expected results on the parent → assertions after the flattened sub-actions
  for (const er of action.expectedResults ?? []) {
    result.push(mapAssertToStep(action, nextOrder(), er));
  }
  return result;
}

// ── Build subgroup steps ────────────────────────────────────

function buildSubgroupSteps(
  ms: ManualStep,
  allGroupActions: Action[],
): ExportSubgroupChildStep[] {
  let localOrder = 0;
  const result: ExportSubgroupChildStep[] = [];

  const coveredActions = ms.actionIds
    .map(id => allGroupActions.find(a => a.id === id))
    .filter(Boolean) as Action[];

  for (const action of coveredActions) {
    const steps = mapActionToLocalSteps(action, () => ++localOrder);
    result.push(...steps);
  }

  return result;
}

// ── Main export function ────────────────────────────────────

/** Identity of a page: same path on different domains (SSO login vs app) is a different page. */
export function pageKey(page: StepPage): string {
  return `${page.actions.find(a => a.page?.domain)?.page.domain ?? ''}|${page.pageContext?.url ?? ''}`;
}

export function buildExportRecording(
  state: RecordingState,
): ExportRecording {
  // Step A — Preconditions
  const preconditions = state.preconditions?.length
    ? state.preconditions
        .slice()
        .sort((a, b) => a.order - b.order)
        .map(p => p.name)
    : undefined;

  // Step B — Build pages
  let globalStepOrder = 0;
  const sortedPages = state.pages.slice().sort((a, b) => a.order - b.order);

  const pageKeys = sortedPages.map(pageKey);

  const pages: ExportPage[] = sortedPages.map((page, pi) => {
    const exportPage: ExportPage = {
      pageOrder: pi + 1,
      pageName: page.name,
      pageUrl: page.pageContext?.url ?? '',
      pageTitle: page.pageContext?.title ?? '',
      ...(page.pageTag ? { pageTag: page.pageTag } : {}),
      steps: [],
    };

    // Collect ManualSteps for this page
    const pageManualSteps = state.manualSteps
      .filter(ms => ms.pageId === page.id)
      .sort((a, b) => a.order - b.order);

    // Build lookup: actionId → ManualStep (first occurrence only)
    const actionIdToManualStep = new Map<string, ManualStep>();
    for (const ms of pageManualSteps) {
      for (const aid of ms.actionIds) {
        if (!actionIdToManualStep.has(aid)) actionIdToManualStep.set(aid, ms);
      }
    }

    // Track which ManualSteps have already been emitted
    const emittedSubgroupIds = new Set<string>();

    for (const action of page.actions) {
      const ms = actionIdToManualStep.get(action.id);

      if (ms && !emittedSubgroupIds.has(ms.id)) {
        // This action is the first one of a ManualStep → emit a SUBGROUP
        globalStepOrder++;
        const subgroupStep: ExportSubgroupStep = {
          stepOrder: globalStepOrder,
          stepType: 'SUBGROUP',
          actionKind: 'subgroup',
          actionName: ms.name,
          steps: buildSubgroupSteps(ms, page.actions),
        };
        exportPage.steps.push(subgroupStep);
        emittedSubgroupIds.add(ms.id);
      } else if (ms) {
        // This action is covered by an already-emitted ManualStep → skip
        continue;
      } else {
        // Action is not covered by any ManualStep → emit directly
        const topLevelSteps = mapActionToTopLevelSteps(action, () => ++globalStepOrder);
        exportPage.steps.push(...topLevelSteps);
      }
    }

    return exportPage;
  });

  const recording: ExportRecording = {
    testName: state.testMetadata.name || 'Untitled Test',
    baseUrl: state.baseUrl || '',
    startUrl: state.testMetadata.startUrl || '',
    pages: deduplicatePages(pages, pageKeys),
  };

  if (preconditions) {
    recording.preconditions = preconditions;
  }

  return recording;
}

// ── Single-page (Page Object Context Scrapper) export ───────

/**
 * Map one Action to the minimal flat single-page step shape:
 * { stepOrder, pageName, stepType, actionKind, actionName, element*, container* }.
 */
function mapActionToSingleStep(
  action: Action,
  pageName: string,
  stepOrder: number,
): ExportSingleStep {
  const hasElement = !!(action.element?.tagName && action.selectors?.primary?.value);

  let stepType: string;
  let actionKind: string;
  let actionName: string;

  if (action.type === 'assert') {
    actionKind = 'assertion';
    if (hasElement) {
      stepType = 'ASSERTION_WITH_ELEMENT';
      actionName = `Assert: ${action.expectedResults?.[0]?.description ?? action.element.accessibleName ?? action.element.textContent ?? ''}`;
    } else {
      stepType = 'ASSERTION_WITHOUT_ELEMENT';
      actionName = `Assert: ${action.expectedResults?.[0]?.description ?? ''}`;
    }
  } else if (action.type === 'step') {
    actionKind = 'action';
    if (hasElement) {
      stepType = 'RECORDED';
      actionName = resolveCustomText(action) || formatActionName(action);
    } else {
      stepType = 'MANUAL';
      actionName = resolveCustomText(action) || '';
    }
  } else {
    actionKind = 'action';
    stepType = 'RECORDED';
    actionName = resolveCustomText(action) || formatActionName(action);
  }

  return {
    stepOrder,
    pageName,
    stepType,
    actionKind,
    actionName,
    elementTag: action.element?.tagName ?? '',
    elementAttributes: action.element?.attributes ?? {},
    containerTag: action.containerContext?.containerTag ?? '',
    containerLabel: action.containerContext?.containerLabel ?? '',
    containerHtml: action.containerContext?.containerHtml ?? '',
  };
}

/**
 * Build the single-page export: an ordered array of the flat step shapes.
 * The single-page flow records every step captured on one page and maps each
 * to the minimal Page Object Context Scrapper shape.
 */
export function buildSingleStepExport(state: RecordingState): ExportSingleStep[] {
  const page = state.pages.slice().sort((a, b) => a.order - b.order)[0];
  const actions = page?.actions?.length ? page.actions : state.actions;
  const pageName = page?.name ?? '';

  return actions.map((action, i) => mapActionToSingleStep(action, pageName, i + 1));
}

export function exportSingleStepToJson(state: RecordingState): string {
  return JSON.stringify(buildSingleStepExport(state), null, 2);
}

// ── Deduplicate pages by domain + url ─────────────────────

function deduplicatePages(pages: ExportPage[], keys: string[]): ExportPage[] {
  const map = new Map<string, ExportPage>();

  for (const [i, page] of pages.entries()) {
    const key = keys[i];
    const existing = map.get(key);
    if (!existing) {
      // First occurrence — clone with new pageOrder based on insertion order
      map.set(key, {
        pageOrder: map.size + 1,
        pageName: page.pageName,
        pageUrl: page.pageUrl,
        pageTitle: page.pageTitle,
        ...(page.pageTag ? { pageTag: page.pageTag } : {}),
        steps: [...page.steps],
      });
    } else {
      // Subsequent visit — append steps to the existing page
      existing.steps.push(...page.steps);
    }
  }

  return Array.from(map.values());
}

// ── Strip empty values ──────────────────────────────────────

function stripEmpty(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripEmpty);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === '') continue;
      if (typeof v === 'object' && v !== null) {
        const cleaned = stripEmpty(v);
        // skip empty objects (but keep arrays even if empty)
        if (!Array.isArray(cleaned) && typeof cleaned === 'object' && Object.keys(cleaned as object).length === 0) continue;
        result[k] = cleaned;
      } else {
        result[k] = v;
      }
    }
    return result;
  }
  return obj;
}

// ── Export helpers ───────────────────────────────────────────

export function exportToJson(recording: ExportRecording): string {
  return JSON.stringify(stripEmpty(recording));
}

export function makeFilenameBase(testName: string): string {
  const name = testName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = new Date().toISOString().split('T')[0];
  return `${name || 'test'}-${date}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJson(recording: ExportRecording): void {
  const json = exportToJson(recording);
  downloadBlob(new Blob([json], { type: 'application/json' }), `${makeFilenameBase(recording.testName)}.json`);
}
