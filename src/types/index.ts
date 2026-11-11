// ============================================================
// StepsToCase - Type Definitions
// ============================================================

export interface TestRecording {
  testMetadata: TestMetadata;
  preconditions?: Precondition[];
  pages: StepPage[];
  manualSteps?: ManualStep[];
}

export interface TestMetadata {
  name: string;
  description: string;
  timestamp: string; // ISO 8601
  duration: number; // milliseconds
  startUrl: string;
  endUrl: string;
  browserInfo?: {
    userAgent: string;
    viewport: { width: number; height: number };
  };
}

export interface StepPage {
  id: string;
  name: string;
  type: 'auto' | 'manual';
  pageContext?: {
    url: string;
    title: string;
  };
  pageTag?: string; // Design/layout tag from page recognition rules
  actions: Action[];
  order: number;
}

export type ActionType = 'click' | 'fill' | 'press' | 'navigate' | 'select' | 'check' | 'uncheck' | 'dblclick' | 'assert' | 'step';

export interface ElementInfo {
  tagName: string;
  textContent: string;
  accessibleName: string;
  innerText: string;
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
  title?: string;
  attributes: Record<string, string>;
}

export interface PageContext {
  url: string;
  title: string;
  domain: string;
  pathname: string;
  pageTag?: string; // Design/layout tag matched by page recognition rules
  frameUrl?: string; // Set when the step happened inside an iframe; selectors are relative to that frame
}

export type SelectorType = 'testid' | 'role' | 'label' | 'placeholder' | 'text' | 'css' | 'id' | 'name' | 'aria' | 'href' | 'alt' | 'title' | 'data-attr' | 'sibling' | 'parent-scoped';

export interface SelectorOption {
  type: SelectorType;
  value: string;
  score: number;
}

export interface Selectors {
  primary: SelectorOption;
  alternatives: SelectorOption[];
  contextText?: string; // Best descriptive text found during hierarchy analysis
  descriptionHierarchy?: HierarchyOption;
  descriptionSource?: string;
  descriptionDepth?: number | null;
  descriptionCandidates?: DescriptionCandidate[]; // All texts scraped across hierarchy levels
}

/** A description text scraped at a specific hierarchy level (Algorithm 1, all-levels scan) */
export interface DescriptionCandidate {
  text: string;
  level: HierarchyOption; // hierarchy level the text was found at
  source: string;         // human-readable source, e.g. "1+ upper sibling 2"
  attr: string;           // anchor attribute that produced the text
}

export interface TriggeredRequest {
  url: string;
  method: string;
  status?: number;
  type?: string;
  duration?: number;
}

export interface ActionData {
  value?: string;
  button?: 'left' | 'right' | 'middle';
  modifiers?: string[];
  selectedOption?: string;
  key?: string;
  triggeredRequests?: TriggeredRequest[];
  triggeredNavigation?: {
    url: string;
    title?: string;
  };
}

export type AssertionType =
  | 'text_equals'
  | 'text_contains'
  | 'visible'
  | 'hidden'
  | 'enabled'
  | 'disabled'
  | 'checked'
  | 'unchecked';

export interface ExpectedResult {
  description: string;
  assertion?: {
    element?: {
      selector: string;
      textContent?: string;
      accessibleName?: string;
    };
    type: AssertionType;
    expectedValue?: string;
  };
}

export interface ContainerContext {
  containerTag: string;    // e.g. "section", "dialog", "div"
  containerLabel: string;  // best label: aria-label, heading text, data-title, etc.
  containerHtml?: string;  // stripped outerHTML of the container for LLM locator generation
}

export interface Action {
  id: string;
  type: ActionType;
  timestamp: number; // relative to test start
  element: ElementInfo;
  page: PageContext;
  selectors: Selectors;
  actionData?: ActionData;
  expectedResults?: ExpectedResult[];
  subActions?: Action[];
  manualSubSteps?: ManualSubStep[];
  customText?: string; // User-edited step description
  subStepName?: string; // Custom label for nested sub-actions
  containerContext?: ContainerContext;
  componentTag?: string; // Component tag matched by component recognition rules (e.g. "header", "nav")
}

// A precondition for the test — named requirement that must be true before the test starts
export interface Precondition {
  id: string;
  name: string;
  order: number;
}

// A manual test step that references a range of automation actions
export interface ManualStep {
  id: string;
  name: string;
  actionIds: string[]; // ordered IDs of the automation steps this covers
  pageId: string;     // which page these steps belong to
  order: number;
}

// A manual sub-step that covers contiguous sub-actions within a parent action
export interface ManualSubStep {
  id: string;
  name: string;
  subActionIds: string[]; // ordered IDs of the sub-actions this covers
  parentActionId: string; // which parent action these sub-actions belong to
  order: number;
}

// ============================================================
// Algorithm configuration types
// ============================================================

export type HierarchyOption = '0' | '1' | '1+' | '2' | '2+' | '3' | '3+';

/** A single entry in the description anchors list (Algorithm 1) */
export interface DescriptionAnchor {
  attr: string;     // e.g. 'innerText', 'textContent', 'aria-label', 'placeholder', 'value', 'title'
  builtin: boolean; // true = cannot be removed, only reordered
}

/** A single entry in the locator attributes list (Algorithm 2) */
export interface LocatorAttr {
  attr: string;       // e.g. 'id', 'data-testid', 'data-*', 'class', 'name'
  isWildcard: boolean; // true if ends with '*', e.g. 'data-*'
  builtin: boolean;
}

// ============================================================
// Message types for extension communication
// ============================================================

export type RecordingPhase = 'idle' | 'metadata' | 'recording' | 'review' | 'exporting';

export interface RecordingState {
  phase: RecordingPhase;
  mode?: 'full' | 'single'; // 'single' = single-step recorder (Page Object Context Scrapper)
  testMetadata: Partial<TestMetadata>;
  actions: Action[];
  pages: StepPage[];
  manualSteps: ManualStep[];
  preconditions: Precondition[];
  startTime?: number;
  isPaused?: boolean;
  lastPagePath?: string;
  baseUrl?: string;
  isElementPickerActive: boolean;
  pendingContainer?: ContainerContext; // set before an action to pre-assign container
}

// Messages: Content Script <-> Background
export type BackgroundMessage =
  | { type: 'START_RECORDING'; tabId: number }
  | { type: 'START_SINGLE_STEP'; tabId: number }
  | { type: 'STOP_RECORDING' }
  | { type: 'PAUSE_RECORDING' }
  | { type: 'CONTINUE_RECORDING'; tabId: number }
  | { type: 'GET_TARGET_TAB' }
  | { type: 'ACTION_CAPTURED'; action: Action }
  | { type: 'GET_STATE' }
  | { type: 'IS_RECORDING' }
  | { type: 'UPDATE_METADATA'; metadata: Partial<TestMetadata> }
  | { type: 'UPDATE_PAGES'; pages: StepPage[] }
  | { type: 'UPDATE_MANUAL_STEPS'; manualSteps: ManualStep[] }
  | { type: 'UPDATE_PRECONDITIONS'; preconditions: Precondition[] }
  | { type: 'ELEMENT_PICKER_START'; tabId?: number; pageUrl?: string }
  | { type: 'ELEMENT_PICKER_STOP'; tabId?: number }
  | { type: 'PICKER_NAV'; direction: 'up' | 'down'; tabId?: number }
  | { type: 'ELEMENT_PICKED'; elementInfo: ElementInfo; selectors: Selectors; containerHtml?: string }
  | { type: 'PICK_CANCELLED' }
  | { type: 'ATTACH_REQUESTS'; actionId: string; requests: TriggeredRequest[] }
  | { type: 'RESET_RECORDING' }
  | { type: 'REMOVE_SUB_ACTION'; parentActionId: string; subActionId: string }
  | { type: 'DELETE_ACTION'; actionId: string }
  | { type: 'UPDATE_ACTION_TEXT'; actionId: string; customText: string }
  | { type: 'SELECT_DESCRIPTION'; actionId: string; text: string; source?: string; level?: HierarchyOption }
  | { type: 'UPDATE_SUB_STEP_NAME'; actionId: string; subStepName: string }
  | { type: 'REORDER_SUB_ACTIONS'; parentActionId: string; subActionIds: string[] }
  | { type: 'UPDATE_MANUAL_SUB_STEPS'; parentActionId: string; manualSubSteps: ManualSubStep[] }
  | { type: 'UPDATE_FILL'; actionId: string; value: string }
  | { type: 'UPDATE_EXPECTED_RESULT'; actionId: string; resultIndex: number; result: ExpectedResult; element?: ElementInfo; selectors?: Selectors }
  | { type: 'LOAD_RECORDING'; recording: TestRecording }
  | { type: 'BACK_TO_RECORDING' }
  | { type: 'REMOVE_ACTION_CONTAINER'; actionId: string }
  | { type: 'HIGHLIGHT_AND_PICK_CONTAINER'; actionId: string; selector: string; candidateSelectors?: string[]; targetText?: string; tabId?: number }
  | { type: 'PICK_CONTAINER_PRE'; tabId?: number; pageUrl?: string }
  | { type: 'SET_PENDING_CONTAINER'; containerContext: ContainerContext }
  | { type: 'CLEAR_PENDING_CONTAINER' };

// ============================================================
// Export format types — produced by buildExportRecording()
// These are separate from the internal RecordingState types.
// ============================================================

export type ExportStepType =
  | 'RECORDED'
  | 'MANUAL'
  | 'MANUAL_WITHOUT_ELEMENT'
  | 'ASSERTION_WITH_ELEMENT'
  | 'ASSERTION_WITHOUT_ELEMENT'
  | 'COMBINED'
  | 'SUBGROUP';

export type ExportActionKind = 'action' | 'comment' | 'assertion' | 'subgroup';

export type ExportAssertionType =
  | 'visible' | 'hidden' | 'enabled' | 'disabled'
  | 'checked' | 'unchecked' | 'text_equals' | 'text_contains';

// Leaf step with element info (RECORDED)
export interface ExportActionStep {
  stepOrder: number;
  stepType: 'RECORDED';
  actionKind: 'action';
  actionName: string;
  actionValue: string;
  triggeredNavigationUrl: string;
  triggeredNavigationTitle: string;
  triggeredRequests?: Array<{ url: string; method: string; status?: number }>;
  elementTag: string;
  elementText: string;
  elementInnerText: string;
  elementAccessibleName: string;
  elementLabel: string;
  elementPlaceholder: string;
  elementAriaLabel: string;
  elementTitle: string;
  elementAttributes: Record<string, string>;
  selectorContextText: string;
  frameUrl?: string; // iframe the element lives in
  containerTag?: string;
  containerLabel?: string;
  containerHtml?: string;
  componentTag?: string; // Component tag matched by component recognition rules
}

// Comment step — no element (MANUAL, MANUAL_WITHOUT_ELEMENT, ASSERTION_WITHOUT_ELEMENT)
export interface ExportCommentStep {
  stepOrder: number;
  stepType: 'MANUAL' | 'MANUAL_WITHOUT_ELEMENT' | 'ASSERTION_WITHOUT_ELEMENT';
  actionKind: 'action' | 'comment' | 'assertion';
  actionName: string;
}

// Assertion step with element (ASSERTION_WITH_ELEMENT)
export interface ExportAssertionStep {
  stepOrder: number;
  stepType: 'ASSERTION_WITH_ELEMENT';
  actionKind: 'assertion';
  actionName: string;
  actionValue: string;
  expectedResultsDescription: string;
  assertElementType: ExportAssertionType;
  assertElementTag: string;
  assertElementText: string;
  assertElementInnerText: string;
  assertElementAccessibleName: string;
  assertElementLabel: string;
  assertElementPlaceholder: string;
  assertElementAriaLabel: string;
  assertElementTitle: string;
  assertElementAttributes: Record<string, string>;
  assertSelectorContextText: string;
  frameUrl?: string; // iframe the element lives in
  containerTag?: string;
  containerLabel?: string;
  containerHtml?: string;
  componentTag?: string; // Component tag matched by component recognition rules
}

// COMBINED container — holds only action leaf steps + comment labels
export interface ExportCombinedStep {
  stepOrder: number;
  stepType: 'COMBINED';
  actionKind: 'action';
  actionName: string;
  steps: Array<ExportActionStep | ExportCommentStep>;
}

// SUBGROUP container — holds any leaf step type
export type ExportSubgroupChildStep =
  | ExportActionStep
  | ExportCommentStep
  | ExportAssertionStep;

export interface ExportSubgroupStep {
  stepOrder: number;
  stepType: 'SUBGROUP';
  actionKind: 'subgroup';
  actionName: string;
  steps: ExportSubgroupChildStep[];
}

// Union of all top-level step types
export type ExportStep =
  | ExportActionStep
  | ExportCommentStep
  | ExportAssertionStep
  | ExportCombinedStep
  | ExportSubgroupStep;

export interface ExportPage {
  pageOrder: number;
  pageName: string;
  pageUrl: string;
  pageTitle: string;
  pageTag?: string; // Design/layout tag from page recognition rules
  steps: ExportStep[];
}

export interface ExportRecording {
  testName: string;
  baseUrl?: string; // origin of the tested site; startUrl and pageUrl are paths on it
  startUrl: string;
  preconditions?: string[];
  pages: ExportPage[];
}

// Flat export shape for one step of the single-page (Page Object Context Scrapper) flow
export interface ExportSingleStep {
  stepOrder: number;
  pageName: string;
  stepType: string;
  actionKind: string;
  actionName: string;
  elementTag: string;
  elementAttributes: Record<string, string>;
  containerTag: string;
  containerLabel: string;
  containerHtml: string;
}
