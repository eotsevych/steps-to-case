import type { TriggeredRequest } from '../types';
import { isAbsoluteUrl } from './pageUrl';

const MAX_TRIGGERED_REQUESTS = 3;

function normalizeDomain(domain?: string): string {
  return (domain || '').trim().toLowerCase();
}

/** Host without its first label: "app.x.com" → "x.com"; undefined when that would leave a bare TLD. */
function parentDomain(host: string): string | undefined {
  const parent = host.split('.').slice(1).join('.');
  return parent.includes('.') ? parent : undefined;
}

/**
 * The page's own backend: the same host, a subdomain of it, or a sibling
 * subdomain (api.x.com for a page on app.x.com).
 * shortcut: siblings under a public suffix (a.co.uk / b.co.uk) also match; add a suffix list if that shows up.
 */
function isOwnBackend(host: string, pageHost: string): boolean {
  if (host === pageHost || host.endsWith(`.${pageHost}`)) return true;
  const parent = parentDomain(pageHost);
  return !!parent && parentDomain(host) === parent;
}

// Only API calls describe what a step does; scripts, images and fonts are noise
const API_REQUEST_TYPES = new Set(['fetch', 'xmlhttprequest']);

function normalizeRequestPath(rawUrl: string, pageDomain?: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  // Already shortened by an earlier pass ("/orders" or "api.x.com/orders")
  if (!isAbsoluteUrl(trimmed)) {
    return trimmed;
  }

  try {
    const parsedUrl = new URL(trimmed);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null;
    }

    const normalizedPageDomain = normalizeDomain(pageDomain);
    if (!normalizedPageDomain || !isOwnBackend(normalizeDomain(parsedUrl.hostname), normalizedPageDomain)) {
      return null;
    }

    // Keep the host when it differs from the page's, so api.x.com/orders stays recognizable
    const path = parsedUrl.pathname || '/';
    return normalizeDomain(parsedUrl.hostname) === normalizedPageDomain ? path : `${parsedUrl.hostname}${path}`;
  } catch {
    return null;
  }
}

export function filterAndShortenTriggeredRequests(
  requests: TriggeredRequest[] | undefined,
  pageDomain?: string,
): TriggeredRequest[] {
  if (!requests?.length) {
    return [];
  }

  const normalized: TriggeredRequest[] = [];

  for (const request of requests) {
    // Stored or imported requests may lack a type; keep those
    if (request.type && !API_REQUEST_TYPES.has(request.type)) {
      continue;
    }
    const path = normalizeRequestPath(request.url, pageDomain);
    if (!path) {
      continue;
    }

    normalized.push({
      ...request,
      url: path,
    });

    if (normalized.length >= MAX_TRIGGERED_REQUESTS) {
      break;
    }
  }

  return normalized;
}
