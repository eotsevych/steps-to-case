/**
 * Shared spacing / typography for step rows.
 *
 * The Record view (ActionsList) and the Organise view (StepPage → DraggableStep)
 * render the same step in different chrome — bordered cards vs. flat separated
 * rows — but everything inside the row should line up identically. Keep the
 * measurements here so the two views cannot drift apart again.
 *
 * Vertical rhythm: the title line is a 24px box — that is the height of the
 * description-picker chip (20px text + 1px padding + 1px border on each side)
 * and of the inline editor. The number, badge and icon buttons all sit in a
 * 24px box so they centre on that line; rows are items-start so they stay
 * there when detail lines are added below.
 */
export const stepRow = {
  /** Row flex box — combine with the view's own chrome (card border / divider) */
  base: 'flex items-start gap-1 px-1.5 py-1.5',
  /** Leading step number */
  number: 'text-xs leading-6 text-muted-foreground font-medium min-w-4 shrink-0',
  /** Content column: title line plus any detail lines */
  content: 'flex-1 min-w-0 flex flex-col',
  /** Title line — min-h-6 so single-line steps match the chip's height */
  titleLine: 'flex items-center gap-1.5 min-w-0 min-h-6',
  /** Container context / assertion / expected-result lines under the title */
  detailLine: 'text-sm mt-0.5',
  /** Trailing group: component tag, type badge, icon buttons */
  actions: 'flex items-center h-6 gap-1 shrink-0',
  /** Left-hand controls (drag handle, selection checkbox) share that 24px box */
  leading: 'flex items-center h-6 shrink-0',
  /** Type badge (R / A / M) */
  badge: 'shrink-0 w-5 h-5 !p-0 justify-center rounded-sm font-semibold leading-none',
  componentTag:
    'shrink-0 inline-flex items-center h-5 text-xs leading-none font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded px-1',
  /** Icon buttons and their glyphs */
  iconButton: 'h-5 w-5',
  icon: 'w-3.5 h-3.5',
  /** Inline editor for the step title */
  editInput: 'w-full px-2 py-0.5 border border-ring rounded text-sm outline-hidden bg-input-background',
  /** Hint under the editor explaining the {name} token */
  editHint: 'block mt-1 text-xs leading-snug text-muted-foreground',

  /** Sub-action rows sit one level down: same rhythm, smaller type and glyphs */
  subList: 'border-l-2 border-border/40 pl-3 pb-1',
  subName: 'text-xs font-semibold text-muted-foreground',
  subRow: 'flex items-start gap-2 py-1',
  /** Sub-rows have no picker chip, so their line box is 20px */
  subActions: 'flex items-center h-5 gap-1 shrink-0',
  subLeading: 'flex items-center h-5 shrink-0',
  subText: 'text-xs text-foreground leading-5 flex-1 min-w-0',
  subIcon: 'w-3 h-3',
  subEditInput: 'flex-1 px-2 py-0.5 border border-ring rounded text-xs outline-hidden bg-input-background',
} as const;

/** Truncation limits for the detail lines, shared by both views. */
export const stepDetailLimits = {
  selector: 60,
  expectedValue: 30,
  expectedResult: 40,
} as const;
