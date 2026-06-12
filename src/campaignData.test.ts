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
  it('keeps the eight campaign filming fields independent per product', () => {
    const petBrush = createCampaignFromName('Pet Brush', defaultCreatorFilmingRequirements);
    const catWand = createCampaignFromName('Cat Wand', defaultCreatorFilmingRequirements);
    petBrush.keyContentPoints = ['show brushing scene'];
    petBrush.sellingPoints = 'removes loose fur';
    petBrush.videoLength = '45 seconds+';
    petBrush.videoCount = '2 videos';
    petBrush.avoidShots = 'do not show unsafe use';
    petBrush.tagRequirement = 'attach product link';
    petBrush.referenceLinks = ['https://example.com/brush'];
    catWand.keyContentPoints = ['show cat jumping'];
    catWand.sellingPoints = 'interactive play';
    catWand.videoLength = '30 seconds+';
    catWand.videoCount = '1 video';
    catWand.avoidShots = 'do not force the cat';
    catWand.tagRequirement = 'attach wand product link';
    catWand.referenceLinks = ['https://example.com/wand'];

    const brushRequirements = campaignToFilmingRequirements(petBrush, defaultCreatorFilmingRequirements);
    const wandRequirements = campaignToFilmingRequirements(catWand, defaultCreatorFilmingRequirements);

    expect(brushRequirements).toMatchObject({
      productName: 'Pet Brush',
      requiredScenes: 'show brushing scene',
      sellingPoints: 'removes loose fur',
      videoLength: '45 seconds+',
      videoCount: '2 videos',
      avoidShots: 'do not show unsafe use',
      productLinkRequirement: 'attach product link',
      referenceVideoLinks: 'https://example.com/brush',
    });
    expect(wandRequirements.requiredScenes).toBe('show cat jumping');
    expect(wandRequirements.productLinkRequirement).toBe('attach wand product link');
    expect(wandRequirements.requiredScenes).not.toBe(brushRequirements.requiredScenes);
  });

});
