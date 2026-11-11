import type {
  Action,
  ActionType,
  AssertionType,
  ContainerContext,
  DescriptionCandidate,
  ElementInfo,
  HierarchyOption,
  ManualStep,
  ManualSubStep,
  PageContext,
  Precondition,
  SelectorOption,
  SelectorType,
  Selectors,
  StepPage,
  TestMetadata,
} from '../types';
import { normalizeRecordedPageUrl } from './pageUrl';

// Turns untrusted input (stored state from older versions, or a user's JSON
// file in either the internal or the export format) into valid internal types.

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type UnknownRecord = Record<string, unknown>;

const actionTypes = new Set<ActionType>([
  'click',
  'fill',
  'press',
  'navigate',
  'select',
  'check',
  'uncheck',
  'dblclick',
  'assert',
  'step',
]);

const assertionTypes = new Set<AssertionType>([
  'text_equals',
  'text_contains',
  'visible',
  'hidden',
  'enabled',
  'disabled',
  'checked',
  'unchecked',
]);

const hierarchyOptions = new Set<HierarchyOption>(['0', '1', '1+', '2', '2+', '3', '3+']);

const selectorTypes = new Set<SelectorType>([
  'testid',
  'role',
  'label',
  'placeholder',
  'text',
  'css',
  'id',
  'name',
  'aria',
  'href',
  'alt',
  'title',
  'data-attr',
  'sibling',
  'parent-scoped',
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeAttributes(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};

  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string') result[key] = raw;
    else if (typeof raw === 'number' || typeof raw === 'boolean') result[key] = String(raw);
  }
  return result;
}

function cssIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`);
}

function cssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function selectorFromAttributes(tagName: string, attrs: Record<string, string>): string {
  if (attrs.id) return `#${cssIdentifier(attrs.id)}`;

  for (const attr of ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa', 'name', 'aria-label', 'placeholder', 'title']) {
    const value = attrs[attr];
    if (value) return `${tagName || '*'}[${attr}="${cssString(value)}"]`;
  }

  return tagName || '';
}

function emptyElement(): ElementInfo {
  return {
    tagName: '',
    textContent: '',
    accessibleName: '',
    innerText: '',
    attributes: {},
  };
}

function normalizeElement(value: unknown): ElementInfo {
  if (!isRecord(value)) return emptyElement();

  return {
    tagName: stringValue(value.tagName).toLowerCase(),
    textContent: stringValue(value.textContent),
    accessibleName: stringValue(value.accessibleName),
    innerText: stringValue(value.innerText),
    label: stringValue(value.label) || undefined,
    placeholder: stringValue(value.placeholder) || undefined,
    ariaLabel: stringValue(value.ariaLabel) || undefined,
    title: stringValue(value.title) || undefined,
    attributes: normalizeAttributes(value.attributes),
  };
}

function pageParts(url: string): Pick<PageContext, 'domain' | 'pathname'> {
  try {
    const parsed = new URL(url);
    return {
      domain: parsed.hostname,
      pathname: parsed.pathname || '/',
    };
  } catch {
    return {
      domain: '',
      pathname: normalizeRecordedPageUrl(url || ''),
    };
  }
}

function normalizePageContext(value: unknown, fallback?: Partial<PageContext>): PageContext {
  const source = isRecord(value) ? value : {};
  const url = stringValue(source.url, fallback?.url ?? '');
  const title = stringValue(source.title, fallback?.title ?? '');
  const parts = pageParts(url);

  return {
    url,
    title,
    domain: stringValue(source.domain, fallback?.domain ?? parts.domain),
    pathname: stringValue(source.pathname, fallback?.pathname ?? parts.pathname),
    pageTag: stringValue(source.pageTag, fallback?.pageTag ?? '') || undefined,
    // Where the step ran; restoring stored state must not drop these
    frameUrl: stringValue(source.frameUrl) || undefined,
    frameId: stringValue(source.frameId) || undefined,
    frameName: stringValue(source.frameName) || undefined,
    query: stringValue(source.query) || undefined,
  };
}

function normalizeSelectorOption(value: unknown, fallback?: SelectorOption): SelectorOption {
  const source = isRecord(value) ? value : {};
  const rawType = source.type;
  const type = typeof rawType === 'string' && selectorTypes.has(rawType as SelectorType)
    ? rawType as SelectorType
    : fallback?.type ?? 'css';

  return {
    type,
    value: stringValue(source.value, fallback?.value ?? ''),
    score: numberValue(source.score, fallback?.score ?? 100),
  };
}

function normalizeDescriptionCandidates(value: unknown): DescriptionCandidate[] | undefined {
  const candidates = arrayValue(value)
    .map((raw): DescriptionCandidate | null => {
      if (!isRecord(raw)) return null;
      const text = stringValue(raw.text);
      if (!text) return null;
      const level = typeof raw.level === 'string' && hierarchyOptions.has(raw.level as HierarchyOption)
        ? raw.level as HierarchyOption
        : '0';
      return {
        text,
        level,
        source: stringValue(raw.source, 'custom'),
        attr: stringValue(raw.attr, 'custom'),
      };
    })
    .filter((candidate): candidate is DescriptionCandidate => !!candidate);

  return candidates.length > 0 ? candidates : undefined;
}

function normalizeSelectors(value: unknown, element: ElementInfo, contextText = ''): Selectors {
  const fallbackValue = selectorFromAttributes(element.tagName, element.attributes);
  const fallbackPrimary: SelectorOption = {
    type: 'css',
    value: fallbackValue,
    score: 100,
  };

  if (!isRecord(value)) {
    return {
      primary: fallbackPrimary,
      alternatives: [],
      ...(contextText ? { contextText } : {}),
    };
  }

  return {
    primary: normalizeSelectorOption(value.primary, fallbackPrimary),
    alternatives: arrayValue(value.alternatives).map(option => normalizeSelectorOption(option)),
    contextText: stringValue(value.contextText, contextText) || undefined,
    descriptionHierarchy: typeof value.descriptionHierarchy === 'string' ? value.descriptionHierarchy as Selectors['descriptionHierarchy'] : undefined,
    descriptionSource: stringValue(value.descriptionSource) || undefined,
    descriptionDepth: typeof value.descriptionDepth === 'number' || value.descriptionDepth === null ? value.descriptionDepth : undefined,
    descriptionCandidates: normalizeDescriptionCandidates(value.descriptionCandidates),
  };
}

function normalizeContainerContext(value: unknown): ContainerContext | undefined {
  if (!isRecord(value)) return undefined;

  const containerTag = stringValue(value.containerTag);
  const containerLabel = stringValue(value.containerLabel);
  if (!containerTag && !containerLabel) return undefined;

  return {
    containerTag,
    containerLabel,
    containerHtml: stringValue(value.containerHtml) || undefined,
  };
}

function normalizeManualSubSteps(value: unknown, parentActionId: string): ManualSubStep[] | undefined {
  const steps = arrayValue(value)
    .map((raw, index): ManualSubStep | null => {
      if (!isRecord(raw)) return null;
      const subActionIds = arrayValue(raw.subActionIds).filter((id): id is string => typeof id === 'string');
      return {
        id: stringValue(raw.id, generateId()),
        name: stringValue(raw.name, `Sub-step ${index + 1}`),
        subActionIds,
        parentActionId: stringValue(raw.parentActionId, parentActionId),
        order: numberValue(raw.order, index),
      };
    })
    .filter((step): step is ManualSubStep => !!step);

  return steps.length > 0 ? steps : undefined;
}

function normalizeAction(value: unknown, index: number, fallbackPage: PageContext): Action {
  const source = isRecord(value) ? value : {};
  const rawType = source.type;
  const type = typeof rawType === 'string' && actionTypes.has(rawType as ActionType)
    ? rawType as ActionType
    : 'step';
  const id = stringValue(source.id, generateId());
  const element = normalizeElement(source.element);
  const page = normalizePageContext(source.page, fallbackPage);
  const selectors = normalizeSelectors(source.selectors, element);

  const action: Action = {
    id,
    type,
    timestamp: numberValue(source.timestamp, index),
    element,
    page,
    selectors,
  };

  if (isRecord(source.actionData)) action.actionData = source.actionData as Action['actionData'];
  if (Array.isArray(source.expectedResults)) action.expectedResults = source.expectedResults as Action['expectedResults'];
  const subActions = arrayValue(source.subActions).map((sub, subIndex) => normalizeAction(sub, subIndex, page));
  if (subActions.length > 0) action.subActions = subActions;
  const manualSubSteps = normalizeManualSubSteps(source.manualSubSteps, id);
  if (manualSubSteps) action.manualSubSteps = manualSubSteps;
  if (typeof source.customText === 'string') action.customText = source.customText;
  if (typeof source.subStepName === 'string') action.subStepName = source.subStepName;
  const containerContext = normalizeContainerContext(source.containerContext);
  if (containerContext) action.containerContext = containerContext;
  if (typeof source.componentTag === 'string') action.componentTag = source.componentTag;
  if (typeof source.tab === 'number') action.tab = source.tab;

  return action;
}

function inferActionType(actionName: string, stepType: string): ActionType {
  const normalized = actionName.toLowerCase();
  if (stepType.startsWith('ASSERTION')) return 'assert';
  if (normalized.startsWith('double-click')) return 'dblclick';
  if (normalized.startsWith('click')) return 'click';
  if (normalized.startsWith('fill') || normalized.startsWith('type')) return 'fill';
  if (normalized.startsWith('select')) return 'select';
  if (normalized.startsWith('press')) return 'press';
  if (normalized.startsWith('check')) return 'check';
  if (normalized.startsWith('uncheck')) return 'uncheck';
  if (normalized.startsWith('navigate')) return 'navigate';
  return stepType === 'RECORDED' ? 'click' : 'step';
}

function normalizeAssertionType(value: unknown): AssertionType {
  return typeof value === 'string' && assertionTypes.has(value as AssertionType)
    ? value as AssertionType
    : 'visible';
}

function elementFromExportStep(step: UnknownRecord, assertion = false): ElementInfo {
  const prefix = assertion ? 'assertElement' : 'element';
  const tagName = stringValue(step[`${prefix}Tag`]).toLowerCase();
  const textContent = stringValue(step[`${prefix}Text`]);
  const innerText = stringValue(step[`${prefix}InnerText`]);
  const accessibleName = stringValue(step[`${prefix}AccessibleName`]);
  const label = stringValue(step[`${prefix}Label`]);
  const placeholder = stringValue(step[`${prefix}Placeholder`]);
  const ariaLabel = stringValue(step[`${prefix}AriaLabel`]);
  const title = stringValue(step[`${prefix}Title`]);
  const attributes = normalizeAttributes(step[`${prefix}Attributes`]);

  if (!tagName && !textContent && !innerText && !accessibleName && Object.keys(attributes).length === 0) {
    return emptyElement();
  }

  return {
    tagName,
    textContent,
    innerText,
    accessibleName,
    label: label || undefined,
    placeholder: placeholder || undefined,
    ariaLabel: ariaLabel || undefined,
    title: title || undefined,
    attributes,
  };
}

function containerFromExportStep(step: UnknownRecord): ContainerContext | undefined {
  return normalizeContainerContext({
    containerTag: step.containerTag,
    containerLabel: step.containerLabel,
    containerHtml: step.containerHtml,
  });
}

function exportStepToAction(value: unknown, index: number, page: PageContext): Action | null {
  if (!isRecord(value)) return null;

  const actionName = stringValue(value.actionName, `Step ${index + 1}`);
  const stepType = stringValue(value.stepType);
  const actionKind = stringValue(value.actionKind);

  if (stepType === 'COMBINED') {
    // Inverse of mapToCombined: a comment child labels the sub-steps that follow it
    const id = generateId();
    const subActions: Action[] = [];
    const manualSubSteps: ManualSubStep[] = [];
    for (const child of arrayValue(value.steps)) {
      if (isRecord(child) && child.actionKind === 'comment') {
        manualSubSteps.push({
          id: generateId(),
          name: stringValue(child.actionName),
          subActionIds: [],
          parentActionId: id,
          order: manualSubSteps.length,
        });
        continue;
      }
      const sub = exportStepToAction(child, subActions.length, page);
      if (!sub) continue;
      subActions.push(sub);
      manualSubSteps[manualSubSteps.length - 1]?.subActionIds.push(sub.id);
    }
    const labeled = manualSubSteps.filter(ms => ms.subActionIds.length > 0);

    return {
      id,
      type: 'step',
      timestamp: index,
      element: emptyElement(),
      page,
      selectors: normalizeSelectors(undefined, emptyElement(), actionName),
      customText: actionName,
      subActions: subActions.length > 0 ? subActions : undefined,
      manualSubSteps: labeled.length > 0 ? labeled : undefined,
    };
  }

  const isAssertion = actionKind === 'assertion' || stepType.startsWith('ASSERTION');
  const element = elementFromExportStep(value, isAssertion);
  const selectors = normalizeSelectors(undefined, element, stringValue(value.selectorContextText) || stringValue(value.assertSelectorContextText));
  // Manual steps and comments are free text — "Click on Save" written by a person is not a recorded click
  const type = stepType.startsWith('MANUAL') || actionKind === 'comment' ? 'step' : inferActionType(actionName, stepType);
  const action: Action = {
    id: generateId(),
    type,
    timestamp: numberValue(value.stepOrder, index),
    element,
    page,
    selectors,
    customText: actionName,
  };

  if (isAssertion) {
    action.type = 'assert';
    action.expectedResults = [{
      description: stringValue(value.expectedResultsDescription, actionName.replace(/^Assert:\s*/i, '')),
      assertion: {
        type: normalizeAssertionType(value.assertElementType),
        expectedValue: stringValue(value.actionValue) || undefined,
      },
    }];
  } else if (type === 'fill') {
    action.actionData = { value: stringValue(value.actionValue) };
  } else if (type === 'press') {
    action.actionData = { key: stringValue(value.actionValue) };
  } else if (type === 'select') {
    action.actionData = { selectedOption: stringValue(value.actionValue) };
  } else if (type === 'navigate') {
    action.actionData = { triggeredNavigation: { url: stringValue(value.triggeredNavigationUrl), title: stringValue(value.triggeredNavigationTitle) } };
  }

  const containerContext = containerFromExportStep(value);
  if (containerContext) action.containerContext = containerContext;
  if (typeof value.componentTag === 'string') action.componentTag = value.componentTag;
  action.page = {
    ...action.page,
    frameUrl: stringValue(value.frameUrl) || undefined,
    frameId: stringValue(value.frameId) || undefined,
    frameName: stringValue(value.frameName) || undefined,
    query: stringValue(value.pageQuery) || undefined,
  };
  if (typeof value.tab === 'number') action.tab = value.tab;

  return action;
}

/**
 * Export-format steps of one page. A SUBGROUP is a composite ("Compose") step:
 * its children are ordinary page steps, grouped by a ManualStep — not sub-actions.
 */
function normalizeExportSteps(value: unknown, page: PageContext, pageId: string, manualSteps: ManualStep[]): Action[] {
  const actions: Action[] = [];
  for (const step of arrayValue(value)) {
    if (isRecord(step) && step.stepType === 'SUBGROUP') {
      const children = normalizeExportSteps(step.steps, page, pageId, manualSteps);
      actions.push(...children);
      if (children.length > 0) {
        manualSteps.push({
          id: generateId(),
          name: stringValue(step.actionName, `Step ${actions.length}`),
          actionIds: children.map(a => a.id),
          pageId,
          order: manualSteps.length,
        });
      }
      continue;
    }
    const action = exportStepToAction(step, actions.length, page);
    if (action) actions.push(action);
  }
  return actions;
}

function normalizePage(value: unknown, index: number, manualSteps: ManualStep[]): StepPage {
  const source = isRecord(value) ? value : {};
  const pageContext = normalizePageContext(source.pageContext, {
    url: stringValue(source.pageUrl),
    title: stringValue(source.pageTitle),
    domain: stringValue(source.pageDomain) || undefined,
    pageTag: stringValue(source.pageTag) || undefined,
  });
  const id = stringValue(source.id, generateId());
  const page: StepPage = {
    id,
    name: stringValue(source.name, stringValue(source.pageName, `Page ${index + 1}`)),
    type: source.type === 'manual' ? 'manual' : 'auto',
    pageContext: {
      url: pageContext.url,
      title: pageContext.title,
    },
    pageTag: stringValue(source.pageTag) || undefined,
    actions: Array.isArray(source.actions)
      ? source.actions.map((action, actionIndex) => normalizeAction(action, actionIndex, pageContext))
      : normalizeExportSteps(source.steps, pageContext, id, manualSteps),
    order: numberValue(source.order, numberValue(source.pageOrder, index)),
  };

  return page;
}

/** Top-level actions of stored internal state. */
export function normalizeActions(value: unknown): Action[] {
  return arrayValue(value).map((action, index) => normalizeAction(action, index, normalizePageContext(undefined)));
}

/** Pages in the internal or export format; SUBGROUPs found in export pages are added to manualSteps. */
export function normalizePages(value: unknown, manualSteps: ManualStep[] = []): StepPage[] {
  return arrayValue(value).map((page, index) => normalizePage(page, index, manualSteps));
}

export function normalizeManualSteps(value: unknown): ManualStep[] {
  return arrayValue(value)
    .map((raw, index): ManualStep | null => {
      if (!isRecord(raw)) return null;
      const legacyGroupId = stringValue(raw.groupId);
      return {
        id: stringValue(raw.id, generateId()),
        name: stringValue(raw.name, `Manual step ${index + 1}`),
        actionIds: arrayValue(raw.actionIds).filter((id): id is string => typeof id === 'string'),
        pageId: stringValue(raw.pageId, legacyGroupId),
        order: numberValue(raw.order, index),
      };
    })
    .filter((step): step is ManualStep => !!step);
}

export function normalizePreconditions(value: unknown): Precondition[] {
  return arrayValue(value)
    .map((raw, index): Precondition | null => {
      if (typeof raw === 'string') {
        return {
          id: `prec-${Date.now()}-${index}`,
          name: raw,
          order: index,
        };
      }
      if (!isRecord(raw)) return null;
      return {
        id: stringValue(raw.id, `prec-${Date.now()}-${index}`),
        name: stringValue(raw.name),
        order: numberValue(raw.order, index),
      };
    })
    .filter((precondition): precondition is Precondition => !!precondition && !!precondition.name);
}

function getLegacyPages(recording: unknown): unknown[] {
  const legacyPages = isRecord(recording) ? recording.groups : undefined;
  return arrayValue(legacyPages);
}

export function normalizeImportedRecording(recording: unknown): {
  testMetadata: Partial<TestMetadata>;
  pages: StepPage[];
  manualSteps: ManualStep[];
  preconditions: Precondition[];
  baseUrl?: string;
} {
  const source = isRecord(recording) ? recording : {};
  const rawMetadata = isRecord(source.testMetadata) ? source.testMetadata : {};
  const testMetadata: Partial<TestMetadata> = {
    ...rawMetadata,
    name: stringValue(rawMetadata.name, stringValue(source.testName)),
    startUrl: stringValue(rawMetadata.startUrl, stringValue(source.startUrl)),
  };

  const sourcePages = Array.isArray(source.pages) ? source.pages : getLegacyPages(source);
  const subgroupSteps: ManualStep[] = [];
  let pages = normalizePages(sourcePages, subgroupSteps);

  if (pages.length === 0 && Array.isArray(source.actions)) {
    const fallbackPageContext = normalizePageContext(undefined, {
      url: testMetadata.startUrl ?? '',
      title: '',
    });
    pages = [{
      id: generateId(),
      name: 'Imported Steps',
      type: 'manual',
      pageContext: {
        url: fallbackPageContext.url,
        title: fallbackPageContext.title,
      },
      actions: source.actions.map((action, index) => normalizeAction(action, index, fallbackPageContext)),
      order: 0,
    }];
  }

  if (pages.length === 0 && typeof source.stepType === 'string') {
    const pageContext = normalizePageContext(undefined, {
      url: testMetadata.startUrl ?? '',
      title: '',
    });
    const action = exportStepToAction(source, 0, pageContext);
    pages = [{
      id: generateId(),
      name: stringValue(source.pageName, 'Imported Step'),
      type: 'manual',
      pageContext: {
        url: pageContext.url,
        title: pageContext.title,
      },
      actions: action ? [action] : [],
      order: 0,
    }];
  }

  return {
    testMetadata,
    pages,
    manualSteps: [...normalizeManualSteps(source.manualSteps), ...subgroupSteps],
    preconditions: normalizePreconditions(source.preconditions),
    baseUrl: stringValue(source.baseUrl) || undefined,
  };
}
