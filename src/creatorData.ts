import type { CreatorRow } from './types';
import { normalizeText, normalizeVideoProgress } from './sopRules';

export const CREATOR_ROWS_STORAGE_KEY = 'tiktok-creator-sop-tool.creatorRows.v1';

export const CREATOR_TEMPLATE_COLUMNS: Array<{ header: string; key: keyof CreatorRow }> = [
  { header: '达人账号', key: 'username' },
  { header: '主页链接', key: 'profileLink' },
  { header: '联系渠道', key: 'contactMethod' },
  { header: '产品', key: 'product' },
  { header: '合作状态', key: 'currentStatus' },
  { header: '样品物流状态', key: 'sampleShippingStatus' },
  { header: '样品到货日期', key: 'sampleDeliveredDate' },
  { header: '视频进度', key: 'videoProgress' },
  { header: '首条视频发布日期', key: 'firstVideoPostedDate' },
  { header: '最近联系日期', key: 'lastContactDate' },
  { header: '跟进次数', key: 'lastFollowUpCount' },
  { header: '跟进状态', key: 'trackingStatus' },
  { header: '最近沟通动作', key: 'lastMessageScenario' },
  { header: '最近沟通渠道', key: 'lastMessageChannel' },
  { header: '下次跟进日期', key: 'nextFollowUpDate' },
  { header: '达人回复', key: 'lastCreatorResponse' },
  { header: '达人备注', key: 'notes' },
];


export type DuplicateCheckResult = {
  duplicateCreator: boolean;
  possibleDuplicate: boolean;
  multiSample: boolean;
  matchingRows: CreatorRow[];
  sameProductRows: CreatorRow[];
  differentProductRows: CreatorRow[];
};

export type ImportDuplicateSummary = {
  possibleDuplicateCount: number;
  multiSampleCount: number;
  duplicateCreatorCount: number;
};

const EXTRA_EXPORT_COLUMNS = [
  { header: '是否同达人多样品', key: 'isMultiSample' },
  { header: '同达人样品数量', key: 'multiSampleCount' },
] as const;

function normalizeCreatorAccount(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, '')
    .replace(/[/?#].*$/, '')
    .trim();
}

function normalizeProfileLink(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\/$/, '')
    .trim();
}

function normalizeProductKey(value: string): string {
  return normalizeText(value).toLowerCase();
}

export function creatorIdentityKeys(row: Pick<CreatorRow, 'username' | 'profileLink'>): string[] {
  return [
    normalizeCreatorAccount(row.username),
    normalizeCreatorAccount(row.profileLink),
    normalizeProfileLink(row.profileLink),
  ].filter(Boolean);
}

export function isSameCreator(a: Pick<CreatorRow, 'username' | 'profileLink'>, b: Pick<CreatorRow, 'username' | 'profileLink'>): boolean {
  const aKeys = new Set(creatorIdentityKeys(a));
  return creatorIdentityKeys(b).some((key) => aKeys.has(key));
}

export function getDuplicateCheck(row: CreatorRow, rows: CreatorRow[]): DuplicateCheckResult {
  const matchingRows = rows.filter((candidate) => candidate.id !== row.id && isSameCreator(row, candidate));
  const productKey = normalizeProductKey(row.product);
  const sameProductRows = matchingRows.filter((candidate) => normalizeProductKey(candidate.product) === productKey && productKey);
  const differentProductRows = matchingRows.filter((candidate) => normalizeProductKey(candidate.product) !== productKey || !productKey);

  return {
    duplicateCreator: matchingRows.length > 0,
    possibleDuplicate: sameProductRows.length > 0,
    multiSample: differentProductRows.length > 0,
    matchingRows,
    sameProductRows,
    differentProductRows,
  };
}

export function countActiveCreatorSamples(row: CreatorRow, rows: CreatorRow[]): number {
  return rows.filter((candidate) => isSameCreator(row, candidate)
    && !/completed|failed|lost|归档|失败|合作完成|已完成/i.test(`${candidate.currentStatus} ${candidate.trackingStatus ?? ''}`)
  ).length;
}

export function buildDuplicateImportSummary(incomingRows: CreatorRow[], existingRows: CreatorRow[] = []): ImportDuplicateSummary {
  const allRows: CreatorRow[] = [...existingRows];
  const seenPossible = new Set<string>();
  const seenMulti = new Set<string>();
  let duplicateCreatorCount = 0;

  incomingRows.forEach((incoming) => {
    const result = getDuplicateCheck(incoming, allRows);
    if (result.duplicateCreator) duplicateCreatorCount += 1;
    if (result.possibleDuplicate) seenPossible.add(incoming.id);
    if (result.multiSample) seenMulti.add(incoming.id);
    allRows.push(incoming);
  });

  return {
    possibleDuplicateCount: seenPossible.size,
    multiSampleCount: seenMulti.size,
    duplicateCreatorCount,
  };
}

export function copyCreatorBaseFields(target: CreatorRow, source: CreatorRow): CreatorRow {
  return {
    ...target,
    username: source.username || target.username,
    profileLink: source.profileLink || target.profileLink,
    contactMethod: source.contactMethod || target.contactMethod,
    notes: source.notes || target.notes,
  };
}

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
  | 'latestVideoPostedDate'
  | 'lastContactDate'
  | 'lastFollowUpCount'
  | 'notes'
  | 'trackingStatus'
  | 'lastMessageScenario'
  | 'lastMessageChannel'
  | 'lastMessageSentAt'
  | 'lastHandledDate'
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

export function createBlankCreatorRow(productName = '', requiredVideos = 1): CreatorRow {
  const safeRequiredVideos = Number.isFinite(requiredVideos) && requiredVideos > 0 ? Math.floor(requiredVideos) : 1;

  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username: '',
    profileLink: '',
    contactMethod: '',
    product: productName.trim(),
    currentStatus: 'To Contact',
    sampleShippingStatus: 'Not Shipped',
    sampleDeliveredDate: '',
    videoProgress: `0/${safeRequiredVideos}`,
    firstVideoPostedDate: '',
    latestVideoPostedDate: '',
    lastContactDate: '',
    lastFollowUpCount: 0,
    notes: '',
    trackingStatus: '',
    lastMessageScenario: '',
    lastMessageChannel: '',
    lastMessageSentAt: '',
    lastHandledDate: '',
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
    const normalized = progressResult.warning && !progressResult.isOverRequired ? rawValue : progressResult.normalized;
    const postedCount = progressResult.postedCount;
    const statusPatch = typeof postedCount !== 'number'
      ? {}
      : postedCount >= requiredVideos
        ? { currentStatus: '合作完成', trackingStatus: '合作完成', nextFollowUpDate: '' }
        : postedCount > 0
          ? { currentStatus: `已发布 ${postedCount} 条 / 待补第 ${postedCount + 1} 条`, trackingStatus: '已发布部分视频' }
          : row.currentStatus.trim()
            ? {}
            : { currentStatus: 'Waiting Video' };
    return {
      ...row,
      ...statusPatch,
      videoProgress: normalized,
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
  const exportColumns = [...CREATOR_TEMPLATE_COLUMNS, ...EXTRA_EXPORT_COLUMNS];
  const header = exportColumns.map((column) => escapeCsvValue(column.header)).join(',');
  const body = rows.map((row) => {
    const activeSampleCount = countActiveCreatorSamples(row, rows);
    return exportColumns.map((column) => {
      if (column.key === 'isMultiSample') return escapeCsvValue(activeSampleCount > 1 ? '是' : '否');
      if (column.key === 'multiSampleCount') return escapeCsvValue(activeSampleCount);
      return escapeCsvValue(exportValue(row, column.key));
    }).join(',');
  });

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
