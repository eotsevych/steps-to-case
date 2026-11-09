import React, { useState } from 'react';
import type { Action, HierarchyOption, ManualStep, StepPage as StepPageType } from '../types';
import { isAbsoluteUrl } from '../lib/pageUrl';
import { DraggableStep } from './DraggableStep';
import { Button } from './components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from './components/ui/dropdown-menu';
import { GripVertical, MoreVertical, Pencil, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  page: StepPageType;
  manualSteps: ManualStep[];
  onDragStepStart: (e: React.DragEvent, actionId: string, sourcePageId: string) => void;
  onDragStepOver: (e: React.DragEvent, targetActionId: string, targetPageId: string) => void;
  onDropStep: (e: React.DragEvent, targetPageId: string) => void;
  onDragPageStart: (e: React.DragEvent, pageId: string) => void;
  onRename: (pageId: string, name: string) => void;
  onDelete: (pageId: string) => void;
  onDeleteStep: (pageId: string, actionId: string) => void;
  onRemoveSubAction: (parentActionId: string, subActionId: string) => void;
  onUpdateActionText?: (actionId: string, customText: string) => void;
  onSelectDescription?: (actionId: string, candidate: { text: string; source?: string; level?: HierarchyOption }) => void;
  onUpdateSubStepName?: (actionId: string, subStepName: string) => void;
  onRenameManualStep: (id: string, name: string) => void;
  onDeleteManualStep: (id: string) => void;
  debug?: boolean;
  selectedPageId: string | null;
  selectedActionIds: string[];
  onSelectStep: (pageId: string, actionId: string) => void;
  onReorderSubActions?: (parentActionId: string, subActionIds: string[]) => void;
  onSelectSubStep?: (parentActionId: string, subActionId: string) => void;
  selectedSubParentId?: string | null;
  selectedSubActionIds?: string[];
  isTopLevelSelectionActive?: boolean;
  onRenameManualSubStep?: (parentActionId: string, manualSubStepId: string, name: string) => void;
  onDeleteManualSubStep?: (parentActionId: string, manualSubStepId: string) => void;
  onAddStep?: (pageId: string) => void;
  onAddAssertion?: (pageId: string) => void;
  onEditAssertion?: (actionId: string, resultIndex: number) => void;
  onPickContainer?: (actionId: string, selector: string, candidateSelectors?: string[], targetText?: string) => void;
  onRemoveContainer?: (actionId: string) => void;
  baseUrl?: string;
}

// ── Segment types ─────────────────────────────────────────────

type StepSegment = { kind: 'step'; action: Action; absoluteIndex: number };
type ManualSegment = { kind: 'manual'; manualStep: ManualStep; steps: { action: Action; absoluteIndex: number }[] };
type Segment = StepSegment | ManualSegment;

function buildSegments(actions: Action[], manualSteps: ManualStep[]): Segment[] {
  const actionToManual = new Map<string, ManualStep>();
  for (const ms of manualSteps) {
    for (const id of ms.actionIds) actionToManual.set(id, ms);
  }
  const segments: Segment[] = [];
  let i = 0;
  while (i < actions.length) {
    const ms = actionToManual.get(actions[i].id);
    if (ms) {
      const steps: { action: Action; absoluteIndex: number }[] = [];
      while (i < actions.length && actionToManual.get(actions[i].id) === ms) {
        steps.push({ action: actions[i], absoluteIndex: i });
        i++;
      }
      segments.push({ kind: 'manual', manualStep: ms, steps });
    } else {
      segments.push({ kind: 'step', action: actions[i], absoluteIndex: i });
      i++;
    }
  }
  return segments;
}

// ── Manual step wrapper ───────────────────────────────────────

function ManualStepWrapper({
  manualStep, steps, pageId,
  onRename, onDelete, onDragStart, onDragOver, onDeleteStep, onRemoveSubAction,
  onUpdateActionText, onSelectDescription, onUpdateSubStepName,
  debug, onReorderSubActions,
  onSelectSubStep, selectedSubParentId, selectedSubActionIds, isTopLevelSelectionActive,
  onRenameManualSubStep, onDeleteManualSubStep, onEditAssertion, onPickContainer, onRemoveContainer,
}: {
  manualStep: ManualStep;
  steps: { action: Action; absoluteIndex: number }[];
  pageId: string;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, actionId: string, sourcePageId: string) => void;
  onDragOver: (e: React.DragEvent, targetActionId: string, targetPageId: string) => void;
  onDeleteStep: (pageId: string, actionId: string) => void;
  onRemoveSubAction: (parentActionId: string, subActionId: string) => void;
  onUpdateActionText?: (actionId: string, customText: string) => void;
  onSelectDescription?: (actionId: string, candidate: { text: string; source?: string; level?: HierarchyOption }) => void;
  onUpdateSubStepName?: (actionId: string, subStepName: string) => void;
  debug?: boolean;
  onReorderSubActions?: (parentActionId: string, subActionIds: string[]) => void;
  onSelectSubStep?: (parentActionId: string, subActionId: string) => void;
  selectedSubParentId?: string | null;
  selectedSubActionIds?: string[];
  isTopLevelSelectionActive?: boolean;
  onRenameManualSubStep?: (parentActionId: string, manualSubStepId: string, name: string) => void;
  onDeleteManualSubStep?: (parentActionId: string, manualSubStepId: string) => void;
  onEditAssertion?: (actionId: string, resultIndex: number) => void;
  onPickContainer?: (actionId: string, selector: string, candidateSelectors?: string[], targetText?: string) => void;
  onRemoveContainer?: (actionId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(manualStep.name);

  const save = () => {
    if (editName.trim()) onRename(manualStep.id, editName.trim());
    setEditing(false);
  };

  return (
    <div className="border border-purple-300 rounded-lg mb-2">
      {/* Manual step header */}
      <div className="flex items-center gap-1 px-1.5 py-1.5 bg-purple-50 rounded-t-lg border-b border-purple-200">
        {editing ? (
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
            className="flex-1 px-2 py-0.5 border border-purple-400 rounded text-sm font-semibold outline-hidden bg-white"
          />
        ) : (
          <span
            className="flex-1 text-sm font-bold text-purple-800 cursor-text"
            onDoubleClick={() => { setEditName(manualStep.name); setEditing(true); }}
            title="Double-click to rename"
          >
            {manualStep.name}
          </span>
        )}
        <span className="text-xs text-purple-500 shrink-0">{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
        <Button variant="ghost" size="icon" onClick={() => { setEditName(manualStep.name); setEditing(true); }} title="Rename" className="h-6 w-6 text-purple-600">
          <Pencil className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(manualStep.id)} title="Remove manual step grouping" className="h-6 w-6 text-destructive hover:text-destructive">
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Steps inside the wrapper */}
      <div className="p-2">
        {steps.map(({ action, absoluteIndex }) => {
          return (
            <DraggableStep
              key={action.id}
              action={action}
              index={absoluteIndex}
              pageId={pageId}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDelete={(actionId) => onDeleteStep(pageId, actionId)}
              onRemoveSubAction={onRemoveSubAction}
              onUpdateActionText={onUpdateActionText}
              onSelectDescription={onSelectDescription}
              onUpdateSubStepName={onUpdateSubStepName}
              debug={debug}
              isSelectable={undefined}
              isSelected={undefined}
              onSelect={undefined}
              onReorderSubActions={onReorderSubActions}
              onSelectSubStep={onSelectSubStep}
              selectedSubParentId={selectedSubParentId}
              selectedSubActionIds={selectedSubActionIds}
              isTopLevelSelectionActive={isTopLevelSelectionActive}
              onRenameManualSubStep={onRenameManualSubStep}
              onDeleteManualSubStep={onDeleteManualSubStep}
              onEditAssertion={onEditAssertion}
              onPickContainer={onPickContainer}
              onRemoveContainer={onRemoveContainer}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── StepPageComponent ────────────────────────────────────────

export function StepPageComponent({
  page, manualSteps,
  onDragStepStart, onDragStepOver, onDropStep, onDragPageStart,
  onRename, onDelete, onDeleteStep, onRemoveSubAction,
  onUpdateActionText, onSelectDescription, onUpdateSubStepName,
  onRenameManualStep, onDeleteManualStep,
  debug,
  selectedPageId, selectedActionIds, onSelectStep,
  onReorderSubActions, onSelectSubStep,
  selectedSubParentId, selectedSubActionIds, isTopLevelSelectionActive,
  onRenameManualSubStep, onDeleteManualSubStep,
  onAddStep, onAddAssertion, onEditAssertion,
  onPickContainer, onRemoveContainer,
  baseUrl,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(page.name);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleRename = () => {
    if (editName.trim()) onRename(page.id, editName.trim());
    setIsEditing(false);
  };

  const isThisPageSelected = selectedPageId === page.id;
  const selectionActive = selectedPageId !== null;

  const selectedIndices = isThisPageSelected
    ? selectedActionIds.map(id => page.actions.findIndex(a => a.id === id)).filter(i => i >= 0)
    : [];
  const minSelected = selectedIndices.length > 0 ? Math.min(...selectedIndices) : -1;
  const maxSelected = selectedIndices.length > 0 ? Math.max(...selectedIndices) : -1;

  const inManualStep = new Set<string>();
  for (const ms of manualSteps) {
    for (const id of ms.actionIds) inManualStep.add(id);
  }

  const segments = buildSegments(page.actions, manualSteps);

  // Page URL for "open" link
  const pagePath = page.pageContext?.url || page.actions[0]?.page?.url;
  const pageUrl = pagePath ? (baseUrl && !isAbsoluteUrl(pagePath) ? baseUrl + pagePath : pagePath) : undefined;

  return (
    <div
      id={`qa-page-${page.id}`}
      data-qa={`page-${page.id}`}
      data-page-card
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); onDropStep(e, page.id); }}
      className={[
        'rounded-lg border mb-2 overflow-hidden transition-all',
        isDragOver ? 'border-ring' : 'border-border',
      ].join(' ')}
    >
      {/* Page header */}
      <div
        id={`qa-page-header-${page.id}`}
        data-qa={`page-header-${page.id}`}
        className={['flex items-center gap-1 px-1.5 py-1.5 bg-muted/40', collapsed ? '' : 'border-b border-border/60'].join(' ')}
      >
        {/* Drag handle */}
        <span
          id={`qa-page-drag-${page.id}`}
          data-qa={`page-drag-${page.id}`}
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            const card = (e.target as HTMLElement).closest('[data-page-card]') as HTMLElement;
            if (card) {
              const rect = card.getBoundingClientRect();
              e.dataTransfer.setDragImage(card, e.clientX - rect.left, e.clientY - rect.top);
            }
            onDragPageStart(e, page.id);
          }}
          title="Drag page"
          className="text-muted-foreground cursor-grab select-none shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </span>

        {/* Collapse toggle */}
        <button
          id={`qa-page-collapse-btn-${page.id}`}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand page' : 'Collapse page'}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronDown className="w-4 h-4" />
          }
        </button>

        {/* Page name */}
        {isEditing ? (
          <input
            id={`qa-page-name-input-${page.id}`}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsEditing(false); }}
            autoFocus
            className="flex-1 px-2 py-0.5 border border-ring rounded text-sm font-semibold outline-hidden bg-input-background"
          />
        ) : (
          <span
            id={`qa-page-name-${page.id}`}
            className="flex-1 text-sm font-semibold text-foreground cursor-pointer truncate"
            onDoubleClick={() => { setEditName(page.name); setIsEditing(true); }}
            title="Double-click to rename"
          >
            {page.name}
          </span>
        )}

        {/* Page tag */}
        {page.pageTag && !isEditing && (
          <span
            id={`qa-page-tag-${page.id}`}
            title={`Page tag: ${page.pageTag}`}
            className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 shrink-0"
          >
            {page.pageTag}
          </span>
        )}

        {/* Open URL link + Step count */}
        <div className="flex items-center gap-2 shrink-0">
        {pageUrl && !isEditing && (
          <a
            href={pageUrl}
            title={pageUrl}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Ask the worker for the recorded tab — "current window" is the panel
              // itself when it runs in the floating popup window
              chrome.runtime.sendMessage({ type: 'GET_TARGET_TAB' }, (tab?: { id?: number } | null) => {
                if (!chrome.runtime.lastError && tab?.id) chrome.tabs.update(tab.id, { url: pageUrl });
              });
            }}
            className="text-xs text-primary underline shrink-0 cursor-pointer leading-none"
          >
            (open)
          </a>
        )}

        {/* Step count */}
        <span id={`qa-page-count-${page.id}`} className="text-xs text-muted-foreground shrink-0">
          {page.actions.length} step{page.actions.length !== 1 ? 's' : ''}
        </span>
        </div>

        {/* 3-dot page menu */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" title="More actions">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onAddStep && (
              <DropdownMenuItem id={`qa-add-step-btn-${page.id}`} onClick={() => onAddStep(page.id)}>
                <Plus className="w-3 h-3" /> Add Step
              </DropdownMenuItem>
            )}
            {onAddAssertion && (
              <DropdownMenuItem id={`qa-add-assertion-btn-${page.id}`} onClick={() => onAddAssertion(page.id)}>
                <Plus className="w-3 h-3" /> Add Assertion
              </DropdownMenuItem>
            )}
            <DropdownMenuItem id={`qa-page-rename-btn-${page.id}`} onClick={() => { setEditName(page.name); setIsEditing(true); }}>
              <Pencil className="w-3 h-3" /> Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem id={`qa-page-delete-btn-${page.id}`} destructive onClick={() => onDelete(page.id)}>
              <Trash2 className="w-3 h-3" /> Delete Page
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Page body */}
      {!collapsed && (
        <div id={`qa-page-body-${page.id}`}>
          {page.actions.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground border-dashed border-2 border-border/50 rounded m-2">
              Drop steps here or add via menu
            </div>
          ) : (
            segments.map((segment, si) => {
              if (segment.kind === 'manual') {
                return (
                  <ManualStepWrapper
                    key={segment.manualStep.id}
                    manualStep={segment.manualStep}
                    steps={segment.steps}
                    pageId={page.id}
                    onRename={onRenameManualStep}
                    onDelete={onDeleteManualStep}
                    onDragStart={onDragStepStart}
                    onDragOver={onDragStepOver}
                    onDeleteStep={onDeleteStep}
                    onRemoveSubAction={onRemoveSubAction}
                    onUpdateActionText={onUpdateActionText}
                    onSelectDescription={onSelectDescription}
                    onUpdateSubStepName={onUpdateSubStepName}
                    debug={debug}
                    onReorderSubActions={onReorderSubActions}
                    onSelectSubStep={onSelectSubStep}
                    selectedSubParentId={selectedSubParentId}
                    selectedSubActionIds={selectedSubActionIds}
                    isTopLevelSelectionActive={isTopLevelSelectionActive}
                    onRenameManualSubStep={onRenameManualSubStep}
                    onDeleteManualSubStep={onDeleteManualSubStep}
                    onEditAssertion={onEditAssertion}
                    onPickContainer={onPickContainer}
                    onRemoveContainer={onRemoveContainer}
                  />
                );
              }

              const { action, absoluteIndex } = segment;
              const isSelected = isThisPageSelected && selectedActionIds.includes(action.id);
              const alreadyInManual = inManualStep.has(action.id);

              let isSelectable: boolean | undefined;
              if (alreadyInManual) {
                isSelectable = undefined;
              } else if (!selectionActive) {
                isSelectable = true;
              } else if (!isThisPageSelected) {
                isSelectable = false;
              } else if (isSelected) {
                isSelectable = true;
              } else {
                isSelectable = absoluteIndex === minSelected - 1 || absoluteIndex === maxSelected + 1;
              }

              return (
                <DraggableStep
                  key={action.id}
                  action={action}
                  index={absoluteIndex}
                  pageId={page.id}
                  onDragStart={onDragStepStart}
                  onDragOver={onDragStepOver}
                  onDelete={(actionId) => onDeleteStep(page.id, actionId)}
                  onRemoveSubAction={onRemoveSubAction}
                  onUpdateActionText={onUpdateActionText}
                  onSelectDescription={onSelectDescription}
                  onUpdateSubStepName={onUpdateSubStepName}
                  debug={debug}
                  isSelected={isSelected}
                  isSelectable={isSelectable}
                  onSelect={(actionId) => onSelectStep(page.id, actionId)}
                  onReorderSubActions={onReorderSubActions}
                  onSelectSubStep={onSelectSubStep}
                  selectedSubParentId={selectedSubParentId}
                  selectedSubActionIds={selectedSubActionIds}
                  isTopLevelSelectionActive={isTopLevelSelectionActive}
                  onRenameManualSubStep={onRenameManualSubStep}
                  onDeleteManualSubStep={onDeleteManualSubStep}
                  onEditAssertion={onEditAssertion}
                  onPickContainer={onPickContainer}
                  onRemoveContainer={onRemoveContainer}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
