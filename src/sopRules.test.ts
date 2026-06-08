import { describe, expect, it } from 'vitest';
import {
  analyzeCreators,
  buildSummary,
  buildVideoProgressHint,
  buildVideoProgressWarning,
  normalizeVideoProgress,
  parseRequiredVideos,
  VIDEO_PROGRESS_OVER_REQUIRED_WARNING,
} from './sopRules';
import { createBlankCreatorRow } from './creatorData';
import type { CreatorRow } from './types';

const today = new Date('2026-06-05T12:00:00Z');

function row(overrides: Partial<CreatorRow>): CreatorRow {
  return {
    id: 'id',
    username: 'creator',
    profileLink: '',
    contactMethod: 'TikTok DM',
    product: 'Steam Grooming Brush',
    currentStatus: '',
    sampleShippingStatus: '',
    sampleDeliveredDate: '',
    videoProgress: '0/2',
    firstVideoPostedDate: '',
    lastContactDate: '',
    lastFollowUpCount: 0,
    notes: '',
    ...overrides,
  };
}

describe('required video count parsing', () => {
  it.each([1, 2, 3, 5, 7, 10])('parses 每位达人 %i 条视频 from editable filming requirements', (requiredVideos) => {
    expect(parseRequiredVideos({ requirements: [`每位达人 ${requiredVideos} 条视频`, '每条视频 60 秒以上'] })).toBe(requiredVideos);
  });

  it('falls back to 2 when no positive video count can be parsed', () => {
    expect(parseRequiredVideos({ requirements: ['请按脚本拍摄'] })).toBe(2);
  });
});

describe('video progress normalization', () => {
  it.each([1, 2, 3, 5, 7, 10])('supports 0 of N and N of N for requiredVideos=%i', (requiredVideos) => {
    expect(normalizeVideoProgress(`0 of ${requiredVideos}`, requiredVideos)).toMatchObject({
      normalized: `0/${requiredVideos}`,
      postedCount: 0,
      requiredVideos,
    });
    expect(normalizeVideoProgress(`${requiredVideos} of ${requiredVideos}`, requiredVideos)).toMatchObject({
      normalized: `${requiredVideos}/${requiredVideos}`,
      postedCount: requiredVideos,
      requiredVideos,
    });
  });

  it('supports slash, posted X, and X videos formats for the current required video count', () => {
    expect(normalizeVideoProgress('1/3', 3)).toMatchObject({ normalized: '1/3', postedCount: 1 });
    expect(normalizeVideoProgress('posted 2', 4)).toMatchObject({ normalized: '2/4', postedCount: 2 });
    expect(normalizeVideoProgress('6 videos', 7)).toMatchObject({ normalized: '6/7', postedCount: 6 });
    expect(normalizeVideoProgress('10 of 10', 10)).toMatchObject({ normalized: '10/10', postedCount: 10 });
  });

  it('warns when progress looks like an Excel-converted date or invalid value using dynamic copy', () => {
    expect(normalizeVideoProgress(new Date('2026-01-02'), 3)).toMatchObject({ normalized: '', warning: buildVideoProgressWarning(3) });
    expect(normalizeVideoProgress('Jan 2, 2026', 5)).toMatchObject({ normalized: 'Jan 2, 2026', warning: buildVideoProgressWarning(5) });
    expect(normalizeVideoProgress('in progress', 7)).toMatchObject({ normalized: 'in progress', warning: buildVideoProgressWarning(7) });
  });

  it('warns but still normalizes when postedCount is greater than requiredVideos', () => {
    expect(normalizeVideoProgress('posted 6', 5)).toMatchObject({
      normalized: '6/5',
      postedCount: 6,
      requiredVideos: 5,
      warning: VIDEO_PROGRESS_OVER_REQUIRED_WARNING,
      isOverRequired: true,
    });
  });

  it('generates dynamic hints without a hard-coded 2-video list', () => {
    expect(buildVideoProgressHint(1)).toBe('视频进度建议填写 0 of 1、1 of 1，避免 Excel 自动转成日期。');
    expect(buildVideoProgressHint(3)).toBe('视频进度建议填写 0 of 3、1 of 3、2 of 3、3 of 3，避免 Excel 自动转成日期。');
    expect(buildVideoProgressHint(10)).toContain('9 of 10、10 of 10');
  });
});

describe('MVP SOP rules', () => {
  it('sorts creators by priority and summarizes daily follow-up counts for the default 2-video requirement', () => {
    const tasks = analyzeCreators([
      row({ id: 'low', username: 'low', currentStatus: 'Contacted', sampleShippingStatus: 'Pending', lastContactDate: '2026-06-03' }),
      row({ id: 'highest', username: 'highest', sampleShippingStatus: 'Delivered', sampleDeliveredDate: '2026-06-02', videoProgress: '0/2' }),
      row({ id: 'medium', username: 'medium', currentStatus: 'Followed Up', lastContactDate: '2026-06-04', videoProgress: '0/2' }),
      row({ id: 'high', username: 'high', videoProgress: '1/2', firstVideoPostedDate: '2026-06-04' }),
    ], today, 2);

    expect(tasks.map((task) => task.priority)).toEqual(['Highest', 'High', 'Medium', 'Low']);
    expect(buildSummary(tasks)).toMatchObject({ totalCreators: 4, needsFollowUp: 4, highest: 1, high: 1, medium: 1, low: 1 });
  });

  it.each([1, 3, 5, 7, 10])('keeps priority and task analysis populated for requiredVideos=%i', (requiredVideos) => {
    const tasks = analyzeCreators([
      row({ id: `zero-${requiredVideos}`, username: `zero-${requiredVideos}`, sampleShippingStatus: 'Delivered', sampleDeliveredDate: '2026-06-02', videoProgress: `0 of ${requiredVideos}` }),
      row({ id: `partial-${requiredVideos}`, username: `partial-${requiredVideos}`, videoProgress: `posted ${Math.max(0, requiredVideos - 1)}`, firstVideoPostedDate: '2026-06-04' }),
      row({ id: `complete-${requiredVideos}`, username: `complete-${requiredVideos}`, videoProgress: `${requiredVideos} videos`, firstVideoPostedDate: '2026-06-04' }),
    ], today, requiredVideos);

    expect(tasks).toHaveLength(3);
    expect(tasks.every((task) => task.triggerReason.length > 0 && task.suggestedAction.length > 0)).toBe(true);
    expect(tasks.find((task) => task.id === `zero-${requiredVideos}`)?.priority).toBe('Highest');
    expect(tasks.find((task) => task.id === `complete-${requiredVideos}`)?.needsFollowUp).toBe(false);
  });

  it('treats N of N as complete and 0 of N as incomplete', () => {
    const [incompleteTask] = analyzeCreators([
      row({ sampleShippingStatus: 'Delivered', sampleDeliveredDate: '2026-06-02', videoProgress: '0 of 7' }),
    ], today, 7);
    const [completeTask] = analyzeCreators([
      row({ videoProgress: '7 of 7', firstVideoPostedDate: '2026-06-04' }),
    ], today, 7);

    expect(incompleteTask.needsFollowUp).toBe(true);
    expect(incompleteTask.videoProgress).toBe('0/7');
    expect(completeTask.needsFollowUp).toBe(false);
    expect(completeTask.videoProgress).toBe('7/7');
  });

  it('mentions remaining video counts in dynamic follow-up actions', () => {
    const [task] = analyzeCreators([
      row({ videoProgress: '1 of 3', firstVideoPostedDate: '2026-06-04' }),
    ], today, 3);

    expect(task.priority).toBe('High');
    expect(task.suggestedAction).toContain('剩余 2 条视频');
  });

  it('warns over-required progress without blanking analysis', () => {
    const [task] = analyzeCreators([
      row({ videoProgress: 'posted 6', firstVideoPostedDate: '2026-06-04' }),
    ], today, 5);

    expect(task.videoProgress).toBe('6/5');
    expect(task.videoProgressWarning).toBe(VIDEO_PROGRESS_OVER_REQUIRED_WARNING);
    expect(task.failedWarnings).toContain(VIDEO_PROGRESS_OVER_REQUIRED_WARNING);
    expect(task.triggerReason).toBeTruthy();
  });

  it('keeps priority analysis stable when a blank manually added row exists', () => {
    const blankRow = createBlankCreatorRow('Manual Product', 4);
    const tasks = analyzeCreators([
      blankRow,
      row({ id: 'highest', username: 'highest', sampleShippingStatus: 'Delivered', sampleDeliveredDate: '2026-06-02', videoProgress: '0 of 4' }),
    ], today, 4);

    expect(tasks).toHaveLength(2);
    expect(tasks.find((task) => task.id === blankRow.id)).toMatchObject({
      username: '',
      product: 'Manual Product',
      videoProgress: '0/4',
      needsFollowUp: false,
      priority: 'None',
    });
    expect(tasks[0].id).toBe('highest');
  });

  it('uses sample delivered date as delivered evidence even when shipping status is stale', () => {
    const [task] = analyzeCreators([
      row({ currentStatus: 'To Contact', sampleShippingStatus: '', sampleDeliveredDate: '2026-06-02', videoProgress: '0 of 2' }),
    ], today, 2);

    expect(task.priority).toBe('Highest');
    expect(task.triggerReason).toContain('样品已到货 3 天');
    expect(task.currentStatus).toBe('To Contact');
  });

  it('does not treat shipped stale To Contact rows as contacted with no sample sent', () => {
    const [task] = analyzeCreators([
      row({ currentStatus: 'To Contact', sampleShippingStatus: 'Shipped', lastContactDate: '2026-06-01', videoProgress: '0 of 2' }),
    ], today, 2);

    expect(task.priority).toBe('None');
    expect(task.triggerReason).toBe('根据当前 MVP 规则，今天暂无必须跟进的任务。');
  });

  it('suggests failed candidates without changing status', () => {
    const [task] = analyzeCreators([
      row({ currentStatus: 'Delivered / Waiting for Video', sampleShippingStatus: 'Delivered', sampleDeliveredDate: '2026-05-28', videoProgress: '0/2' }),
    ], today, 2);

    expect(task.priority).toBe('Highest');
    expect(task.failedWarnings[0]).toContain('样品已到货 8 天');
    expect(task.currentStatus).toBe('Delivered / Waiting for Video');
  });
});
