import type { CreatorFilmingRequirements, CreatorRow } from './types';
import { normalizeText, normalizeVideoProgress } from './sopRules';

export const CREATOR_ROWS_STORAGE_KEY = 'tiktok-creator-sop-tool.creatorRows.v1';
export const FILMING_REQUIREMENTS_STORAGE_KEY = 'tiktok-creator-sop-tool.filmingRequirements.v1';

export const DEFAULT_CREATOR_FILMING_REQUIREMENTS: CreatorFilmingRequirements = {
  productName: '蒸汽梳毛器',
  videoCount: 2,
  videoDurationRequirement: '每条视频 60 秒以上',
  brandTagRequirement: '必须 tag 品牌账号',
  productLinkRequirement: '必须挂 TikTok Shop 产品链接',
  keyContentPoints: [
    '展示雾化功能',
    '展示梳下来的浮毛',
    '展示宠物真实反应',
    '展示自然的日常宠物护理场景',
    '展示清理过程',
  ],
};

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

function toStoredRequirements(requirements: CreatorFilmingRequirements): CreatorFilmingRequirements {
  const videoCount = Number(requirements.videoCount);

  return {
    productName: normalizeText(requirements.productName) || DEFAULT_CREATOR_FILMING_REQUIREMENTS.productName,
    videoCount: Number.isFinite(videoCount) && videoCount > 0 ? Math.floor(videoCount) : DEFAULT_CREATOR_FILMING_REQUIREMENTS.videoCount,
    videoDurationRequirement: normalizeText(requirements.videoDurationRequirement) || DEFAULT_CREATOR_FILMING_REQUIREMENTS.videoDurationRequirement,
    brandTagRequirement: normalizeText(requirements.brandTagRequirement) || DEFAULT_CREATOR_FILMING_REQUIREMENTS.brandTagRequirement,
    productLinkRequirement: normalizeText(requirements.productLinkRequirement) || DEFAULT_CREATOR_FILMING_REQUIREMENTS.productLinkRequirement,
    keyContentPoints: requirements.keyContentPoints.map(normalizeText).filter(Boolean),
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
    return parsed.map((item) => toStoredRow(item as CreatorRow));
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

export function loadFilmingRequirements(): CreatorFilmingRequirements {
  const storage = getBrowserStorage();
  if (!storage) return DEFAULT_CREATOR_FILMING_REQUIREMENTS;

  const saved = storage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY);
  if (!saved) return DEFAULT_CREATOR_FILMING_REQUIREMENTS;

  try {
    const parsed = JSON.parse(saved) as CreatorFilmingRequirements;
    return toStoredRequirements({
      ...DEFAULT_CREATOR_FILMING_REQUIREMENTS,
      ...parsed,
      keyContentPoints: Array.isArray(parsed.keyContentPoints) ? parsed.keyContentPoints : DEFAULT_CREATOR_FILMING_REQUIREMENTS.keyContentPoints,
    });
  } catch {
    storage.removeItem(FILMING_REQUIREMENTS_STORAGE_KEY);
    return DEFAULT_CREATOR_FILMING_REQUIREMENTS;
  }
}

export function saveFilmingRequirements(requirements: CreatorFilmingRequirements): CreatorFilmingRequirements {
  const normalized = toStoredRequirements(requirements);
  getBrowserStorage()?.setItem(FILMING_REQUIREMENTS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearSavedFilmingRequirements(): void {
  getBrowserStorage()?.removeItem(FILMING_REQUIREMENTS_STORAGE_KEY);
}

export function createBlankCreatorRow(requirements: CreatorFilmingRequirements, index = Date.now()): CreatorRow {
  return {
    id: `manual-${index}`,
    username: '',
    profileLink: '',
    contactMethod: 'TikTok DM',
    product: normalizeText(requirements.productName),
    currentStatus: 'To Contact',
    sampleShippingStatus: 'Not Shipped',
    sampleDeliveredDate: '',
    videoProgress: '0 of 2',
    firstVideoPostedDate: '',
    lastContactDate: '',
    lastFollowUpCount: 0,
    notes: '',
  };
}

export function updateCreatorField(row: CreatorRow, field: EditableCreatorField, rawValue: string): CreatorRow {
  if (field === 'lastFollowUpCount') {
    const parsed = Number.parseInt(rawValue, 10);
    return { ...row, lastFollowUpCount: Number.isNaN(parsed) ? 0 : Math.max(0, parsed) };
  }

  if (field === 'videoProgress') {
    const progressResult = normalizeVideoProgress(rawValue);
    return {
      ...row,
      videoProgress: rawValue,
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
