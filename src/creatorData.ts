import type { CreatorRow } from './types';
import { normalizeText, normalizeVideoProgress } from './sopRules';

export const CREATOR_ROWS_STORAGE_KEY = 'tiktok-creator-sop-tool.creatorRows.v1';

export const CREATOR_TEMPLATE_COLUMNS: Array<{ header: string; key: keyof CreatorRow }> = [
  { header: '达人账号', key: 'username' },
  { header: '主页链接', key: 'profileLink' },
  { header: '联系渠道', key: 'contactMethod' },
  { header: '产品', key: 'product' },
  { header: '合作状态', key: 'currentStatus' },
  { header: '物流状态', key: 'sampleShippingStatus' },
  { header: '样品到货日期', key: 'sampleDeliveredDate' },
  { header: '视频进度', key: 'videoProgress' },
  { header: '首条视频发布日期', key: 'firstVideoPostedDate' },
  { header: '最近联系日期', key: 'lastContactDate' },
  { header: '跟进次数', key: 'lastFollowUpCount' },
  { header: '跟进状态', key: 'trackingStatus' },
  { header: '最近沟通动作', key: 'lastMessageScenario' },
  { header: '最近沟通渠道', key: 'lastMessageChannel' },
  { header: '下次跟进日期', key: 'nextFollowUpDate' },
  { header: '达人回复/下一步备注', key: 'lastCreatorResponse' },
  { header: '跟进记录', key: 'followUpHistory' },
  { header: '备注', key: 'notes' },
];

export type EditableCreatorField =
  | 'username'
  | 'profileLink'
  | 'contactMethod'
  | 'product'
  | 'currentStatus'
  | 'sampleShippingStatus'
  | 'sampleDeliveredDate'
  | 'videoProgress'
  | 'firstVideoPostedDate'
  | 'lastContactDate'
  | 'lastFollowUpCount'
  | 'notes'
  | 'trackingStatus'
  | 'lastMessageScenario'
  | 'lastMessageChannel'
  | 'lastMessageSentAt'
  | 'nextFollowUpDate'
  | 'lastCreatorResponse';

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function normalizeFollowUpHistory(row: CreatorRow): CreatorRow['followUpHistory'] {
  if (!Array.isArray(row.followUpHistory)) return [];

  return row.followUpHistory.filter((entry) => (
    entry
    && typeof entry.date === 'string'
    && typeof entry.action === 'string'
  ));
}

function toStoredRow(row: CreatorRow): CreatorRow {
  return {
    ...row,
    lastFollowUpCount: Number.isFinite(Number(row.lastFollowUpCount)) ? Number(row.lastFollowUpCount) : 0,
    followUpHistory: normalizeFollowUpHistory(row),
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
    return parsed.map((item) => toStoredRow(item as CreatorRow)).filter((row) => normalizeText(row.id));
  } catch {
    storage.removeItem(CREATOR_ROWS_STORAGE_KEY);
    return [];
  }
}

export function createBlankCreatorRow(productName = '', requiredVideos = 2): CreatorRow {
  const safeRequiredVideos = Number.isFinite(requiredVideos) && requiredVideos > 0 ? Math.floor(requiredVideos) : 2;

  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username: '',
    profileLink: '',
    contactMethod: '',
    product: productName.trim(),
    currentStatus: 'To Contact',
    sampleShippingStatus: 'Not Shipped',
    sampleDeliveredDate: '',
    videoProgress: `0 of ${safeRequiredVideos}`,
    firstVideoPostedDate: '',
    lastContactDate: '',
    lastFollowUpCount: 0,
    notes: '',
    trackingStatus: '',
    lastMessageScenario: '',
    lastMessageChannel: '',
    lastMessageSentAt: '',
    nextFollowUpDate: '',
    lastCreatorResponse: '',
  };
}

export function deleteCreatorRow(rows: CreatorRow[], rowId: string): CreatorRow[] {
  return rows.filter((row) => row.id !== rowId);
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

function exportValue(row: CreatorRow, key: keyof CreatorRow): unknown {
  if (key === 'followUpHistory') {
    const count = row.followUpHistory?.length ?? 0;
    return count === 0 ? '暂无记录' : `${count} 条记录`;
  }

  return row[key];
}

function escapeCsvValue(value: unknown): string {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function creatorRowsToCsv(rows: CreatorRow[]): string {
  const header = CREATOR_TEMPLATE_COLUMNS.map((column) => escapeCsvValue(column.header)).join(',');
  const body = rows.map((row) => (
    CREATOR_TEMPLATE_COLUMNS.map((column) => escapeCsvValue(exportValue(row, column.key))).join(',')
  ));

  return `\ufeff${[header, ...body].join('\n')}`;
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
