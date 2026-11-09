import type { HierarchyOption } from '../types';

export const HIERARCHY_OPTIONS: HierarchyOption[] = ['0', '1', '1+', '2', '2+', '3', '3+'];

export const DEFAULT_DESCRIPTION_HIERARCHY: HierarchyOption = '0';
export const DEFAULT_LOCATOR_HIERARCHY: HierarchyOption = '3+';

export function normalizeHierarchyOption(
  value: unknown,
  fallback: HierarchyOption
): HierarchyOption {
  return typeof value === 'string' && HIERARCHY_OPTIONS.includes(value as HierarchyOption)
    ? value as HierarchyOption
    : fallback;
}

export function legacyHighToHierarchy(value: unknown): HierarchyOption {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LOCATOR_HIERARCHY;
  if (parsed <= 0) return '0';
  if (parsed === 1) return '1+';
  if (parsed === 2) return '2+';
  return '3+';
}
