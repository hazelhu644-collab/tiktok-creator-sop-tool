import type { CreatorRow } from './types';
import { normalizeVideoProgress } from './sopRules';

export const LOCAL_STORAGE_KEY = 'tiktok-creator-sop-tool:creator-rows';
export const EXPORT_FILE_NAME = 'creator-collaboration-data.csv';

export const EXPORT_COLUMNS = [
  'Creator username',
  'Creator profile link',
  'Contact method',
  'Product',
  'Current status',
  'Sample shipping status',
  'Sample delivered date',
  'Video progress',
  'First video posted date',
  'Last contact date',
  'Last follow-up count',
  'Notes',
] as const;

export type EditableField = keyof Pick<
  CreatorRow,
  | 'username'
  | 'product'
  | 'currentStatus'
  | 'sampleShippingStatus'
  | 'sampleDeliveredDate'
  | 'videoProgress'
  | 'firstVideoPostedDate'
  | 'lastContactDate'
  | 'lastFollowUpCount'
  | 'notes'
>;

export function withVideoProgressWarning(row: CreatorRow): CreatorRow {
  const progress = normalizeVideoProgress(row.videoProgress);
  return {
    ...row,
    videoProgressWarning: progress.warning,
  };
}

export function updateCreatorField(row: CreatorRow, field: EditableField, value: string): CreatorRow {
  const updated: CreatorRow = {
    ...row,
    [field]: field === 'lastFollowUpCount' ? parseFollowUpCount(value) : value,
  };

  return field === 'videoProgress' ? withVideoProgressWarning(updated) : updated;
}

export function serializeCreatorRows(rows: CreatorRow[]): string {
  return JSON.stringify(rows);
}

export function deserializeCreatorRows(value: string | null): CreatorRow[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(coerceStoredRow).filter((row) => row.username);
  } catch {
    return [];
  }
}

export function loadCreatorRows(): CreatorRow[] {
  if (typeof window === 'undefined') return [];
  return deserializeCreatorRows(window.localStorage.getItem(LOCAL_STORAGE_KEY));
}

export function saveCreatorRows(rows: CreatorRow[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_STORAGE_KEY, serializeCreatorRows(rows));
}

export function clearSavedCreatorRows(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LOCAL_STORAGE_KEY);
}

export function creatorRowsToCsv(rows: CreatorRow[]): string {
  const lines = [EXPORT_COLUMNS.join(',')];

  rows.forEach((row) => {
    lines.push([
      row.username,
      row.profileLink,
      row.contactMethod,
      row.product,
      row.currentStatus,
      row.sampleShippingStatus,
      row.sampleDeliveredDate,
      row.videoProgress,
      row.firstVideoPostedDate,
      row.lastContactDate,
      String(row.lastFollowUpCount),
      row.notes,
    ].map(escapeCsvCell).join(','));
  });

  return `${lines.join('\n')}\n`;
}

export function downloadCreatorRowsCsv(rows: CreatorRow[]): void {
  const blob = new Blob([creatorRowsToCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = EXPORT_FILE_NAME;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function parseFollowUpCount(value: string): number {
  const parsed = Number.parseInt(value || '0', 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

function coerceStoredRow(value: unknown, index: number): CreatorRow {
  const row = value && typeof value === 'object' ? value as Partial<CreatorRow> : {};
  return withVideoProgressWarning({
    id: String(row.id || `${index}-${row.username || 'creator'}`),
    username: String(row.username || `Creator ${index + 1}`),
    profileLink: String(row.profileLink || ''),
    contactMethod: String(row.contactMethod || ''),
    product: String(row.product || 'Steam Grooming Brush'),
    currentStatus: String(row.currentStatus || ''),
    sampleShippingStatus: String(row.sampleShippingStatus || ''),
    sampleDeliveredDate: String(row.sampleDeliveredDate || ''),
    videoProgress: String(row.videoProgress || '0/2'),
    firstVideoPostedDate: String(row.firstVideoPostedDate || ''),
    lastContactDate: String(row.lastContactDate || ''),
    lastFollowUpCount: typeof row.lastFollowUpCount === 'number' ? row.lastFollowUpCount : parseFollowUpCount(String(row.lastFollowUpCount || '0')),
    notes: String(row.notes || ''),
  });
}
