import { describe, expect, it } from 'vitest';
import { analyzeCreators, buildSummary } from './sopRules';
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

  it('suggests failed candidates without changing status', () => {
    const [task] = analyzeCreators([
      row({ currentStatus: 'Delivered / Waiting for Video', sampleShippingStatus: 'Delivered', sampleDeliveredDate: '2026-05-28', videoProgress: '0/2' }),
    ], today);

    expect(task.priority).toBe('Highest');
    expect(task.failedWarnings[0]).toContain('Sample was delivered 8 days ago');
    expect(task.currentStatus).toBe('Delivered / Waiting for Video');
  });
});
