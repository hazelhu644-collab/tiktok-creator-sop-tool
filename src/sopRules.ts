import type { CreatorRow, Priority, Summary, Task } from './types';

export const PRIORITY_RANK: Record<Priority, number> = {
  Highest: 1,
  High: 2,
  Medium: 3,
  Low: 4,
  None: 99,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
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

function isCompleted(row: CreatorRow): boolean {
  return normalizeText(row.currentStatus).toLowerCase() === 'completed' || normalizeText(row.videoProgress) === '2/2';
}

export function getFailureWarnings(row: CreatorRow, today = new Date()): string[] {
  const warnings: string[] = [];
  const deliveredDays = daysSince(row.sampleDeliveredDate, today);
  const firstVideoDays = daysSince(row.firstVideoPostedDate, today);
  const notes = normalizeText(row.notes);

  if (isDelivered(row.sampleShippingStatus) && row.videoProgress === '0/2' && deliveredDays !== null && deliveredDays >= 7) {
    warnings.push(`Sample was delivered ${deliveredDays} days ago and video progress is still 0/2.`);
  }

  if (row.lastFollowUpCount >= 2 && !isCompleted(row)) {
    warnings.push('Creator has received 2+ follow-ups and has not completed the collaboration.');
  }

  if (row.videoProgress === '1/2' && firstVideoDays !== null && firstVideoDays >= 5) {
    warnings.push(`Only 1 video has been posted, and the first video was posted ${firstVideoDays} days ago.`);
  }

  if (includesAny(notes, ['long-time no reply', 'long time no reply', 'no filming plan', 'bad cooperation', 'unwilling to correct', 'unwillingness to correct'])) {
    warnings.push('Notes indicate long-time no reply, no filming plan, bad cooperation, or unwillingness to correct the video.');
  }

  return warnings;
}

export function analyzeCreator(row: CreatorRow, today = new Date()): Task {
  const deliveredDays = daysSince(row.sampleDeliveredDate, today);
  const lastContactDays = daysSince(row.lastContactDate, today);
  let priority: Priority = 'None';
  let triggerReason = 'No follow-up task is due under the MVP rules.';
  let suggestedAction = 'Review later.';

  if (isDelivered(row.sampleShippingStatus) && row.videoProgress === '0/2' && deliveredDays !== null && deliveredDays >= 2) {
    priority = 'Highest';
    triggerReason = `Sample was delivered ${deliveredDays} days ago, but no videos have been posted.`;
    suggestedAction = 'Send first filming follow-up and remind the creator to follow the brief.';
  } else if (row.videoProgress === '1/2' && normalizeText(row.firstVideoPostedDate)) {
    priority = 'High';
    triggerReason = 'Creator has posted only one video, but this collaboration requires two videos.';
    suggestedAction = 'Ask the creator to post the second video.';
  } else if (normalizeText(row.currentStatus).toLowerCase() === 'followed up' && lastContactDays !== null && lastContactDays >= 1 && row.videoProgress !== '2/2') {
    priority = 'Medium';
    triggerReason = `Creator was already followed up ${lastContactDays} day${lastContactDays === 1 ? '' : 's'} ago and has not completed the collaboration.`;
    suggestedAction = 'Send a second follow-up and ask for a clear update.';
  } else if (normalizeText(row.currentStatus).toLowerCase() === 'contacted' && lastContactDays !== null && lastContactDays >= 2 && isNoSampleSent(row.sampleShippingStatus)) {
    priority = 'Low';
    triggerReason = `Creator was contacted ${lastContactDays} days ago, but no sample has been sent yet.`;
    suggestedAction = 'Send a light follow-up to confirm whether the creator is interested.';
  }

  const failedWarnings = getFailureWarnings(row, today);

  return {
    ...row,
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
