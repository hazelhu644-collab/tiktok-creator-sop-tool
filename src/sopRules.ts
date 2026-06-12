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

function isSameDate(dateValue: string | undefined, today: Date): boolean {
  const date = parseDate(dateValue ?? '');
  if (!date) return false;
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function isFutureDate(dateValue: string | undefined, today: Date): boolean {
  const date = parseDate(dateValue ?? '');
  if (!date) return false;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return dateStart > todayStart;
}

function isTodayOrOverdue(dateValue: string | undefined, today: Date): boolean {
  const date = parseDate(dateValue ?? '');
  if (!date) return false;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return dateStart <= todayStart;
}

function isHandledToday(row: CreatorRow, today: Date): boolean {
  const handledActions = ['Message Sent', 'No Reply', 'Skipped Today', 'Video Posted', 'Completed', 'Failed'];
  return isSameDate(row.lastHandledDate, today)
    || isSameDate(row.lastMessageSentAt, today)
    || Boolean(row.followUpHistory?.some((entry) => isSameDate(entry.date, today) && handledActions.includes(entry.action)));
}

function hasPauseNote(row: CreatorRow): boolean {
  return includesAny(normalizeText(row.notes), [
    '不要每天催',
    '周五后再跟进',
    '等她恢复',
    '生病',
    '受伤',
    '搬家',
    '今天不催',
    '等剪辑',
    '已沟通等待',
    'sick',
    'injured',
    'moving',
    'wait until friday',
    'do not follow up daily',
    'wait for editing',
  ]);
}

function isShippedOrInTransit(row: CreatorRow): boolean {
  return includesAny(normalizeText(row.sampleShippingStatus), ['shipped', 'in transit', '运输', '已寄', '已发货'])
    || includesAny(normalizeText(row.currentStatus), ['sample shipped', 'in transit', '运输中', '已寄样']);
}

function isInvitedOnly(row: CreatorRow): boolean {
  const status = normalizeText(row.currentStatus);
  const shipping = normalizeText(row.sampleShippingStatus);
  return includesAny(status, ['invited', 'to contact', 'not contacted', 'contacted', '初次邀约', '还未建立关系'])
    && !hasDeliveredEvidence(row)
    && !isShippedOrInTransit(row)
    && isNoSampleSent(shipping);
}

function hasFailedStatus(row: CreatorRow): boolean {
  return includesAny(normalizeText(row.currentStatus), ['failed', 'lost', '失败', '归档'])
    || includesAny(normalizeText(row.trackingStatus), ['failed', '失败', '归档']);
}

function stageRank(row: CreatorRow, priority: Priority, today: Date, requiredVideos: number): number {
  const progress = videoProgress(row, requiredVideos);
  const trackingStatus = normalizeText(row.trackingStatus).toLowerCase();
  if (isHandledToday(row, today) || trackingStatus === 'skipped today' || trackingStatus === '今日已跳过') return 7;
  if (isCompleted(row, requiredVideos) || hasFailedStatus(row)) return 8;
  if (['replied', 'reply pending', '达人已回复', '达人回复待处理'].includes(trackingStatus)) return 1;
  if (hasDeliveredEvidence(row) && (progress.postedCount ?? 0) === 0) return 2;
  if (typeof progress.postedCount === 'number' && progress.postedCount > 0 && progress.postedCount < requiredVideos) return 3;
  if (priority === 'Highest' && row.lastFollowUpCount >= 2) return 4;
  if (isShippedOrInTransit(row)) return 5;
  if (isInvitedOnly(row)) return 6;
  return 6;
}

export function analyzeCreator(row: CreatorRow, today = new Date(), requiredVideos = DEFAULT_REQUIRED_VIDEOS): Task {
  const deliveredDays = daysSince(row.sampleDeliveredDate, today);
  const lastContactDays = daysSince(row.lastContactDate, today);
  const progress = videoProgress(row, requiredVideos);
  const missingVideos = missingVideoCount(progress, requiredVideos);
  const hasPostedAnyVideo = typeof progress.postedCount === 'number' && progress.postedCount > 0;
  const isIncomplete = missingVideos === null || missingVideos > 0;
  const trackingStatus = normalizeText(row.trackingStatus).toLowerCase();
  const hasPendingCreatorReply = ['replied', 'reply pending', '达人已回复', '达人回复待处理'].includes(trackingStatus)
    && !isCompleted(row, requiredVideos)
    && !hasFailedStatus(row);
  const handledToday = isHandledToday(row, today) || trackingStatus === 'skipped today' || trackingStatus === '今日已跳过';
  const pauseNote = hasPauseNote(row);
  const futureFollowUp = isFutureDate(row.nextFollowUpDate, today);
  const dueFollowUp = isTodayOrOverdue(row.nextFollowUpDate, today);
  const deliveredOrDeliverable = hasDeliveredEvidence(row) || hasPostedAnyVideo;
  const statusText = normalizeText(row.currentStatus);
  const hasAnyWorkflowSignal = [row.username, row.currentStatus, row.sampleShippingStatus, row.sampleDeliveredDate, row.firstVideoPostedDate, row.lastContactDate, row.notes, row.trackingStatus ?? '', row.nextFollowUpDate ?? '']
    .some((value) => normalizeText(value));
  let priority: Priority = hasAnyWorkflowSignal ? 'Low' : 'None';
  let triggerReason = '今天不是必须高频跟进，可稍后复查。';
  let suggestedAction = '稍后复查。';

  if (!normalizeText(row.username) || !hasAnyWorkflowSignal) {
    priority = 'None';
    triggerReason = '缺少达人状态信息，今天暂无必须跟进的任务。';
    suggestedAction = '补充达人资料后再判断。';
  } else if (handledToday) {
    priority = 'Low';
    triggerReason = '今日已处理，默认不再进入待处理队列。';
    suggestedAction = '今日已处理，明日或按下次跟进日期复查。';
  } else if (isCompleted(row, requiredVideos)) {
    priority = 'Low';
    triggerReason = '合作已完成，无需进入今日高优先级队列。';
    suggestedAction = '合作完成维护。';
  } else if (hasFailedStatus(row)) {
    priority = 'Low';
    triggerReason = '合作已失败或归档，默认低优先级复盘。';
    suggestedAction = '合作失败归档。';
  } else if ((pauseNote || futureFollowUp) && !dueFollowUp) {
    priority = 'Low';
    triggerReason = pauseNote ? '备注显示暂不催，已降低优先级。' : '下次跟进日期未到，暂不进入今日高优先级。';
    suggestedAction = '按备注或下次跟进日期复查。';
  } else if (hasPendingCreatorReply) {
    priority = 'Highest';
    triggerReason = '达人已回复，需先处理对话。';
    suggestedAction = '生成「回复达人消息」话术，基于达人回复内容给出下一步回应。';
  } else if (hasPostedAnyVideo && isIncomplete) {
    priority = 'Highest';
    triggerReason = `已发布 ${progress.postedCount} 条，剩余 ${missingVideos ?? 1} 条待履约。`;
    suggestedAction = missingVideos === null ? '提醒达人确认剩余视频发布计划。' : `提醒达人继续发布剩余 ${missingVideos} 条视频。`;
  } else if (hasDeliveredEvidence(row) && progress.postedCount === 0) {
    if (deliveredDays !== null && deliveredDays >= 3) {
      priority = 'Highest';
      triggerReason = '样品已签收但仍未发布视频。';
      suggestedAction = `发送拍摄跟进，提醒达人按照达人拍摄要求完成 ${requiredVideos} 条视频。`;
    } else {
      priority = 'High';
      triggerReason = '样品近期签收，需确认拍摄计划。';
      suggestedAction = '轻提醒达人确认收货和预计发布时间。';
    }
  } else if (row.lastFollowUpCount >= 2 && deliveredOrDeliverable && isIncomplete) {
    priority = 'Highest';
    triggerReason = '已多次跟进且交付未完成，存在合作失败风险。';
    suggestedAction = '发送最后确认，请达人明确发布时间或是否继续合作。';
  } else if (dueFollowUp) {
    priority = 'High';
    triggerReason = '下次跟进日期已到或逾期，今天应处理。';
    suggestedAction = '按约定节点跟进达人。';
  } else if (isShippedOrInTransit(row)) {
    priority = row.lastFollowUpCount >= 2 || includesAny(statusText, ['logistics', '物流异常']) ? 'High' : 'Medium';
    triggerReason = priority === 'High' ? '样品运输中，有物流提醒或异常需要确认。' : '样品仍在运输中，仅需轻提醒。';
    suggestedAction = '轻量确认物流进度，避免提前催内容。';
  } else if (lastContactDays !== null && lastContactDays >= 2 && isIncomplete) {
    priority = isInvitedOnly(row) ? 'Medium' : 'High';
    triggerReason = isInvitedOnly(row) ? '初次邀约后可轻跟进，但不应高于已寄样达人。' : '已联系但暂无回复，今天可跟进确认下一步。';
    suggestedAction = '发送轻量跟进，确认达人是否仍有合作兴趣。';
  } else if (isInvitedOnly(row)) {
    priority = 'Medium';
    triggerReason = '初次邀约阶段，未进入交付风险。';
    suggestedAction = '可轻量跟进合作兴趣。';
  }

  const failedWarnings = getFailureWarnings(row, today, requiredVideos);
  const rank = PRIORITY_RANK[priority];

  return {
    ...row,
    videoProgress: progress.normalized,
    videoProgressWarning: progress.warning,
    priority,
    priorityRank: rank,
    stageRank: stageRank(row, priority, today, requiredVideos),
    triggerReason,
    suggestedAction,
    failedWarnings,
    needsFollowUp: priority !== 'None' && (priority !== 'Low' || (!handledToday && !isCompleted(row, requiredVideos) && !hasFailedStatus(row) && !pauseNote && !futureFollowUp)),
  };
}

export function analyzeCreators(rows: CreatorRow[], today = new Date(), requiredVideos = DEFAULT_REQUIRED_VIDEOS): Task[] {
  return rows
    .map((row) => analyzeCreator(row, today, requiredVideos))
    .sort((a, b) => a.stageRank - b.stageRank
      || a.priorityRank - b.priorityRank
      || (daysSince(b.lastContactDate, today) ?? -1) - (daysSince(a.lastContactDate, today) ?? -1)
      || b.lastFollowUpCount - a.lastFollowUpCount
      || (parseDate(a.nextFollowUpDate ?? '')?.getTime() ?? Number.POSITIVE_INFINITY) - (parseDate(b.nextFollowUpDate ?? '')?.getTime() ?? Number.POSITIVE_INFINITY)
      || a.username.localeCompare(b.username));
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
