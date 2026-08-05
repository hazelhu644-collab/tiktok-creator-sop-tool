import {
  defaultCreatorFilmingRequirements,
  type CreatorFilmingRequirements,
} from "./messageGenerator";
import { demoCampaigns, isDemoMode } from "./demoMode";
import type { CreatorRow, Campaign, Store } from "./types";

export const CAMPAIGNS_STORAGE_KEY = "tiktok-creator-sop-tool.campaigns.v1";
export const DEFAULT_STORE_ID = "default-store";
export const DEFAULT_STORE_NAME = "默认店铺";
export const ALL_STORES = "ALL_STORES";

export function storeIdFromName(name: string): string {
  const normalized = normalizeName(name) || DEFAULT_STORE_NAME;
  return (
    normalized
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "") || encodeURIComponent(normalized)
  );
}

export function normalizeStoreName(name: string | undefined): string {
  return normalizeName(name ?? "") || DEFAULT_STORE_NAME;
}

export function normalizeStoreId(
  id: string | undefined,
  name?: string,
): string {
  return (
    normalizeName(id ?? "") ||
    (normalizeStoreName(name) === DEFAULT_STORE_NAME
      ? DEFAULT_STORE_ID
      : storeIdFromName(normalizeStoreName(name)))
  );
}

export function normalizeStore(input: {
  storeId?: string;
  storeName?: string;
}): Store {
  const storeName = normalizeStoreName(input.storeName);
  return { name: storeName, id: normalizeStoreId(input.storeId, storeName) };
}

const PRESET_REQUIREMENTS: Record<string, Partial<Campaign>> = {
  宠物蒸汽梳毛器: {
    sellingPoints: "蒸汽软化浮毛，梳毛同时收集毛发，日常护理场景自然。",
    requirements: [
      "每位达人 2 条视频",
      "每条视频 60 秒以上",
      "必须 tag 品牌账号",
      "必须挂 TikTok Shop 产品链接",
    ],
    keyContentPoints: [
      "展示开雾",
      "展示梳毛过程",
      "展示收集毛发",
      "展示清理过程",
    ],
    videoLength: "每条视频 60 秒以上",
    videoCount: "每位达人 2 条视频",
    tagRequirement: "必须 tag 品牌账号；必须挂 TikTok Shop 产品链接",
  },
  逗猫棒: {
    sellingPoints: "弹性互动强，铃铛和羽毛/尾巴细节适合展示猫咪真实反应。",
    requirements: ["每位达人 2 条视频", "必须挂 TikTok Shop 产品链接"],
    keyContentPoints: [
      "展示猫咪真实互动",
      "展示逗猫棒弹性",
      "展示铃铛细节",
      "展示羽毛/尾巴细节",
    ],
    videoCount: "每位达人 2 条视频",
    tagRequirement: "必须挂 TikTok Shop 产品链接",
  },
  宠物清洁手套: {
    sellingPoints: "适合外出回家、饭后、日常清洁等前后对比场景。",
    requirements: [
      "每位达人 2 条视频",
      "每条视频 40 秒以上",
      "必须挂 TikTok Shop 产品链接",
    ],
    keyContentPoints: [
      "展示清洁前后对比",
      "展示手套使用方式",
      "展示真实宠物护理场景",
    ],
    videoLength: "每条视频 40 秒以上",
    videoCount: "每位达人 2 条视频",
    tagRequirement: "必须挂 TikTok Shop 产品链接",
  },
};

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  // Safe Demo Mode never reads or writes real campaign configuration.
  if (isDemoMode()) return null;
  return window.localStorage;
}

function normalizeName(name: string): string {
  return name.trim();
}

export function campaignIdFromName(name: string): string {
  const normalized = normalizeName(name) || "未命名产品";
  return (
    normalized
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "") || encodeURIComponent(normalized)
  );
}

export function campaignIdentity(storeId: string, campaignId: string): string {
  return `${storeId}::${campaignId}`;
}

export function productIdForCampaign(
  storeId: string,
  campaignId: string,
): string {
  return `product::${storeId}::${campaignId}`;
}

export function rowMatchesCampaignIdentity(
  row: Pick<
    CreatorRow,
    "storeId" | "storeName" | "campaignId" | "productId" | "product"
  >,
  campaign: Campaign,
): boolean {
  const storeId = normalizeStoreId(row.storeId, row.storeName);
  const campaignStoreId = normalizeStoreId(
    campaign.storeId,
    campaign.storeName,
  );
  if (storeId !== campaignStoreId) return false;

  const campaignProductId =
    campaign.productId || productIdForCampaign(campaignStoreId, campaign.id);
  if (row.campaignId) {
    if (
      row.campaignId === campaign.id &&
      (!row.productId || row.productId === campaignProductId)
    )
      return true;
    const legacyCampaignId = campaignIdFromName(row.product);
    const legacyProductId = productIdForCampaign(storeId, legacyCampaignId);
    const isLegacyIdentity =
      row.campaignId === legacyCampaignId &&
      (!row.productId || row.productId === legacyProductId);
    return (
      isLegacyIdentity &&
      normalizeName(row.product).toLowerCase() ===
        normalizeName(campaign.productName).toLowerCase()
    );
  }
  if (row.productId) return row.productId === campaignProductId;
  return (
    normalizeName(row.product).toLowerCase() ===
    normalizeName(campaign.productName).toLowerCase()
  );
}

export function createCampaignFromName(
  name: string,
  fallback: CreatorFilmingRequirements = defaultCreatorFilmingRequirements,
  storeName = DEFAULT_STORE_NAME,
  storeId = normalizeStoreId(undefined, storeName),
  campaignId = campaignIdFromName(name),
  productId = productIdForCampaign(storeId, campaignId),
): Campaign {
  const productName = normalizeName(name) || fallback.productName;
  const preset = PRESET_REQUIREMENTS[productName] ?? {};
  return {
    id: campaignId,
    productId,
    storeId,
    storeName: normalizeStoreName(storeName),
    productName,
    sellingPoints: preset.sellingPoints ?? "",
    requirements: preset.requirements ?? fallback.requirements,
    keyContentPoints: preset.keyContentPoints ?? fallback.keyContentPoints,
    avoidShots: preset.avoidShots ?? "",
    videoCount:
      preset.videoCount ??
      fallback.videoCount ??
      String(
        (preset.requirements ?? fallback.requirements)
          .join("\n")
          .match(/(\d+)\s*条视频/)?.[1] ?? "2",
      ),
    videoLength:
      preset.videoLength ??
      fallback.videoLength ??
      (preset.requirements ?? fallback.requirements).find((item) =>
        item.includes("秒"),
      ) ??
      "",
    tagRequirement:
      preset.tagRequirement ??
      fallback.productLinkRequirement ??
      "必须挂 TikTok Shop 产品链接",
    productLink: preset.productLink ?? "",
    referenceLinks: preset.referenceLinks ?? fallback.referenceLinks ?? [],
    defaultMessageSetting:
      preset.defaultMessageSetting ??
      "使用当前产品项目的拍摄要求、产品链接和参考视频生成英文达人话术。",
    notes: preset.notes ?? "",
  };
}

export function detectCampaignNames(rows: CreatorRow[]): Array<{
  storeId: string;
  storeName: string;
  campaignId: string;
  productId: string;
  productName: string;
}> {
  const byIdentity = new Map<
    string,
    {
      storeId: string;
      storeName: string;
      campaignId: string;
      productId: string;
      productName: string;
    }
  >();
  rows.forEach((row) => {
    const productName = row.product.trim();
    if (!productName) return;
    const storeName = normalizeStoreName(row.storeName);
    const storeId = normalizeStoreId(row.storeId, storeName);
    const campaignId = row.campaignId || campaignIdFromName(productName);
    const productId =
      row.productId || productIdForCampaign(storeId, campaignId);
    byIdentity.set(campaignIdentity(storeId, campaignId), {
      storeId,
      storeName,
      campaignId,
      productId,
      productName,
    });
  });
  return Array.from(byIdentity.values());
}

export function loadCampaigns(): Campaign[] {
  if (isDemoMode()) return demoCampaigns();

  const saved = storage()?.getItem(CAMPAIGNS_STORAGE_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved) as Campaign[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.productName)
      .map((item) => {
        const storeName = normalizeStoreName(item.storeName);
        const storeId = normalizeStoreId(item.storeId, storeName);
        const campaignId = item.id || campaignIdFromName(item.productName);
        const productId =
          item.productId || productIdForCampaign(storeId, campaignId);
        return {
          ...createCampaignFromName(
            item.productName,
            defaultCreatorFilmingRequirements,
            storeName,
            storeId,
            campaignId,
            productId,
          ),
          ...item,
          storeId,
          storeName,
          id: campaignId,
          productId,
        };
      });
  } catch {
    storage()?.removeItem(CAMPAIGNS_STORAGE_KEY);
    return [];
  }
}

export function saveCampaigns(campaigns: Campaign[]): void {
  const target = storage();
  if (!target) return;
  target.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns));
}

export function mergeDetectedCampaigns(
  saved: Campaign[],
  rows: CreatorRow[],
  fallback: CreatorFilmingRequirements = defaultCreatorFilmingRequirements,
): Campaign[] {
  const byIdentity = new Map<string, Campaign>(
    saved.map((campaign) => {
      const storeName = normalizeStoreName(campaign.storeName);
      const storeId = normalizeStoreId(campaign.storeId, storeName);
      const id = campaign.id || campaignIdFromName(campaign.productName);
      const productId = campaign.productId || productIdForCampaign(storeId, id);
      const normalized = { ...campaign, storeId, storeName, id, productId };
      return [campaignIdentity(storeId, normalized.id), normalized] as const;
    }),
  );
  detectCampaignNames(rows).forEach(
    ({ storeId, storeName, campaignId, productId, productName }) => {
      const key = campaignIdentity(storeId, campaignId);
      const isLegacyIdentity =
        campaignId === campaignIdFromName(productName) &&
        productId === productIdForCampaign(storeId, campaignId);
      const matchingSavedCampaign = Array.from(byIdentity.values()).find(
        (campaign) =>
          normalizeStoreId(campaign.storeId, campaign.storeName) === storeId &&
          campaign.productName.trim().toLowerCase() ===
            productName.trim().toLowerCase(),
      );
      if (isLegacyIdentity && matchingSavedCampaign) return;
      if (!byIdentity.has(key))
        byIdentity.set(
          key,
          createCampaignFromName(
            productName,
            fallback,
            storeName,
            storeId,
            campaignId,
            productId,
          ),
        );
    },
  );
  if (byIdentity.size === 0)
    byIdentity.set(
      campaignIdentity(
        DEFAULT_STORE_ID,
        campaignIdFromName(fallback.productName),
      ),
      createCampaignFromName(fallback.productName, fallback),
    );
  return Array.from(byIdentity.values());
}

export function campaignToFilmingRequirements(
  campaign: Campaign | undefined,
  fallback: CreatorFilmingRequirements,
): CreatorFilmingRequirements {
  if (!campaign) return fallback;
  const requiredScenes =
    (campaign.keyContentPoints ?? []).join("；") || fallback.requiredScenes;
  const requirements = [
    campaign.videoCount,
    campaign.videoLength,
    ...(campaign.requirements ?? []),
    campaign.tagRequirement,
  ].filter((item): item is string => Boolean(item?.trim()));
  const referenceLinks =
    campaign.referenceLinks ?? fallback.referenceLinks ?? [];
  return {
    productName: campaign.productName || fallback.productName,
    requiredScenes,
    sellingPoints: campaign.sellingPoints || fallback.sellingPoints,
    videoLength: campaign.videoLength || fallback.videoLength,
    videoCount: campaign.videoCount || fallback.videoCount,
    avoidShots: campaign.avoidShots || fallback.avoidShots,
    productLinkRequirement:
      [campaign.tagRequirement, campaign.productLink]
        .filter(Boolean)
        .join("；") || fallback.productLinkRequirement,
    referenceVideoLinks:
      referenceLinks.join("\n") || fallback.referenceVideoLinks,
    requirements: requirements.length ? requirements : fallback.requirements,
    keyContentPoints: campaign.keyContentPoints?.length
      ? campaign.keyContentPoints
      : fallback.keyContentPoints,
    referenceLinks,
  };
}
