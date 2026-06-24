import { CAMPAIGNS_STORAGE_KEY, createCampaignFromName, normalizeStoreId } from './campaignData';
import type { Campaign, CreatorRow } from './types';
import { CREATOR_ROWS_STORAGE_KEY } from './creatorData';
import { defaultCreatorFilmingRequirements } from './messageGenerator';

export const DEMO_MODE_FLAG_KEY = 'demo_appState';
export const DEMO_CREATOR_ROWS_STORAGE_KEY = 'demo_creatorRows';
export const DEMO_CAMPAIGNS_STORAGE_KEY = 'demo_campaignSettings';
export const DEMO_FILMING_REQUIREMENTS_STORAGE_KEY = 'demo_storeSettings';

export function isDemoRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.search.includes('demo=1') || window.location.pathname.endsWith('/demo');
}

export function isDemoModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return isDemoRoute() || window.localStorage.getItem(DEMO_MODE_FLAG_KEY) === 'demo';
}

const demoStores = ['Demo Store A', 'Demo Store B'];
const demoProducts = ['Demo Pet Brush', 'Demo Cat Toy Wand', 'Demo Dental Wipes'];
const demoStatuses = ['To Contact', 'Invited', 'Sample Shipped', 'Delivered', 'Waiting Video', 'Replied', 'Posted', 'Completed', 'Lost'];
const demoVideoProgress = ['0/1', '1/1', '2/1', '0/2', '1/2'];

export function createDemoCampaigns(): Campaign[] {
  return demoProducts.map((productName, index) => {
    const storeName = demoStores[index % demoStores.length];
    return {
      ...createCampaignFromName(productName, defaultCreatorFilmingRequirements, storeName, normalizeStoreId(undefined, storeName)),
      productName,
      sellingPoints: `Demo selling point for ${productName}.`,
      productLink: 'https://example.com/demo-product',
      referenceLinks: ['https://example.com/demo-product'],
      notes: 'Demo note: safe fake product settings.',
      tagRequirement: 'Demo requirement: attach a fake demo product card only.',
    };
  });
}

export function createDemoCreatorRows(): CreatorRow[] {
  const usernames = ['@demo_creator_001', '@sample_pet_account', '@ugc_demo_creator', '@demo_cat_owner', '@pet_video_sample', '@creator_example_06'];
  const campaigns = createDemoCampaigns();
  return usernames.map((username, index) => {
    const campaign = campaigns[index % campaigns.length];
    return {
      id: `demo-creator-${index + 1}`,
      username,
      profileLink: 'https://example.com/demo-creator',
      contactMethod: index % 2 === 0 ? 'TikTok DM' : 'Email',
      storeId: campaign.storeId,
      storeName: campaign.storeName,
      campaignId: campaign.id,
      product: campaign.productName,
      currentStatus: demoStatuses[index % demoStatuses.length],
      sampleShippingStatus: index % 3 === 0 ? 'Delivered' : index % 3 === 1 ? 'In Transit' : 'Not Shipped',
      sampleDeliveredDate: index % 2 === 0 ? '2026-06-20' : '',
      videoProgress: demoVideoProgress[index % demoVideoProgress.length],
      firstVideoPostedDate: index % 3 === 0 ? '2026-06-21' : '',
      latestVideoPostedDate: index % 3 === 0 ? '2026-06-22' : '',
      lastContactDate: '2026-06-20',
      lastFollowUpCount: index,
      notes: index % 2 === 0 ? 'Demo note: creator prefers short scripts.' : 'Demo note: sample delivered, waiting for video.',
      trackingStatus: index % 2 === 0 ? 'Reply Pending' : 'Replied',
      lastMessageScenario: 'Demo follow-up',
      lastMessageChannel: 'TikTok DM',
      lastMessageSentAt: '',
      lastHandledDate: '',
      nextFollowUpDate: '2026-06-24',
      lastCreatorResponse: 'Demo reply: I can post this week.',
      followUpHistory: [{ date: '2026-06-20', action: 'Message Sent', note: 'Demo note: fake workflow record.' }],
    };
  });
}

export function seedDemoData(storage: Storage = window.localStorage): void {
  if (!storage.getItem(DEMO_CREATOR_ROWS_STORAGE_KEY)) storage.setItem(DEMO_CREATOR_ROWS_STORAGE_KEY, JSON.stringify(createDemoCreatorRows()));
  if (!storage.getItem(DEMO_CAMPAIGNS_STORAGE_KEY)) storage.setItem(DEMO_CAMPAIGNS_STORAGE_KEY, JSON.stringify(createDemoCampaigns()));
  if (!storage.getItem(DEMO_FILMING_REQUIREMENTS_STORAGE_KEY)) storage.setItem(DEMO_FILMING_REQUIREMENTS_STORAGE_KEY, JSON.stringify({ ...defaultCreatorFilmingRequirements, productName: 'Demo Pet Brush', productLinkRequirement: 'Use https://example.com/demo-product only.' }));
}

export function resetDemoData(storage: Storage = window.localStorage): void {
  storage.setItem(DEMO_CREATOR_ROWS_STORAGE_KEY, JSON.stringify(createDemoCreatorRows()));
  storage.setItem(DEMO_CAMPAIGNS_STORAGE_KEY, JSON.stringify(createDemoCampaigns()));
  storage.setItem(DEMO_FILMING_REQUIREMENTS_STORAGE_KEY, JSON.stringify({ ...defaultCreatorFilmingRequirements, productName: 'Demo Pet Brush', productLinkRequirement: 'Use https://example.com/demo-product only.' }));
}

export function storageKeysForMode(isDemoMode: boolean) {
  return {
    creatorRows: isDemoMode ? DEMO_CREATOR_ROWS_STORAGE_KEY : CREATOR_ROWS_STORAGE_KEY,
    campaigns: isDemoMode ? DEMO_CAMPAIGNS_STORAGE_KEY : CAMPAIGNS_STORAGE_KEY,
    filmingRequirements: isDemoMode ? DEMO_FILMING_REQUIREMENTS_STORAGE_KEY : 'tiktokCreatorSop.filmingRequirements',
  };
}
