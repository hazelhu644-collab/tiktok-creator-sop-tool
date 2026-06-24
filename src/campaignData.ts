import { defaultCreatorFilmingRequirements, type CreatorFilmingRequirements } from './messageGenerator';
import type { CreatorRow, Campaign, Store } from './types';

export const CAMPAIGNS_STORAGE_KEY = 'tiktok-creator-sop-tool.campaigns.v1';
export const DEFAULT_STORE_ID = 'default-store';
export const DEFAULT_STORE_NAME = '默认店铺';
export const ALL_STORES = 'ALL_STORES';

export function storeIdFromName(name: string): string {
  const normalized = normalizeName(name) || DEFAULT_STORE_NAME;
  return normalized.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || encodeURIComponent(normalized);
}

export function normalizeStoreName(name: string | undefined): string {
  return normalizeName(name ?? '') || DEFAULT_STORE_NAME;
}

export function normalizeStoreId(id: string | undefined, name?: string): string {
  return normalizeName(id ?? '') || (normalizeStoreName(name) === DEFAULT_STORE_NAME ? DEFAULT_STORE_ID : storeIdFromName(normalizeStoreName(name)));
}

export function normalizeStore(input: { storeId?: string; storeName?: string }): Store {
  const storeName = normalizeStoreName(input.storeName);
  return { name: storeName, id: normalizeStoreId(input.storeId, storeName) };
}


const PRESET_REQUIREMENTS: Record<string, Partial<Campaign>> = {
  宠物蒸汽梳毛器: {
    sellingPoints: '蒸汽软化浮毛，梳毛同时收集毛发，日常护理场景自然。',
    requirements: ['每位达人 2 条视频', '每条视频 60 秒以上', '必须 tag 品牌账号', '必须挂 TikTok Shop 产品链接'],
    keyContentPoints: ['展示开雾', '展示梳毛过程', '展示收集毛发', '展示清理过程'],
    videoLength: '每条视频 60 秒以上',
    videoCount: '每位达人 2 条视频',
    tagRequirement: '必须 tag 品牌账号；必须挂 TikTok Shop 产品链接',
  },
  逗猫棒: {
    sellingPoints: '弹性互动强，铃铛和羽毛/尾巴细节适合展示猫咪真实反应。',
    requirements: ['每位达人 2 条视频', '必须挂 TikTok Shop 产品链接'],
    keyContentPoints: ['展示猫咪真实互动', '展示逗猫棒弹性', '展示铃铛细节', '展示羽毛/尾巴细节'],
    videoCount: '每位达人 2 条视频',
    tagRequirement: '必须挂 TikTok Shop 产品链接',
  },
  宠物清洁手套: {
    sellingPoints: '适合外出回家、饭后、日常清洁等前后对比场景。',
    requirements: ['每位达人 2 条视频', '每条视频 40 秒以上', '必须挂 TikTok Shop 产品链接'],
    keyContentPoints: ['展示清洁前后对比', '展示手套使用方式', '展示真实宠物护理场景'],
    videoLength: '每条视频 40 秒以上',
    videoCount: '每位达人 2 条视频',
    tagRequirement: '必须挂 TikTok Shop 产品链接',
  },
};

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function normalizeName(name: string): string {
  return name.trim();
}

export function campaignIdFromName(name: string): string {
  const normalized = normalizeName(name) || '未命名产品';
  return normalized.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || encodeURIComponent(normalized);
}

export function campaignIdentity(storeId: string, campaignId: string): string {
  return `${storeId}::${campaignId}`;
}

export function createCampaignFromName(name: string, fallback: CreatorFilmingRequirements = defaultCreatorFilmingRequirements, storeName = DEFAULT_STORE_NAME, storeId = normalizeStoreId(undefined, storeName)): Campaign {
  const productName = normalizeName(name) || fallback.productName;
  const preset = PRESET_REQUIREMENTS[productName] ?? {};
  return {
    id: campaignIdFromName(productName),
    storeId,
    storeName: normalizeStoreName(storeName),
    productName,
    sellingPoints: preset.sellingPoints ?? '',
    requirements: preset.requirements ?? fallback.requirements,
    keyContentPoints: preset.keyContentPoints ?? fallback.keyContentPoints,
    avoidShots: preset.avoidShots ?? '',
    videoCount: preset.videoCount ?? fallback.videoCount ?? String((preset.requirements ?? fallback.requirements).join('\n').match(/(\d+)\s*条视频/)?.[1] ?? '2'),
    videoLength: preset.videoLength ?? fallback.videoLength ?? ((preset.requirements ?? fallback.requirements).find((item) => item.includes('秒')) ?? ''),
    tagRequirement: preset.tagRequirement ?? fallback.productLinkRequirement ?? '必须挂 TikTok Shop 产品链接',
    productLink: preset.productLink ?? '',
    referenceLinks: preset.referenceLinks ?? fallback.referenceLinks ?? [],
    defaultMessageSetting: preset.defaultMessageSetting ?? '使用当前产品项目的拍摄要求、产品链接和参考视频生成英文达人话术。',
    notes: preset.notes ?? '',
  };
}

export function detectCampaignNames(rows: CreatorRow[]): Array<{ storeId: string; storeName: string; productName: string }> {
  const byIdentity = new Map<string, { storeId: string; storeName: string; productName: string }>();
  rows.forEach((row) => {
    const productName = row.product.trim();
    if (!productName) return;
    const storeName = normalizeStoreName(row.storeName);
    const storeId = normalizeStoreId(row.storeId, storeName);
    byIdentity.set(campaignIdentity(storeId, campaignIdFromName(productName)), { storeId, storeName, productName });
  });
  return Array.from(byIdentity.values());
}

export function loadCampaigns(storageKey = CAMPAIGNS_STORAGE_KEY): Campaign[] {
  const saved = storage()?.getItem(storageKey);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved) as Campaign[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.productName).map((item) => {
      const storeName = normalizeStoreName(item.storeName);
      const storeId = normalizeStoreId(item.storeId, storeName);
      return ({ ...createCampaignFromName(item.productName, defaultCreatorFilmingRequirements, storeName, storeId), ...item, storeId, storeName, id: item.id || campaignIdFromName(item.productName) });
    });
  } catch {
    storage()?.removeItem(storageKey);
    return [];
  }
}

export function saveCampaigns(campaigns: Campaign[], storageKey = CAMPAIGNS_STORAGE_KEY): void {
  const target = storage();
  if (!target) return;
  target.setItem(storageKey, JSON.stringify(campaigns));
}

export function mergeDetectedCampaigns(saved: Campaign[], rows: CreatorRow[], fallback: CreatorFilmingRequirements = defaultCreatorFilmingRequirements): Campaign[] {
  const byIdentity = new Map<string, Campaign>(saved.map((campaign) => {
    const storeName = normalizeStoreName(campaign.storeName);
    const storeId = normalizeStoreId(campaign.storeId, storeName);
    const normalized = { ...campaign, storeId, storeName, id: campaign.id || campaignIdFromName(campaign.productName) };
    return [campaignIdentity(storeId, normalized.id), normalized] as const;
  }));
  detectCampaignNames(rows).forEach(({ storeId, storeName, productName }) => {
    const key = campaignIdentity(storeId, campaignIdFromName(productName));
    if (!byIdentity.has(key)) byIdentity.set(key, createCampaignFromName(productName, fallback, storeName, storeId));
  });
  if (byIdentity.size === 0) byIdentity.set(campaignIdentity(DEFAULT_STORE_ID, campaignIdFromName(fallback.productName)), createCampaignFromName(fallback.productName, fallback));
  return Array.from(byIdentity.values());
}

export function campaignToFilmingRequirements(campaign: Campaign | undefined, fallback: CreatorFilmingRequirements): CreatorFilmingRequirements {
  if (!campaign) return fallback;
  const requiredScenes = (campaign.keyContentPoints ?? []).join('；') || fallback.requiredScenes;
  const requirements = [campaign.videoCount, campaign.videoLength, ...(campaign.requirements ?? []), campaign.tagRequirement]
    .filter((item): item is string => Boolean(item?.trim()));
  const referenceLinks = campaign.referenceLinks ?? fallback.referenceLinks ?? [];
  return {
    productName: campaign.productName || fallback.productName,
    requiredScenes,
    sellingPoints: campaign.sellingPoints || fallback.sellingPoints,
    videoLength: campaign.videoLength || fallback.videoLength,
    videoCount: campaign.videoCount || fallback.videoCount,
    avoidShots: campaign.avoidShots || fallback.avoidShots,
    productLinkRequirement: [campaign.tagRequirement, campaign.productLink].filter(Boolean).join('；') || fallback.productLinkRequirement,
    referenceVideoLinks: referenceLinks.join('\n') || fallback.referenceVideoLinks,
    requirements: requirements.length ? requirements : fallback.requirements,
    keyContentPoints: campaign.keyContentPoints?.length ? campaign.keyContentPoints : fallback.keyContentPoints,
    referenceLinks,
  };
}
