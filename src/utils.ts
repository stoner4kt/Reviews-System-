import type { LeadStatus, LeadSource } from './types';

export const BRAND_NAME = 'ReviewFlow';
export const AGENCY_NAME = 'Conextsol';
// The footer line is locked across the entire product — not configurable.
export const POWERED_BY = `Powered by ${BRAND_NAME} · ${AGENCY_NAME}`;

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  in_progress: 'In Progress',
  complete: 'Complete',
  review_sent: 'Review Sent',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'slate',
  in_progress: 'cyan',
  complete: 'emerald',
  review_sent: 'amber',
  cancelled: 'rose',
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  widget: 'Widget',
  capture_fn: 'Capture',
  manual: 'Manual',
};

export function timeAgo(dateIso?: string): string {
  if (!dateIso) return '';
  const seconds = Math.floor((Date.now() - new Date(dateIso).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(dateIso).toLocaleString();
}

export function formatLocal(dateIso?: string): string {
  if (!dateIso) return '—';
  return new Date(dateIso).toLocaleString();
}

export function formatDelay(hours: number): string {
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  return `${hours} hours`;
}

export function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function callEdgeFunction<T, B = Record<string, unknown>>(
  functionName: string,
  method: 'GET' | 'POST' = 'POST',
  body?: B,
  sessionToken?: string,
): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is not configured');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (body) headers['x-internal-call'] = 'true';
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

  return fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error((json as { error?: string }).error || `Request failed (${res.status})`);
    return json;
  });
}