import { describe, expect, it } from 'vitest';
import { DEFAULT_CREATOR_FILMING_REQUIREMENTS } from './creatorData';
import { generateMessage } from './messageGenerator';
import type { Task } from './types';

const task: Task = {
  id: 'id',
  username: 'creator',
  profileLink: '',
  contactMethod: 'TikTok DM',
  product: 'Pet Water Fountain',
  currentStatus: '',
  sampleShippingStatus: 'Delivered',
  sampleDeliveredDate: '2026-06-01',
  videoProgress: '0/2',
  firstVideoPostedDate: '',
  lastContactDate: '',
  lastFollowUpCount: 0,
  notes: '',
  priority: 'Highest',
  priorityRank: 1,
  triggerReason: '',
  suggestedAction: '',
  failedWarnings: [],
  needsFollowUp: true,
};

describe('generateMessage', () => {
  it('uses editable filming requirements in generated messages', () => {
    const message = generateMessage(task, 'Email', {
      ...DEFAULT_CREATOR_FILMING_REQUIREMENTS,
      productName: 'Pet Water Fountain',
      videoCount: 3,
      videoDurationRequirement: 'each video should be 45+ seconds',
      brandTagRequirement: 'tag @waterbrand',
      productLinkRequirement: 'add the TikTok Shop product link',
      keyContentPoints: ['show quiet water flow', 'show pet drinking naturally'],
    });

    expect(message.english).toContain('Pet Water Fountain');
    expect(message.english).toContain('3 videos total');
    expect(message.english).toContain('show quiet water flow');
    expect(message.chineseExplanation).toContain('Pet Water Fountain');
  });
});
