import type { DescriptionAnchor, HierarchyOption, LocatorAttr } from '../types';
import {
  DEFAULT_DESCRIPTION_HIERARCHY,
  DEFAULT_LOCATOR_HIERARCHY,
  legacyHighToHierarchy,
  normalizeHierarchyOption,
} from './hierarchy';

/** A rule that tags a page if the given CSS locator is found on the page */
export interface PageRecognitionRule {
  locator: string; // CSS selector to check for presence on the page
  tag: string;     // Tag label to apply to the page if the locator matches
}

/** A rule that tags a step if the interacted element is a descendant of the given CSS ancestor selector */
export interface ComponentRecognitionRule {
  ancestor: string; // CSS selector for the component root (e.g. "header", "#main-nav")
  tag: string;      // Tag label to apply to the step if the element is inside this component
}

export const DEFAULT_DESCRIPTION_ANCHORS: DescriptionAnchor[] = [
  { attr: 'innerText', builtin: true },
  { attr: 'textContent', builtin: true },
  { attr: 'aria-label', builtin: true },
  { attr: 'placeholder', builtin: true },
  { attr: 'value', builtin: true },
  { attr: 'title', builtin: true },
];

export const DEFAULT_LOCATOR_ATTRIBUTES: LocatorAttr[] = [
  { attr: 'data-testid', isWildcard: false, builtin: true },
  { attr: 'data-test-id', isWildcard: false, builtin: true },
  { attr: 'data-test', isWildcard: false, builtin: true },
  { attr: 'data-cy', isWildcard: false, builtin: true },
  { attr: 'data-qa', isWildcard: false, builtin: true },
  { attr: 'id', isWildcard: false, builtin: true },
  { attr: 'name', isWildcard: false, builtin: true },
  { attr: 'aria-label', isWildcard: false, builtin: true },
  { attr: 'placeholder', isWildcard: false, builtin: true },
  { attr: 'title', isWildcard: false, builtin: true },
  { attr: 'value', isWildcard: false, builtin: true },
  { attr: 'class', isWildcard: false, builtin: true },
  { attr: 'href', isWildcard: false, builtin: true },
];

export function cloneLocatorAttributes(attrs: LocatorAttr[] = DEFAULT_LOCATOR_ATTRIBUTES): LocatorAttr[] {
  return attrs.map(attr => ({ ...attr }));
}

function normalizeLocatorAttributes(attrs: unknown): LocatorAttr[] {
  if (!Array.isArray(attrs)) {
    return cloneLocatorAttributes();
  }

  const seen = new Set<string>();
  const normalized = attrs.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const rawAttr = typeof (entry as { attr?: unknown }).attr === 'string'
      ? (entry as { attr: string }).attr.trim().toLowerCase()
      : '';
    if (!rawAttr || seen.has(rawAttr)) {
      return [];
    }

    seen.add(rawAttr);
    return [{
      attr: rawAttr,
      isWildcard: rawAttr.endsWith('*'),
      builtin: Boolean((entry as { builtin?: unknown }).builtin),
    }];
  });

  return normalized.length > 0 ? normalized : cloneLocatorAttributes();
}

/** Panel text-size preference — lets users on a wide monitor size up, or on a small laptop size down. */
export type FontScale = 'small' | 'medium' | 'large';

/** Root font-size (px) each scale maps to; the panel's rem-based text sizes cascade from this. */
export const FONT_SCALE_PX: Record<FontScale, number> = {
  small: 14,
  medium: 16,
  large: 18,
};

function normalizeFontScale(value: unknown): FontScale {
  return value === 'small' || value === 'medium' || value === 'large' ? value : 'medium';
}

export interface RecorderSettings {
  customAttributes: string[];
  debugMode?: boolean;
  darkMode?: boolean;
  fontScale: FontScale;
  descriptionHierarchy: HierarchyOption;
  locatorHierarchy: HierarchyOption;
  descriptionAnchors: DescriptionAnchor[];
  locatorAttributes: LocatorAttr[];
  pageRecognitionRules: PageRecognitionRule[];
  componentRecognitionRules: ComponentRecognitionRule[];
}

export const DEFAULT_SETTINGS: RecorderSettings = {
  customAttributes: [],
  debugMode: false,
  darkMode: false,
  fontScale: 'medium',
  descriptionHierarchy: DEFAULT_DESCRIPTION_HIERARCHY,
  locatorHierarchy: DEFAULT_LOCATOR_HIERARCHY,
  descriptionAnchors: DEFAULT_DESCRIPTION_ANCHORS,
  locatorAttributes: DEFAULT_LOCATOR_ATTRIBUTES,
  pageRecognitionRules: [],
  componentRecognitionRules: [],
};

const STORAGE_KEY = 'recorderSettings';

export async function loadSettings(): Promise<RecorderSettings> {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    if (result[STORAGE_KEY]) {
      const rawSaved = result[STORAGE_KEY] as Partial<RecorderSettings> & { high?: unknown };
      const saved: RecorderSettings = {
        ...DEFAULT_SETTINGS,
        ...rawSaved,
        descriptionHierarchy: normalizeHierarchyOption(
          rawSaved.descriptionHierarchy,
          DEFAULT_DESCRIPTION_HIERARCHY
        ),
        locatorHierarchy: normalizeHierarchyOption(
          rawSaved.locatorHierarchy,
          legacyHighToHierarchy(rawSaved.high)
        ),
        descriptionAnchors: rawSaved.descriptionAnchors ?? DEFAULT_DESCRIPTION_ANCHORS,
        locatorAttributes: normalizeLocatorAttributes(rawSaved.locatorAttributes),
        fontScale: normalizeFontScale(rawSaved.fontScale),
      };
      // Migration: if legacy customAttributes exist and locatorAttributes were never stored,
      // prepend them once to the default locator list.
      if (
        saved.customAttributes.length > 0 &&
        (!Array.isArray(rawSaved.locatorAttributes) || rawSaved.locatorAttributes.length === 0)
      ) {
        const customLocators: LocatorAttr[] = saved.customAttributes
          .filter((attr: string) => !saved.locatorAttributes.some((la: LocatorAttr) => la.attr === attr))
          .map((attr: string) => ({ attr, isWildcard: attr.endsWith('*'), builtin: false }));
        if (customLocators.length > 0) {
          saved.locatorAttributes = [...customLocators, ...saved.locatorAttributes];
        }
      }
      return saved;
    }
  } catch { /* ignore */ }
  return {
    ...DEFAULT_SETTINGS,
    descriptionAnchors: [...DEFAULT_DESCRIPTION_ANCHORS],
    locatorAttributes: cloneLocatorAttributes(),
  };
}

export async function saveSettings(settings: RecorderSettings): Promise<void> {
  await chrome.storage.sync.set({
    [STORAGE_KEY]: {
      ...settings,
      locatorAttributes: normalizeLocatorAttributes(settings.locatorAttributes),
    },
  });
}

const PROMPT_KEY = 'promptTemplate';
const SUPPORTED_PROMPT_PLACEHOLDERS = new Set(['%PLAIN_TEXT%', '%JSON%']);

function sanitizePromptTemplate(template: string): string {
  return template.replace(/%[A-Z_]+%/g, token => (SUPPORTED_PROMPT_PLACEHOLDERS.has(token) ? token : ''));
}

export async function loadPromptTemplate(): Promise<string> {
  try {
    const result = await chrome.storage.local.get(PROMPT_KEY);
    if (result[PROMPT_KEY]) return sanitizePromptTemplate(result[PROMPT_KEY] as string);
  } catch { /* ignore */ }
  // Fall back to bundled file
  try {
    const url = chrome.runtime.getURL('prompt.txt');
    const res = await fetch(url);
    if (res.ok) return sanitizePromptTemplate(await res.text());
  } catch { /* ignore */ }
  return '';
}

export async function savePromptTemplate(text: string): Promise<void> {
  await chrome.storage.local.set({ [PROMPT_KEY]: sanitizePromptTemplate(text) });
}
