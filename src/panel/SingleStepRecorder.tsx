import React from 'react';
import type { Action, ContainerContext, HierarchyOption } from '../types';
import { ActionsList } from './ActionsList';
import { Button } from './components/ui/button';
import { Check, Plus, Container, X, ArrowLeft } from 'lucide-react';

interface Props {
  actions: Action[];
  pendingContainer?: ContainerContext;
  onAddAssertion: () => void;
  onPickContainerPre: () => void;
  onClearPendingContainer: () => void;
  onAddManual: () => void;
  onFinish: () => void;
  onBack: () => void;
  onDeleteAction: (actionId: string) => void;
  onUpdateActionText: (actionId: string, customText: string) => void;
  onSelectDescription?: (actionId: string, candidate: { text: string; source?: string; level?: HierarchyOption }) => void;
  onEditAssertion: (actionId: string, resultIndex: number) => void;
  onPickContainer: (actionId: string, selector: string, candidateSelectors?: string[], targetText?: string) => void;
  onRemoveContainer: (actionId: string) => void;
  debug?: boolean;
}

/**
 * Single-page recorder view — the "Page Object Context Scrapper" flow.
 * Records every step (recorded actions, assertions, or manual) that happens on
 * the current page — steps captured after navigating elsewhere are dropped —
 * with the same container/assertion/edit affordances as the full recorder, then
 * exports them as a self-contained array of one-page steps.
 */
export function SingleStepRecorder({
  actions,
  pendingContainer,
  onAddAssertion,
  onPickContainerPre,
  onClearPendingContainer,
  onAddManual,
  onFinish,
  onBack,
  onDeleteAction,
  onUpdateActionText,
  onSelectDescription,
  onEditAssertion,
  onPickContainer,
  onRemoveContainer,
  debug,
}: Props) {
  const hasSteps = actions.length > 0;

  return (
    <div id="qa-single-step-view" data-qa="single-step-view" className="flex flex-col h-screen bg-background">
      {/* Sticky header */}
      <div data-qa="single-step-bar" className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button
              data-qa="single-step-back-btn"
              variant="ghost"
              size="icon"
              onClick={onBack}
              title="Cancel"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span data-qa="single-step-dot" className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-red-500 shrink-0">
              Single Page
            </span>
          </div>
          <Button
            data-qa="single-step-finish-btn"
            size="sm"
            onClick={onFinish}
            disabled={!hasSteps}
          >
            <Check className="w-4 h-4 mr-1" />
            Done
          </Button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Interact with the page to capture steps, or add an assertion / manual step below.
          Only steps on the current page are recorded — navigating away stops capture.
        </p>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Steps</h2>
            <div className="flex items-center gap-1">
              <Button
                data-qa="single-step-add-assertion-btn"
                variant="ghost"
                size="sm"
                onClick={onAddAssertion}
              >
                <Plus className="w-3 h-3 mr-1" />
                Assertion
              </Button>
              <Button
                data-qa="single-step-pick-container-btn"
                variant="ghost"
                size="sm"
                onClick={onPickContainerPre}
              >
                <Container className="w-3 h-3 mr-1" />
                Container
              </Button>
              <Button
                data-qa="single-step-add-manual-btn"
                variant="ghost"
                size="sm"
                onClick={onAddManual}
              >
                <Plus className="w-3 h-3 mr-1" />
                Manual
              </Button>
            </div>
          </div>

          {/* Pending container indicator */}
          {pendingContainer && (
            <div data-qa="single-step-pending-container" className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-md border border-amber-300 bg-amber-50 text-amber-700">
              <span className="text-sm font-semibold flex-1 truncate">
                Container: {pendingContainer.containerLabel}
              </span>
              <Button
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

          {hasSteps ? (
            <ActionsList
              actions={actions}
              onDeleteAction={onDeleteAction}
              onUpdateActionText={onUpdateActionText}
              onSelectDescription={onSelectDescription}
              onEditAssertion={onEditAssertion}
              onPickContainer={onPickContainer}
              onRemoveContainer={onRemoveContainer}
              debug={debug}
            />
          ) : (
            <p data-qa="single-step-empty" className="text-xs text-muted-foreground py-2">
              No steps captured yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
