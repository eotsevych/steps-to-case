import React, {useEffect, useRef, useState} from 'react';
import type {ElementInfo, ExpectedResult, ExportRecording, HierarchyOption, Precondition, Selectors, TestRecording} from '../types';
import {useRecorderState} from './useRecorderState';
import {usePanelSettings} from './usePanelSettings';
import {TestMetadataForm} from './TestMetadataForm';
import {ExpectedResultModal} from './ExpectedResultModal';
import {StepOrganizer} from './StepOrganizer';
import {SingleStepRecorder} from './SingleStepRecorder';
import {RecordingView} from './RecordingView';
import {FinishView} from './FinishView';
import {WindowModeToggle} from './WindowModeToggle';
import {AddStepModal} from './AddStepModal';
import {AddPreconditionModal} from './AddPreconditionModal';
import {ContainerNameModal} from './ContainerNameModal';
import {DiscardConfirmModal} from './DiscardConfirmModal';
import {buildExportRecording, exportSingleStepToJson} from '../lib/exporter';
import {parseRecordedPageContext} from '../lib/pageUrl';

/** Element pre-picked as a container, awaiting a name from the user. */
interface PrePickedContainer {
  tagName: string;
  suggestedName: string;
  containerHtml?: string;
}

export function RecorderPanel() {
  const {state, send} = useRecorderState();
  const {debugMode} = usePanelSettings();
  const [showExpectedResult, setShowExpectedResult] = useState(false);
  const [pickedElement, setPickedElement] = useState<{ elementInfo: ElementInfo; selectors: Selectors } | null>(null);
  const [finishRecording, setFinishRecording] = useState<ExportRecording | null>(null);
  const [showAddStep, setShowAddStep] = useState(false);
  const [showAddPrecondition, setShowAddPrecondition] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [editingAssertionState, setEditingAssertionState] = useState<{ actionId: string; resultIndex: number } | null>(null);
  const [prePickedElement, setPrePickedElement] = useState<PrePickedContainer | null>(null);
  // Short message from the worker (a refused pick, a skipped step); hides itself
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Listen for element pick results — only from service worker (no sender.tab),
  // ignoring the raw ELEMENT_PICKED from the content script which the SW may
  // have already consumed for container picking.
  useEffect(() => {
    const listener = (message: { type: string; elementInfo?: ElementInfo; selectors?: Selectors; containerHtml?: string; text?: string }, sender: chrome.runtime.MessageSender) => {
      if (sender.tab) return; // ignore messages from content scripts
      if (message.type === 'NOTICE' && message.text) setNotice(message.text);
      if (message.type === 'ELEMENT_PICKED' && message.elementInfo && message.selectors) {
        setPickedElement({elementInfo: message.elementInfo, selectors: message.selectors});
      }
      if (message.type === 'CONTAINER_PRE_PICKED' && message.elementInfo) {
        const el = message.elementInfo;
        setPrePickedElement({
          tagName: el.tagName,
          suggestedName: message.selectors?.contextText
            || el.accessibleName || el.ariaLabel || el.innerText?.slice(0, 60) || el.title || el.tagName || '',
          containerHtml: message.containerHtml,
        });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // While the element/container picker is active, keyboard focus usually stays
  // in the panel — forward Esc (cancel) and ↑/↓ (tree navigation) to the page.
  useEffect(() => {
    if (!state.isElementPickerActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void send({type: 'ELEMENT_PICKER_STOP'});
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        void send({type: 'PICKER_NAV', direction: e.key === 'ArrowUp' ? 'up' : 'down'});
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [state.isElementPickerActive, send]);

  const resolveTargetTab = () => new Promise<chrome.tabs.Tab | null>((resolve) => {
    chrome.runtime.sendMessage({type: 'GET_TARGET_TAB'}, (tab) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(tab ?? null);
    });
  });

  const handleStartRecording = async () => {
    const tab = await resolveTargetTab();
    if (tab?.id) await send({type: 'START_RECORDING', tabId: tab.id});
  };

  const handleStartSingleStep = async () => {
    const tab = await resolveTargetTab();
    if (tab?.id) await send({type: 'START_SINGLE_STEP', tabId: tab.id});
  };

  const handleStopRecording = () => send({type: 'STOP_RECORDING'});

  const handleAddExpectedResult = () => {
    setShowExpectedResult(true);
    setPickedElement(null);
  };

  const handleSaveManualStep = async (text: string) => {
    const tab = await resolveTargetTab();
    const page = parseRecordedPageContext(tab?.url || '', tab?.title || '');

    const stepAction = {
      id: '',
      type: 'step' as const,
      timestamp: 0,
      element: {
        tagName: '',
        textContent: text,
        accessibleName: text,
        innerText: text,
        attributes: {},
      },
      page,
      selectors: {
        primary: {type: 'css' as const, value: '', score: 100},
        alternatives: [],
      },
      customText: text,
    };

    await send({type: 'ACTION_CAPTURED', action: stepAction});
    setShowAddStep(false);
  };

  const handleSaveExpectedResult = async (result: ExpectedResult) => {
    // Build a standalone assert action with current page context
    const tab = await resolveTargetTab();
    const page = parseRecordedPageContext(tab?.url || '', tab?.title || '');

    const assertAction = {
      id: '',
      type: 'assert' as const,
      timestamp: 0,
      element: pickedElement?.elementInfo || {
        tagName: '',
        textContent: result.description,
        accessibleName: result.description,
        innerText: result.description,
        attributes: {},
      },
      page,
      selectors: pickedElement?.selectors || {
        primary: {type: 'css' as const, value: '', score: 100},
        alternatives: [],
      },
      expectedResults: [result],
    };

    await send({type: 'ACTION_CAPTURED', action: assertAction});
    setShowExpectedResult(false);
    setPickedElement(null);
  };

  const handlePickElement = () => send({type: 'ELEMENT_PICKER_START'});

  const handleFinish = () => setFinishRecording(buildExportRecording(state));

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleLoadJson = () => {
    if (!fileInputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const recording: TestRecording = JSON.parse(text);
          await send({type: 'LOAD_RECORDING', recording});
        } catch (e) {
          console.error('[StepsToCase] Failed to load JSON:', e);
        }
        input.value = '';
      });
      document.body.appendChild(input);
      fileInputRef.current = input;
    }
    fileInputRef.current.click();
  };

  const handleReset = async () => {
    setFinishRecording(null);
    await send({type: 'RESET_RECORDING'});
  };

  /** Reset straight away when nothing would be lost, otherwise confirm first. */
  const handleResetRequest = () => {
    if (state.actions.length > 0) {
      setShowBackConfirm(true);
    } else {
      void handleReset();
    }
  };

  const handleContinue = async () => {
    const tab = await resolveTargetTab();
    if (tab?.id) await send({type: 'CONTINUE_RECORDING', tabId: tab.id});
  };

  const actionHandlers = {
    onRemoveSubAction: (parentActionId: string, subActionId: string) =>
      void send({type: 'REMOVE_SUB_ACTION', parentActionId, subActionId}),
    onDeleteAction: (actionId: string) => void send({type: 'DELETE_ACTION', actionId}),
    onUpdateActionText: (actionId: string, customText: string) =>
      void send({type: 'UPDATE_ACTION_TEXT', actionId, customText}),
    onSelectDescription: (actionId: string, candidate: { text: string; source?: string; level?: HierarchyOption }) =>
      void send({type: 'SELECT_DESCRIPTION', actionId, text: candidate.text, source: candidate.source, level: candidate.level}),
    onUpdateSubStepName: (actionId: string, subStepName: string) =>
      void send({type: 'UPDATE_SUB_STEP_NAME', actionId, subStepName}),
    onReorderSubActions: (parentActionId: string, subActionIds: string[]) =>
      void send({type: 'REORDER_SUB_ACTIONS', parentActionId, subActionIds}),
    onPickContainer: (actionId: string, selector: string, candidateSelectors?: string[], targetText?: string) =>
      void send({type: 'HIGHLIGHT_AND_PICK_CONTAINER', actionId, selector, candidateSelectors, targetText}),
    onRemoveContainer: (actionId: string) => void send({type: 'REMOVE_ACTION_CONTAINER', actionId}),
  };

  const handlePickContainerPre = () => send({type: 'PICK_CONTAINER_PRE'});

  const handleClearPendingContainer = () => send({type: 'CLEAR_PENDING_CONTAINER'});

  const handleConfirmPendingContainer = async (containerLabel: string) => {
    if (!prePickedElement) return;
    await send({
      type: 'SET_PENDING_CONTAINER',
      containerContext: {
        containerTag: prePickedElement.tagName,
        containerLabel,
        containerHtml: prePickedElement.containerHtml,
      },
    });
    setPrePickedElement(null);
  };

  const handleCancelPendingContainer = async () => {
    setPrePickedElement(null);
    await send({type: 'ELEMENT_PICKER_STOP'});
  };

  const handleEditAssertion = (actionId: string, resultIndex: number) => {
    setEditingAssertionState({actionId, resultIndex});
    setPickedElement(null);
  };

  const handleSaveEditedAssertion = async (result: ExpectedResult) => {
    if (!editingAssertionState) return;
    await send({
      type: 'UPDATE_EXPECTED_RESULT',
      actionId: editingAssertionState.actionId,
      resultIndex: editingAssertionState.resultIndex,
      result,
      // A re-picked element becomes the assert step's element (the exporter reads it from there)
      element: pickedElement?.elementInfo,
      selectors: pickedElement?.selectors,
    });
    setEditingAssertionState(null);
    setPickedElement(null);
  };

  const handleAddPrecondition = async (text: string) => {
    const newPrecondition: Precondition = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: text,
      order: state.preconditions.length,
    };
    await send({type: 'UPDATE_PRECONDITIONS', preconditions: [...state.preconditions, newPrecondition]});
    setShowAddPrecondition(false);
  };

  /** Leaving a step/assertion modal must not strand a pending container or an active picker. */
  const dismissCapturedModal = (close: () => void) => {
    close();
    setPickedElement(null);
    void handleClearPendingContainer();
    void send({type: 'ELEMENT_PICKER_STOP'});
  };

  // In review the steps live in the pages (after a JSON load, state.actions is empty)
  const stepCount = state.phase === 'review'
    ? state.pages.reduce((sum, page) => sum + page.actions.length, 0)
    : state.actions.length;

  // Render based on phase
  const renderContent = () => {
    // Finish view
    if (finishRecording) {
      return (
        <FinishView
          recording={finishRecording}
          onBack={() => setFinishRecording(null)}
          onNewTest={handleReset}
        />
      );
    }

    // Single-step (Page Object Context Scrapper) export view — skip the organize stage
    if (state.mode === 'single' && state.phase === 'review') {
      return (
        <FinishView
          recording={buildExportRecording(state)}
          jsonOnly
          jsonOverride={exportSingleStepToJson(state)}
          onBack={() => { void send({type: 'BACK_TO_RECORDING'}); }}
        />
      );
    }

    switch (state.phase) {
      case 'idle':
        return (
          <TestMetadataForm
            metadata={state.testMetadata}
            onSave={(metadata) => send({type: 'UPDATE_METADATA', metadata})}
            onStartRecording={handleStartRecording}
            onStartSingleStep={handleStartSingleStep}
            onLoadJson={handleLoadJson}
          />
        );

      case 'recording':
        if (state.mode === 'single') {
          return (
            <SingleStepRecorder
              actions={state.actions}
              pendingContainer={state.pendingContainer}
              onAddAssertion={handleAddExpectedResult}
              onPickContainerPre={handlePickContainerPre}
              onClearPendingContainer={handleClearPendingContainer}
              onAddManual={() => setShowAddStep(true)}
              onFinish={handleStopRecording}
              onBack={handleResetRequest}
              onDeleteAction={actionHandlers.onDeleteAction}
              onUpdateActionText={actionHandlers.onUpdateActionText}
              onSelectDescription={actionHandlers.onSelectDescription}
              onEditAssertion={handleEditAssertion}
              onPickContainer={actionHandlers.onPickContainer}
              onRemoveContainer={actionHandlers.onRemoveContainer}
              debug={debugMode}
            />
          );
        }
        return (
          <RecordingView
            actions={state.actions}
            preconditions={state.preconditions}
            manualSteps={state.manualSteps}
            testMetadata={state.testMetadata}
            isPaused={state.isPaused}
            pendingContainer={state.pendingContainer}
            onRename={(name) => send({type: 'UPDATE_METADATA', metadata: {...state.testMetadata, name}})}
            onReset={handleResetRequest}
            onPause={() => send({type: 'PAUSE_RECORDING'})}
            onContinue={handleContinue}
            onFinish={handleStopRecording}
            onUpdatePreconditions={(preconditions) => send({type: 'UPDATE_PRECONDITIONS', preconditions})}
            onAddPrecondition={() => setShowAddPrecondition(true)}
            onAddAssertion={handleAddExpectedResult}
            onAddManualStep={() => setShowAddStep(true)}
            onPickContainerPre={handlePickContainerPre}
            onClearPendingContainer={handleClearPendingContainer}
            onEditAssertion={handleEditAssertion}
            debug={debugMode}
            {...actionHandlers}
          />
        );

      case 'review':
        return (
          <StepOrganizer
            pages={state.pages}
            manualSteps={state.manualSteps}
            preconditions={state.preconditions}
            onUpdatePages={(pages) => send({type: 'UPDATE_PAGES', pages})}
            onUpdateManualSteps={(manualSteps) => send({type: 'UPDATE_MANUAL_STEPS', manualSteps})}
            onUpdatePreconditions={(preconditions) => send({type: 'UPDATE_PRECONDITIONS', preconditions})}
            onRemoveSubAction={actionHandlers.onRemoveSubAction}
            onDeleteStep={actionHandlers.onDeleteAction}
            onUpdateActionText={actionHandlers.onUpdateActionText}
            onSelectDescription={actionHandlers.onSelectDescription}
            onUpdateSubStepName={actionHandlers.onUpdateSubStepName}
            onReorderSubActions={actionHandlers.onReorderSubActions}
            onUpdateManualSubSteps={(parentActionId, manualSubSteps) =>
              send({type: 'UPDATE_MANUAL_SUB_STEPS', parentActionId, manualSubSteps})}
            onFinish={handleFinish}
            onReset={() => setShowBackConfirm(true)}
            onBack={() => { void send({type: 'BACK_TO_RECORDING'}); }}
            debug={debugMode}
            testMetadata={state.testMetadata}
            onUpdateMetadata={(metadata) => send({type: 'UPDATE_METADATA', metadata})}
            onPickContainer={actionHandlers.onPickContainer}
            onRemoveContainer={actionHandlers.onRemoveContainer}
            baseUrl={state.baseUrl}
            onPickElement={(pageUrl) => send({type: 'ELEMENT_PICKER_START', pageUrl})}
            pickedElement={pickedElement}
            onClearPickedElement={() => {
              setPickedElement(null);
              send({type: 'ELEMENT_PICKER_STOP'});
            }}
            pendingContainer={state.pendingContainer}
            onPickContainerPre={(pageUrl) => send({type: 'PICK_CONTAINER_PRE', pageUrl})}
            onClearPendingContainer={handleClearPendingContainer}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div id="qa-panel-root" data-qa="panel" className="h-screen overflow-hidden bg-background text-foreground">
      <div id="qa-panel-content" data-qa="panel-content" className="h-full">
        {renderContent()}
      </div>

      <WindowModeToggle />

      {notice && (
        <div role="status" data-qa="notice"
             className="fixed top-2 left-2 right-2 z-50 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} title="Dismiss" className="shrink-0 font-semibold">&times;</button>
        </div>
      )}

      {/* Expected Result Modal — add new */}
      {showExpectedResult && (
        <ExpectedResultModal
          onSave={handleSaveExpectedResult}
          onCancel={() => dismissCapturedModal(() => setShowExpectedResult(false))}
          onPickElement={handlePickElement}
          pickedElement={pickedElement}
          pendingContainer={state.pendingContainer}
          onPickContainer={handlePickContainerPre}
          onClearContainer={handleClearPendingContainer}
        />
      )}

      {/* Edit Assertion Modal */}
      {editingAssertionState && (
        <ExpectedResultModal
          title="Edit Assertion"
          initialResult={state.actions
            .find(a => a.id === editingAssertionState.actionId)
            ?.expectedResults?.[editingAssertionState.resultIndex]}
          onSave={handleSaveEditedAssertion}
          onCancel={() => {
            setEditingAssertionState(null);
            setPickedElement(null);
            send({type: 'ELEMENT_PICKER_STOP'});
          }}
          onPickElement={handlePickElement}
          pickedElement={pickedElement}
        />
      )}

      {showAddStep && (
        <AddStepModal
          pendingContainer={state.pendingContainer}
          onSave={handleSaveManualStep}
          onClose={() => dismissCapturedModal(() => setShowAddStep(false))}
          onPickContainer={handlePickContainerPre}
          onClearContainer={handleClearPendingContainer}
        />
      )}

      {prePickedElement && (
        <ContainerNameModal
          tagName={prePickedElement.tagName}
          suggestedName={prePickedElement.suggestedName}
          onConfirm={handleConfirmPendingContainer}
          onCancel={handleCancelPendingContainer}
        />
      )}

      {showAddPrecondition && (
        <AddPreconditionModal
          onSave={handleAddPrecondition}
          onClose={() => setShowAddPrecondition(false)}
        />
      )}

      <DiscardConfirmModal
        open={showBackConfirm}
        stepCount={stepCount}
        onCancel={() => setShowBackConfirm(false)}
        onConfirm={async () => {
          setShowBackConfirm(false);
          await handleReset();
        }}
      />
    </div>
  );
}
