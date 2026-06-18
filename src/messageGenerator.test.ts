import { describe, expect, it } from 'vitest';
import { classifyCreatorFollowUp, defaultCreatorFilmingRequirements, generateMessage, type CreatorFilmingRequirements } from './messageGenerator';
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
    priority: 'High',
    priorityRank: 1,
    stageRank: 2,
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
      priority: 'High',
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

describe('generateMessage status-aware communication center scenarios', () => {
  it('generates first outreach for To Contact creators', () => {
    const message = generateMessage(task({
      currentStatus: 'To Contact',
      sampleShippingStatus: '',
      sampleDeliveredDate: '',
      priority: 'None',
      priorityRank: 99,
      needsFollowUp: false,
    }), 'Email');

    expect(message.scenario).toBe('First Outreach');
    expect(message.scenarioReason).toContain('首次合作介绍话术');
    expect(message.english).toContain('potential collaboration');
    expect(message.english).toContain('If you’re interested');
    expect(message.english).not.toContain('delivered');
    expect(message.english).not.toMatch(chineseCharacterPattern);
    expect(message.chineseExplanation).toMatch(chineseCharacterPattern);
  });

  it('generates shipment-in-progress copy for Sample Shipped or In Transit creators', () => {
    const message = generateMessage(task({
      currentStatus: 'Sample Shipped',
      sampleShippingStatus: 'In Transit',
      sampleDeliveredDate: '',
      priority: 'None',
      priorityRank: 99,
      needsFollowUp: false,
    }), 'TikTok DM');

    expect(message.scenario).toBe('Sample In Transit Reminder');
    expect(message.scenarioReason).toContain('物流状态为 In Transit');
    expect(message.english).toContain('sample is on the way');
    expect(message.english).toContain('No posting is needed before the sample is delivered');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('does not generate final confirmation for Sample Shipped + In Transit before delivery', () => {
    const inTransitTask = task({
      currentStatus: 'Sample Shipped',
      sampleShippingStatus: 'In Transit',
      sampleDeliveredDate: '',
      videoProgress: '0 of 2',
      priority: 'High',
      lastFollowUpCount: 3,
      failedWarnings: ['达人已被跟进 2 次以上，但合作仍未完成。'],
    });
    const message = generateMessage(inTransitTask, 'TikTok Shop Affiliate Message');

    expect(message.communicationAction).toBe('确认物流 / 是否签收');
    expect(message.urgencyLevel).toBe('高');
    expect(message.scenario).toBe('Logistics Exception Confirmation');
    expect(message.scenario).not.toBe('Final Follow-up Before Failed Candidate');
    expect(message.english).not.toContain('required video(s) are still incomplete');
    expect(message.english).not.toContain('still able to complete the remaining video(s)');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('does not generate remaining video fulfillment for Sample Shipped + In Transit before delivery', () => {
    const message = generateMessage(task({
      currentStatus: 'Sample Shipped',
      sampleShippingStatus: 'In Transit',
      sampleDeliveredDate: '',
      videoProgress: '1 of 2',
      firstVideoPostedDate: '2026-06-04',
      priority: 'High',
      priorityRank: 2,
    }), 'TikTok DM');

    expect(message.communicationAction).toBe('样品运输中，提前沟通拍摄要求');
    expect(message.scenario).toBe('Sample In Transit Reminder');
    expect(message.scenario).not.toBe('Partial Video Completion Follow-up');
    expect(message.english).not.toContain('remaining video');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('uses logistics confirmation instead of final confirmation when in-transit follow-up count is high', () => {
    const message = generateMessage(task({
      currentStatus: 'Sample Shipped',
      sampleShippingStatus: 'In Transit',
      sampleDeliveredDate: '',
      videoProgress: '0/2',
      priority: 'High',
      lastFollowUpCount: 2,
      failedWarnings: [],
    }), 'Email');

    expect(message.urgencyLevel).toBe('高');
    expect(message.communicationAction).toBe('确认物流 / 是否签收');
    expect(message.scenario).toBe('Logistics Exception Confirmation');
    expect(message.scenarioReason).toContain('需要优先确认物流 / 是否签收');
    expect(message.english).toContain('confirm whether you have received it or seen any delivery updates');
    expect(message.english).not.toContain('If you’re no longer able to continue');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('keeps extreme urgency for in-transit risk but classifies action as logistics confirmation', () => {
    const classification = classifyCreatorFollowUp(task({
      currentStatus: 'Sample Shipped',
      sampleShippingStatus: 'In Transit',
      sampleDeliveredDate: '',
      videoProgress: '0/2',
      priority: 'High',
      priorityRank: 1,
      lastFollowUpCount: 1,
    }));

    expect(classification.urgencyLevel).toBe('高');
    expect(classification.communicationAction).toBe('样品运输中，提前沟通拍摄要求');
    expect(classification.reason).toContain('提前沟通拍摄要求');
  });

  it('classifies Delivered + 0/N as sample-delivered filming follow-up without high-risk pressure', () => {
    const message = generateMessage(task({
      currentStatus: 'Delivered / Waiting for Video',
      sampleShippingStatus: 'Delivered',
      sampleDeliveredDate: '',
      videoProgress: '0 of 2',
      failedWarnings: [],
      lastFollowUpCount: 0,
      priority: 'None',
    }), 'TikTok DM');

    expect(message.communicationAction).toBe('样品到货催拍');
    expect(message.scenario).toBe('Sample Delivered Follow-up');
    expect(message.english).toContain('sample has been delivered');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('allows Delivered + high follow-up count + 0/N to generate final confirmation', () => {
    const message = generateMessage(task({
      currentStatus: 'Delivered / Waiting for Video',
      sampleShippingStatus: 'Delivered',
      sampleDeliveredDate: '2026-06-02',
      videoProgress: '0 of 2',
      lastFollowUpCount: 2,
      failedWarnings: ['达人已被跟进 2 次以上，但合作仍未完成。'],
    }), 'TikTok Shop Affiliate Message');

    expect(message.communicationAction).toBe('最后确认');
    expect(message.scenario).toBe('Final Follow-up Before Failed Candidate');
    expect(message.english).toContain('required video(s) are still incomplete');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('generates filming reminder copy for Delivered / Waiting for Video creators', () => {
    const message = generateMessage(task({
      currentStatus: 'Delivered / Waiting for Video',
      sampleShippingStatus: 'Delivered',
      videoProgress: '0 of 2',
      failedWarnings: [],
      lastFollowUpCount: 0,
    }), 'TikTok Shop Affiliate Message', requirements({ referenceLinks: ['https://example.com/ref'] }));

    expect(message.scenario).toBe('Sample Delivered Follow-up');
    expect(message.english).toContain('sample has been delivered');
    expect(message.english).toContain('expected posting date for the first video');
    expect(message.english).toContain('filming guidelines');
    expect(message.english).toContain('https://example.com/ref');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('generates remaining-video follow-up for partial video completion', () => {
    const message = generateMessage(task({
      currentStatus: 'Posted Video / Waiting for Next Video',
      videoProgress: '1 of 3',
      priority: 'High',
      priorityRank: 2,
      firstVideoPostedDate: '2026-06-04',
      failedWarnings: [],
    }), 'Email', requirements({ requirements: ['每位达人 3 条视频'] }));

    expect(message.scenario).toBe('Partial Video Completion Follow-up');
    expect(message.english).toContain('preparing to review it for ad testing');
    expect(message.english).toContain('2 remaining videos');
    expect(message.english).toContain('expected posting date');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('generates thank-you and future collaboration copy for Completed creators', () => {
    const message = generateMessage(task({
      currentStatus: 'Completed',
      videoProgress: '2 of 2',
      priority: 'None',
      priorityRank: 99,
      needsFollowUp: false,
    }), 'WhatsApp');

    expect(message.scenario).toBe('Completed Thank You');
    expect(message.english).toContain('Thank you for completing');
    expect(message.english).toContain('review performance');
    expect(message.english).toContain('future campaign opportunities');
    expect(message.english).not.toContain('remaining video');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it.each(['Shipped', 'In Transit'])('lets %s shipping override stale To Contact status', (sampleShippingStatus) => {
    const message = generateMessage(task({
      currentStatus: 'To Contact',
      sampleShippingStatus,
      sampleDeliveredDate: '',
      videoProgress: '0 of 2',
      priority: 'None',
      priorityRank: 99,
      needsFollowUp: false,
    }), 'TikTok Shop Affiliate Message', requirements({ referenceLinks: ['https://example.com/ref-1', 'https://example.com/ref-2', 'https://example.com/ref-3', 'https://example.com/ref-4'] }));

    expect(message.scenario).toBe('Sample In Transit Reminder');
    expect(message.scenarioReason).toContain('物流状态已发货/运输中');
    expect(message.english).toContain('has been shipped and is currently on the way');
    expect(message.english).toContain('plan the content in advance');
    expect(message.english).toContain('when you expect to start filming after receiving the sample');
    expect(message.english).toContain('TikTok Shop product link');
    expect(message.english).toContain('https://example.com/ref-1');
    expect(message.english).toContain('https://example.com/ref-3');
    expect(message.english).not.toContain('https://example.com/ref-4');
    expect(message.english).not.toContain('If you’re interested');
    expect(message.english).not.toContain('potential collaboration');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('lets Delivered shipping override stale To Contact status for 0/N video progress', () => {
    const message = generateMessage(task({
      currentStatus: 'To Contact',
      sampleShippingStatus: 'Delivered',
      sampleDeliveredDate: '',
      videoProgress: '0 of 2',
      failedWarnings: [],
      lastFollowUpCount: 0,
    }), 'TikTok Shop Affiliate Message');

    expect(message.scenario).toBe('Sample Delivered Follow-up');
    expect(message.scenarioReason).toContain('物流状态为 Delivered');
    expect(message.english).toContain('sample has been delivered');
    expect(message.english).toContain('expected posting date for the first video');
    expect(message.english).not.toContain('If you’re interested');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('does not let a lone arrival date override stale To Contact without delivered logistics status', () => {
    const message = generateMessage(task({
      currentStatus: 'To Contact',
      sampleShippingStatus: '',
      sampleDeliveredDate: '2026-06-03',
      videoProgress: '0 of 2',
      failedWarnings: [],
      lastFollowUpCount: 0,
    }), 'Email');

    expect(message.scenario).toBe('First Outreach');
    expect(message.english).toContain('potential collaboration');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('keeps stale To Contact with Not Shipped as first outreach', () => {
    const message = generateMessage(task({
      currentStatus: 'To Contact',
      sampleShippingStatus: 'Not Shipped',
      sampleDeliveredDate: '',
      videoProgress: '0 of 2',
      priority: 'None',
      priorityRank: 99,
      needsFollowUp: false,
    }), 'TikTok DM');

    expect(message.scenario).toBe('First Outreach');
    expect(message.english).toContain('potential collaboration');
    expect(message.english).toContain('If you’re interested');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });
  it('generates non-pushy archive confirmation for Failed creators', () => {
    const message = generateMessage(task({
      currentStatus: 'Failed',
      priority: 'None',
      priorityRank: 99,
      failedWarnings: ['达人已被跟进 2 次以上，但合作仍未完成。'],
      needsFollowUp: false,
    }), 'TikTok Shop Affiliate Message');

    expect(message.scenario).toBe('Failed Archive Confirmation');
    expect(message.english).toContain('updating the campaign status');
    expect(message.english).toContain('archive this campaign as not completed');
    expect(message.english).not.toContain('Please let us know if you’re still able to complete');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });
});

describe('creator reply follow-up generator', () => {
  it('classifies replied creators with saved notes as reply messages instead of archived work', () => {
    const classification = classifyCreatorFollowUp(task({
      currentStatus: 'Sample Delivered',
      trackingStatus: 'Replied',
      lastCreatorResponse: 'The 60 seconds requirement is too long for me.',
      priority: 'None',
      priorityRank: 99,
      needsFollowUp: false,
    }));

    expect(classification.communicationAction).toBe('回复达人消息');
    expect(classification.urgencyLevel).toBe('高');
  });


  it('classifies replied creators from the latest Creator Replied history note even without lastCreatorResponse', () => {
    const classification = classifyCreatorFollowUp(task({
      trackingStatus: 'Replied',
      lastCreatorResponse: '',
      followUpHistory: [{ date: '2026-06-09', action: 'Creator Replied', note: 'I can post Friday.' }],
    }));

    expect(classification.communicationAction).toBe('回复达人消息');
  });

  it('generates an English-only reply that responds to the saved creator reply note', () => {
    const message = generateMessage(task({
      trackingStatus: 'Replied',
      lastCreatorResponse: 'The video length is too long. Can it be shorter?',
      currentStatus: 'Sample Delivered',
    }), 'TikTok DM');

    expect(message.communicationAction).toBe('回复达人消息');
    expect(message.scenario).toBe('Creator Reply Follow-up');
    expect(message.english).toContain('video length');
    expect(message.english).toContain('60-second direction');
    expect(message.english).toContain('ad testing');
    expect(message.english).not.toMatch(chineseCharacterPattern);
    expect(message.chineseExplanation).toContain('这个话术用于达人已经回复后继续推进沟通');
  });

  it('uses optional reply focus while keeping the generated English message free of Chinese characters', () => {
    const message = generateMessage(task({
      trackingStatus: 'Replied',
      lastCreatorResponse: 'I can post this Friday.',
      currentStatus: 'Sample Delivered',
    }), 'Email', requirements(), '同意她周五发布，提醒挂车');

    expect(message.english).toContain('Friday');
    expect(message.english).toContain('product link');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('uses the latest saved creator reply from follow-up history before older reply fields', () => {
    const message = generateMessage(task({
      trackingStatus: 'Replied',
      lastCreatorResponse: 'Old reply: I can post Friday.',
      followUpHistory: [
        { date: '2026-06-08', action: 'Creator Replied', note: 'I cannot continue.' },
      ],
    }), 'TikTok DM');

    expect(message.english).toContain('update the campaign status');
    expect(message.english).not.toContain('Friday');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('uses relationship notes, friendly tone, reply goal, and Chinese focus to confirm an end-of-week timeline', () => {
    const message = generateMessage(task({
      username: 'creator',
      trackingStatus: 'Replied',
      lastCreatorResponse: 'Hi thank you for understanding ill get a video done at the end of week',
    }), 'TikTok DM', requirements(), '没问题，我这里记录一下。顺利', {
      relationshipNote: '她之前沟通还可以，保持专业友好',
      replyTone: '友好一点',
      replyGoal: '确认发布时间',
    });

    expect(message.english.toLowerCase()).toContain('thank you for the update');
    expect(message.english).toContain('by the end of this week');
    expect(message.english).toContain('I appreciate the communication');
    expect(message.english).toContain('Looking forward to seeing the content');
    expect(message.english).not.toContain('clearest next update');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('uses a firm tone to make the expected next action clearer', () => {
    const message = generateMessage(task({
      trackingStatus: 'Replied',
      lastCreatorResponse: 'I can post Friday.',
    }), 'TikTok DM', requirements(), '', { replyTone: '坚定推进' });

    expect(message.english).toContain('Please keep this timeline');
    expect(message.english).toContain('Friday');
  });

  it('uses reply goal and acceptable concession for video length clarification', () => {
    const message = generateMessage(task({
      trackingStatus: 'Replied',
      lastCreatorResponse: '60 seconds is too long.',
    }), 'TikTok DM', requirements(), '', {
      replyGoal: '解释 60 秒要求',
      acceptableConcession: '可以短一点，但不能低于 35 秒',
    });

    expect(message.english).toContain('video length');
    expect(message.english).toContain('above 35 seconds');
    expect(message.english).toContain('key product use');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('generates logistics response when the package has not arrived', () => {
    const message = generateMessage(task({
      trackingStatus: 'Replied',
      lastCreatorResponse: "I haven't received it yet.",
      sampleShippingStatus: 'In Transit',
      sampleDeliveredDate: '',
    }), 'TikTok DM');

    expect(message.english).toContain('delivery updates');
    expect(message.english).toContain('shipping issue');
    expect(message.english).toContain('No need to start filming');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('summarizes filming requirements and reference links when the creator asks what to film', () => {
    const message = generateMessage(task({
      trackingStatus: 'Replied',
      lastCreatorResponse: 'What should I film? Any brief?',
    }), 'TikTok DM', requirements({ referenceLinks: ['https://example.com/ref-video'] }));

    expect(message.english).toContain('main filming direction');
    expect(message.english).toContain('show the main product use case');
    expect(message.english).toContain('https://example.com/ref-video');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('generates neutral campaign status response when creator cannot continue', () => {
    const message = generateMessage(task({
      trackingStatus: 'Replied',
      lastCreatorResponse: "I can't continue.",
    }), 'TikTok DM', requirements(), '', { replyTone: '最后确认' });

    expect(message.english).toContain('update the campaign status');
    expect(message.english).toContain('No further action is needed');
    expect(message.english).not.toMatch(/please keep filming|expected posting date/i);
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('still works without personalization fields filled', () => {
    const message = generateMessage(task({
      trackingStatus: 'Replied',
      lastCreatorResponse: 'Thanks, I will get the video done tomorrow.',
    }), 'TikTok Shop Affiliate Message');

    expect(message.english).toContain('tomorrow');
    expect(message.english).toContain('product link');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

});

describe('creator reply local intent mapping', () => {
  function replyTask(reply = 'No problem!'): Task {
    return task({
      currentStatus: 'Sample Delivered',
      trackingStatus: 'Replied',
      lastCreatorResponse: reply,
      followUpHistory: [{ date: '2026-06-09', action: 'Creator Replied', note: reply }],
    });
  }

  it('maps Chinese 具体时间 focus to an estimated posting date request', () => {
    const message = generateMessage(replyTask(), 'TikTok DM', requirements(), '有没有具体时间');

    expect(message.scenario).toBe('Creator Reply Follow-up');
    expect(message.english).toContain('estimated posting date');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('maps Chinese 投流 and 投放计划 focus to ad testing and boost planning', () => {
    const message = generateMessage(replyTask(), 'TikTok DM', requirements(), '方便团队安排投流和投放计划');

    expect(message.english).toContain('ad testing');
    expect(message.english).toContain('boost timing');
    expect(message.english).toContain('campaign planning');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('maps Chinese 记录 focus to noting the update on our side', () => {
    const message = generateMessage(replyTask(), 'TikTok DM', requirements(), '我这里记录一下');

    expect(message.english).toContain('note this on our side');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('maps Chinese 期待 focus to a natural appreciative reply', () => {
    const message = generateMessage(replyTask(), 'TikTok DM', requirements(), '期待你拍的视频，谢谢');

    expect(message.english).toContain('thank you for the update');
    expect(message.english).toContain('looking forward to seeing the content');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('combines looking-forward, posting-date, and ad-planning intents without generic fallback', () => {
    const message = generateMessage(replyTask(), 'TikTok DM', requirements(), '期待你拍的视频，有没有具体的时间让我流团队安排投放计划');

    expect(message.english).toContain('looking forward to seeing the content');
    expect(message.english).toContain('estimated posting date');
    expect(message.english).toMatch(/ad testing|campaign planning/);
    expect(message.english).not.toContain('Please reply with the clearest next update');
    expect(message.english).not.toContain('This helps us keep the collaboration timeline clear');
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it('generates distinct channel-specific creator replies', () => {
    const baseTask = replyTask('No problem!');
    const focus = '期待你拍的视频，有没有具体的时间让我团队安排投流计划';
    const affiliate = generateMessage(baseTask, 'TikTok Shop Affiliate Message', requirements(), focus).english;
    const dm = generateMessage(baseTask, 'TikTok DM', requirements(), focus).english;
    const email = generateMessage(baseTask, 'Email', requirements(), focus).english;
    const whatsapp = generateMessage(baseTask, 'WhatsApp', requirements(), focus).english;

    expect(new Set([affiliate, dm, email, whatsapp]).size).toBe(4);
    expect(affiliate).toContain('Thank you.');
    expect(email).toContain('Best,');
    expect(dm.length).toBeLessThan(email.length);
    expect(whatsapp.length).toBeLessThan(email.length);
    [affiliate, dm, email, whatsapp].forEach((text) => expect(text).not.toMatch(chineseCharacterPattern));
  });

});
