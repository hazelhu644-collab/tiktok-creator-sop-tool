import type { CreatorRow } from './types';
import { normalizeText, normalizeVideoProgress } from './sopRules';

const COLUMN_ALIASES: Record<keyof Omit<CreatorRow, 'id' | 'lastFollowUpCount' | 'videoProgressWarning' | 'followUpHistory' | 'archivedAt' | 'archiveReason'>, string[]> = {
  username: ['creator username', 'username', 'creator', 'creator handle', '达人账号'],
  profileLink: ['creator profile link', 'profile link', 'creator link', 'profile', '主页链接'],
  contactMethod: ['contact method', 'contact', 'channel', '联系渠道'],
  product: ['product', 'product name', 'product Name', '产品', '产品名称', '所属产品', '产品项目'],
  currentStatus: ['current status', 'status', 'creator status', '合作状态', '当前状态'],
  sampleShippingStatus: ['sample shipping status', 'shipping status', 'sample status', '物流状态', '样品物流状态'],
  sampleDeliveredDate: ['sample delivered date', 'sample arrival date', 'estimated arrival date', 'estimated delivery date', 'expected delivery date', 'eta', 'delivered date', 'delivery date', '样品到货日期', '样品到货时间', '预计到货日期'],
  videoProgress: ['video progress', 'videos', 'progress', '视频进度'],
  firstVideoPostedDate: ['first video posted date', 'first video date', 'video 1 date', '首条视频发布日期', '首条视频发布时间'],
  latestVideoPostedDate: ['latest video posted date', 'last video posted date', '最近视频发布日期'],
  lastContactDate: ['last contact date', 'last contacted date', 'contacted date', '最近联系日期', '最后联系时间', 'last message sent at'],
  notes: ['notes', 'note', 'remarks', '备注', '达人备注'],
  trackingStatus: ['tracking status', 'follow-up tracking status', 'follow up tracking status', '跟进状态'],
  lastMessageScenario: ['last message scenario', '最近沟通动作'],
  lastMessageChannel: ['last message channel', '最近沟通渠道'],
  lastMessageSentAt: ['last message sent at'],
  lastHandledDate: ['last handled date', '最近处理日期'],
  nextFollowUpDate: ['next follow-up date', 'next follow up date', '下次跟进日期'],
  lastCreatorResponse: ['last creator response', '达人回复/下一步备注', '达人回复', '下一步备注'],
};

const FOLLOW_UP_ALIASES = ['last follow-up count', 'last follow up count', 'follow-up count', 'follow up count', 'followups', '跟进次数'];

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, ' ');
}

function pickValue(record: Record<string, unknown>, aliases: string[]): string {
  const entries = Object.entries(record);
  const found = entries.find(([key]) => aliases.includes(normalizeHeader(key)));
  return normalizeText(found?.[1]);
}

export function normalizeRecord(record: Record<string, unknown>, index: number, requiredVideos = 1): CreatorRow {
  const lastFollowUpValue = pickValue(record, FOLLOW_UP_ALIASES);
  const followUpCount = Number.parseInt(lastFollowUpValue || '0', 10);
  const progressResult = normalizeVideoProgress(pickValue(record, COLUMN_ALIASES.videoProgress), requiredVideos);
  const lastMessageSentAt = pickValue(record, COLUMN_ALIASES.lastMessageSentAt);
  const lastContactDate = pickValue(record, COLUMN_ALIASES.lastContactDate) || lastMessageSentAt;

  return {
    id: `${index}-${pickValue(record, COLUMN_ALIASES.username) || 'creator'}`,
    username: pickValue(record, COLUMN_ALIASES.username) || `Creator ${index + 1}`,
    profileLink: pickValue(record, COLUMN_ALIASES.profileLink),
    contactMethod: pickValue(record, COLUMN_ALIASES.contactMethod),
    product: pickValue(record, COLUMN_ALIASES.product),
    currentStatus: pickValue(record, COLUMN_ALIASES.currentStatus),
    sampleShippingStatus: pickValue(record, COLUMN_ALIASES.sampleShippingStatus),
    sampleDeliveredDate: pickValue(record, COLUMN_ALIASES.sampleDeliveredDate),
    videoProgress: progressResult.normalized,
    videoProgressWarning: progressResult.warning,
    firstVideoPostedDate: pickValue(record, COLUMN_ALIASES.firstVideoPostedDate),
    latestVideoPostedDate: pickValue(record, COLUMN_ALIASES.latestVideoPostedDate),
    lastContactDate,
    lastFollowUpCount: Number.isNaN(followUpCount) ? 0 : followUpCount,
    notes: pickValue(record, COLUMN_ALIASES.notes),
    trackingStatus: pickValue(record, COLUMN_ALIASES.trackingStatus),
    lastMessageScenario: pickValue(record, COLUMN_ALIASES.lastMessageScenario),
    lastMessageChannel: pickValue(record, COLUMN_ALIASES.lastMessageChannel),
    lastMessageSentAt,
    lastHandledDate: pickValue(record, COLUMN_ALIASES.lastHandledDate),
    nextFollowUpDate: pickValue(record, COLUMN_ALIASES.nextFollowUpDate),
    lastCreatorResponse: pickValue(record, COLUMN_ALIASES.lastCreatorResponse),
    followUpHistory: [],
  };
}

export async function parseCreatorFile(file: File, requiredVideos = 1): Promise<CreatorRow[]> {
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
