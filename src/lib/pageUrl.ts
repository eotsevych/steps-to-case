import type { PageContext } from '../types';

const ABSOLUTE_URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

function stripQueryAndHash(value: string): string {
  const [withoutHash] = value.split('#', 1);
  const [withoutQuery] = withoutHash.split('?', 1);
  return withoutQuery || value;
}

export function isAbsoluteUrl(value: string): boolean {
  return ABSOLUTE_URL_SCHEME_RE.test(value);
}

/** "#/users?tab=1" → "#/users" for hash-routed apps (Angular, Vue, old React); "" for plain anchors. */
function hashRoute(hash: string): string {
  return /^#!?\//.test(hash) ? hash.split('?', 1)[0] : '';
}

export function normalizeRecordedPageUrl(rawUrl: string): string {
  if (!rawUrl) return '';

  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname || '/';

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return pathname + hashRoute(parsed.hash);
    }

    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return stripQueryAndHash(rawUrl);
  }
}

export function parseRecordedPageContext(rawUrl: string, title = ''): PageContext {
  if (!rawUrl) {
    return {
      url: '',
      title,
      domain: '',
      pathname: '',
    };
  }

  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname || '/';

    return {
      url: normalizeRecordedPageUrl(rawUrl),
      title,
      domain: parsed.hostname,
      pathname,
      ...(parsed.search ? { query: parsed.search } : {}),
    };
  } catch {
    const normalized = normalizeRecordedPageUrl(rawUrl);
    return {
      url: normalized,
      title,
      domain: '',
      pathname: normalized,
    };
  }
}

// Numeric, UUID or long-hex segments are record IDs, not page names
const ID_SEGMENT_RE = /^(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16,})$/i;

/** Readable page name from a recorded page URL: "/orders/123" → "orders", "/#/settings" → "settings". */
export function pageNameFromUrl(url: string): string {
  const parts = url.split(/[/#!]+/).filter(part => part && !ID_SEGMENT_RE.test(part));
  return parts[parts.length - 1] || 'Home';
}
