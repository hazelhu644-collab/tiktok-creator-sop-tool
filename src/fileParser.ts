import type { CreatorRow } from './types';
import { normalizeText, normalizeVideoProgress } from './sopRules';

const COLUMN_ALIASES: Record<keyof Omit<CreatorRow, 'id' | 'lastFollowUpCount' | 'videoProgressWarning' | 'followUpHistory'>, string[]> = {
  username: ['creator username', 'username', 'creator', 'creator handle'],
  profileLink: ['creator profile link', 'profile link', 'creator link', 'profile'],
  contactMethod: ['contact method', 'contact', 'channel'],
  product: ['product', 'product name'],
  currentStatus: ['current status', 'status', 'creator status'],
  sampleShippingStatus: ['sample shipping status', 'shipping status', 'sample status'],
  sampleDeliveredDate: ['sample delivered date', 'delivered date', 'delivery date'],
  videoProgress: ['video progress', 'videos', 'progress'],
  firstVideoPostedDate: ['first video posted date', 'first video date', 'video 1 date'],
  lastContactDate: ['last contact date', 'last contacted date', 'contacted date'],
  notes: ['notes', 'note', 'remarks'],
  lastMessageScenario: ['last message scenario'],
  lastMessageChannel: ['last message channel'],
  lastMessageSentAt: ['last message sent at'],
  nextFollowUpDate: ['next follow-up date', 'next follow up date'],
  lastCreatorResponse: ['last creator response'],
};

const FOLLOW_UP_ALIASES = ['last follow-up count', 'last follow up count', 'follow-up count', 'follow up count', 'followups'];

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, ' ');
}

function pickValue(record: Record<string, unknown>, aliases: string[]): string {
  const entries = Object.entries(record);
  const found = entries.find(([key]) => aliases.includes(normalizeHeader(key)));
  return normalizeText(found?.[1]);
}

export function normalizeRecord(record: Record<string, unknown>, index: number, requiredVideos = 2): CreatorRow {
  const lastFollowUpValue = pickValue(record, FOLLOW_UP_ALIASES);
  const followUpCount = Number.parseInt(lastFollowUpValue || '0', 10);
  const progressResult = normalizeVideoProgress(pickValue(record, COLUMN_ALIASES.videoProgress), requiredVideos);

  return {
    id: `${index}-${pickValue(record, COLUMN_ALIASES.username) || 'creator'}`,
    username: pickValue(record, COLUMN_ALIASES.username) || `Creator ${index + 1}`,
    profileLink: pickValue(record, COLUMN_ALIASES.profileLink),
    contactMethod: pickValue(record, COLUMN_ALIASES.contactMethod),
    product: pickValue(record, COLUMN_ALIASES.product) || 'Steam Grooming Brush',
    currentStatus: pickValue(record, COLUMN_ALIASES.currentStatus),
    sampleShippingStatus: pickValue(record, COLUMN_ALIASES.sampleShippingStatus),
    sampleDeliveredDate: pickValue(record, COLUMN_ALIASES.sampleDeliveredDate),
    videoProgress: progressResult.normalized,
    videoProgressWarning: progressResult.warning,
    firstVideoPostedDate: pickValue(record, COLUMN_ALIASES.firstVideoPostedDate),
    lastContactDate: pickValue(record, COLUMN_ALIASES.lastContactDate),
    lastFollowUpCount: Number.isNaN(followUpCount) ? 0 : followUpCount,
    notes: pickValue(record, COLUMN_ALIASES.notes),
    lastMessageScenario: pickValue(record, COLUMN_ALIASES.lastMessageScenario),
    lastMessageChannel: pickValue(record, COLUMN_ALIASES.lastMessageChannel),
    lastMessageSentAt: pickValue(record, COLUMN_ALIASES.lastMessageSentAt),
    nextFollowUpDate: pickValue(record, COLUMN_ALIASES.nextFollowUpDate),
    lastCreatorResponse: pickValue(record, COLUMN_ALIASES.lastCreatorResponse),
    followUpHistory: [],
  };
}

export async function parseCreatorFile(file: File, requiredVideos = 2): Promise<CreatorRow[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (extension === 'csv') {
    const text = new TextDecoder().decode(buffer);
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(text, { type: 'string' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
    return records.map((record, index) => normalizeRecord(record, index, requiredVideos)).filter((row) => row.username);
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
    return records.map((record, index) => normalizeRecord(record, index, requiredVideos)).filter((row) => row.username);
  }

  throw new Error('请上传 CSV、XLS 或 XLSX 文件。');
}
