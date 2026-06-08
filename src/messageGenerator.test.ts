import { describe, expect, it } from 'vitest';
import { defaultCreatorFilmingRequirements, generateMessage, type CreatorFilmingRequirements } from './messageGenerator';
import type { Task } from './types';

const chineseCharacterPattern = /[\u3400-\u9fff]/;

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

describe('generateMessage English copy readiness', () => {
  it('keeps Chinese text out of the English message while leaving the Chinese explanation below it', () => {
    const message = generateMessage(task(), 'TikTok Shop Affiliate Message', requirements({
      requirements: ['每位达人 3 条视频', '必须挂 TikTok Shop 产品链接', '必须 tag 品牌账号'],
      keyContentPoints: ['展示逗猫棒很好玩', '展示宠物真实反应'],
    }));

    expect(message.english).not.toMatch(chineseCharacterPattern);
    expect(message.english).toContain('show that the cat teaser is fun to use');
    expect(message.english).toContain('include the TikTok Shop product link');
    expect(message.english).not.toContain('达人拍摄要求');
    expect(message.english).not.toContain('每位达人');
    expect(message.chineseExplanation).toMatch(chineseCharacterPattern);
    expect(message.chineseExplanation).toContain('这条消息用于');
  });

  it('falls back to concise filming guideline wording instead of pasting unknown Chinese requirements', () => {
    const message = generateMessage(task(), 'Email', requirements({
      requirements: ['拍摄要求：请用中文保存的复杂要求'],
      keyContentPoints: ['内容重点：复杂中文卖点'],
    }));

    expect(message.english).not.toMatch(chineseCharacterPattern);
    expect(message.english).toContain('Please follow the filming guidelines we shared');
    expect(message.english).not.toContain('复杂中文卖点');
  });

  it('keeps normal sample-delivered reminders concise while mentioning filming guidelines lightly', () => {
    const message = generateMessage(task(), 'TikTok DM', requirements({ referenceLinks: [] }));

    expect(message.scenario).toBe('Sample Delivered Follow-up');
    expect(message.english).toContain('sample has been delivered');
    expect(message.english).toContain('Please follow the filming guidelines we shared');
    expect(message.english).toContain('expected posting date for the first video');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });
});

describe('generateMessage high-risk and final follow-up style', () => {
  it('does not paste full filming requirements in final follow-up messages', () => {
    const message = generateMessage(task({
      failedWarnings: ['达人已被跟进 2 次以上，但合作仍未完成。'],
      priority: 'Highest',
      lastFollowUpCount: 2,
    }), 'TikTok Shop Affiliate Message', requirements({
      requirements: ['每位达人 3 条视频', '每条视频 60 秒以上', '必须 tag 品牌账号', '必须挂 TikTok Shop 产品链接'],
      keyContentPoints: ['展示雾化功能', '展示梳下来的浮毛', '展示宠物真实反应', '展示自然的日常宠物护理场景'],
    }));

    expect(message.scenario).toBe('Final Follow-up Before Failed Candidate');
    expect(message.english).toContain('required video(s) are still incomplete');
    expect(message.english).toContain('confirm your expected posting date');
    expect(message.english).toContain('update the campaign status');
    expect(message.english).not.toContain('tag the brand account');
    expect(message.english).not.toContain('include the TikTok Shop product link');
    expect(message.english).not.toContain('show the mist feature');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('asks high-risk creators to confirm whether they can complete the collaboration and give a timeline', () => {
    const message = generateMessage(task({
      currentStatus: 'Followed Up',
      priority: 'Medium',
      priorityRank: 3,
      lastFollowUpCount: 2,
      failedWarnings: ['达人已被跟进 2 次以上，但合作仍未完成。'],
    }), 'Email');

    expect(message.english).toContain('still able to complete the remaining video(s)');
    expect(message.english).toContain('confirm your expected posting date');
    expect(message.english).toContain('If you’re no longer able to continue');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });
});

describe('generateMessage partial video completion follow-up', () => {
  it('uses partial completion follow-up for postedCount > 0 and postedCount < requiredVideos', () => {
    const message = generateMessage(task({
      currentStatus: 'Posted Video / Waiting for Next Video',
      priority: 'High',
      priorityRank: 2,
      videoProgress: '1 of 2',
      firstVideoPostedDate: '2026-06-04',
    }), 'TikTok Shop Affiliate Message');

    expect(message.scenario).toBe('Partial Video Completion Follow-up');
    expect(message.chineseExplanation).toContain('已发布部分视频，跟进剩余视频');
    expect(message.english).toContain('Thank you for posting the first video');
    expect(message.english).toContain('content looks good');
    expect(message.english).toContain('preparing to review it for ad testing');
    expect(message.english).toContain('Could you please confirm when you expect to post the remaining video?');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it.each([
    ['1 of 2', ['每位达人 2 条视频'], '1 remaining video'],
    ['1 of 3', ['每位达人 3 条视频'], '2 remaining videos'],
    ['4 of 5', ['每位达人 5 条视频'], '1 remaining video'],
  ])('uses a dynamic remaining count for %s', (videoProgress, requirementLines, expectedPhrase) => {
    const message = generateMessage(task({
      currentStatus: 'Posted Video / Waiting for Next Video',
      priority: 'High',
      priorityRank: 2,
      videoProgress,
      firstVideoPostedDate: '2026-06-04',
    }), 'Email', requirements({ requirements: requirementLines }));

    expect(message.scenario).toBe('Partial Video Completion Follow-up');
    expect(message.english).toContain(expectedPhrase);
    expect(message.english).toContain('Please confirm the expected posting date');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('keeps partial completion filming reminders light instead of listing every requirement or selling point', () => {
    const message = generateMessage(task({
      currentStatus: 'Posted Video / Waiting for Next Video',
      priority: 'High',
      priorityRank: 2,
      videoProgress: '1 of 3',
      firstVideoPostedDate: '2026-06-04',
    }), 'TikTok Shop Affiliate Message', requirements({
      requirements: ['每位达人 3 条视频', '每条视频 60 秒以上', '必须 tag 品牌账号', '必须挂 TikTok Shop 产品链接'],
      keyContentPoints: ['展示雾化功能', '展示梳下来的浮毛', '展示宠物真实反应'],
    }));

    expect(message.english).toContain('please keep following the filming guidelines');
    expect(message.english).toContain('TikTok Shop product link is attached');
    expect(message.english).not.toContain('keep each video at least 60 seconds');
    expect(message.english).not.toContain('tag the brand account');
    expect(message.english).not.toContain('show the mist feature');
  });

  it('includes reference links naturally and limits them to 3 for partial completion follow-ups', () => {
    const message = generateMessage(task({
      currentStatus: 'Posted Video / Waiting for Next Video',
      priority: 'High',
      priorityRank: 2,
      videoProgress: '1 of 3',
      firstVideoPostedDate: '2026-06-04',
    }), 'TikTok DM', requirements({
      requirements: ['每位达人 3 条视频'],
      referenceLinks: [
        'https://example.com/ref-1',
        'https://example.com/ref-2',
        'https://example.com/ref-3',
        'https://example.com/ref-4',
      ],
    }));

    expect(message.scenario).toBe('Partial Video Completion Follow-up');
    expect(message.english).toContain('You can also use these reference videos as direction for the next post');
    expect(message.english).toContain('https://example.com/ref-1');
    expect(message.english).toContain('https://example.com/ref-2');
    expect(message.english).toContain('https://example.com/ref-3');
    expect(message.english).not.toContain('https://example.com/ref-4');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('does not mention links for partial completion follow-ups when no reference links exist', () => {
    const message = generateMessage(task({
      currentStatus: 'Posted Video / Waiting for Next Video',
      priority: 'High',
      priorityRank: 2,
      videoProgress: '1 of 2',
      firstVideoPostedDate: '2026-06-04',
    }), 'TikTok Shop Affiliate Message', requirements({ referenceLinks: [] }));

    expect(message.english).not.toContain('reference videos');
  });
});

describe('generateMessage reference video links', () => {
  it('includes reference links and the Chinese explanation when links are present', () => {
    const message = generateMessage(task(), 'WhatsApp', requirements({
      referenceLinks: ['https://tiktok.com/ref-a', 'https://shop.tiktok.com/ref-b'],
    }));

    expect(message.english).toContain('Here are a few reference videos you can use for filming direction');
    expect(message.english).toContain('https://tiktok.com/ref-a');
    expect(message.english).toContain('https://shop.tiktok.com/ref-b');
    expect(message.chineseExplanation).toContain('参考视频链接用于给达人参考拍摄模板、内容灵感或后续视频优化方向');
  });

  it('does not mention reference links when none are present', () => {
    const message = generateMessage(task(), 'Email', requirements({ referenceLinks: [] }));

    expect(message.english).not.toContain('reference videos');
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

  it('uses lighter reference link wording for high-risk remaining-video follow-ups', () => {
    const message = generateMessage(task({
      failedWarnings: ['样品已到货 7 天，但视频进度仍为 0/2。'],
    }), 'TikTok Shop Affiliate Message', requirements({ referenceLinks: ['https://example.com/remaining-video'] }));

    expect(message.scenario).toBe('Final Follow-up Before Failed Candidate');
    expect(message.english).toContain('You can use the reference links as direction for the remaining video(s): https://example.com/remaining-video.');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('uses remaining-video wording for second-video follow-up scenarios', () => {
    const message = generateMessage(task({
      priority: 'High',
      priorityRank: 2,
      videoProgress: '1 of 2',
      triggerReason: '已发布 1 条，还需补第二条',
      suggestedAction: '提醒补发第二条视频',
    }), 'WhatsApp', requirements({ referenceLinks: ['https://example.com/remaining-video'] }));

    expect(message.scenario).toBe('Partial Video Completion Follow-up');
    expect(message.english).toContain('remaining video');
    expect(message.english).toContain('You can also use these reference videos as direction for the next post');
    expect(message.english).toContain('https://example.com/remaining-video');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });
});
