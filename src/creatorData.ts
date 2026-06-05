import type { CreatorRow } from './types';
import { normalizeText, normalizeVideoProgress } from './sopRules';

export const CREATOR_ROWS_STORAGE_KEY = 'tiktok-creator-sop-tool.creatorRows.v1';

export const CREATOR_TEMPLATE_COLUMNS: Array<{ header: string; key: keyof CreatorRow }> = [
  { header: 'Creator username', key: 'username' },
  { header: 'Creator profile link', key: 'profileLink' },
  { header: 'Contact method', key: 'contactMethod' },
  { header: 'Product', key: 'product' },
  { header: 'Current status', key: 'currentStatus' },
  { header: 'Sample shipping status', key: 'sampleShippingStatus' },
  { header: 'Sample delivered date', key: 'sampleDeliveredDate' },
  { header: 'Video progress', key: 'videoProgress' },
  { header: 'First video posted date', key: 'firstVideoPostedDate' },
  { header: 'Last contact date', key: 'lastContactDate' },
  { header: 'Last follow-up count', key: 'lastFollowUpCount' },
  { header: 'Notes', key: 'notes' },
];

export type EditableCreatorField =
  | 'username'
  | 'product'
  | 'currentStatus'
  | 'sampleShippingStatus'
  | 'sampleDeliveredDate'
  | 'videoProgress'
  | 'firstVideoPostedDate'
  | 'lastContactDate'
  | 'lastFollowUpCount'
  | 'notes';

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function toStoredRow(row: CreatorRow): CreatorRow {
  return {
    ...row,
    lastFollowUpCount: Number.isFinite(Number(row.lastFollowUpCount)) ? Number(row.lastFollowUpCount) : 0,
  };
}

export function loadCreatorRows(): CreatorRow[] {
  const storage = getBrowserStorage();
  if (!storage) return [];

  const saved = storage.getItem(CREATOR_ROWS_STORAGE_KEY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => toStoredRow(item as CreatorRow)).filter((row) => normalizeText(row.username));
  } catch {
    storage.removeItem(CREATOR_ROWS_STORAGE_KEY);
    return [];
  }
}

export function saveCreatorRows(rows: CreatorRow[]): void {
  const storage = getBrowserStorage();
  if (!storage) return;

  if (rows.length === 0) {
    storage.removeItem(CREATOR_ROWS_STORAGE_KEY);
    return;
  }

  storage.setItem(CREATOR_ROWS_STORAGE_KEY, JSON.stringify(rows.map(toStoredRow)));
}

export function clearSavedCreatorRows(): void {
  getBrowserStorage()?.removeItem(CREATOR_ROWS_STORAGE_KEY);
}

export function updateCreatorField(row: CreatorRow, field: EditableCreatorField, rawValue: string, requiredVideos = 2): CreatorRow {
  if (field === 'lastFollowUpCount') {
    const parsed = Number.parseInt(rawValue, 10);
    return { ...row, lastFollowUpCount: Number.isNaN(parsed) ? 0 : Math.max(0, parsed) };
  }

  if (field === 'videoProgress') {
    const progressResult = normalizeVideoProgress(rawValue, requiredVideos);
    return {
      ...row,
      videoProgress: progressResult.warning && !progressResult.isOverRequired ? rawValue : progressResult.normalized,
      videoProgressWarning: progressResult.warning,
    };
  }

  return { ...row, [field]: rawValue };
}

function escapeCsvValue(value: unknown): string {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function creatorRowsToCsv(rows: CreatorRow[]): string {
  const header = CREATOR_TEMPLATE_COLUMNS.map((column) => escapeCsvValue(column.header)).join(',');
  const body = rows.map((row) => (
    CREATOR_TEMPLATE_COLUMNS.map((column) => escapeCsvValue(row[column.key])).join(',')
  ));

  return [header, ...body].join('\n');
}

export function downloadCreatorRowsCsv(rows: CreatorRow[]): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;

  const blob = new Blob([creatorRowsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'creator-collaboration-data.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
