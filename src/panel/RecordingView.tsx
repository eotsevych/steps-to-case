import React, { useMemo, useRef, useState } from 'react';
import type { Action, ContainerContext, HierarchyOption, ManualStep, Precondition, TestMetadata } from '../types';
import { ActionsList } from './ActionsList';
import { PreconditionsSection } from './PreconditionsSection';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { RotateCcw, Pause, Play, Check, Plus, Container, X } from 'lucide-react';

interface Props {
  actions: Action[];
  preconditions: Precondition[];
  manualSteps: ManualStep[];
  testMetadata: Partial<TestMetadata>;
  isPaused?: boolean;
  pendingContainer?: ContainerContext;
  onRename: (name: string) => void;
  onReset: () => void;
  onPause: () => void;
  onContinue: () => void;
  onFinish: () => void;
  onUpdatePreconditions: (preconditions: Precondition[]) => void;
  onAddPrecondition: () => void;
  onAddAssertion: () => void;
  onAddManualStep: () => void;
  onPickContainerPre: () => void;
  onClearPendingContainer: () => void;
  onRemoveSubAction: (parentActionId: string, subActionId: string) => void;
  onDeleteAction: (actionId: string) => void;
  onUpdateActionText: (actionId: string, customText: string) => void;
  onSelectDescription: (actionId: string, candidate: { text: string; source?: string; level?: HierarchyOption }) => void;
  onUpdateSubStepName: (actionId: string, subStepName: string) => void;
  onReorderSubActions: (parentActionId: string, subActionIds: string[]) => void;
  onEditAssertion: (actionId: string, resultIndex: number) => void;
  onPickContainer: (actionId: string, selector: string, candidateSelectors?: string[], targetText?: string) => void;
  onRemoveContainer: (actionId: string) => void;
  debug?: boolean;
}

/** Live recording screen for the full (multi-step) mode. */
export function RecordingView({
  actions,
  preconditions,
  manualSteps,
  testMetadata,
  isPaused,
  pendingContainer,
  onRename,
  onReset,
  onPause,
  onContinue,
  onFinish,
  onUpdatePreconditions,
  onAddPrecondition,
  onAddAssertion,
  onAddManualStep,
  onPickContainerPre,
  onClearPendingContainer,
  debug,
  ...actionHandlers
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameEditValue, setNameEditValue] = useState('');
  // Both Enter and Escape unmount the input, and removal fires blur afterwards;
  // the first of the two to run decides, so Escape genuinely discards the edit.
  const nameSettledRef = useRef(false);

  // Actions that belong to a composed (manual) step — locked while recording
  const { lockedActionIds, lockedActionLabels } = useMemo(() => {
    const ids = new Set<string>();
    const labels = new Map<string, string>();
    for (const ms of manualSteps) {
      for (const id of ms.actionIds) {
        ids.add(id);
        labels.set(id, ms.name);
      }
    }
    return { lockedActionIds: ids, lockedActionLabels: labels };
  }, [manualSteps]);

  const startNameEdit = () => {
    nameSettledRef.current = false;
    setNameEditValue(testMetadata.name || '');
    setEditingName(true);
  };

  const settleNameEdit = (save: boolean) => {
    if (nameSettledRef.current) return;
    nameSettledRef.current = true;
    const value = nameEditValue;
    setEditingName(false);
    if (save) onRename(value.trim() || 'Untitled Test');
  };

  return (
    <div id="qa-recording-view" data-qa="recording-view" className="flex flex-col h-screen bg-background">
      {/* Sticky header */}
      <div id="qa-recording-bar" data-qa="recording-bar" className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 space-y-2">
        {/* Row 1: recording indicator + test name */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isPaused ? (
              <Pause className="w-3 h-3 text-amber-500 shrink-0" />
            ) : (
              <span id="qa-recording-dot" data-qa="recording-dot" className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            )}
            <span className={`text-xs font-bold uppercase tracking-wider shrink-0 ${isPaused ? 'text-amber-500' : 'text-red-500'}`}>
              {isPaused ? 'Paused' : 'Recording'}
            </span>
            {editingName ? (
              <Input
                id="qa-recording-name-input"
                data-qa="name-input"
                value={nameEditValue}
                onChange={e => setNameEditValue(e.target.value)}
                onBlur={() => settleNameEdit(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter') settleNameEdit(true);
                  if (e.key === 'Escape') settleNameEdit(false);
                }}
                autoFocus
                placeholder="Add test name…"
                className="h-6 text-sm font-semibold flex-1 min-w-0"
              />
            ) : (
              <span
                id="qa-recording-name"
                data-qa="test-name"
                onClick={startNameEdit}
                title="Click to edit test name"
                className={`text-sm font-semibold truncate cursor-text flex-1 min-w-0 ${testMetadata.name ? 'text-foreground' : 'text-muted-foreground italic'}`}
              >
                {testMetadata.name || 'Add test name…'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              id="qa-recording-reset-btn"
              data-qa="reset-btn"
              variant="ghost"
              size="icon"
              onClick={onReset}
              title="Reset recording"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              id="qa-recording-pause-btn"
              data-qa="pause-btn"
              variant="ghost"
              size="icon"
              onClick={isPaused ? onContinue : onPause}
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
            <Button
              id="qa-recording-finish-btn"
              data-qa="finish-btn"
              size="sm"
              onClick={onFinish}
            >
              <Check className="w-4 h-4 mr-1" />
              Finish
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        <PreconditionsSection
          preconditions={preconditions}
          onChange={onUpdatePreconditions}
          onAdd={onAddPrecondition}
        />

        {/* Steps section */}
        <div id="qa-recording-steps">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Steps {isPaused && <span className="text-amber-600 font-normal normal-case tracking-normal">(paused)</span>}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                id="qa-recording-assertion-btn"
                data-qa="add-assertion-btn"
                variant="ghost"
                size="sm"
                onClick={onAddAssertion}
              >
                <Plus className="w-3 h-3 mr-1" />
                Assertion
              </Button>
              <Button
                id="qa-recording-pick-container-pre-btn"
                data-qa="pick-container-pre-btn"
                variant="ghost"
                size="sm"
                onClick={onPickContainerPre}
              >
                <Container className="w-3 h-3 mr-1" />
                Container
              </Button>
              <Button
                id="qa-recording-add-step-btn"
                data-qa="add-step-btn"
                variant="ghost"
                size="sm"
                onClick={onAddManualStep}
              >
                <Plus className="w-3 h-3 mr-1" />
                Manual
              </Button>
            </div>
          </div>

          {/* Pending container indicator */}
          {pendingContainer && (
            <div data-qa="pending-container-indicator" className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-md border border-amber-300 bg-amber-50 text-amber-700">
              <span data-qa="pending-container-name" className="text-sm font-semibold flex-1 truncate">
                Container: {pendingContainer.containerLabel}
              </span>
              <Button
                data-qa="clear-pending-container-btn"
                variant="ghost"
                size="icon"
                onClick={onClearPendingContainer}
                title="Clear container"
                className="h-5 w-5"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* Actions list */}
          <div className={isPaused ? 'opacity-50' : undefined}>
            <ActionsList
              actions={actions}
              debug={debug}
              lockedActionIds={lockedActionIds}
              lockedActionLabels={lockedActionLabels}
              {...actionHandlers}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
