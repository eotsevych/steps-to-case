import React, { useEffect, useRef, useState } from 'react';
import type { Action, HierarchyOption } from '../types';
import { NAME_TOKEN } from '../lib/stepName';
import { assertionLabels, getStepSummary, getStepTextTemplate, getStepTypeBadge, normalizeStepTemplate } from './stepDisplay';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Container, Trash2, Pencil, Check, X, GripVertical } from 'lucide-react';
import { getContainerHighlightSelector, getAllContainerHighlightSelectors } from './containerHighlightSelector';
import { StepTitle } from './DescriptionPicker';
import { stepDetailLimits, stepRow } from './stepRowStyles';

interface Props {
  actions: Action[];
  onRemoveSubAction?: (parentActionId: string, subActionId: string) => void;
  onDeleteAction?: (actionId: string) => void;
  onUpdateActionText?: (actionId: string, customText: string) => void;
  onSelectDescription?: (actionId: string, candidate: { text: string; source?: string; level?: HierarchyOption }) => void;
  onUpdateSubStepName?: (actionId: string, subStepName: string) => void;
  onReorderSubActions?: (parentActionId: string, subActionIds: string[]) => void;
  onEditAssertion?: (actionId: string, resultIndex: number) => void;
  onPickContainer?: (actionId: string, selector: string, candidateSelectors?: string[], targetText?: string) => void;
  onRemoveContainer?: (actionId: string) => void;
  debug?: boolean;
  lockedActionIds?: Set<string>;
  lockedActionLabels?: Map<string, string>;
}


export function ActionsList({ actions, onRemoveSubAction, onDeleteAction, onUpdateActionText, onSelectDescription, onUpdateSubStepName, onReorderSubActions, onEditAssertion, onPickContainer, onRemoveContainer, debug, lockedActionIds, lockedActionLabels }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(actions.length);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [editText, setEditText] = useState('');
  const [editingSubStepId, setEditingSubStepId] = useState<string | null>(null);
  const [subStepText, setSubStepText] = useState('');
  const [subDragState, setSubDragState] = useState<{ parentId: string; dragIdx: number; dropIdx: number | null } | null>(null);
  // Suppresses the blur-triggered save that would otherwise fire when Escape
  // unmounts the focused input (blur fires on removal, after the cancel already ran)
  const cancelingEditRef = useRef(false);
  const cancelingSubStepEditRef = useRef(false);

  // Auto-scroll to bottom when new actions are added
  useEffect(() => {
    if (actions.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    prevCountRef.current = actions.length;
  }, [actions.length]);

  // The pencil edits the whole summary line, verb included. On steps that show
  // the description picker the element name appears as the {name} token, so the
  // picker chip survives a reworded line (see getStepTextTemplate)
  const startEditing = (action: Action) => {
    setEditingId(action.id);
    setEditingAction(action);
    setEditText(getStepTextTemplate(action));
  };

  const saveEdit = () => {
    const text = editText.trim();
    if (editingId && editingAction && text) {
      onUpdateActionText?.(editingId, normalizeStepTemplate(text, editingAction));
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    cancelingEditRef.current = true;
    setEditingId(null);
  };

  const startEditingSubStep = (action: Action) => {
    setEditingSubStepId(action.id);
    setSubStepText(action.subStepName || '');
  };

  const saveSubStepEdit = () => {
    if (editingSubStepId && onUpdateSubStepName) {
      onUpdateSubStepName(editingSubStepId, subStepText.trim());
    }
    setEditingSubStepId(null);
  };

  const cancelSubStepEdit = () => {
    cancelingSubStepEditRef.current = true;
    setEditingSubStepId(null);
  };

  if (actions.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p className="text-sm">Interact with the page to record actions</p>
        <p className="text-xs mt-2">Clicks, typing, navigation will be captured automatically</p>
      </div>
    );
  }

  const renderActionCard = (action: Action, index: number, isLocked: boolean) => {
    const { label: badgeLabel, variant: badgeVariant } = getStepTypeBadge(action.type);

    // Build locked sub-step names map from manualSubSteps
    const subLockedNames = new Map<string, string>();
    if (action.manualSubSteps) {
      for (const ms of action.manualSubSteps) {
        for (const id of ms.subActionIds) subLockedNames.set(id, ms.name);
      }
    }

    // Build sub-action segments (single vs composed)
    type SubSeg = { type: 'single'; sub: Action; si: number } | { type: 'composed'; label: string; items: { sub: Action; si: number }[] };
    const subSegs: SubSeg[] = [];
    (action.subActions || []).forEach((sub, si) => {
      const lbl = subLockedNames.get(sub.id);
      if (lbl) {
        const last = subSegs[subSegs.length - 1];
        if (last?.type === 'composed' && last.label === lbl) {
          last.items.push({ sub, si });
        } else {
          subSegs.push({ type: 'composed', label: lbl, items: [{ sub, si }] });
        }
      } else {
        subSegs.push({ type: 'single', sub, si });
      }
    });

    return (
      <>
        <div className={`${stepRow.base} rounded-lg border border-border bg-card mb-1`}>
          {/* Step number */}
          <span className={stepRow.number}>{index + 1}.</span>

          {/* Content */}
          <div className={stepRow.content}>
            {editingId === action.id ? (
              <>
                <input
                  data-qa="action-edit-input"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={() => { if (cancelingEditRef.current) { cancelingEditRef.current = false; return; } saveEdit(); }}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                  autoFocus
                  className={stepRow.editInput}
                />
                {editText.includes(NAME_TOKEN) && <span className={stepRow.editHint}>{NAME_TOKEN} stays a picker chip &mdash; reword around it</span>}
              </>
            ) : (
              <div className={stepRow.titleLine}>
                <span data-qa="action-description" className="flex-1 min-w-0 flex">
                  <StepTitle action={action} onSelectDescription={isLocked ? undefined : onSelectDescription} />
                </span>
              </div>
            )}

            {/* Container context */}
            {action.containerContext && (
              <span className={`${stepRow.detailLine} text-muted-foreground italic block`}>
                in &ldquo;{action.containerContext.containerLabel}&rdquo;
              </span>
            )}

            {/* Assertion details */}
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

            {/* Expected results for non-assert actions */}
            {action.type !== 'assert' && action.expectedResults && action.expectedResults.length > 0 && (
              <div className={`${stepRow.detailLine} flex flex-wrap gap-1`}>
                {action.expectedResults.map((er, i) => (
                  <span
                    key={i}
                    data-qa={`assertion-badge-${i}`}
                    className="text-green-700"
                  >
                    {er.description.slice(0, stepDetailLimits.expectedResult)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Component tag, type badge and icon buttons, pinned to the title line */}
          <div className={stepRow.actions}>
            {editingId !== action.id && action.componentTag && (
              <span title={`Component: ${action.componentTag}`} className={stepRow.componentTag}>
                {action.componentTag}
              </span>
            )}
            {editingId !== action.id && (
              <Badge variant={badgeVariant} className={stepRow.badge}>{badgeLabel}</Badge>
            )}
            {!isLocked && action.type !== 'assert' && onUpdateActionText && (
              editingId === action.id ? (
                <Button
                  data-qa="save-action-btn"
                  variant="ghost"
                  size="icon"
                  onMouseDown={e => e.preventDefault()}
                  onClick={saveEdit}
                  title="Done editing"
                  className="h-5 w-5"
                >
                  <Check className="w-3.5 h-3.5 text-green-600" />
                </Button>
              ) : (
                <Button
                  data-qa="edit-action-btn"
                  variant="ghost"
                  size="icon"
                  onClick={() => startEditing(action)}
                  title="Edit step text"
                  className="h-5 w-5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )
            )}
            {!isLocked && action.type === 'assert' && onEditAssertion && (action.expectedResults?.length ?? 0) > 0 && (
              <Button
                data-qa="edit-assertion-btn"
                variant="ghost"
                size="icon"
                onClick={() => onEditAssertion(action.id, 0)}
                title="Edit assertion"
                className="h-5 w-5"
              >
                <Pencil className="w-3.5 h-3.5 text-green-600" />
              </Button>
            )}
            {!isLocked && action.containerContext && onRemoveContainer ? (
              <Button
                data-qa="remove-container-btn"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveContainer(action.id)}
                title="Remove container"
                className="h-5 w-5"
              >
                <X className="w-3.5 h-3.5 text-amber-600" />
              </Button>
            ) : (!isLocked && onPickContainer && (
              <Button
                data-qa="pick-container-btn"
                variant="ghost"
                size="icon"
                onClick={() => onPickContainer(
                  action.id,
                  getContainerHighlightSelector(action),
                  getAllContainerHighlightSelectors(action),
                  action.element?.textContent || action.element?.innerText
                )}
                title="Pick container"
                className="h-5 w-5"
              >
                <Container className="w-3.5 h-3.5" />
              </Button>
            ))}
            {!isLocked && onDeleteAction && (
              <Button
                data-qa="delete-action-btn"
                variant="ghost"
                size="icon"
                onClick={() => onDeleteAction(action.id)}
                title="Delete step"
                className="h-5 w-5 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Sub-actions (Alt+Click grouped) */}
        {action.subActions && action.subActions.length > 0 && (
          <div data-qa="sub-actions" className={`ml-5 ${stepRow.subList} mb-2`}>
            {/* Editable sub-step name */}
            <div className="flex items-center gap-1.5 py-1">
              {editingSubStepId === action.id ? (
                <input
                  data-qa="substep-edit-input"
                  value={subStepText}
                  onChange={e => setSubStepText(e.target.value)}
                  onBlur={() => { if (cancelingSubStepEditRef.current) { cancelingSubStepEditRef.current = false; return; } saveSubStepEdit(); }}
                  onKeyDown={e => { if (e.key === 'Enter') saveSubStepEdit(); if (e.key === 'Escape') cancelSubStepEdit(); }}
                  placeholder="Sub-step name..."
                  autoFocus
                  className={stepRow.subEditInput}
                />
              ) : (
                <>
                  <span data-qa="substep-name" className={stepRow.subName}>
                    {action.subStepName || (action.subActions?.[0] ? getStepSummary(action.subActions[0]) : 'Sub-steps')}
                  </span>
                  {!isLocked && onUpdateSubStepName && (
                    <Button
                      data-qa="edit-substep-btn"
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditingSubStep(action)}
                      title="Edit sub-step name"
                      className="h-5 w-5"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                </>
              )}
            </div>
            {subSegs.map((seg, segIdx) => {
              if (seg.type === 'composed') {
                return (
                  <div key={`sub-composed-${segIdx}`} className="border-l-2 border-purple-400 bg-purple-50/40 rounded pl-2 py-1 mb-1.5 opacity-60">
                    <div className="text-xs font-semibold text-purple-700 pb-1">Composed: {seg.label}</div>
                    {seg.items.map(({ sub, si }) => (
                      <div key={sub.id || si} data-qa={`sub-action-${si}`} className={`${stepRow.subRow} rounded border border-border bg-card px-2 mb-1`}>
                        <Badge variant={getStepTypeBadge(sub.type).variant} className={stepRow.badge}>{getStepTypeBadge(sub.type).label}</Badge>
                        <span data-qa="substep-description" className={stepRow.subText}>{getStepSummary(sub)}</span>
                      </div>
                    ))}
                  </div>
                );
              }
              const { sub, si } = seg;
              return (
                <div
                  key={sub.id || si}
                  data-qa={`sub-action-${si}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (subDragState?.parentId === action.id) {
                      setSubDragState({ ...subDragState, dropIdx: si });
                    }
                  }}
                  onDragLeave={(e) => {
                    e.stopPropagation();
                    if (subDragState?.parentId === action.id) {
                      setSubDragState({ ...subDragState, dropIdx: null });
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (subDragState && subDragState.parentId === action.id && subDragState.dragIdx !== si && onReorderSubActions && action.subActions) {
                      const newOrder = [...action.subActions];
                      const [moved] = newOrder.splice(subDragState.dragIdx, 1);
                      // Insert before the drop target (removal shifts indices when dragging down)
                      newOrder.splice(subDragState.dragIdx < si ? si - 1 : si, 0, moved);
                      onReorderSubActions(action.id, newOrder.map(s => s.id));
                    }
                    setSubDragState(null);
                  }}
                  className={[
                    `${stepRow.subRow} rounded border border-border bg-card px-2 mb-1`,
                    subDragState?.parentId === action.id && subDragState.dragIdx === si ? 'opacity-40' : '',
                    subDragState?.parentId === action.id && subDragState.dropIdx === si ? 'border-t-2 border-t-ring' : '',
                  ].join(' ')}
                >
                  {!isLocked && (
                    <span
                      data-qa="substep-drag-handle"
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setSubDragState({ parentId: action.id, dragIdx: si, dropIdx: null });
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('application/qa-substep', sub.id);
                      }}
                      onDragEnd={() => setSubDragState(null)}
                      title="Drag sub-step"
                      className={`${stepRow.subLeading} text-muted-foreground cursor-grab select-none`}
                    >
                      <GripVertical className={stepRow.subIcon} />
                    </span>
                  )}
                  <div className={stepRow.content}>
                    {editingId === sub.id ? (
                      <input
                        data-qa="substep-edit-input"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onBlur={() => { if (cancelingEditRef.current) { cancelingEditRef.current = false; return; } saveEdit(); }}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        autoFocus
                        className={stepRow.subEditInput}
                      />
                    ) : (
                      <span data-qa="substep-description" className={stepRow.subText}>{getStepSummary(sub)}</span>
                    )}
                  </div>
                  <div className={stepRow.subActions}>
                    {!isLocked && onUpdateActionText && (
                      editingId === sub.id ? (
                        <Button
                          data-qa="save-substep-btn"
                          variant="ghost"
                          size="icon"
                          onMouseDown={e => e.preventDefault()}
                          onClick={saveEdit}
                          title="Done editing"
                          className="h-5 w-5"
                        >
                          <Check className="w-3 h-3 text-green-600" />
                        </Button>
                      ) : (
                        <Button
                          data-qa="edit-substep-btn"
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditing(sub)}
                          title="Edit step text"
                          className="h-5 w-5"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )
                    )}
                    {!isLocked && onRemoveSubAction && (
                      <Button
                        data-qa="remove-substep-btn"
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveSubAction(action.id, sub.id)}
                        title="Delete sub-step"
                        className="h-5 w-5 text-destructive hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  // Pre-compose actions into segments: composed sets share a wrapper, others are individual
  type Segment = { type: 'single'; action: Action; index: number } | { type: 'composed'; label: string; actions: { action: Action; index: number }[] };
  const segments: Segment[] = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const label = lockedActionIds?.has(action.id) ? lockedActionLabels?.get(action.id) : undefined;
    if (label) {
      const last = segments[segments.length - 1];
      if (last?.type === 'composed' && last.label === label) {
        last.actions.push({ action, index: i });
      } else {
        segments.push({ type: 'composed', label, actions: [{ action, index: i }] });
      }
    } else {
      segments.push({ type: 'single', action, index: i });
    }
  }

  return (
    <div data-qa="actions-list">
      {segments.map((seg, segIdx) => {
        if (seg.type === 'composed') {
          return (
            <div key={`composed-${segIdx}`} data-qa="composed-step-set-wrapper" className="border-l-2 border-purple-400 bg-purple-50/40 rounded-md pl-2 py-1.5 mb-2 opacity-60">
              <div data-qa="composed-step-set-label" className="text-xs font-semibold text-purple-700 pb-1.5 px-1">
                Composed: {seg.label}
              </div>
              {seg.actions.map(({ action, index }) => (
                <div key={action.id || index} data-qa={`action-${index}`}>
                  {renderActionCard(action, index, true)}
                </div>
              ))}
            </div>
          );
        }
        const { action, index } = seg;
        return (
          <div key={action.id || index} data-qa={`action-${index}`}>
            {renderActionCard(action, index, false)}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
