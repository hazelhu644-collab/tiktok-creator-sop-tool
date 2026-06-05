import { describe, expect, it } from 'vitest';
import { defaultCreatorFilmingRequirements, generateMessage, type CreatorFilmingRequirements } from './messageGenerator';
import type { Task } from './types';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'creator-1',
    username: 'fluffy_creator',
    profileLink: '',
    contactMethod: 'TikTok DM',
    product: '蒸汽梳毛器',
    currentStatus: 'Sample Delivered',
    sampleShippingStatus: 'Delivered',
    sampleDeliveredDate: '2026-06-02',
    videoProgress: '0 of 2',
    firstVideoPostedDate: '',
    lastContactDate: '2026-06-01',
    lastFollowUpCount: 0,
    notes: '',
    priority: 'Highest',
    priorityRank: 1,
    triggerReason: '样品已到货 3 天但未发视频',
    suggestedAction: '催拍第一条视频',
    failedWarnings: [],
    needsFollowUp: true,
    ...overrides,
  };
}

function requirements(overrides: Partial<CreatorFilmingRequirements> = {}): CreatorFilmingRequirements {
  return {
    ...defaultCreatorFilmingRequirements,
    ...overrides,
  };
}

describe('generateMessage reference video links', () => {
  it('includes reference links and the Chinese explanation when links are present', () => {
    const message = generateMessage(task(), 'WhatsApp', requirements({
      referenceLinks: ['https://tiktok.com/ref-a', 'https://shop.tiktok.com/ref-b'],
    }));

    expect(message.english).toContain('Here are a few reference videos you can use for filming inspiration');
    expect(message.english).toContain('https://tiktok.com/ref-a');
    expect(message.english).toContain('https://shop.tiktok.com/ref-b');
    expect(message.english).toContain('for reference only');
    expect(message.chineseExplanation).toContain('参考视频链接用于给达人参考拍摄模板、内容灵感或后续视频优化方向');
  });

  it('does not mention reference links when none are present', () => {
    const message = generateMessage(task(), 'Email', requirements({ referenceLinks: [] }));

    expect(message.english).not.toContain('reference videos');
    expect(message.english).not.toContain('for reference only');
    expect(message.chineseExplanation).not.toContain('参考视频链接用于');
  });

  it('includes only up to 3 links in the English message', () => {
    const message = generateMessage(task(), 'WhatsApp', requirements({
      referenceLinks: [
        'https://example.com/ref-1',
        'https://example.com/ref-2',
        'https://example.com/ref-3',
        'https://example.com/ref-4',
      ],
    }));

    expect(message.english).toContain('https://example.com/ref-1');
    expect(message.english).toContain('https://example.com/ref-2');
    expect(message.english).toContain('https://example.com/ref-3');
    expect(message.english).not.toContain('https://example.com/ref-4');
  });

  it('uses remaining-video wording for second-video follow-up scenarios', () => {
    const message = generateMessage(task({
      priority: 'High',
      priorityRank: 2,
      videoProgress: '1 of 2',
      triggerReason: '已发布 1 条，还需补第二条',
      suggestedAction: '提醒补发第二条视频',
    }), 'WhatsApp', requirements({ referenceLinks: ['https://example.com/remaining-video'] }));

    expect(message.scenario).toBe('Second Video Reminder');
    expect(message.english).toContain('as direction for the next video');
    expect(message.english).toContain('https://example.com/remaining-video');
  });

  it('keeps existing message generator behavior without reference links', () => {
    const message = generateMessage(task(), 'TikTok DM', requirements({ referenceLinks: [] }));

    expect(message.scenario).toBe('Sample Delivered Follow-up');
    expect(message.english).toContain('Hi @fluffy_creator');
    expect(message.english).toContain('sample has been delivered');
    expect(message.english).toContain('creator filming requirements');
    expect(message.chineseExplanation).toContain('语气保持专业、温和、直接');
  });
});
