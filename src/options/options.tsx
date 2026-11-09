import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronDown, GripVertical } from 'lucide-react';
import {
  cloneLocatorAttributes,
  DEFAULT_SETTINGS,
  FONT_SCALE_PX,
  loadPromptTemplate,
  loadSettings,
  savePromptTemplate,
  saveSettings,
  type ComponentRecognitionRule,
  type FontScale,
  type PageRecognitionRule,
  type RecorderSettings,
} from '../lib/settings';
import { HIERARCHY_OPTIONS } from '../lib/hierarchy';
import { darkColors, lightColors, type Colors } from '../panel/styles';
import type { HierarchyOption } from '../types';

const OPT_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const OPT_MONO = '"SF Mono", "Fira Code", Consolas, "Courier New", monospace';

type SectionId =
  | 'appearance'
  | 'development'
  | 'prompt-template'
  | 'description-anchors'
  | 'locator-attributes'
  | 'page-recognition'
  | 'component-recognition';

interface ReorderableItem {
  id: string;
  label: string;
  removable: boolean;
  badge?: string;
}

const NAV_SECTIONS: Array<{
  id: 'general' | 'advanced';
  label: string;
  items: Array<{ id: SectionId; label: string }>;
}> = [
  {
    id: 'general',
    label: 'General',
    items: [
      { id: 'appearance', label: 'Appearance' },
      { id: 'development', label: 'Development' },
      { id: 'prompt-template', label: 'AI Prompt Template' },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    items: [
      { id: 'description-anchors', label: 'Description Anchors' },
      { id: 'locator-attributes', label: 'Locator Attributes' },
      { id: 'page-recognition', label: 'Page Recognition' },
      { id: 'component-recognition', label: 'Component Recognition' },
    ],
  },
];

const HIERARCHY_LABELS: Record<HierarchyOption, string> = {
  '0': '0 - Exact element',
  '1': '1 - Closest upper sibling',
  '1+': '1+ - All upper siblings',
  '2': '2 - Closest parent',
  '2+': '2+ - Parents and their upper siblings',
  '3': '3 - Grandparent',
  '3+': '3+ - Grandparent and higher levels',
};

const HIERARCHY_HINTS: Record<HierarchyOption, string> = {
  '0': 'Use only the target element.',
  '1': 'Use the nearest previous sibling only.',
  '1+': 'Check previous siblings from nearest to farthest.',
  '2': 'Use only the closest parent.',
  '2+': 'Walk parents upward and also inspect their previous siblings.',
  '3': 'Jump directly to the grandparent.',
  '3+': 'Start from the grandparent, then keep walking upward with upper siblings.',
};

const HIERARCHY_EXAMPLE_LINES: Array<{ text: string; token?: HierarchyOption }> = [
  { text: '<div class="page-shell">' },
  { text: '  <aside class="summary"></aside> <!-- 3+ upper sibling above the grandparent -->', token: '3+' },
  { text: '  <div class="panel"> <!-- 3 grandparent -->', token: '3' },
  { text: '    <header class="row-summary">Summary</header> <!-- 2+ upper sibling above the parent -->', token: '2+' },
  { text: '    <section class="field-row"> <!-- 2 closest parent -->', token: '2' },
  { text: '      <label for="email">Email</label> <!-- 1+ next upper sibling -->', token: '1+' },
  { text: '      <p class="hint">Hint</p> <!-- 1 closer upper sibling -->', token: '1' },
  { text: '      <input id="email" value="john@acme.com" /> <!-- 0 exact element -->', token: '0' },
  { text: '    </section>' },
  { text: '  </div>' },
  { text: '</div>' },
];

// Highlight only the DOM positions the selected level actually reads — a single
// level (plus its own upper-sibling positions for the "+" variants). It does NOT
// cascade down to lower levels: lower levels are not inspected, except level 0,
// which is shown separately as the fallback (see HierarchyModeControl).
const HIERARCHY_HIGHLIGHT: Record<HierarchyOption, HierarchyOption[]> = {
  '0': ['0'],
  '1': ['1'],
  '1+': ['1', '1+'],
  '2': ['2'],
  '2+': ['2', '2+'],
  '3': ['3'],
  '3+': ['3', '3+'],
};

function makeStyles(c: Colors) {
  return {
    shell: {
      minHeight: '100vh',
      background: c.bg,
      color: c.text,
      fontFamily: OPT_FONT,
      display: 'flex',
    } as React.CSSProperties,
    sidebar: {
      width: '220px',
      borderRight: `1px solid ${c.border}`,
      background: c.bg,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    } as React.CSSProperties,
    sidebarHeader: {
      padding: '18px 16px',
      borderBottom: `1px solid ${c.border}`,
    } as React.CSSProperties,
    iconButton: {
      width: '28px',
      height: '28px',
      border: 'none',
      background: 'transparent',
      borderRadius: '8px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: c.textSecondary,
      cursor: 'pointer',
    } as React.CSSProperties,
    nav: {
      padding: '10px 8px 16px',
      overflowY: 'auto',
      flex: 1,
    } as React.CSSProperties,
    navGroup: {
      marginBottom: '10px',
    } as React.CSSProperties,
    navGroupButton: {
      width: '100%',
      border: 'none',
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 8px',
      borderRadius: '8px',
      color: c.textSecondary,
      fontSize: '0.8125rem',
      fontWeight: 600,
      cursor: 'default',
      textAlign: 'left',
    } as React.CSSProperties,
    navItems: {
      marginTop: '4px',
      marginLeft: '18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    } as React.CSSProperties,
    navItem: (active: boolean): React.CSSProperties => ({
      width: '100%',
      border: 'none',
      background: active ? c.primaryLight : 'transparent',
      color: active ? c.primary : c.textSecondary,
      fontSize: '0.75rem',
      fontWeight: active ? 600 : 500,
      padding: '9px 10px',
      borderRadius: '8px',
      textAlign: 'left',
      cursor: 'pointer',
    }),
    main: {
      flex: 1,
      overflowY: 'auto',
      background: c.bg,
    } as React.CSSProperties,
    content: {
      padding: '28px 32px 40px',
      maxWidth: '780px',
    } as React.CSSProperties,
    eyebrow: {
      fontSize: '0.6875rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: c.textMuted,
      marginBottom: '8px',
    } as React.CSSProperties,
    pageTitle: {
      margin: 0,
      fontSize: '1.75rem',
      lineHeight: '1.15',
      letterSpacing: '-0.03em',
      fontWeight: 700,
      color: c.text,
    } as React.CSSProperties,
    pageDescription: {
      margin: '10px 0 0',
      maxWidth: '640px',
      fontSize: '0.875rem',
      lineHeight: '1.65',
      color: c.textSecondary,
    } as React.CSSProperties,
    statusPill: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '6px 10px',
      borderRadius: '999px',
      background: c.successLight,
      color: c.success,
      fontSize: '0.75rem',
      fontWeight: 600,
    } as React.CSSProperties,
    card: {
      marginTop: '24px',
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: '18px',
      padding: '22px',
      boxShadow: darkShadow(c),
    } as React.CSSProperties,
    cardTitle: {
      margin: 0,
      fontSize: '1.125rem',
      lineHeight: '1.25',
      fontWeight: 600,
      color: c.text,
    } as React.CSSProperties,
    cardDescription: {
      margin: '8px 0 0',
      fontSize: '0.875rem',
      lineHeight: '1.65',
      color: c.textSecondary,
    } as React.CSSProperties,
    sectionStack: {
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      marginTop: '18px',
    } as React.CSSProperties,
    toggleRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '18px',
      padding: '14px 0',
    } as React.CSSProperties,
    toggleInfo: {
      flex: 1,
      minWidth: 0,
    } as React.CSSProperties,
    toggleLabel: {
      display: 'block',
      fontSize: '0.875rem',
      lineHeight: '1.4',
      fontWeight: 600,
      color: c.text,
    } as React.CSSProperties,
    toggleHint: {
      marginTop: '4px',
      fontSize: '0.8125rem',
      lineHeight: '1.6',
      color: c.textSecondary,
    } as React.CSSProperties,
    switch: (checked: boolean): React.CSSProperties => ({
      width: '34px',
      height: '20px',
      border: 'none',
      borderRadius: '999px',
      background: checked ? c.primary : c.bgTertiary,
      padding: '2px',
      cursor: 'pointer',
      position: 'relative',
      transition: 'background 0.18s ease',
      flexShrink: 0,
    }),
    switchThumb: (checked: boolean): React.CSSProperties => ({
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      background: '#fff',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.18)',
      transform: checked ? 'translateX(14px)' : 'translateX(0)',
      transition: 'transform 0.18s ease',
    }),
    segmented: {
      display: 'inline-flex',
      padding: '3px',
      borderRadius: '10px',
      background: c.bgTertiary,
      gap: '2px',
      flexShrink: 0,
    } as React.CSSProperties,
    segmentButton: (active: boolean): React.CSSProperties => ({
      border: 'none',
      borderRadius: '7px',
      padding: '7px 14px',
      background: active ? c.bg : 'transparent',
      color: active ? c.text : c.textSecondary,
      fontSize: '0.8125rem',
      fontWeight: active ? 600 : 500,
      cursor: 'pointer',
      boxShadow: active ? darkShadow(c) : 'none',
      fontFamily: OPT_FONT,
    }),
    textarea: {
      width: '100%',
      minHeight: '320px',
      resize: 'vertical',
      borderRadius: '14px',
      border: `1px solid ${c.border}`,
      background: c.bgSecondary,
      color: c.text,
      padding: '14px 16px',
      fontSize: '0.75rem',
      lineHeight: '1.65',
      boxSizing: 'border-box',
      fontFamily: OPT_MONO,
      outline: 'none',
    } as React.CSSProperties,
    input: {
      width: '100%',
      borderRadius: '12px',
      border: `1px solid ${c.border}`,
      background: c.bgSecondary,
      color: c.text,
      padding: '10px 12px',
      fontSize: '0.8125rem',
      lineHeight: '1.5',
      boxSizing: 'border-box',
      outline: 'none',
      fontFamily: OPT_FONT,
    } as React.CSSProperties,
    numberInput: {
      width: '88px',
      borderRadius: '12px',
      border: `1px solid ${c.border}`,
      background: c.bgSecondary,
      color: c.text,
      padding: '10px 12px',
      fontSize: '0.9375rem',
      lineHeight: '1.3',
      boxSizing: 'border-box',
      outline: 'none',
      fontFamily: OPT_FONT,
      textAlign: 'center',
    } as React.CSSProperties,
    select: {
      width: '100%',
      borderRadius: '12px',
      border: `1px solid ${c.border}`,
      background: c.bgSecondary,
      color: c.text,
      padding: '10px 12px',
      fontSize: '0.8125rem',
      lineHeight: '1.5',
      boxSizing: 'border-box',
      outline: 'none',
      fontFamily: OPT_FONT,
    } as React.CSSProperties,
    buttonRow: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      marginTop: '14px',
    } as React.CSSProperties,
    primaryButton: (enabled: boolean): React.CSSProperties => ({
      border: 'none',
      borderRadius: '12px',
      padding: '10px 14px',
      background: c.primary,
      color: '#fff',
      fontSize: '0.8125rem',
      fontWeight: 600,
      cursor: enabled ? 'pointer' : 'default',
      opacity: enabled ? 1 : 0.45,
      fontFamily: OPT_FONT,
    }),
    secondaryButton: {
      border: `1px solid ${c.border}`,
      borderRadius: '12px',
      padding: '10px 14px',
      background: c.bg,
      color: c.textSecondary,
      fontSize: '0.8125rem',
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: OPT_FONT,
    } as React.CSSProperties,
    helperText: {
      fontSize: '0.8125rem',
      lineHeight: '1.6',
      color: c.textSecondary,
    } as React.CSSProperties,
    inlineCode: {
      fontFamily: OPT_MONO,
      fontSize: '0.75rem',
      background: c.bgSecondary,
      borderRadius: '6px',
      padding: '2px 6px',
      color: c.text,
    } as React.CSSProperties,
    emptyBox: {
      padding: '18px',
      textAlign: 'center',
      color: c.textMuted,
      border: `1px dashed ${c.border}`,
      borderRadius: '14px',
      fontSize: '0.8125rem',
      background: c.bgSecondary,
    } as React.CSSProperties,
    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    } as React.CSSProperties,
    listRow: (active: boolean): React.CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 12px',
      background: active ? c.primaryLight : c.bgSecondary,
      borderRadius: '12px',
      border: `1px solid ${active ? c.primaryBorder : c.border}`,
      cursor: 'grab',
      fontSize: '0.8125rem',
      lineHeight: '1.5',
    }),
    monoText: {
      fontFamily: OPT_MONO,
      fontSize: '0.75rem',
      color: c.text,
    } as React.CSSProperties,
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '20px',
      padding: '4px 7px',
      borderRadius: '999px',
      background: c.primaryLight,
      color: c.primary,
      fontSize: '0.625rem',
      lineHeight: 1,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    } as React.CSSProperties,
    removeButton: {
      border: 'none',
      background: 'transparent',
      color: c.danger,
      fontSize: '1.125rem',
      lineHeight: 1,
      cursor: 'pointer',
      padding: '0 2px',
    } as React.CSSProperties,
    fieldRow: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 2fr) auto minmax(0, 1fr) auto',
      gap: '10px',
      alignItems: 'center',
    } as React.CSSProperties,
    ruleList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      marginBottom: '12px',
    } as React.CSSProperties,
    ruleRow: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 2fr) auto minmax(0, 1fr) auto',
      gap: '10px',
      alignItems: 'center',
      padding: '10px 12px',
      borderRadius: '12px',
      border: `1px solid ${c.border}`,
      background: c.bgSecondary,
    } as React.CSSProperties,
    ruleText: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontFamily: OPT_MONO,
      fontSize: '0.75rem',
      color: c.text,
    } as React.CSSProperties,
    ruleTag: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontFamily: OPT_MONO,
      fontSize: '0.75rem',
      color: c.primary,
      fontWeight: 700,
    } as React.CSSProperties,
    divider: {
      height: '1px',
      background: c.border,
      opacity: 0.7,
    } as React.CSSProperties,
    controlStack: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      marginTop: '18px',
    } as React.CSSProperties,
    fieldLabel: {
      fontSize: '0.8125rem',
      lineHeight: '1.4',
      fontWeight: 600,
      color: c.text,
    } as React.CSSProperties,
    depthRow: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '10px',
      marginTop: '18px',
    } as React.CSSProperties,
    exampleBox: {
      marginTop: '14px',
      borderRadius: '14px',
      border: `1px solid ${c.border}`,
      background: c.bgSecondary,
      padding: '14px 16px',
      overflowX: 'auto',
    } as React.CSSProperties,
    examplePre: {
      margin: 0,
      fontFamily: OPT_MONO,
      fontSize: '0.75rem',
      lineHeight: '1.7',
      color: c.text,
      whiteSpace: 'pre',
    } as React.CSSProperties,
    exampleLine: {
      borderRadius: '6px',
      padding: '0 6px',
      margin: '0 -6px',
    } as React.CSSProperties,
    exampleLineActive: {
      borderRadius: '6px',
      padding: '0 6px',
      margin: '0 -6px',
      background: 'rgba(99, 132, 255, 0.22)',
      boxShadow: 'inset 2px 0 0 rgba(99, 132, 255, 0.7)',
    } as React.CSSProperties,
    exampleLineFallback: {
      borderRadius: '6px',
      padding: '0 6px',
      margin: '0 -6px',
      background: 'rgba(234, 179, 8, 0.16)',
      boxShadow: 'inset 2px 0 0 rgba(234, 179, 8, 0.7)',
    } as React.CSSProperties,
    exampleLegend: {
      marginTop: '10px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '14px',
      fontSize: '0.6875rem',
      color: c.textMuted,
    } as React.CSSProperties,
    exampleLegendDot: (color: string): React.CSSProperties => ({
      display: 'inline-block',
      width: '10px',
      height: '10px',
      borderRadius: '3px',
      background: color,
      marginRight: '6px',
      verticalAlign: 'middle',
    }),
  };
}

function darkShadow(c: Colors) {
  return c.bg === darkColors.bg ? '0 10px 32px rgba(0, 0, 0, 0.22)' : '0 10px 28px rgba(15, 23, 42, 0.06)';
}

function ReorderableList({
  items,
  onReorder,
  onRemove,
  onAdd,
  addPlaceholder,
  c,
  s,
}: {
  items: ReorderableItem[];
  onReorder: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onAdd: (value: string) => void;
  addPlaceholder: string;
  c: Colors;
  s: ReturnType<typeof makeStyles>;
}) {
  const [newValue, setNewValue] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    requestAnimationFrame(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = '0.45';
      }
    });
  };

  const handleDragEnd = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '1';
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== null && index !== dragIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndex;
    if (fromIndex !== null && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleAdd = () => {
    const trimmed = newValue.trim();
    if (!trimmed) {
      return;
    }
    onAdd(trimmed);
    setNewValue('');
  };

  return (
    <div>
      <div style={s.list}>
        {items.length === 0 ? (
          <div style={s.emptyBox}>No items configured.</div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={event => handleDragStart(event, index)}
              onDragEnd={handleDragEnd}
              onDragOver={event => handleDragOver(event, index)}
              onDrop={event => handleDrop(event, index)}
              style={s.listRow(dragOverIndex === index)}
            >
              <GripVertical size={15} color={c.textMuted} />
              <span style={{ ...s.monoText, flex: 1, minWidth: 0 }}>{item.label}</span>
              {item.badge ? <span style={s.badge}>{item.badge}</span> : null}
              {item.removable ? (
                <button onClick={() => onRemove(item.id)} style={s.removeButton} title="Remove">
                  &times;
                </button>
              ) : (
                <span style={{ width: '16px' }} />
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
        <input
          value={newValue}
          onChange={event => setNewValue(event.target.value)}
          onKeyDown={event => event.key === 'Enter' && handleAdd()}
          placeholder={addPlaceholder}
          style={s.input}
        />
        <button
          onClick={handleAdd}
          disabled={!newValue.trim()}
          style={s.primaryButton(!!newValue.trim())}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function Switch({
  checked,
  onChange,
  c,
  s,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  c: Colors;
  s: ReturnType<typeof makeStyles>;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={s.switch(checked)}
    >
      <span style={s.switchThumb(checked)} />
      <span style={{ position: 'absolute', inset: 0, borderRadius: '999px', boxShadow: `inset 0 0 0 1px ${checked ? 'transparent' : c.border}` }} />
    </button>
  );
}

function SectionCard({
  title,
  description,
  children,
  s,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <section style={s.card}>
      <h2 style={s.cardTitle}>{title}</h2>
      <p style={s.cardDescription}>{description}</p>
      {children}
    </section>
  );
}

function ToggleSetting({
  title,
  description,
  checked,
  onChange,
  c,
  s,
  id,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  c: Colors;
  s: ReturnType<typeof makeStyles>;
  id?: string;
}) {
  return (
    <div style={s.toggleRow}>
      <div style={s.toggleInfo}>
        <div style={s.toggleLabel}>{title}</div>
        <div style={s.toggleHint}>{description}</div>
      </div>
      <Switch checked={checked} onChange={onChange} c={c} s={s} id={id} />
    </div>
  );
}

function FontScaleSetting({
  value,
  onChange,
  s,
}: {
  value: FontScale;
  onChange: (value: FontScale) => void;
  s: ReturnType<typeof makeStyles>;
}) {
  const options: Array<{ id: FontScale; label: string }> = [
    { id: 'small', label: 'Small' },
    { id: 'medium', label: 'Medium' },
    { id: 'large', label: 'Large' },
  ];
  return (
    <div style={s.toggleRow}>
      <div style={s.toggleInfo}>
        <div style={s.toggleLabel}>Panel Text Size</div>
        <div style={s.toggleHint}>
          Scales all text in the recorder side panel. Try Small on a compact laptop screen, Large on a wide monitor.
        </div>
      </div>
      <div style={s.segmented} role="radiogroup" aria-label="Panel text size">
        {options.map(option => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            onClick={() => onChange(option.id)}
            style={s.segmentButton(value === option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HierarchyModeControl({
  label,
  value,
  onChange,
  description,
  fallbackToZero = false,
  c,
  s,
}: {
  label: string;
  value: HierarchyOption;
  onChange: (value: HierarchyOption) => void;
  description: string;
  fallbackToZero?: boolean;
  c: Colors;
  s: ReturnType<typeof makeStyles>;
}) {
  const highlightTokens = HIERARCHY_HIGHLIGHT[value];
  const showFallback = fallbackToZero && value !== '0';
  return (
    <div style={s.depthRow}>
      <div style={s.fieldLabel}>{label}</div>
      <div style={s.helperText}>{description}</div>
      <select
        value={value}
        onChange={event => onChange(event.target.value as HierarchyOption)}
        style={s.select}
      >
        {HIERARCHY_OPTIONS.map(option => (
          <option key={option} value={option}>
            {HIERARCHY_LABELS[option]}
          </option>
        ))}
      </select>
      <div style={{ ...s.helperText, color: c.textMuted }}>
        {HIERARCHY_HINTS[value]}
      </div>
      <div style={s.exampleBox}>
        <pre style={s.examplePre}>
          {HIERARCHY_EXAMPLE_LINES.map((line, index) => {
            const active = line.token !== undefined && highlightTokens.includes(line.token);
            const fallback = showFallback && line.token === '0';
            const lineStyle = active
              ? s.exampleLineActive
              : fallback
                ? s.exampleLineFallback
                : s.exampleLine;
            return (
              <div key={index} style={lineStyle}>
                {line.text}
              </div>
            );
          })}
        </pre>
      </div>
      {showFallback && (
        <div style={s.exampleLegend}>
          <span>
            <span style={s.exampleLegendDot('rgba(99, 132, 255, 0.7)')} />
            Selected level
          </span>
          <span>
            <span style={s.exampleLegendDot('rgba(234, 179, 8, 0.7)')} />
            Level 0 fallback (used only when the selected level finds nothing)
          </span>
        </div>
      )}
    </div>
  );
}

/** Rules run querySelector/closest on every captured step; an invalid one would throw there. */
function isValidSelector(selector: string): boolean {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

function OptionsPage() {
  const [settings, setSettings] = useState<RecorderSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [promptText, setPromptText] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('development');
  const [newRuleLocator, setNewRuleLocator] = useState('');
  const [newRuleTag, setNewRuleTag] = useState('');
  const [newCompAncestor, setNewCompAncestor] = useState('');
  const [newCompTag, setNewCompTag] = useState('');

  useEffect(() => {
    loadSettings().then(setSettings);
    loadPromptTemplate().then(setPromptText);
  }, []);

  const dark = !!settings.darkMode;
  const c = dark ? darkColors : lightColors;
  const s = makeStyles(c);

  useEffect(() => {
    document.body.style.background = c.bg;
    document.body.style.margin = '0';
  }, [c.bg]);

  // Root font-size drives every rem-based text size on this page, mirroring the recorder panel.
  useEffect(() => {
    document.documentElement.style.fontSize = `${FONT_SCALE_PX[settings.fontScale]}px`;
  }, [settings.fontScale]);

  const save = (updated: RecorderSettings) => {
    setSettings(updated);
    saveSettings(updated)
      .then(() => {
        setErrorMessage('');
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1500);
      })
      // e.g. chrome.storage.sync's 8 KB per-item limit — say so instead of "saved"
      .catch(error => setErrorMessage(`Settings not saved: ${error instanceof Error ? error.message : String(error)}`));
  };

  const handleSavePrompt = useCallback(async () => {
    await savePromptTemplate(promptText);
    setErrorMessage('');
    setPromptSaved(true);
    window.setTimeout(() => setPromptSaved(false), 1500);
  }, [promptText]);

  const handleResetPrompt = useCallback(async () => {
    const url = chrome.runtime.getURL('prompt.txt');
    const res = await fetch(url);
    if (res.ok) {
      setPromptText(await res.text());
    }
  }, []);

  const handleAnchorReorder = (from: number, to: number) => {
    const next = [...settings.descriptionAnchors];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    save({ ...settings, descriptionAnchors: next });
  };

  const handleAnchorRemove = (attr: string) => {
    save({
      ...settings,
      descriptionAnchors: settings.descriptionAnchors.filter(anchor => anchor.attr !== attr),
    });
  };

  const handleAnchorAdd = (value: string) => {
    const attr = value.trim().toLowerCase();
    if (!attr || settings.descriptionAnchors.some(anchor => anchor.attr === attr)) {
      return;
    }
    save({
      ...settings,
      descriptionAnchors: [...settings.descriptionAnchors, { attr, builtin: false }],
    });
  };

  const handleLocatorReorder = (from: number, to: number) => {
    const next = [...settings.locatorAttributes];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    save({ ...settings, locatorAttributes: next });
  };

  const handleLocatorRemove = (attr: string) => {
    if (settings.locatorAttributes.length <= 1) {
      return;
    }
    save({
      ...settings,
      locatorAttributes: settings.locatorAttributes.filter(locator => locator.attr !== attr),
    });
  };

  const handleLocatorAdd = (value: string) => {
    const attr = value.trim().toLowerCase();
    if (!attr || settings.locatorAttributes.some(locator => locator.attr === attr)) {
      return;
    }
    save({
      ...settings,
      locatorAttributes: [
        ...settings.locatorAttributes,
        { attr, isWildcard: attr.endsWith('*'), builtin: false },
      ],
    });
  };

  const handleRestoreLocatorDefaults = () => {
    save({
      ...settings,
      locatorAttributes: cloneLocatorAttributes(),
    });
  };

  const handleRuleAdd = () => {
    const locator = newRuleLocator.trim();
    const tag = newRuleTag.trim();
    if (!locator || !tag) {
      return;
    }
    if (!isValidSelector(locator)) {
      setErrorMessage(`"${locator}" is not a valid CSS selector`);
      return;
    }
    save({
      ...settings,
      pageRecognitionRules: [...(settings.pageRecognitionRules ?? []), { locator, tag }],
    });
    setNewRuleLocator('');
    setNewRuleTag('');
  };

  const handleRuleRemove = (index: number) => {
    save({
      ...settings,
      pageRecognitionRules: (settings.pageRecognitionRules ?? []).filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const handleCompRuleAdd = () => {
    const ancestor = newCompAncestor.trim();
    const tag = newCompTag.trim();
    if (!ancestor || !tag) {
      return;
    }
    if (!isValidSelector(ancestor)) {
      setErrorMessage(`"${ancestor}" is not a valid CSS selector`);
      return;
    }
    save({
      ...settings,
      componentRecognitionRules: [...(settings.componentRecognitionRules ?? []), { ancestor, tag }],
    });
    setNewCompAncestor('');
    setNewCompTag('');
  };

  const handleCompRuleRemove = (index: number) => {
    save({
      ...settings,
      componentRecognitionRules: (settings.componentRecognitionRules ?? []).filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const anchorItems: ReorderableItem[] = settings.descriptionAnchors.map(anchor => ({
    id: anchor.attr,
    label: anchor.attr,
    removable: !anchor.builtin,
  }));

  const locatorItems: ReorderableItem[] = settings.locatorAttributes.map(locator => ({
    id: locator.attr,
    label: locator.attr,
    removable: settings.locatorAttributes.length > 1,
    badge: locator.isWildcard ? 'wildcard' : undefined,
  }));

  const sectionMeta: Record<SectionId, { title: string; description: string; category: string }> = {
    appearance: {
      title: 'Appearance',
      description: 'Control the visual theme used by the recorder panel and this settings page.',
      category: 'General',
    },
    development: {
      title: 'Development',
      description: 'Turn on diagnostics and internal recorder tooling while you build or troubleshoot flows.',
      category: 'General',
    },
    'prompt-template': {
      title: 'AI Prompt Template',
      description: 'Edit the export prompt used when turning recorded cases into AI-ready instructions.',
      category: 'General',
    },
    'description-anchors': {
      title: 'Description Anchors',
      description: 'Define the ordered attributes used to derive readable step titles from the DOM.',
      category: 'Advanced',
    },
    'locator-attributes': {
      title: 'Locator Attributes',
      description: 'Configure the selector attribute priority used to generate stable CSS locators.',
      category: 'Advanced',
    },
    'page-recognition': {
      title: 'Page Recognition',
      description: 'Map page-level selectors to tags so recorded pages can be classified automatically.',
      category: 'Advanced',
    },
    'component-recognition': {
      title: 'Component Recognition',
      description: 'Tag recorded steps when the target sits inside a known shared component.',
      category: 'Advanced',
    },
  };

  const currentSection = sectionMeta[activeSection];
  const statusMessage = errorMessage || (promptSaved ? 'Prompt template saved' : saved ? 'Settings saved' : '');

  const renderSection = () => {
    switch (activeSection) {
      case 'appearance':
        return (
          <SectionCard
            title="Appearance"
            description="Keep the settings surface aligned with the panel. Theme changes apply immediately."
            s={s}
          >
            <div style={s.sectionStack}>
              <ToggleSetting
                id="dark-mode"
                title="Dark Theme"
                description="Use a darker color scheme for the recorder panel and this options page."
                checked={dark}
                onChange={value => save({ ...settings, darkMode: value })}
                c={c}
                s={s}
              />
              <div style={s.divider} />
              <FontScaleSetting
                value={settings.fontScale}
                onChange={value => save({ ...settings, fontScale: value })}
                s={s}
              />
            </div>
          </SectionCard>
        );

      case 'development':
        return (
          <SectionCard
            title="Development"
            description="Surface debugging signals and experimental recorder controls when you need to inspect behavior."
            s={s}
          >
            <div style={s.sectionStack}>
              <ToggleSetting
                id="debug-mode"
                title="Debug Mode"
                description="Print selector generation and recording details to the browser console while capturing steps."
                checked={!!settings.debugMode}
                onChange={value => save({ ...settings, debugMode: value })}
                c={c}
                s={s}
              />
            </div>
          </SectionCard>
        );

      case 'prompt-template':
        return (
          <SectionCard
            title="AI Prompt Template"
            description="These placeholders are required. The exporter replaces them with the generated plain-text case and JSON payload."
            s={s}
          >
            <div style={{ ...s.helperText, marginTop: '18px' }}>
              Leave <code style={s.inlineCode}>%PLAIN_TEXT%</code> and <code style={s.inlineCode}>%JSON%</code> in the template.
            </div>
            <textarea
              value={promptText}
              onChange={event => setPromptText(event.target.value)}
              rows={16}
              style={{ ...s.textarea, marginTop: '14px' }}
            />
            <div style={s.buttonRow}>
              <button onClick={handleSavePrompt} style={s.primaryButton(true)}>
                {promptSaved ? 'Saved' : 'Save Prompt'}
              </button>
              <button onClick={handleResetPrompt} style={s.secondaryButton}>
                Reset to Default
              </button>
            </div>
          </SectionCard>
        );

      case 'description-anchors':
        return (
          <SectionCard
            title="Description Anchors"
            description="The recorder checks these attributes in order. The first non-empty match on the element becomes the default step title; texts from all hierarchy levels are also scraped so the description can be changed per step from the dropdown."
            s={s}
          >
            <div style={{ marginTop: '18px' }}>
              <ReorderableList
                items={anchorItems}
                onReorder={handleAnchorReorder}
                onRemove={handleAnchorRemove}
                onAdd={handleAnchorAdd}
                addPlaceholder="e.g. data-label, alt"
                c={c}
                s={s}
              />
            </div>
          </SectionCard>
        );

      case 'locator-attributes':
        return (
          <SectionCard
            title="Locator Attributes"
            description="Higher items have higher selector priority. You can remove any attribute, but at least one must remain. Wildcards such as data-* match any attribute with the same prefix."
            s={s}
          >
            <div style={{ marginTop: '18px' }}>
              <ReorderableList
                items={locatorItems}
                onReorder={handleLocatorReorder}
                onRemove={handleLocatorRemove}
                onAdd={handleLocatorAdd}
                addPlaceholder="e.g. data-field, data-*"
                c={c}
                s={s}
              />
              <div style={{ ...s.helperText, marginTop: '12px' }}>
                The recorder exports this ordered list so the LLM can prefer the same attributes when building a stable locator.
              </div>
              <HierarchyModeControl
                label="Relationship Hierarchy"
                value={settings.locatorHierarchy}
                onChange={value => save({ ...settings, locatorHierarchy: value })}
                description="Choose which relative DOM level can be used when self attributes are not enough and the recorder must build a relationship-based selector."
                c={c}
                s={s}
              />
              <div style={s.buttonRow}>
                <button onClick={handleRestoreLocatorDefaults} style={s.secondaryButton}>
                  Restore Defaults
                </button>
              </div>
            </div>
          </SectionCard>
        );

      case 'page-recognition':
        return (
          <SectionCard
            title="Page Recognition"
            description="When a new page is created, the first matching locator tags that page. Use this to distinguish UI variants or routed contexts."
            s={s}
          >
            <div style={{ marginTop: '18px' }}>
              <div style={s.ruleList}>
                {(settings.pageRecognitionRules ?? []).length === 0 ? (
                  <div style={s.emptyBox}>No rules configured.</div>
                ) : (
                  (settings.pageRecognitionRules ?? []).map((rule: PageRecognitionRule, index: number) => (
                    <div key={`${rule.locator}-${rule.tag}-${index}`} style={s.ruleRow}>
                      <span style={s.ruleText} title={rule.locator}>
                        {rule.locator}
                      </span>
                      <span style={{ color: c.textMuted }}>→</span>
                      <span style={s.ruleTag} title={rule.tag}>
                        {rule.tag}
                      </span>
                      <button onClick={() => handleRuleRemove(index)} style={s.removeButton} title="Remove">
                        &times;
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div style={s.fieldRow}>
                <input
                  value={newRuleLocator}
                  onChange={event => setNewRuleLocator(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && handleRuleAdd()}
                  placeholder="CSS locator, e.g. [data-theme='new']"
                  style={s.input}
                />
                <span style={{ color: c.textMuted }}>→</span>
                <input
                  value={newRuleTag}
                  onChange={event => setNewRuleTag(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && handleRuleAdd()}
                  placeholder="Tag, e.g. new-design"
                  style={s.input}
                />
                <button
                  onClick={handleRuleAdd}
                  disabled={!newRuleLocator.trim() || !newRuleTag.trim()}
                  style={s.primaryButton(!!(newRuleLocator.trim() && newRuleTag.trim()))}
                >
                  Add
                </button>
              </div>
            </div>
          </SectionCard>
        );

      case 'component-recognition':
        return (
          <SectionCard
            title="Component Recognition"
            description="When a recorded element is inside a matching ancestor selector, the recorder applies the configured tag to the step."
            s={s}
          >
            <div style={{ marginTop: '18px' }}>
              <div style={s.ruleList}>
                {(settings.componentRecognitionRules ?? []).length === 0 ? (
                  <div style={s.emptyBox}>No rules configured.</div>
                ) : (
                  (settings.componentRecognitionRules ?? []).map((rule: ComponentRecognitionRule, index: number) => (
                    <div key={`${rule.ancestor}-${rule.tag}-${index}`} style={s.ruleRow}>
                      <span style={s.ruleText} title={rule.ancestor}>
                        {rule.ancestor}
                      </span>
                      <span style={{ color: c.textMuted }}>→</span>
                      <span style={s.ruleTag} title={rule.tag}>
                        {rule.tag}
                      </span>
                      <button onClick={() => handleCompRuleRemove(index)} style={s.removeButton} title="Remove">
                        &times;
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div style={s.fieldRow}>
                <input
                  value={newCompAncestor}
                  onChange={event => setNewCompAncestor(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && handleCompRuleAdd()}
                  placeholder="Ancestor selector, e.g. header, #main-nav"
                  style={s.input}
                />
                <span style={{ color: c.textMuted }}>→</span>
                <input
                  value={newCompTag}
                  onChange={event => setNewCompTag(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && handleCompRuleAdd()}
                  placeholder="Tag, e.g. header"
                  style={s.input}
                />
                <button
                  onClick={handleCompRuleAdd}
                  disabled={!newCompAncestor.trim() || !newCompTag.trim()}
                  style={s.primaryButton(!!(newCompAncestor.trim() && newCompTag.trim()))}
                >
                  Add
                </button>
              </div>
            </div>
          </SectionCard>
        );

    }
  };

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '1rem', lineHeight: '1.3', fontWeight: 700, color: c.text }}>Settings</h1>
          </div>
        </div>

        <nav style={s.nav} aria-label="Settings sections">
          {NAV_SECTIONS.map(section => (
            <div key={section.id} style={s.navGroup}>
              <div style={s.navGroupButton}>
                <ChevronDown size={14} />
                {section.label}
              </div>
              <div style={s.navItems}>
                {section.items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    style={s.navItem(activeSection === item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main style={s.main}>
        <div style={s.content}>
          <div style={s.eyebrow}>{currentSection.category}</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={s.pageTitle}>{currentSection.title}</h1>
              <p style={s.pageDescription}>{currentSection.description}</p>
            </div>
            {statusMessage ? <div style={s.statusPill}>{statusMessage}</div> : null}
          </div>

          {renderSection()}
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<OptionsPage />);
