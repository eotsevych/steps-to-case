import React, { useRef, useState } from 'react';
import type { Action, HierarchyOption, ManualSubStep } from '../types';
import { NAME_TOKEN } from '../lib/stepName';
import { assertionLabels, getStepSummary, getStepTextTemplate, getStepTypeBadge, normalizeStepTemplate } from './stepDisplay';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { GripVertical, Trash2, Container, Pencil, Check, X } from 'lucide-react';
import { getContainerHighlightSelector, getAllContainerHighlightSelectors } from './containerHighlightSelector';
import { StepTitle } from './DescriptionPicker';
import { stepDetailLimits, stepRow } from './stepRowStyles';

interface Props {
  action: Action;
  index: number;
  pageId: string;
  onDragStart: (e: React.DragEvent, actionId: string, sourcePageId: string) => void;
  onDragOver: (e: React.DragEvent, actionId: string, pageId: string) => void;
  onDelete: (actionId: string) => void;
  onRemoveSubAction: (parentActionId: string, subActionId: string) => void;
  onUpdateActionText?: (actionId: string, customText: string) => void;
  onSelectDescription?: (actionId: string, candidate: { text: string; source?: string; level?: HierarchyOption }) => void;
  onUpdateSubStepName?: (actionId: string, subStepName: string) => void;
  debug?: boolean;
  isSelected?: boolean;
  isSelectable?: boolean;
  onSelect?: (actionId: string) => void;
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
}


// ── Sub-step segment types ─────────────────────────────────

type SubStepSegment = { kind: 'sub'; sub: Action; absoluteIndex: number };
type ManualSubSegment = { kind: 'manualSub'; manualSubStep: ManualSubStep; subs: { sub: Action; absoluteIndex: number }[] };
type SubSegment = SubStepSegment | ManualSubSegment;

function buildSubSegments(subActions: Action[], manualSubSteps: ManualSubStep[]): SubSegment[] {
  const subToManual = new Map<string, ManualSubStep>();
  for (const ms of manualSubSteps) {
    for (const id of ms.subActionIds) subToManual.set(id, ms);
  }
  const segments: SubSegment[] = [];
  let i = 0;
  while (i < subActions.length) {
    const ms = subToManual.get(subActions[i].id);
    if (ms) {
      const subs: { sub: Action; absoluteIndex: number }[] = [];
      while (i < subActions.length && subToManual.get(subActions[i].id) === ms) {
        subs.push({ sub: subActions[i], absoluteIndex: i });
        i++;
      }
      segments.push({ kind: 'manualSub', manualSubStep: ms, subs });
    } else {
      segments.push({ kind: 'sub', sub: subActions[i], absoluteIndex: i });
      i++;
    }
  }
  return segments;
}

// ── Editable sub-step ─────────────────────────────────────

function EditableSubStep({ sub, onUpdateActionText }: { sub: Action; onUpdateActionText: (id: string, text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const cancelingRef = useRef(false);
  if (editing) {
    return (
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => {
          if (cancelingRef.current) { cancelingRef.current = false; setEditing(false); return; }
          if (text.trim()) onUpdateActionText(sub.id, normalizeStepTemplate(text.trim(), sub));
          setEditing(false);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') { if (text.trim()) onUpdateActionText(sub.id, normalizeStepTemplate(text.trim(), sub)); setEditing(false); }
          if (e.key === 'Escape') { cancelingRef.current = true; setEditing(false); }
        }}
        autoFocus
        className="w-28 px-1 border border-ring rounded text-xs outline-hidden bg-input-background"
      />
    );
  }
  return (
    <Button variant="ghost" size="icon" onClick={() => { setText(getStepTextTemplate(sub)); setEditing(true); }} title="Edit step text" className="h-5 w-5">
      <Pencil className="w-3 h-3" />
    </Button>
  );
}

// ── Manual sub-step wrapper ────────────────────────────────

function ManualSubStepWrapper({
  manualSubStep, subs, parentAction, onRemoveSubAction, onUpdateActionText,
  onRenameManualSubStep, onDeleteManualSubStep,
  onReorderSubActions, allSubActions,
}: {
  manualSubStep: ManualSubStep;
  subs: { sub: Action; absoluteIndex: number }[];
  parentAction: Action;
  onRemoveSubAction: (parentActionId: string, subActionId: string) => void;
  onUpdateActionText?: (actionId: string, customText: string) => void;
  onRenameManualSubStep?: (parentActionId: string, manualSubStepId: string, name: string) => void;
  onDeleteManualSubStep?: (parentActionId: string, manualSubStepId: string) => void;
  onReorderSubActions?: (parentActionId: string, subActionIds: string[]) => void;
  allSubActions: Action[];
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(manualSubStep.name);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const cancelingRef = useRef(false);

  const save = () => {
    if (editName.trim() && onRenameManualSubStep) onRenameManualSubStep(parentAction.id, manualSubStep.id, editName.trim());
    setEditing(false);
  };

  const cancel = () => { cancelingRef.current = true; setEditing(false); };

  return (
    <div className="border border-purple-300 rounded-md mb-1 mt-0.5">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 rounded-t-md border-b border-purple-200">
        {editing ? (
          <input value={editName} onChange={e => setEditName(e.target.value)}
            onBlur={() => { if (cancelingRef.current) { cancelingRef.current = false; return; } save(); }}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            autoFocus className="flex-1 px-1.5 py-0.5 border border-purple-400 rounded text-xs font-semibold outline-hidden bg-white" />
        ) : (
          <span className="flex-1 text-xs font-bold text-purple-800 cursor-text"
            onDoubleClick={() => { setEditName(manualSubStep.name); setEditing(true); }} title="Double-click to rename">
            {manualSubStep.name}
          </span>
        )}
        <span className="text-xs text-purple-500">{subs.length} sub{subs.length !== 1 ? 's' : ''}</span>
        {editing ? (
          <Button variant="ghost" size="icon" onMouseDown={e => e.preventDefault()} onClick={save} title="Done editing" className="h-5 w-5 text-green-600">
            <Check className="w-3 h-3" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={() => { setEditName(manualSubStep.name); setEditing(true); }} title="Rename sub-step set" className="h-5 w-5 text-purple-600">
            <Pencil className="w-3 h-3" />
          </Button>
        )}
        {onDeleteManualSubStep && (
          <Button variant="ghost" size="icon" onClick={() => onDeleteManualSubStep(parentAction.id, manualSubStep.id)} title="Delete sub-step set" className="h-5 w-5 text-destructive hover:text-destructive">
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
      <div className="px-1 py-0.5">
        {subs.map(({ sub, absoluteIndex }, si) => (
          <div key={sub.id}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropIdx(si); }}
            onDragLeave={(e) => { e.stopPropagation(); setDropIdx(null); }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation();
              if (dragIdx !== null && dragIdx !== si && onReorderSubActions) {
                const newOrder = [...allSubActions];
                const fromAbs = subs[dragIdx].absoluteIndex;
                const toAbs = absoluteIndex;
                const [moved] = newOrder.splice(fromAbs, 1);
                // Insert before the drop target (removal shifts indices when dragging down)
                newOrder.splice(fromAbs < toAbs ? toAbs - 1 : toAbs, 0, moved);
                onReorderSubActions(parentAction.id, newOrder.map(s => s.id));
              }
              setDragIdx(null); setDropIdx(null);
            }}
            className={['flex items-center gap-1.5 py-0.5', dragIdx === si ? 'opacity-40' : '', dropIdx === si ? 'border-t-2 border-ring' : ''].join(' ')}
          >
            <span draggable onDragStart={(e) => { e.stopPropagation(); setDragIdx(si); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/qa-substep', sub.id); }}
              onDragEnd={() => { setDragIdx(null); setDropIdx(null); }} title="Drag sub-step" className="text-muted-foreground cursor-grab select-none">
              <GripVertical className="w-3 h-3" />
            </span>
            <span className="text-xs text-foreground flex-1">{getStepSummary(sub)}</span>
            {onUpdateActionText && <EditableSubStep sub={sub} onUpdateActionText={onUpdateActionText} />}
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRemoveSubAction(parentAction.id, sub.id); }} title="Delete sub-step" className="h-5 w-5 text-destructive hover:text-destructive">
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DraggableStep ──────────────────────────────────────────

export function DraggableStep({
  action, index, pageId,
  onDragStart, onDragOver, onDelete, onRemoveSubAction,
  onUpdateActionText, onSelectDescription, onUpdateSubStepName,
  debug,
  isSelected, isSelectable, onSelect,
  onReorderSubActions, onSelectSubStep,
  selectedSubParentId, selectedSubActionIds,
  isTopLevelSelectionActive,
  onRenameManualSubStep, onDeleteManualSubStep,
  onEditAssertion, onPickContainer, onRemoveContainer,
}: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [editText, setEditText] = useState('');
  const [editingSubStep, setEditingSubStep] = useState(false);
  const [subStepText, setSubStepText] = useState('');
  // Suppresses the blur-triggered save that would otherwise fire when Escape
  // unmounts the focused input (blur fires on removal, after the cancel already ran)
  const cancelingEditRef = useRef(false);
  const cancelingSubStepEditRef = useRef(false);
  const [handleDragging, setHandleDragging] = useState(false);
  const [subDragIdx, setSubDragIdx] = useState<number | null>(null);
  const [subDropIdx, setSubDropIdx] = useState<number | null>(null);

  const { label: badgeLabel, variant: badgeVariant } = getStepTypeBadge(action.type);
  const reqCount = action.actionData?.triggeredRequests?.length || 0;
  const selectionModeActive = isSelectable !== undefined;
  const selectable = isSelectable !== false;

  const isSubSelectionActiveHere = selectedSubParentId === action.id;
  const subSelectionActive = selectedSubParentId !== null && selectedSubParentId !== undefined;
  const subSelectedIds = isSubSelectionActiveHere ? (selectedSubActionIds || []) : [];
  const inManualSubStep = new Set<string>();
  if (action.manualSubSteps) {
    for (const ms of action.manualSubSteps) {
      for (const id of ms.subActionIds) inManualSubStep.add(id);
    }
  }

  // The pencil edits the whole summary line, verb included; on picker-backed
  // steps the element name shows as the {name} token so the chip survives
  const startEditText = () => { setEditText(getStepTextTemplate(action)); setEditingText(true); };
  const saveEditText = () => {
    const text = editText.trim();
    if (text) onUpdateActionText?.(action.id, normalizeStepTemplate(text, action));
    setEditingText(false);
  };
  const cancelEditText = () => { cancelingEditRef.current = true; setEditingText(false); };
  const startEditSubStep = () => { setSubStepText(action.subStepName || ''); setEditingSubStep(true); };
  const saveSubStep = () => { if (onUpdateSubStepName) onUpdateSubStepName(action.id, subStepText.trim()); setEditingSubStep(false); };
  const cancelSubStep = () => { cancelingSubStepEditRef.current = true; setEditingSubStep(false); };

  return (
    <>
      {/* Step row */}
      <div
        id={`qa-step-${action.id}`}
        data-step-card
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); onDragOver(e, action.id, pageId); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={() => setIsDragOver(false)}
        className={[
          `${stepRow.base} border-b border-border/40 last:border-b-0 transition-colors`,
          isSelected ? 'bg-primary/8' : isDragOver ? 'bg-accent/30' : 'hover:bg-muted/30',
          handleDragging ? 'opacity-40' : (!selectable && selectionModeActive) ? 'opacity-40' : '',
        ].join(' ')}
      >
        {/* Selection checkbox */}
        {selectionModeActive && (
          <button
            id={`qa-step-checkbox-${action.id}`}
            onClick={(e) => { e.stopPropagation(); if (onSelect && selectable) onSelect(action.id); }}
            title={isSelected ? 'Deselect step' : !selectable ? 'Select an adjacent step first' : 'Select step'}
            className={[
              'shrink-0 w-4 h-4 mt-1 rounded border-2 flex items-center justify-center',
              isSelected ? 'bg-primary border-primary' : selectable ? 'border-muted-foreground' : 'border-border',
              selectable ? 'cursor-pointer' : 'cursor-default',
            ].join(' ')}
          >
            {isSelected && <span className="text-white text-xs leading-none">✓</span>}
          </button>
        )}

        {/* Drag handle */}
        <span
          id={`qa-step-drag-${action.id}`}
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            setHandleDragging(true);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/qa-step', action.id);
            const card = (e.target as HTMLElement).closest('[data-step-card]') as HTMLElement;
            if (card) {
              const rect = card.getBoundingClientRect();
              e.dataTransfer.setDragImage(card, e.clientX - rect.left, e.clientY - rect.top);
            }
            onDragStart(e, action.id, pageId);
          }}
          onDragEnd={() => setHandleDragging(false)}
          title="Drag step"
          className={`${stepRow.leading} text-muted-foreground cursor-grab select-none`}
        >
          <GripVertical className="w-4 h-4" />
        </span>

        {/* Step number */}
        <span className={stepRow.number}>{index + 1}.</span>

        {/* Step content */}
        <div id={`qa-step-content-${action.id}`} className={stepRow.content}>
          {/* Line 1: title (or inline editor) */}
          <div className={stepRow.titleLine}>
            {editingText ? (
              <div className="flex-1 min-w-0">
                <input
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={() => { if (cancelingEditRef.current) { cancelingEditRef.current = false; return; } saveEditText(); }}
                  onKeyDown={e => { if (e.key === 'Enter') saveEditText(); if (e.key === 'Escape') cancelEditText(); }}
                  autoFocus
                  className={stepRow.editInput}
                />
                {editText.includes(NAME_TOKEN) && <span className={stepRow.editHint}>{NAME_TOKEN} stays a picker chip &mdash; reword around it</span>}
              </div>
            ) : (
              <StepTitle action={action} onSelectDescription={onSelectDescription} />
            )}
          </div>

          {/* Line 2 (optional): assertion / container / expected results details */}
          {action.containerContext && (
            <span className={`${stepRow.detailLine} text-muted-foreground italic block`}>
              in &ldquo;{action.containerContext.containerLabel}&rdquo;
            </span>
          )}
          {action.type === 'assert' && action.expectedResults?.[0]?.assertion && (
            <div className={`${stepRow.detailLine} flex items-center gap-1.5 flex-wrap`}>
              <span className="font-medium text-green-700">
                {assertionLabels[action.expectedResults[0].assertion.type] || action.expectedResults[0].assertion.type}
              </span>
              {action.expectedResults[0].assertion.element?.selector && (
                <span className="text-muted-foreground font-mono break-all">
                  {action.expectedResults[0].assertion.element.selector.slice(0, stepDetailLimits.selector)}
                </span>
              )}
              {action.expectedResults[0].assertion.expectedValue && (
                <span className="text-muted-foreground">
                  &ldquo;{action.expectedResults[0].assertion.expectedValue.slice(0, stepDetailLimits.expectedValue)}&rdquo;
                </span>
              )}
            </div>
          )}
          {action.type !== 'assert' && action.expectedResults && action.expectedResults.length > 0 && (
            <div className={`${stepRow.detailLine} flex flex-wrap gap-1`}>
              {action.expectedResults.map((er, i) => (
                <span key={i} className="text-green-700">
                  {er.description.slice(0, stepDetailLimits.expectedResult)}
                </span>
              ))}
            </div>
          )}
          {debug && action.actionData?.triggeredNavigation && (
            <div className={`${stepRow.detailLine} text-muted-foreground`}>
              &rarr; {action.actionData.triggeredNavigation.url.replace(/^https?:\/\//, '').slice(0, 50)}
            </div>
          )}
          {debug && reqCount > 0 && (
            <div className={`${stepRow.detailLine} text-muted-foreground`}>
              {reqCount} req{reqCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Component tag, type badge and icon buttons, pinned to the title line */}
        <div className={stepRow.actions}>
          {!editingText && action.componentTag && (
            <span title={`Component: ${action.componentTag}`} className={stepRow.componentTag}>
              {action.componentTag}
            </span>
          )}
          {!editingText && (
            <Badge variant={badgeVariant} className={stepRow.badge}>{badgeLabel}</Badge>
          )}

          {onUpdateActionText && action.type !== 'assert' && (
            editingText ? (
              <Button variant="ghost" size="icon" onMouseDown={e => e.preventDefault()} onClick={saveEditText} title="Done editing" className="h-5 w-5">
                <Check className="w-3.5 h-3.5 text-green-600" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={startEditText} title="Edit step text" className="h-5 w-5">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )
          )}
          {action.type === 'assert' && onEditAssertion && (action.expectedResults?.length ?? 0) > 0 && (
            <Button variant="ghost" size="icon" onClick={() => onEditAssertion(action.id, 0)} title="Edit assertion" className="h-5 w-5">
              <Pencil className="w-3.5 h-3.5 text-green-600" />
            </Button>
          )}
          {action.containerContext && onRemoveContainer ? (
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRemoveContainer(action.id); }} title="Remove container" className="h-5 w-5 text-amber-600 hover:text-amber-700">
              <X className="w-3.5 h-3.5" />
            </Button>
          ) : onPickContainer && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onPickContainer(
                  action.id,
                  getContainerHighlightSelector(action),
                  getAllContainerHighlightSelectors(action),
                  action.element?.textContent || action.element?.innerText
                );
              }}
              title="Pick container"
              className="h-5 w-5"
            >
              <Container className="w-3.5 h-3.5" />
            </Button>
          )}

          {/* Direct delete button */}
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(action.id); }} title="Delete step" className="h-5 w-5 text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Sub-actions */}
      {action.subActions && action.subActions.length > 0 && (
        <div
          id={`qa-step-subactions-${action.id}`}
          onDragOver={(e) => { e.stopPropagation(); }}
          onDrop={(e) => { e.stopPropagation(); }}
          className={`ml-8 ${stepRow.subList}`}
        >
          <div className="flex items-center gap-1.5 py-1">
            {editingSubStep ? (
              <input value={subStepText} onChange={e => setSubStepText(e.target.value)}
                onBlur={() => { if (cancelingSubStepEditRef.current) { cancelingSubStepEditRef.current = false; return; } saveSubStep(); }}
                onKeyDown={e => { if (e.key === 'Enter') saveSubStep(); if (e.key === 'Escape') cancelSubStep(); }}
                placeholder="Sub-step name..." autoFocus
                className={stepRow.subEditInput} />
            ) : (
              <>
                <span className={stepRow.subName}>
                  {action.subStepName || (action.subActions?.[0] ? getStepSummary(action.subActions[0]) : 'Sub-steps')}
                </span>
                {onUpdateSubStepName && (
                  <Button variant="ghost" size="icon" onClick={startEditSubStep} title="Edit sub-step name" className="h-5 w-5">
                    <Pencil className="w-3 h-3" />
                  </Button>
                )}
              </>
            )}
          </div>

          {buildSubSegments(action.subActions, action.manualSubSteps || []).map((segment) => {
            if (segment.kind === 'manualSub') {
              return (
                <ManualSubStepWrapper
                  key={segment.manualSubStep.id}
                  manualSubStep={segment.manualSubStep}
                  subs={segment.subs}
                  parentAction={action}
                  onRemoveSubAction={onRemoveSubAction}
                  onUpdateActionText={onUpdateActionText}
                  onRenameManualSubStep={onRenameManualSubStep}
                  onDeleteManualSubStep={onDeleteManualSubStep}
                  onReorderSubActions={onReorderSubActions}
                  allSubActions={action.subActions!}
                />
              );
            }

            const sub = segment.sub;
            const si = segment.absoluteIndex;
            const isSubSelected = subSelectedIds.includes(sub.id);
            const isInManualSub = inManualSubStep.has(sub.id);

            let subSelectable: boolean | undefined;
            if (isInManualSub || isTopLevelSelectionActive) {
              subSelectable = undefined;
            } else if (!subSelectionActive) {
              subSelectable = true;
            } else if (!isSubSelectionActiveHere) {
              subSelectable = false;
            } else if (isSubSelected) {
              subSelectable = true;
            } else {
              const selectedIndices = subSelectedIds
                .map(id => action.subActions!.findIndex(s => s.id === id))
                .filter(i => i >= 0);
              const minSel = Math.min(...selectedIndices);
              const maxSel = Math.max(...selectedIndices);
              subSelectable = si === minSel - 1 || si === maxSel + 1;
            }

            return (
              <div
                key={sub.id || si}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setSubDropIdx(si); }}
                onDragLeave={(e) => { e.stopPropagation(); setSubDropIdx(null); }}
                onDrop={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  if (subDragIdx !== null && subDragIdx !== si && onReorderSubActions && action.subActions) {
                    const newOrder = [...action.subActions];
                    const [moved] = newOrder.splice(subDragIdx, 1);
                    // Insert before the drop target (removal shifts indices when dragging down)
                    newOrder.splice(subDragIdx < si ? si - 1 : si, 0, moved);
                    onReorderSubActions(action.id, newOrder.map(s => s.id));
                  }
                  setSubDragIdx(null); setSubDropIdx(null);
                }}
                className={[stepRow.subRow, subDragIdx === si ? 'opacity-40' : '', subDropIdx === si ? 'border-t-2 border-ring' : ''].join(' ')}
              >
                <span draggable
                  onDragStart={(e) => { e.stopPropagation(); setSubDragIdx(si); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/qa-substep', sub.id); }}
                  onDragEnd={() => { setSubDragIdx(null); setSubDropIdx(null); }}
                  title="Drag sub-step"
                  className={`${stepRow.subLeading} text-muted-foreground cursor-grab select-none`}
                >
                  <GripVertical className={stepRow.subIcon} />
                </span>

                {subSelectable !== undefined && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (onSelectSubStep && subSelectable) onSelectSubStep(action.id, sub.id); }}
                    title={isSubSelected ? 'Deselect sub-step' : !subSelectable ? 'Select an adjacent sub-step first' : 'Select sub-step'}
                    className={[
                      'shrink-0 w-3.5 h-3.5 mt-[3px] rounded border-2 flex items-center justify-center',
                      isSubSelected ? 'bg-purple-600 border-purple-600' : subSelectable ? 'border-muted-foreground' : 'border-border',
                      subSelectable ? 'cursor-pointer' : 'cursor-default',
                    ].join(' ')}
                  >
                    {isSubSelected && <span className="text-white text-xs leading-none">✓</span>}
                  </button>
                )}

                <span className={stepRow.subText}>{getStepSummary(sub)}</span>
                {onUpdateActionText && <EditableSubStep sub={sub} onUpdateActionText={onUpdateActionText} />}
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRemoveSubAction(action.id, sub.id); }} title="Delete sub-step" className="h-5 w-5 text-destructive hover:text-destructive">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
