import { describe, expect, it } from 'vitest';
import { analyzeCreators, buildSummary, normalizeVideoProgress, VIDEO_PROGRESS_WARNING } from './sopRules';
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

describe('video progress normalization', () => {
  it('keeps the original slash progress formats', () => {
    expect(normalizeVideoProgress('0/2')).toEqual({ normalized: '0/2' });
    expect(normalizeVideoProgress('1/2')).toEqual({ normalized: '1/2' });
    expect(normalizeVideoProgress('2/2')).toEqual({ normalized: '2/2' });
  });

  it('supports safer non-date progress formats', () => {
    expect(normalizeVideoProgress('0 of 2')).toEqual({ normalized: '0/2' });
    expect(normalizeVideoProgress('1 of 2')).toEqual({ normalized: '1/2' });
    expect(normalizeVideoProgress('2 of 2')).toEqual({ normalized: '2/2' });
    expect(normalizeVideoProgress('0 videos')).toEqual({ normalized: '0/2' });
    expect(normalizeVideoProgress('1 video')).toEqual({ normalized: '1/2' });
    expect(normalizeVideoProgress('2 videos')).toEqual({ normalized: '2/2' });
    expect(normalizeVideoProgress('posted 0')).toEqual({ normalized: '0/2' });
    expect(normalizeVideoProgress('posted 1')).toEqual({ normalized: '1/2' });
    expect(normalizeVideoProgress('posted 2')).toEqual({ normalized: '2/2' });
  });

  it('warns when progress looks like an Excel-converted date or invalid value', () => {
    expect(normalizeVideoProgress(new Date('2026-01-02'))).toEqual({ normalized: '', warning: VIDEO_PROGRESS_WARNING });
    expect(normalizeVideoProgress('Jan 2, 2026')).toEqual({ normalized: 'Jan 2, 2026', warning: VIDEO_PROGRESS_WARNING });
    expect(normalizeVideoProgress('in progress')).toEqual({ normalized: 'in progress', warning: VIDEO_PROGRESS_WARNING });
  });
});

describe('MVP SOP rules', () => {
  it('sorts creators by priority and summarizes daily follow-up counts', () => {
    const tasks = analyzeCreators([
      row({ id: 'low', username: 'low', currentStatus: 'Contacted', sampleShippingStatus: 'Pending', lastContactDate: '2026-06-03' }),
      row({ id: 'highest', username: 'highest', sampleShippingStatus: 'Delivered', sampleDeliveredDate: '2026-06-02', videoProgress: '0/2' }),
      row({ id: 'medium', username: 'medium', currentStatus: 'Followed Up', lastContactDate: '2026-06-04', videoProgress: '0/2' }),
      row({ id: 'high', username: 'high', videoProgress: '1/2', firstVideoPostedDate: '2026-06-04' }),
    ], today);

    expect(tasks.map((task) => task.priority)).toEqual(['Highest', 'High', 'Medium', 'Low']);
    expect(buildSummary(tasks)).toMatchObject({ totalCreators: 4, needsFollowUp: 4, highest: 1, high: 1, medium: 1, low: 1 });
  });

  it('treats safer one-video progress values as High priority', () => {
    const tasks = analyzeCreators([
      row({ id: 'one-of-two', username: 'one-of-two', videoProgress: '1 of 2', firstVideoPostedDate: '2026-06-04' }),
      row({ id: 'one-video', username: 'one-video', videoProgress: '1 video', firstVideoPostedDate: '2026-06-04' }),
    ], today);

    expect(tasks.map((task) => task.priority)).toEqual(['High', 'High']);
    expect(tasks.map((task) => task.videoProgress)).toEqual(['1/2', '1/2']);
  });

  it('suggests failed candidates without changing status', () => {
    const [task] = analyzeCreators([
      row({ currentStatus: 'Delivered / Waiting for Video', sampleShippingStatus: 'Delivered', sampleDeliveredDate: '2026-05-28', videoProgress: '0/2' }),
    ], today);

    expect(task.priority).toBe('Highest');
    expect(task.failedWarnings[0]).toContain('样品已到货 8 天');
    expect(task.currentStatus).toBe('Delivered / Waiting for Video');
  });
});
