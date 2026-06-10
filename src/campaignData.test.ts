import { describe, expect, it } from 'vitest';
import { campaignToFilmingRequirements, createCampaignFromName, detectCampaignNames, mergeDetectedCampaigns } from './campaignData';
import { defaultCreatorFilmingRequirements } from './messageGenerator';
import type { CreatorRow } from './types';

function row(product: string): CreatorRow {
  return {
    id: product || 'missing',
    username: `creator-${product}`,
    profileLink: '',
    contactMethod: 'TikTok DM',
    product,
    currentStatus: 'Delivered',
    sampleShippingStatus: 'Delivered',
    sampleDeliveredDate: '2026-06-01',
    videoProgress: '0 of 2',
    firstVideoPostedDate: '',
    lastContactDate: '',
    lastFollowUpCount: 0,
    notes: '',
    trackingStatus: '',
    lastMessageScenario: '',
    lastMessageChannel: '',
    lastMessageSentAt: '',
    nextFollowUpDate: '',
    lastCreatorResponse: '',
    followUpHistory: [],
  };
}

describe('campaign data helpers', () => {
  it('detects unique product campaigns from uploaded creator rows', () => {
    expect(detectCampaignNames([row('宠物蒸汽梳毛器'), row('逗猫棒'), row('宠物蒸汽梳毛器'), row('')])).toEqual(['宠物蒸汽梳毛器', '逗猫棒']);
  });

  it('merges detected products into campaign objects with product-specific presets', () => {
    const campaigns = mergeDetectedCampaigns([], [row('宠物蒸汽梳毛器'), row('逗猫棒'), row('宠物清洁手套')], defaultCreatorFilmingRequirements);

    expect(campaigns.map((campaign) => campaign.productName)).toEqual(['宠物蒸汽梳毛器', '逗猫棒', '宠物清洁手套']);
    expect(campaigns.find((campaign) => campaign.productName === '逗猫棒')?.keyContentPoints).toContain('展示猫咪真实互动');
    expect(campaigns.find((campaign) => campaign.productName === '宠物清洁手套')?.requirements).toContain('每条视频 40 秒以上');
  });

  it('converts a campaign into isolated filming requirements for message generation', () => {
    const campaign = createCampaignFromName('逗猫棒', defaultCreatorFilmingRequirements);
    const requirements = campaignToFilmingRequirements({ ...campaign, referenceLinks: ['https://example.com/cat'] }, defaultCreatorFilmingRequirements);

    expect(requirements.productName).toBe('逗猫棒');
    expect(requirements.keyContentPoints).toContain('展示逗猫棒弹性');
    expect(requirements.referenceLinks).toEqual(['https://example.com/cat']);
  });
});
