// Dropdown for choosing which scraped hierarchy text becomes the step description.
// Rendered as a small framed chip (text + chevron) inside the step summary;
// the menu opens under the chip.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Action, DescriptionCandidate, HierarchyOption } from '../types';
import { getStepSummary, getStepSummaryParts } from './stepDisplay';
import { Check, ChevronDown } from 'lucide-react';

// Compact origin hints — full detail stays available via the option tooltip
const LEVEL_TAGS: Record<HierarchyOption, string> = {
  '0': 'self',
  '1': 'sibling',
  '1+': 'sibling',
  '2': 'parent',
  '2+': 'parent',
  '3': 'ancestor',
  '3+': 'ancestor',
};

const MENU_WIDTH = 288; // matches w-72
const MENU_MAX_HEIGHT = 320;
const VIEWPORT_MARGIN = 8;

interface MenuPosition {
  top?: number;
  bottom?: number;
  left: number;
  maxHeight: number;
}

interface PickerProps {
  action: Action;
  /** Text shown inside the framed chip; omit to render a bare chevron trigger */
  label?: string;
  onSelectDescription: (actionId: string, candidate: { text: string; source?: string; level?: HierarchyOption }) => void;
}

export function DescriptionPicker({ action, label, onSelectDescription }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0, maxHeight: MENU_MAX_HEIGHT });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const candidates = action.selectors?.descriptionCandidates ?? [];
  const selectedText = action.selectors?.contextText ?? '';

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        contentRef.current && !contentRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (candidates.length === 0) return null;

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const left = Math.max(4, Math.min(rect.left, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN));
      const spaceBelow = window.innerHeight - rect.bottom - 4 - VIEWPORT_MARGIN;
      const spaceAbove = rect.top - 4 - VIEWPORT_MARGIN;
      // Open downward when it fits (or beats the space above); otherwise flip up
      if (spaceBelow >= MENU_MAX_HEIGHT || spaceBelow >= spaceAbove) {
        setPosition({ top: rect.bottom + 4, left, maxHeight: Math.min(MENU_MAX_HEIGHT, Math.max(120, spaceBelow)) });
      } else {
        setPosition({ bottom: window.innerHeight - rect.top + 4, left, maxHeight: Math.min(MENU_MAX_HEIGHT, Math.max(120, spaceAbove)) });
      }
      setFilter('');
    }
    setOpen(!open);
  };

  const pick = (candidate: DescriptionCandidate) => {
    onSelectDescription(action.id, { text: candidate.text, source: candidate.source, level: candidate.level });
    setOpen(false);
  };

  const query = filter.trim().toLowerCase();
  // Candidates are already ordered closest-level-first by the collector
  const visible = query
    ? candidates.filter(c => c.text.toLowerCase().includes(query))
    : candidates;

  return (
    <>
      {label !== undefined ? (
        <button
          ref={triggerRef}
          data-qa="description-picker-btn"
          onClick={toggle}
          title="Choose description text"
          className={[
            'inline-flex items-center gap-0.5 min-w-0 max-w-full shrink px-1 py-px',
            'border rounded text-sm text-foreground transition-colors',
            open ? 'border-ring bg-accent/50' : 'border-border hover:border-ring hover:bg-accent/50',
          ].join(' ')}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className={`w-3 h-3 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <button
          ref={triggerRef}
          data-qa="description-picker-btn"
          onClick={toggle}
          title="Choose description text"
          className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {open && createPortal(
        <div
          ref={contentRef}
          data-qa="description-picker-menu"
          style={{ position: 'fixed', top: position.top, bottom: position.bottom, left: position.left, maxHeight: position.maxHeight }}
          className="z-[9999] w-72 overflow-y-auto rounded-md border border-border bg-popover shadow-md"
          onClick={e => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 bg-popover border-b border-border p-1.5">
            <input
              data-qa="description-picker-filter"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && visible.length === 1) pick(visible[0]);
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder="Filter..."
              autoFocus
              className="w-full px-2 py-1 border border-input rounded text-sm outline-hidden focus:border-ring bg-input-background"
            />
          </div>

          <div className="py-0.5">
            {visible.length === 0 && (
              <p data-qa="description-picker-no-results" className="px-2.5 py-3 text-sm text-center text-muted-foreground">
                No matching text
              </p>
            )}
            {visible.map((candidate, i) => {
              const isSelected = candidate.text === selectedText;
              return (
                <button
                  key={i}
                  data-qa="description-picker-option"
                  onClick={() => pick(candidate)}
                  title={`${candidate.level} · ${candidate.source} · ${candidate.attr}`}
                  className={[
                    'flex w-full items-start gap-1.5 px-2.5 py-1.5 text-left hover:bg-accent transition-colors',
                    isSelected ? 'bg-primary/8' : '',
                  ].join(' ')}
                >
                  <span className="w-3.5 shrink-0 pt-0.5">
                    {isSelected && <Check className="w-3 h-3 text-primary" />}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-foreground leading-snug line-clamp-2">
                    {candidate.text}
                  </span>
                  <span className={[
                    'shrink-0 pt-0.5 text-xs leading-none rounded px-1 py-0.5',
                    candidate.source === 'custom'
                      ? 'text-violet-700 bg-violet-100 font-medium'
                      : 'text-muted-foreground bg-muted',
                  ].join(' ')}>
                    {candidate.source === 'custom' ? 'custom' : LEVEL_TAGS[candidate.level]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

interface StepTitleProps {
  action: Action;
  onSelectDescription?: (actionId: string, candidate: { text: string; source?: string; level?: HierarchyOption }) => void;
}

/**
 * Step summary line. When description candidates are available the element
 * name is rendered as a framed picker chip (text + chevron); otherwise the
 * plain summary text is shown.
 */
export function StepTitle({ action, onSelectDescription }: StepTitleProps) {
  const canPick =
    !!onSelectDescription &&
    action.type !== 'assert' &&
    (action.selectors?.descriptionCandidates?.length ?? 0) > 0;
  const parts = canPick ? getStepSummaryParts(action) : null;

  if (canPick && parts) {
    return (
      <span className="flex-1 min-w-0 flex items-center gap-1 text-sm text-foreground">
        {parts.prefix && <span className="shrink-0 whitespace-nowrap">{parts.prefix}</span>}
        <DescriptionPicker action={action} label={parts.name} onSelectDescription={onSelectDescription!} />
        {parts.suffix && <span className="truncate min-w-6">{parts.suffix}</span>}
      </span>
    );
  }

  if (canPick) {
    // Custom text or non-name-driven summary: plain text with a bare chevron
    return (
      <span className="flex-1 min-w-0 flex items-center gap-0.5">
        <span className="text-sm text-foreground truncate min-w-0">{getStepSummary(action)}</span>
        <DescriptionPicker action={action} onSelectDescription={onSelectDescription!} />
      </span>
    );
  }

  return <span className="text-sm text-foreground flex-1 truncate">{getStepSummary(action)}</span>;
}
