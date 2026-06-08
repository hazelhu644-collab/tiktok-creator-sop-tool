import type { CreatorRow, Priority, Summary, Task, VideoProgressNormalization } from './types';

export const PRIORITY_RANK: Record<Priority, number> = {
  Highest: 1,
  High: 2,
  Medium: 3,
  Low: 4,
  None: 99,
};

export const DEFAULT_REQUIRED_VIDEOS = 2;
export const VIDEO_PROGRESS_OVER_REQUIRED_WARNING = '视频进度超过当前达人拍摄要求。请检查已发布视频数量或修改达人拍摄要求。';

const DAY_MS = 24 * 60 * 60 * 1000;

type FilmingRequirementsLike = {
  requirements?: string[];
  keyContentPoints?: string[];
  productName?: string;
};

export function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

export function parseRequiredVideos(source: FilmingRequirementsLike | string[] | string | null | undefined): number {
  const text = Array.isArray(source)
    ? source.join('\n')
    : typeof source === 'string'
      ? source
      : [source?.requirements, source?.keyContentPoints, source?.productName]
        .flat()
        .filter((item): item is string => typeof item === 'string')
        .join('\n');

  const patterns = [
    /每\s*位\s*达人\s*(\d+)\s*条\s*视频/i,
    /(\d+)\s*条\s*视频/i,
    /(\d+)\s*videos?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const parsed = Number.parseInt(match[1], 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }

  return DEFAULT_REQUIRED_VIDEOS;
}

function requiredVideoExamples(requiredVideos: number): string[] {
  return Array.from({ length: requiredVideos + 1 }, (_, postedCount) => `${postedCount} of ${requiredVideos}`);
}

export function buildVideoProgressHint(requiredVideos = DEFAULT_REQUIRED_VIDEOS): string {
  return `视频进度建议填写 ${requiredVideoExamples(requiredVideos).join('、')}，避免 Excel 自动转成日期。`;
}

export function buildVideoProgressWarning(requiredVideos = DEFAULT_REQUIRED_VIDEOS): string {
  return `视频进度可能无法识别。建议使用 ${requiredVideoExamples(requiredVideos).join('、')}。`;
}

export const VIDEO_PROGRESS_WARNING = buildVideoProgressWarning(DEFAULT_REQUIRED_VIDEOS);

export function normalizeVideoProgress(value: unknown, requiredVideos = DEFAULT_REQUIRED_VIDEOS): VideoProgressNormalization {
  const safeRequiredVideos = Number.isSafeInteger(requiredVideos) && requiredVideos > 0 ? requiredVideos : DEFAULT_REQUIRED_VIDEOS;

  if (value instanceof Date) {
    return { normalized: '', warning: buildVideoProgressWarning(safeRequiredVideos), requiredVideos: safeRequiredVideos };
  }

  const raw = normalizeText(value);
  if (!raw) return { normalized: `0/${safeRequiredVideos}`, postedCount: 0, requiredVideos: safeRequiredVideos };

  const normalized = raw.toLowerCase().trim().replace(/\s+/g, ' ');
  const slashMatch = normalized.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slashMatch) return normalizePostedCount(Number.parseInt(slashMatch[1], 10), Number.parseInt(slashMatch[2], 10), safeRequiredVideos, raw);

  const ofMatch = normalized.match(/^(\d+)\s+of\s+(\d+)$/);
  if (ofMatch) return normalizePostedCount(Number.parseInt(ofMatch[1], 10), Number.parseInt(ofMatch[2], 10), safeRequiredVideos, raw);

  const videosMatch = normalized.match(/^(\d+)\s+videos?$/);
  if (videosMatch) return normalizePostedCount(Number.parseInt(videosMatch[1], 10), safeRequiredVideos, safeRequiredVideos, raw);

  const postedMatch = normalized.match(/^posted\s+(\d+)$/);
  if (postedMatch) return normalizePostedCount(Number.parseInt(postedMatch[1], 10), safeRequiredVideos, safeRequiredVideos, raw);

  if (looksLikeExcelConvertedDate(value, normalized)) {
    return { normalized: raw, warning: buildVideoProgressWarning(safeRequiredVideos), requiredVideos: safeRequiredVideos };
  }

  return { normalized: raw, warning: buildVideoProgressWarning(safeRequiredVideos), requiredVideos: safeRequiredVideos };
}

function normalizePostedCount(postedCount: number, providedRequiredVideos: number, requiredVideos: number, raw: string): VideoProgressNormalization {
  if (!Number.isSafeInteger(postedCount) || postedCount < 0 || providedRequiredVideos !== requiredVideos) {
    return { normalized: raw, warning: buildVideoProgressWarning(requiredVideos), requiredVideos };
  }

  const normalized = `${postedCount}/${requiredVideos}`;
  if (postedCount > requiredVideos) {
    return { normalized, warning: VIDEO_PROGRESS_OVER_REQUIRED_WARNING, postedCount, requiredVideos, isOverRequired: true };
  }

  return { normalized, postedCount, requiredVideos };
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

function hasDeliveredEvidence(row: CreatorRow): boolean {
  return isDelivered(row.sampleShippingStatus) || parseDate(row.sampleDeliveredDate) !== null;
}

function isNoSampleSent(status: string): boolean {
  const normalized = normalizeText(status).toLowerCase();
  return !normalized || normalized === 'pending' || normalized === 'not shipped';
}

function videoProgress(row: CreatorRow, requiredVideos: number): VideoProgressNormalization {
  return normalizeVideoProgress(row.videoProgress, requiredVideos);
}

function isCompleted(row: CreatorRow, requiredVideos: number): boolean {
  const progress = videoProgress(row, requiredVideos);
  return normalizeText(row.currentStatus).toLowerCase() === 'completed'
    || (typeof progress.postedCount === 'number' && progress.postedCount >= requiredVideos);
}

function missingVideoCount(progress: VideoProgressNormalization, requiredVideos: number): number | null {
  if (typeof progress.postedCount !== 'number') return null;
  return Math.max(0, requiredVideos - progress.postedCount);
}

export function getFailureWarnings(row: CreatorRow, today = new Date(), requiredVideos = DEFAULT_REQUIRED_VIDEOS): string[] {
  const warnings: string[] = [];
  const deliveredDays = daysSince(row.sampleDeliveredDate, today);
  const firstVideoDays = daysSince(row.firstVideoPostedDate, today);
  const notes = normalizeText(row.notes);
  const progress = videoProgress(row, requiredVideos);
  const missingVideos = missingVideoCount(progress, requiredVideos);

  if (progress.isOverRequired) {
    warnings.push(VIDEO_PROGRESS_OVER_REQUIRED_WARNING);
  }

  if (hasDeliveredEvidence(row) && progress.postedCount === 0 && deliveredDays !== null && deliveredDays >= 7) {
    warnings.push(`样品已到货 ${deliveredDays} 天，但视频进度仍为 0/${requiredVideos}。`);
  }

  if (row.lastFollowUpCount >= 2 && !isCompleted(row, requiredVideos)) {
    warnings.push('达人已被跟进 2 次以上，但合作仍未完成。');
  }

  if (typeof progress.postedCount === 'number' && progress.postedCount > 0 && missingVideos !== null && missingVideos > 0 && firstVideoDays !== null && firstVideoDays >= 5) {
    warnings.push(`达人已发布 ${progress.postedCount} 条视频，还差 ${missingVideos} 条视频，首条视频已发布 ${firstVideoDays} 天。`);
  }

  if (includesAny(notes, ['long-time no reply', 'long time no reply', 'no filming plan', 'bad cooperation', 'unwilling to correct', 'unwillingness to correct'])) {
    warnings.push('备注显示达人长期未回复、没有明确拍摄计划、合作状态较差，或不愿意修改视频。');
  }

  return warnings;
}

export function analyzeCreator(row: CreatorRow, today = new Date(), requiredVideos = DEFAULT_REQUIRED_VIDEOS): Task {
  const deliveredDays = daysSince(row.sampleDeliveredDate, today);
  const lastContactDays = daysSince(row.lastContactDate, today);
  const progress = videoProgress(row, requiredVideos);
  const missingVideos = missingVideoCount(progress, requiredVideos);
  const hasPostedAnyVideo = typeof progress.postedCount === 'number' && progress.postedCount > 0;
  const isIncomplete = missingVideos === null || missingVideos > 0;
  let priority: Priority = 'None';
  let triggerReason = '根据当前 MVP 规则，今天暂无必须跟进的任务。';
  let suggestedAction = '稍后复查。';

  if (hasDeliveredEvidence(row) && progress.postedCount === 0 && deliveredDays !== null && deliveredDays >= 2) {
    priority = 'Highest';
    triggerReason = `样品已到货 ${deliveredDays} 天，但达人还没有发布视频。`;
    suggestedAction = `发送第一次拍摄跟进，提醒达人按照达人拍摄要求完成 ${requiredVideos} 条视频。`;
  } else if (hasPostedAnyVideo && isIncomplete && normalizeText(row.firstVideoPostedDate)) {
    priority = 'High';
    triggerReason = `达人已发布 ${progress.postedCount} 条视频，但本次合作要求 ${requiredVideos} 条视频。`;
    suggestedAction = missingVideos === null
      ? '提醒达人确认剩余视频发布计划。'
      : `提醒达人继续发布剩余 ${missingVideos} 条视频。`;
  } else if (normalizeText(row.currentStatus).toLowerCase() === 'followed up' && lastContactDays !== null && lastContactDays >= 1 && isIncomplete) {
    priority = 'Medium';
    triggerReason = `已在 ${lastContactDays} 天前跟进过达人，但合作仍未完成。`;
    suggestedAction = missingVideos === null
      ? '发送第二次跟进，请达人给出明确进展。'
      : `发送第二次跟进，请达人给出剩余 ${missingVideos} 条视频的明确进展。`;
  } else if (normalizeText(row.currentStatus).toLowerCase() === 'contacted' && lastContactDays !== null && lastContactDays >= 2 && isNoSampleSent(row.sampleShippingStatus)) {
    priority = 'Low';
    triggerReason = `已在 ${lastContactDays} 天前联系达人，但样品还未寄出。`;
    suggestedAction = '发送轻量跟进，确认达人是否仍有合作兴趣。';
  }

  const failedWarnings = getFailureWarnings(row, today, requiredVideos);

  return {
    ...row,
    videoProgress: progress.normalized,
    videoProgressWarning: progress.warning,
    priority,
    priorityRank: PRIORITY_RANK[priority],
    triggerReason,
    suggestedAction,
    failedWarnings,
    needsFollowUp: priority !== 'None',
  };
}

export function analyzeCreators(rows: CreatorRow[], today = new Date(), requiredVideos = DEFAULT_REQUIRED_VIDEOS): Task[] {
  return rows
    .map((row) => analyzeCreator(row, today, requiredVideos))
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
