import type { CreatorRow, Priority, Summary, Task, VideoProgressNormalization } from './types';

export const PRIORITY_RANK: Record<Priority, number> = {
  Highest: 1,
  High: 2,
  Medium: 3,
  Low: 4,
  None: 99,
};

export const VIDEO_PROGRESS_WARNING = '视频进度可能无法识别。建议使用 0/2、1/2、2/2，或者更稳定的写法：1 of 2。';

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizeVideoProgress(value: unknown): VideoProgressNormalization {
  if (value instanceof Date) {
    return { normalized: '', warning: VIDEO_PROGRESS_WARNING };
  }

  const raw = normalizeText(value);
  if (!raw) return { normalized: '0/2' };

  const normalized = raw.toLowerCase().trim().replace(/\s+/g, ' ');
  const slashMatch = normalized.match(/^([0-2])\s*\/\s*2$/);
  if (slashMatch) return { normalized: `${slashMatch[1]}/2` };

  const ofMatch = normalized.match(/^([0-2])\s+of\s+2$/);
  if (ofMatch) return { normalized: `${ofMatch[1]}/2` };

  const videosMatch = normalized.match(/^([0-2])\s+videos?$/);
  if (videosMatch) return { normalized: `${videosMatch[1]}/2` };

  const postedMatch = normalized.match(/^posted\s+([0-2])$/);
  if (postedMatch) return { normalized: `${postedMatch[1]}/2` };

  if (looksLikeExcelConvertedDate(value, normalized)) {
    return { normalized: raw, warning: VIDEO_PROGRESS_WARNING };
  }

  return { normalized: raw, warning: VIDEO_PROGRESS_WARNING };
}

function looksLikeExcelConvertedDate(value: unknown, normalized: string): boolean {
  if (value instanceof Date) return true;
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/.test(normalized)) return true;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(normalized)) return true;
  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(normalized)) return true;
  if (/^[a-z]{3}\s+[a-z]{3}\s+\d{1,2}\s+\d{4}/.test(normalized)) return true;
  return false;
}

export function parseDate(value: string): Date | null {
  const raw = normalizeText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;
  const [, first, second, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  const fallback = new Date(Number(fullYear), Number(first) - 1, Number(second));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function daysSince(dateValue: string, today = new Date()): number | null {
  const date = parseDate(dateValue);
  if (!date) return null;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.floor((todayStart - dateStart) / DAY_MS);
}

function includesAny(value: string, options: string[]): boolean {
  const normalized = value.toLowerCase();
  return options.some((option) => normalized.includes(option));
}

function isDelivered(status: string): boolean {
  return normalizeText(status).toLowerCase() === 'delivered';
}

function isNoSampleSent(status: string): boolean {
  const normalized = normalizeText(status).toLowerCase();
  return !normalized || normalized === 'pending' || normalized === 'not shipped';
}

function videoProgress(row: CreatorRow): string {
  return normalizeVideoProgress(row.videoProgress).normalized;
}

function isCompleted(row: CreatorRow): boolean {
  return normalizeText(row.currentStatus).toLowerCase() === 'completed' || videoProgress(row) === '2/2';
}

export function getFailureWarnings(row: CreatorRow, today = new Date()): string[] {
  const warnings: string[] = [];
  const deliveredDays = daysSince(row.sampleDeliveredDate, today);
  const firstVideoDays = daysSince(row.firstVideoPostedDate, today);
  const notes = normalizeText(row.notes);
  const progress = videoProgress(row);

  if (isDelivered(row.sampleShippingStatus) && progress === '0/2' && deliveredDays !== null && deliveredDays >= 7) {
    warnings.push(`样品已到货 ${deliveredDays} 天，但视频进度仍为 0/2。`);
  }

  if (row.lastFollowUpCount >= 2 && !isCompleted(row)) {
    warnings.push('达人已被跟进 2 次以上，但合作仍未完成。');
  }

  if (progress === '1/2' && firstVideoDays !== null && firstVideoDays >= 5) {
    warnings.push(`达人只发布了 1 条视频，第一条视频已发布 ${firstVideoDays} 天。`);
  }

  if (includesAny(notes, ['long-time no reply', 'long time no reply', 'no filming plan', 'bad cooperation', 'unwilling to correct', 'unwillingness to correct'])) {
    warnings.push('备注显示达人长期未回复、没有明确拍摄计划、合作状态较差，或不愿意修改视频。');
  }

  return warnings;
}

export function analyzeCreator(row: CreatorRow, today = new Date()): Task {
  const deliveredDays = daysSince(row.sampleDeliveredDate, today);
  const lastContactDays = daysSince(row.lastContactDate, today);
  const progress = videoProgress(row);
  let priority: Priority = 'None';
  let triggerReason = '根据当前 MVP 规则，今天暂无必须跟进的任务。';
  let suggestedAction = '稍后复查。';

  if (isDelivered(row.sampleShippingStatus) && progress === '0/2' && deliveredDays !== null && deliveredDays >= 2) {
    priority = 'Highest';
    triggerReason = `样品已到货 ${deliveredDays} 天，但达人还没有发布视频。`;
    suggestedAction = '发送第一次拍摄跟进，提醒达人按照达人拍摄要求拍摄。';
  } else if (progress === '1/2' && normalizeText(row.firstVideoPostedDate)) {
    priority = 'High';
    triggerReason = '达人只发布了 1 条视频，但本次合作要求 2 条视频。';
    suggestedAction = '提醒达人确认并发布第二条视频。';
  } else if (normalizeText(row.currentStatus).toLowerCase() === 'followed up' && lastContactDays !== null && lastContactDays >= 1 && progress !== '2/2') {
    priority = 'Medium';
    triggerReason = `已在 ${lastContactDays} 天前跟进过达人，但合作仍未完成。`;
    suggestedAction = '发送第二次跟进，请达人给出明确进展。';
  } else if (normalizeText(row.currentStatus).toLowerCase() === 'contacted' && lastContactDays !== null && lastContactDays >= 2 && isNoSampleSent(row.sampleShippingStatus)) {
    priority = 'Low';
    triggerReason = `已在 ${lastContactDays} 天前联系达人，但样品还未寄出。`;
    suggestedAction = '发送轻量跟进，确认达人是否仍有合作兴趣。';
  }

  const failedWarnings = getFailureWarnings(row, today);

  return {
    ...row,
    videoProgress: progress,
    priority,
    priorityRank: PRIORITY_RANK[priority],
    triggerReason,
    suggestedAction,
    failedWarnings,
    needsFollowUp: priority !== 'None',
  };
}

export function analyzeCreators(rows: CreatorRow[], today = new Date()): Task[] {
  return rows
    .map((row) => analyzeCreator(row, today))
    .sort((a, b) => a.priorityRank - b.priorityRank || a.username.localeCompare(b.username));
}

export function buildSummary(tasks: Task[]): Summary {
  return {
    totalCreators: tasks.length,
    needsFollowUp: tasks.filter((task) => task.needsFollowUp).length,
    highest: tasks.filter((task) => task.priority === 'Highest').length,
    high: tasks.filter((task) => task.priority === 'High').length,
    medium: tasks.filter((task) => task.priority === 'Medium').length,
    low: tasks.filter((task) => task.priority === 'Low').length,
    failedWarnings: tasks.filter((task) => task.failedWarnings.length > 0).length,
  };
}
