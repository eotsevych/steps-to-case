import React, {useCallback, useRef, useState} from 'react';
import type {Action, ContainerContext, ElementInfo, ExpectedResult, HierarchyOption, ManualStep, ManualSubStep, Precondition, Selectors, StepPage, TestMetadata} from '../types';
import {StepPageComponent} from './StepPage';
import {CreatePageModal} from './CreatePageModal';
import {ExpectedResultModal} from './ExpectedResultModal';
import {Button} from './components/ui/button';
import {Input} from './components/ui/input';
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from './components/ui/dialog';
import {Label} from './components/ui/label';
import {ArrowLeft, RotateCcw, FileDown, Plus, GripVertical, Pencil, X, Check} from 'lucide-react';

interface Props {
  pages: StepPage[];
  manualSteps: ManualStep[];
  preconditions: Precondition[];
  onUpdatePages: (pages: StepPage[]) => void;
  onUpdateManualSteps: (steps: ManualStep[]) => void;
  onUpdatePreconditions: (preconditions: Precondition[]) => void;
  onRemoveSubAction: (parentActionId: string, subActionId: string) => void;
  onDeleteStep?: (actionId: string) => void;
  onUpdateActionText?: (actionId: string, customText: string) => void;
  onSelectDescription?: (actionId: string, candidate: { text: string; source?: string; level?: HierarchyOption }) => void;
  onUpdateSubStepName?: (actionId: string, subStepName: string) => void;
  onReorderSubActions?: (parentActionId: string, subActionIds: string[]) => void;
  onUpdateManualSubSteps?: (parentActionId: string, manualSubSteps: ManualSubStep[]) => void;
  onPickContainer?: (actionId: string, selector: string, candidateSelectors?: string[], targetText?: string) => void;
  onRemoveContainer?: (actionId: string) => void;
  baseUrl?: string;
  onFinish: () => void;
  onReset?: () => void;
  onBack?: () => void;
  debug?: boolean;
  testMetadata?: Partial<TestMetadata>;
  onUpdateMetadata?: (metadata: Partial<TestMetadata>) => void;
  /** pageUrl: the page the picked element must come from */
  onPickElement?: (pageUrl?: string) => void;
  pickedElement?: { elementInfo: ElementInfo; selectors: Selectors } | null;
  onClearPickedElement?: () => void;
  pendingContainer?: ContainerContext;
  onPickContainerPre?: (pageUrl?: string) => void;
  onClearPendingContainer?: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Page context for a step added in the organizer: the page's URL plus the domain its recorded steps came from. */
function pageContextFor(page: StepPage | undefined): Action['page'] {
  const url = page?.pageContext?.url ?? '';
  const domain = page?.actions.find(a => a.page?.domain)?.page.domain ?? '';
  return {url, title: page?.pageContext?.title ?? '', domain, pathname: url};
}

export function StepOrganizer({
                                pages, manualSteps, preconditions,
                                onUpdatePages, onUpdateManualSteps, onUpdatePreconditions,
                                onRemoveSubAction, onDeleteStep, onUpdateActionText, onSelectDescription, onUpdateSubStepName,
                                onReorderSubActions, onUpdateManualSubSteps,
                                onPickContainer, onRemoveContainer,
                                baseUrl,
                                onFinish, onReset, onBack, debug,
                                testMetadata, onUpdateMetadata,
                                onPickElement, pickedElement, onClearPickedElement,
                                pendingContainer, onPickContainerPre, onClearPendingContainer,
                              }: Props) {
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleEditValue, setTitleEditValue] = useState('');
  const dragRef = useRef<{ actionId: string; sourcePageId: string } | null>(null);
  const dragPageRef = useRef<string | null>(null);
  const dropTargetRef = useRef<{ actionId: string; pageId: string } | null>(null);

  // Precondition state
  const [showAddPrecondition, setShowAddPrecondition] = useState(false);
  const [newPreconditionText, setNewPreconditionText] = useState('');
  const [editingPreconditionId, setEditingPreconditionId] = useState<string | null>(null);
  const [editingPreconditionText, setEditingPreconditionText] = useState('');
  const preconditionDragRef = useRef<number | null>(null);

  // Step selection for manual step creation
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeStepName, setMergeStepName] = useState('');

  // Add step to page
  const [addStepPageId, setAddStepPageId] = useState<string | null>(null);
  const [addStepText, setAddStepText] = useState('');

  // Add assertion to page
  const [addAssertionPageId, setAddAssertionPageId] = useState<string | null>(null);

  // Edit assertion
  const [editingAssertionActionId, setEditingAssertionActionId] = useState<string | null>(null);
  const [editingAssertionResultIndex, setEditingAssertionResultIndex] = useState<number>(0);

  // Sub-step selection for manual sub-step creation
  const [selectedSubParentId, setSelectedSubParentId] = useState<string | null>(null);
  const [selectedSubActionIds, setSelectedSubActionIds] = useState<string[]>([]);
  // sub-merge now uses the unified compose modal (showMergeModal + mergeStepName)

  /** Recorded URL of a page — picking for it must happen on that page. */
  const pageUrlOf = (pageId: string | null) => pages.find(g => g.id === pageId)?.pageContext?.url;

  // ── Drag & drop ─────────────────────────────────────────────

  const handleDragStepStart = useCallback((e: React.DragEvent, actionId: string, sourcePageId: string) => {
    dragRef.current = {actionId, sourcePageId};
    dragPageRef.current = null;
    dropTargetRef.current = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/qa-step', actionId);
  }, []);

  const handleDragStepOver = useCallback((_e: React.DragEvent, targetActionId: string, targetPageId: string) => {
    dropTargetRef.current = {actionId: targetActionId, pageId: targetPageId};
  }, []);

  const handleDragPageStart = useCallback((e: React.DragEvent, pageId: string) => {
    dragPageRef.current = pageId;
    dragRef.current = null;
    dropTargetRef.current = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pageId);
  }, []);

  const handleDropStep = useCallback((e: React.DragEvent, targetPageId: string) => {
    e.preventDefault();

    if (dragRef.current) {
      const {actionId, sourcePageId} = dragRef.current;
      const newPages = pages.map(g => ({...g, actions: [...g.actions]}));
      let movedAction: Action | undefined;

      const sourcePage = newPages.find(g => g.id === sourcePageId);
      if (sourcePage) {
        const idx = sourcePage.actions.findIndex(a => a.id === actionId);
        if (idx >= 0) movedAction = sourcePage.actions.splice(idx, 1)[0];
      }

      if (movedAction) {
        const targetPage = newPages.find(g => g.id === targetPageId);
        if (targetPage) {
          if (dropTargetRef.current && dropTargetRef.current.pageId === targetPageId) {
            const targetIdx = targetPage.actions.findIndex(a => a.id === dropTargetRef.current!.actionId);
            targetIdx >= 0
              ? targetPage.actions.splice(targetIdx, 0, movedAction)
              : targetPage.actions.push(movedAction);
          } else {
            targetPage.actions.push(movedAction);
          }
        }
      }

      onUpdatePages(newPages);
      dragRef.current = null;
      dropTargetRef.current = null;
      return;
    }

    if (dragPageRef.current) {
      const draggedId = dragPageRef.current;
      if (draggedId === targetPageId) {
        dragPageRef.current = null;
        return;
      }

      const newPages = [...pages];
      const fromIdx = newPages.findIndex(g => g.id === draggedId);
      const toIdx = newPages.findIndex(g => g.id === targetPageId);

      if (fromIdx >= 0 && toIdx >= 0) {
        const [moved] = newPages.splice(fromIdx, 1);
        newPages.splice(toIdx, 0, moved);
        newPages.forEach((g, i) => g.order = i);
      }

      onUpdatePages(newPages);
      dragPageRef.current = null;
    }
  }, [pages, onUpdatePages]);

  // ── Page management ──────────────────────────────────────────

  const handleRenamePage = useCallback((pageId: string, name: string) => {
    onUpdatePages(pages.map(g => g.id === pageId ? {...g, name} : g));
  }, [pages, onUpdatePages]);

  const handleDeletePage = useCallback((pageId: string) => {
    const page = pages.find(g => g.id === pageId);
    if (!page) return;

    // Delete all steps within the page
    for (const action of page.actions) {
      onDeleteStep?.(action.id);
    }

    const newPages = pages.filter(g => g.id !== pageId);
    newPages.forEach((g, i) => g.order = i);
    onUpdatePages(newPages);

    if (selectedPageId === pageId) {
      setSelectedPageId(null);
      setSelectedActionIds([]);
    }
  }, [pages, onUpdatePages, selectedPageId]);

  const handleDeleteStep = useCallback((pageId: string, actionId: string) => {
    onUpdatePages(pages.map(g =>
      g.id === pageId ? {...g, actions: g.actions.filter(a => a.id !== actionId)} : g
    ));
    onDeleteStep?.(actionId);
    if (selectedPageId === pageId) {
      const newIds = selectedActionIds.filter(id => id !== actionId);
      setSelectedActionIds(newIds);
      if (newIds.length === 0) setSelectedPageId(null);
    }
  }, [pages, onUpdatePages, onDeleteStep, selectedPageId, selectedActionIds]);

  const handleCreatePage = useCallback((name: string) => {
    onUpdatePages([...pages, {id: generateId(), name, type: 'manual', actions: [], order: pages.length}]);
    setShowCreatePage(false);
  }, [pages, onUpdatePages]);

  // ── Step selection ───────────────────────────────────────────

  // IDs already owned by a manual step (not selectable for new ones)
  const ownedByManual = new Set(manualSteps.flatMap(ms => ms.actionIds));

  const handleSelectStep = useCallback((pageId: string, actionId: string) => {
    if (ownedByManual.has(actionId)) return;
    if (selectedPageId && selectedPageId !== pageId) return;

    const page = pages.find(g => g.id === pageId);
    if (!page) return;
    const idx = page.actions.findIndex(a => a.id === actionId);
    if (idx < 0) return;

    if (selectedActionIds.length === 0) {
      setSelectedPageId(pageId);
      setSelectedActionIds([actionId]);
      return;
    }

    const currentIndices = selectedActionIds
      .map(id => page.actions.findIndex(a => a.id === id))
      .filter(i => i >= 0);
    const minIdx = Math.min(...currentIndices);
    const maxIdx = Math.max(...currentIndices);

    if (selectedActionIds.includes(actionId)) {
      if (idx === minIdx || idx === maxIdx) {
        const newIds = selectedActionIds.filter(id => id !== actionId);
        if (newIds.length === 0) setSelectedPageId(null);
        setSelectedActionIds(newIds);
      }
      return;
    }

    if (idx === minIdx - 1 || idx === maxIdx + 1) {
      const newIds = [...selectedActionIds, actionId].sort((a, b) => {
        const ia = page.actions.findIndex(act => act.id === a);
        const ib = page.actions.findIndex(act => act.id === b);
        return ia - ib;
      });
      setSelectedActionIds(newIds);
    }
  }, [pages, selectedPageId, selectedActionIds, ownedByManual]);

  const clearSelection = useCallback(() => {
    setSelectedPageId(null);
    setSelectedActionIds([]);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedActionIds.length === 0) return;
    const idsToDelete = new Set(selectedActionIds);

    onUpdatePages(
      pages.map(g => ({...g, actions: g.actions.filter(a => !idsToDelete.has(a.id))}))
    );

    for (const actionId of selectedActionIds) {
      onDeleteStep?.(actionId);
    }

    setSelectedPageId(null);
    setSelectedActionIds([]);
  }, [selectedActionIds, pages, onUpdatePages, onDeleteStep]);

  // ── Manual step management ───────────────────────────────────

  const handleMerge = useCallback(() => {
    if (!selectedPageId || selectedActionIds.length < 2 || !mergeStepName.trim()) return;

    const newStep: ManualStep = {
      id: generateId(),
      name: mergeStepName.trim(),
      actionIds: [...selectedActionIds],
      pageId: selectedPageId,
      order: manualSteps.length,
    };

    onUpdateManualSteps([...manualSteps, newStep]);
    setSelectedPageId(null);
    setSelectedActionIds([]);
    setShowMergeModal(false);
    setMergeStepName('');
  }, [selectedPageId, selectedActionIds, mergeStepName, manualSteps, onUpdateManualSteps]);

  const handleRenameManualStep = useCallback((id: string, name: string) => {
    onUpdateManualSteps(manualSteps.map(ms => ms.id === id ? {...ms, name} : ms));
  }, [manualSteps, onUpdateManualSteps]);

  const handleDeleteManualStep = useCallback((id: string) => {
    onUpdateManualSteps(
      manualSteps.filter(ms => ms.id !== id).map((ms, i) => ({...ms, order: i}))
    );
  }, [manualSteps, onUpdateManualSteps]);

  const handleAddStepToPage = useCallback((
    pageId: string,
    text: string,
    pickedEl?: { elementInfo: ElementInfo; selectors: Selectors } | null,
  ) => {
    const page = pages.find(g => g.id === pageId);
    const id = generateId();
    const newAction: Action = {
      id,
      type: 'step',
      timestamp: Date.now(),
      element: pickedEl?.elementInfo ?? {
        tagName: '',
        textContent: text,
        accessibleName: text,
        innerText: text,
        attributes: {},
      },
      page: pageContextFor(page),
      selectors: pickedEl?.selectors ?? {
        primary: {type: 'css', value: '', score: 100},
        alternatives: [],
      },
      customText: text,
      containerContext: pendingContainer,
    };
    onUpdatePages(pages.map(g =>
      g.id === pageId ? {...g, actions: [...g.actions, newAction]} : g
    ));
    setAddStepPageId(null);
    setAddStepText('');
    onClearPickedElement?.();
    onClearPendingContainer?.();
  }, [pages, onUpdatePages, onClearPickedElement, onClearPendingContainer, pendingContainer]);

  const handleAddAssertionToPage = useCallback((
    pageId: string,
    result: ExpectedResult,
    pickedEl?: { elementInfo: ElementInfo; selectors: Selectors } | null,
  ) => {
    const page = pages.find(g => g.id === pageId);
    const id = generateId();
    const newAction: Action = {
      id,
      type: 'assert',
      timestamp: Date.now(),
      element: pickedEl?.elementInfo ?? {
        tagName: '',
        textContent: result.description,
        accessibleName: result.description,
        innerText: result.description,
        attributes: {},
      },
      page: pageContextFor(page),
      selectors: pickedEl?.selectors ?? {
        primary: {type: 'css', value: '', score: 100},
        alternatives: [],
      },
      customText: `Assert: ${result.description}`,
      expectedResults: [result],
      containerContext: pendingContainer,
    };
    onUpdatePages(pages.map(g =>
      g.id === pageId ? {...g, actions: [...g.actions, newAction]} : g
    ));
    setAddAssertionPageId(null);
    onClearPickedElement?.();
    onClearPendingContainer?.();
  }, [pages, onUpdatePages, onClearPickedElement, onClearPendingContainer, pendingContainer]);

  // ── Sub-step selection ────────────────────────────────────────

  /** Find parent action containing sub-actions across all pages */
  const findParentAction = useCallback((parentId: string): Action | undefined => {
    for (const g of pages) {
      const a = g.actions.find(act => act.id === parentId);
      if (a) return a;
    }
    return undefined;
  }, [pages]);

  const handleSelectSubStep = useCallback((parentActionId: string, subActionId: string) => {
    // Mutual exclusion: clear top-level selection when sub-step selection starts
    if (selectedPageId) {
      setSelectedPageId(null);
      setSelectedActionIds([]);
    }

    const parent = findParentAction(parentActionId);
    if (!parent?.subActions) return;

    // Check if this sub-action is already in a manual sub-step
    const ownedByManualSub = new Set<string>();
    if (parent.manualSubSteps) {
      for (const ms of parent.manualSubSteps) {
        for (const id of ms.subActionIds) ownedByManualSub.add(id);
      }
    }
    if (ownedByManualSub.has(subActionId)) return;

    if (selectedSubParentId && selectedSubParentId !== parentActionId) return;

    const idx = parent.subActions.findIndex(s => s.id === subActionId);
    if (idx < 0) return;

    if (selectedSubActionIds.length === 0) {
      setSelectedSubParentId(parentActionId);
      setSelectedSubActionIds([subActionId]);
      return;
    }

    const currentIndices = selectedSubActionIds
      .map(id => parent.subActions!.findIndex(s => s.id === id))
      .filter(i => i >= 0);
    const minIdx = Math.min(...currentIndices);
    const maxIdx = Math.max(...currentIndices);

    if (selectedSubActionIds.includes(subActionId)) {
      if (idx === minIdx || idx === maxIdx) {
        const newIds = selectedSubActionIds.filter(id => id !== subActionId);
        if (newIds.length === 0) setSelectedSubParentId(null);
        setSelectedSubActionIds(newIds);
      }
      return;
    }

    if (idx === minIdx - 1 || idx === maxIdx + 1) {
      const newIds = [...selectedSubActionIds, subActionId].sort((a, b) => {
        const ia = parent.subActions!.findIndex(s => s.id === a);
        const ib = parent.subActions!.findIndex(s => s.id === b);
        return ia - ib;
      });
      setSelectedSubActionIds(newIds);
    }
  }, [pages, selectedSubParentId, selectedSubActionIds, selectedPageId, findParentAction]);

  const clearSubSelection = useCallback(() => {
    setSelectedSubParentId(null);
    setSelectedSubActionIds([]);
  }, []);

  const handleSubMerge = useCallback(() => {
    if (!selectedSubParentId || selectedSubActionIds.length < 2 || !mergeStepName.trim() || !onUpdateManualSubSteps) return;

    const parent = findParentAction(selectedSubParentId);
    if (!parent) return;

    const newSubStep: ManualSubStep = {
      id: generateId(),
      name: mergeStepName.trim(),
      subActionIds: [...selectedSubActionIds],
      parentActionId: selectedSubParentId,
      order: (parent.manualSubSteps || []).length,
    };

    onUpdateManualSubSteps(selectedSubParentId, [...(parent.manualSubSteps || []), newSubStep]);
    setSelectedSubParentId(null);
    setSelectedSubActionIds([]);
    setShowMergeModal(false);
    setMergeStepName('');
  }, [selectedSubParentId, selectedSubActionIds, mergeStepName, onUpdateManualSubSteps, findParentAction]);

  const handleEditAssertion = useCallback((actionId: string, resultIndex: number) => {
    setEditingAssertionActionId(actionId);
    setEditingAssertionResultIndex(resultIndex);
    onClearPickedElement?.();
  }, [onClearPickedElement]);

  const handleUpdateAssertion = useCallback((result: ExpectedResult) => {
    if (!editingAssertionActionId) return;
    const idx = editingAssertionResultIndex;
    onUpdatePages(pages.map(g => ({
      ...g,
      actions: g.actions.map(a =>
        a.id === editingAssertionActionId
          ? {
              ...a,
              expectedResults: a.expectedResults?.map((r, i) => i === idx ? result : r),
              // A re-picked element becomes the assert step's element (the exporter reads it from there)
              ...(a.type === 'assert' && pickedElement
                ? { element: pickedElement.elementInfo, selectors: pickedElement.selectors }
                : {}),
            }
          : a
      ),
    })));
    setEditingAssertionActionId(null);
    setEditingAssertionResultIndex(0);
    onClearPickedElement?.();
  }, [editingAssertionActionId, editingAssertionResultIndex, pages, onUpdatePages, onClearPickedElement, pickedElement]);

  const editingAssertionResult = editingAssertionActionId ? (() => {
    for (const g of pages) {
      const action = g.actions.find(a => a.id === editingAssertionActionId);
      if (action?.expectedResults?.[editingAssertionResultIndex] !== undefined) {
        return action.expectedResults[editingAssertionResultIndex];
      }
    }
    return undefined;
  })() : undefined;

  const handleRenameManualSubStep = useCallback((parentActionId: string, manualSubStepId: string, name: string) => {
    if (!onUpdateManualSubSteps) return;
    const parent = findParentAction(parentActionId);
    if (!parent?.manualSubSteps) return;
    onUpdateManualSubSteps(parentActionId, parent.manualSubSteps.map(ms =>
      ms.id === manualSubStepId ? {...ms, name} : ms
    ));
  }, [onUpdateManualSubSteps, findParentAction]);

  const handleDeleteManualSubStep = useCallback((parentActionId: string, manualSubStepId: string) => {
    if (!onUpdateManualSubSteps) return;
    const parent = findParentAction(parentActionId);
    if (!parent?.manualSubSteps) return;
    onUpdateManualSubSteps(parentActionId,
      parent.manualSubSteps.filter(ms => ms.id !== manualSubStepId).map((ms, i) => ({...ms, order: i}))
    );
  }, [onUpdateManualSubSteps, findParentAction]);

  // Mutual exclusion: when top-level step selection starts, clear sub-step selection
  const handleSelectStepWithMutex = useCallback((pageId: string, actionId: string) => {
    if (selectedSubParentId) {
      setSelectedSubParentId(null);
      setSelectedSubActionIds([]);
    }
    handleSelectStep(pageId, actionId);
  }, [handleSelectStep, selectedSubParentId]);

  // ── Precondition management ──────────────────────────────────

  const handleAddPrecondition = useCallback((name: string) => {
    const newP: Precondition = {
      id: generateId(),
      name,
      order: preconditions.length,
    };
    onUpdatePreconditions([...preconditions, newP]);
    setShowAddPrecondition(false);
    setNewPreconditionText('');
  }, [preconditions, onUpdatePreconditions]);

  const handleRenamePrecondition = useCallback((id: string, name: string) => {
    onUpdatePreconditions(preconditions.map(p => p.id === id ? {...p, name} : p));
    setEditingPreconditionId(null);
    setEditingPreconditionText('');
  }, [preconditions, onUpdatePreconditions]);

  const handleDeletePrecondition = useCallback((id: string) => {
    onUpdatePreconditions(
      preconditions.filter(p => p.id !== id).map((p, i) => ({...p, order: i}))
    );
  }, [preconditions, onUpdatePreconditions]);

  const handlePreconditionDragStart = useCallback((e: React.DragEvent, index: number) => {
    preconditionDragRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handlePreconditionDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const fromIndex = preconditionDragRef.current;
    if (fromIndex === null || fromIndex === targetIndex) return;
    const reordered = [...preconditions];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    onUpdatePreconditions(reordered.map((p, i) => ({...p, order: i})));
    preconditionDragRef.current = null;
  }, [preconditions, onUpdatePreconditions]);

  const totalSteps = pages.reduce((sum, g) => sum + g.actions.length, 0);
  const hasAnySelected = selectedActionIds.length >= 1;
  const hasAnySubSelected = selectedSubActionIds.length >= 1;
  const isTopLevelSelectionActive = hasAnySelected;

  const saveTitle = (value: string) => {
    const newName = value.trim() || 'Untitled Test';
    if (onUpdateMetadata && testMetadata) {
      onUpdateMetadata({...testMetadata, name: newName});
    }
    setEditingTitle(false);
  };

  return (
    <div id="qa-organizer-container" data-qa="organizer-container" className="flex flex-col h-screen bg-background">
      {/* Sticky header */}
      <div id="qa-organizer-title-row" data-qa="organizer-title-row"
           className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Left: back button + title */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {onBack && (
              <Button id="qa-organizer-back-btn" data-qa="back-btn" variant="ghost" size="icon" onClick={onBack} title="Back to recording">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {testMetadata !== undefined && (
              editingTitle ? (
                <Input
                  id="qa-organizer-title-input"
                  data-qa="title-input"
                  value={titleEditValue}
                  onChange={e => setTitleEditValue(e.target.value)}
                  onBlur={() => saveTitle(titleEditValue)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveTitle(titleEditValue);
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                  autoFocus
                  placeholder="Add test name…"
                  className="h-7 text-sm font-semibold flex-1 min-w-0"
                />
              ) : (
                <span
                  id="qa-organizer-title"
                  data-qa="title"
                  onClick={() => {
                    setTitleEditValue(testMetadata.name || '');
                    setEditingTitle(true);
                  }}
                  title="Click to edit test name"
                  className={`text-sm font-semibold truncate cursor-text flex-1 min-w-0 ${testMetadata.name ? 'text-foreground' : 'text-muted-foreground italic'}`}
                >
                  {testMetadata.name || 'Add test name…'}
                </span>
              )
            )}
          </div>
          {/* Right: reset + export */}
          <div className="flex items-center gap-1 shrink-0">
            {onReset && (
              <Button id="qa-organizer-reset-btn" data-qa="reset-btn" variant="ghost" size="icon" onClick={onReset} title="Reset">
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
            <Button id="qa-organizer-export-btn" data-qa="export-btn" size="sm" onClick={onFinish}>
              <FileDown className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Toolbar: stats + selection actions */}
        <div id="qa-organizer-toolbar" data-qa="organizer-toolbar" className="flex items-center gap-2 mt-1.5">
          <span id="qa-organizer-stats" data-qa="stats" className="text-xs text-muted-foreground">
            {pages.length} page{pages.length !== 1 ? 's' : ''} · {totalSteps} step{totalSteps !== 1 ? 's' : ''}
          </span>
          {hasAnySelected && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs font-semibold text-primary">{selectedActionIds.length} selected</span>
              <Button id="qa-organizer-clear-selection-btn" data-qa="clear-selection-btn" variant="ghost" size="icon" onClick={clearSelection} title="Clear selected steps"><X className="w-3 h-3" /></Button>
              <Button id="qa-organizer-delete-selected-btn" data-qa="delete-selected-btn" variant="destructive" size="sm" onClick={handleDeleteSelected}>Delete</Button>
            </div>
          )}
          {((hasAnySelected && selectedActionIds.length >= 2) || (hasAnySubSelected && selectedSubActionIds.length >= 2)) && (
            <Button id="qa-organizer-manual-step-btn" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => { setMergeStepName(''); setShowMergeModal(true); }}>
              Compose
            </Button>
          )}
          {hasAnySubSelected && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-purple-600">{selectedSubActionIds.length} sub-steps</span>
              <Button variant="ghost" size="icon" onClick={clearSubSelection} title="Clear selected sub-steps"><X className="w-3 h-3" /></Button>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {/* Preconditions block */}
        <div id="qa-organizer-preconditions">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preconditions</h2>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setShowAddPrecondition(true); setNewPreconditionText(''); }}>
              <Plus className="w-3 h-3 mr-0.5" />
              Add
            </Button>
          </div>

          {preconditions.length === 0 && !showAddPrecondition && (
            <p data-qa="empty-preconditions" className="text-xs text-muted-foreground py-0.5">No preconditions.</p>
          )}

          {preconditions.map((p, idx) => (
            <div
              key={p.id}
              draggable
              onDragStart={e => handlePreconditionDragStart(e, idx)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handlePreconditionDrop(e, idx)}
              className="flex items-center gap-1.5 px-2 py-1.5 mb-0.5 bg-secondary/60 rounded border border-border/60 cursor-grab"
            >
              <span title="Drag precondition" className="shrink-0">
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
              </span>
              {editingPreconditionId === p.id ? (
                <Input
                  value={editingPreconditionText}
                  onChange={e => setEditingPreconditionText(e.target.value)}
                  onBlur={() => editingPreconditionText.trim() && handleRenamePrecondition(p.id, editingPreconditionText.trim())}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && editingPreconditionText.trim()) handleRenamePrecondition(p.id, editingPreconditionText.trim());
                    if (e.key === 'Escape') { setEditingPreconditionId(null); setEditingPreconditionText(''); }
                  }}
                  autoFocus
                  className="h-6 text-sm flex-1"
                />
              ) : (
                <span className="text-sm flex-1 text-foreground">{p.name}</span>
              )}
              {editingPreconditionId !== p.id && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingPreconditionId(p.id); setEditingPreconditionText(p.name); }} title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeletePrecondition(p.id)} title="Delete">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}

          {showAddPrecondition && (
            <div className="px-2 py-1.5 bg-secondary/60 rounded border border-border/60 space-y-1.5">
              <Input
                value={newPreconditionText}
                onChange={e => setNewPreconditionText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newPreconditionText.trim()) handleAddPrecondition(newPreconditionText.trim());
                  if (e.key === 'Escape') { setShowAddPrecondition(false); setNewPreconditionText(''); }
                }}
                placeholder="e.g., User is logged in"
                autoFocus
                className="h-6 text-sm"
              />
              <div className="flex justify-end gap-1.5">
                <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => { setShowAddPrecondition(false); setNewPreconditionText(''); }}>Cancel</Button>
                <Button size="sm" className="h-6 px-2 text-xs" onClick={() => newPreconditionText.trim() && handleAddPrecondition(newPreconditionText.trim())} disabled={!newPreconditionText.trim()}>Add</Button>
              </div>
            </div>
          )}
        </div>

        {/* Pages */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 data-qa="steps-label" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pages</h2>
            <Button id="qa-organizer-create-page-btn" data-qa="create-page-btn" variant="ghost" size="sm" onClick={() => setShowCreatePage(true)}>
              <Plus className="w-3 h-3 mr-1" />
              Page
            </Button>
          </div>

          {pages.map(page => (
            <StepPageComponent
              key={page.id}
              page={page}
              manualSteps={manualSteps.filter(ms => ms.pageId === page.id)}
              onDragStepStart={handleDragStepStart}
              onDragStepOver={handleDragStepOver}
              onDropStep={handleDropStep}
              onDragPageStart={handleDragPageStart}
              onRename={handleRenamePage}
              onDelete={handleDeletePage}
              onDeleteStep={handleDeleteStep}
              onRemoveSubAction={onRemoveSubAction}
              onUpdateActionText={onUpdateActionText}
              onSelectDescription={onSelectDescription}
              onUpdateSubStepName={onUpdateSubStepName}
              onRenameManualStep={handleRenameManualStep}
              onDeleteManualStep={handleDeleteManualStep}
              debug={debug}
              selectedPageId={selectedPageId}
              selectedActionIds={selectedActionIds}
              onSelectStep={handleSelectStepWithMutex}
              onReorderSubActions={onReorderSubActions}
              onSelectSubStep={handleSelectSubStep}
              selectedSubParentId={selectedSubParentId}
              selectedSubActionIds={selectedSubActionIds}
              isTopLevelSelectionActive={isTopLevelSelectionActive}
              onRenameManualSubStep={handleRenameManualSubStep}
              onDeleteManualSubStep={handleDeleteManualSubStep}
              onAddStep={setAddStepPageId}
              onAddAssertion={setAddAssertionPageId}
              onEditAssertion={handleEditAssertion}
              onPickContainer={onPickContainer}
              onRemoveContainer={onRemoveContainer}
              baseUrl={baseUrl}
            />
          ))}

          {pages.length === 0 && (
            <p data-qa="empty-pages" className="text-xs text-muted-foreground text-center py-8">
              No pages. Create a page to organize your steps.
            </p>
          )}
        </div>
      </div>

      {showCreatePage && (
        <CreatePageModal onSave={handleCreatePage} onCancel={() => setShowCreatePage(false)}/>
      )}

      {/* Compose Modal */}
      {showMergeModal && (() => {
        const isSubMerge = hasAnySubSelected && selectedSubActionIds.length >= 2;
        const count = isSubMerge ? selectedSubActionIds.length : selectedActionIds.length;
        const label = isSubMerge ? 'sub-steps' : 'steps';
        const onSubmit = isSubMerge ? handleSubMerge : handleMerge;
        return (
          <Dialog open={true} onClose={() => setShowMergeModal(false)}>
            <DialogContent data-qa="merge-modal-content">
              <DialogHeader>
                <DialogTitle data-qa="merge-modal-title">Create Composite Step</DialogTitle>
              </DialogHeader>
              <p data-qa="merge-modal-description" className="text-sm text-muted-foreground">
                {count} {label} will be composed into a single step.
              </p>
              <div className="space-y-2">
                <Label data-qa="merge-modal-label" htmlFor="merge-step-name">Step Name</Label>
                <Input
                  id="merge-step-name"
                  data-qa="merge-modal-input"
                  value={mergeStepName}
                  onChange={e => setMergeStepName(e.target.value)}
                  placeholder="e.g., Complete checkout form"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && onSubmit()}
                />
              </div>
              <DialogFooter>
                <Button data-qa="merge-modal-cancel-btn" variant="outline" onClick={() => setShowMergeModal(false)}>Cancel</Button>
                <Button data-qa="merge-modal-create-btn" onClick={onSubmit} disabled={!mergeStepName.trim()} className="bg-purple-600 hover:bg-purple-700 text-white">Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Add Step Modal */}
      <Dialog open={!!addStepPageId} onClose={() => { setAddStepPageId(null); setAddStepText(''); onClearPickedElement?.(); onClearPendingContainer?.(); }}>
        <DialogContent data-qa="add-step-modal-content">
          <DialogHeader>
            <DialogTitle data-qa="add-step-modal-title">Add Step</DialogTitle>
          </DialogHeader>
          {addStepPageId && (
            <p className="text-xs text-muted-foreground">
              Adding to: <strong>{pages.find(g => g.id === addStepPageId)?.name}</strong>
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="add-step-organizer-input">Step Description</Label>
            <Input
              id="add-step-organizer-input"
              data-qa="add-step-modal-input"
              value={addStepText}
              onChange={e => setAddStepText(e.target.value)}
              placeholder="Describe what to do in this step..."
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && addStepText.trim() && addStepPageId) handleAddStepToPage(addStepPageId, addStepText.trim(), pickedElement);
                if (e.key === 'Escape') { setAddStepPageId(null); setAddStepText(''); onClearPickedElement?.(); onClearPendingContainer?.(); }
              }}
            />
          </div>
          {onPickElement && (
            <div className="space-y-2">
              <Label>Container (optional)</Label>
              {pendingContainer ? (
                <div className="flex items-center gap-2 p-2 bg-secondary rounded-md border border-amber-300">
                  <span className="text-sm flex-1 truncate text-foreground">
                    {pendingContainer.containerLabel}
                  </span>
                  <Button variant="ghost" size="icon" onClick={onClearPendingContainer} title="Clear container"><X className="w-3 h-3" /></Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => onPickContainerPre?.(pageUrlOf(addStepPageId))}>Pick Container (optional)</Button>
              )}
              <Label>Element (optional)</Label>
              {pickedElement ? (
                <div className="flex items-center gap-2 p-2 bg-secondary rounded-md border border-green-500">
                  <Check className="w-3 h-3 text-green-600 shrink-0" />
                  <span className="text-sm flex-1 truncate text-foreground">
                    {pickedElement.selectors.contextText || pickedElement.elementInfo.accessibleName || pickedElement.elementInfo.textContent || pickedElement.selectors.primary.value}
                  </span>
                  <Button variant="ghost" size="icon" onClick={onClearPickedElement} title="Clear element"><X className="w-3 h-3" /></Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => onPickElement(pageUrlOf(addStepPageId))}>Pick Element (optional)</Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button data-qa="add-step-modal-cancel-btn" variant="outline" onClick={() => { setAddStepPageId(null); setAddStepText(''); onClearPickedElement?.(); onClearPendingContainer?.(); }}>Cancel</Button>
            <Button data-qa="add-step-modal-save-btn" onClick={() => addStepText.trim() && addStepPageId && handleAddStepToPage(addStepPageId, addStepText.trim(), pickedElement)} disabled={!addStepText.trim()}>Add Step</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {addAssertionPageId && (
        <ExpectedResultModal
          onSave={(result) => handleAddAssertionToPage(addAssertionPageId, result, pickedElement)}
          onCancel={() => {
            setAddAssertionPageId(null);
            onClearPickedElement?.();
            onClearPendingContainer?.();
          }}
          onPickElement={() => onPickElement?.(pageUrlOf(addAssertionPageId))}
          pickedElement={pickedElement}
          pendingContainer={pendingContainer}
          onPickContainer={() => onPickContainerPre?.(pageUrlOf(addAssertionPageId))}
          onClearContainer={() => onClearPendingContainer?.()}
        />
      )}

      {editingAssertionActionId && (
        <ExpectedResultModal
          title="Edit Assertion"
          initialResult={editingAssertionResult}
          onSave={handleUpdateAssertion}
          onCancel={() => {
            setEditingAssertionActionId(null);
            setEditingAssertionResultIndex(0);
            onClearPickedElement?.();
          }}
          onPickElement={() => onPickElement?.(
            pageUrlOf(pages.find(g => g.actions.some(a => a.id === editingAssertionActionId))?.id ?? null),
          )}
          pickedElement={pickedElement}
        />
      )}

    </div>
  );
}
