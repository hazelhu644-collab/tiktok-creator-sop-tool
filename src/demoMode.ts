import type { Campaign, CreatorRow } from "./types";

/**
 * Safe Demo Mode.
 *
 * Activated with `?demo=1`. While it is on, nothing is read from or written to
 * localStorage — `creatorData` and `campaignData` treat storage as unavailable,
 * so a demo session can never see or overwrite real creator records. Edits made
 * during a demo live in React state only and disappear on reload.
 *
 * This module deliberately imports nothing but types: `creatorData` and
 * `campaignData` both depend on it, so any import back into them would be a
 * cycle.
 */

export const DEMO_QUERY_PARAM = "demo";
export const DEMO_STORE_ID = "demo-store";
export const DEMO_STORE_NAME = "Demo 店铺";
export const DEMO_CAMPAIGN_ID = "demo-pet-grooming-brush";
export const DEMO_PRODUCT_NAME = "Demo 宠物蒸汽梳";

const DEMO_PRODUCT_ID = `product::${DEMO_STORE_ID}::${DEMO_CAMPAIGN_ID}`;

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return (
      new URLSearchParams(window.location.search).get(DEMO_QUERY_PARAM) === "1"
    );
  } catch {
    return false;
  }
}

/** Same page without `?demo=1`, for the banner's exit link. */
export function exitDemoModeUrl(): string {
  if (typeof window === "undefined") return "/";

  try {
    const url = new URL(window.location.href);
    url.searchParams.delete(DEMO_QUERY_PARAM);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function demoRow(
  patch: Partial<CreatorRow> & Pick<CreatorRow, "id">,
): CreatorRow {
  return {
    username: "",
    profileLink: "",
    contactMethod: "TikTok DM",
    storeId: DEMO_STORE_ID,
    storeName: DEMO_STORE_NAME,
    campaignId: DEMO_CAMPAIGN_ID,
    productId: DEMO_PRODUCT_ID,
    product: DEMO_PRODUCT_NAME,
    currentStatus: "",
    sampleShippingStatus: "Not Shipped",
    sampleDeliveredDate: "",
    videoProgress: "0/2",
    firstVideoPostedDate: "",
    lastContactDate: "",
    lastFollowUpCount: 0,
    notes: "",
    trackingStatus: "",
    lastMessageScenario: "",
    lastMessageChannel: "",
    lastMessageSentAt: "",
    lastHandledDate: "",
    nextFollowUpDate: "",
    lastCreatorResponse: "",
    ...patch,
  };
}

/**
 * Obviously-fake creators, one per follow-up stage, so a demo shows the full
 * priority ladder (Highest → Medium) without any real collaboration data.
 */
export function demoCreatorRows(): CreatorRow[] {
  return [
    demoRow({
      id: "demo-1",
      username: "demo_creator_reply",
      currentStatus: "Waiting Video",
      sampleShippingStatus: "Delivered",
      sampleDeliveredDate: daysAgo(4),
      trackingStatus: "Replied",
      lastCreatorResponse: "Sure, I can post on Friday!",
      lastContactDate: daysAgo(1),
      lastFollowUpCount: 1,
      notes: "示例数据：达人已回复，等待处理。",
    }),
    demoRow({
      id: "demo-2",
      username: "demo_creator_delivered",
      currentStatus: "Delivered",
      sampleShippingStatus: "Delivered",
      sampleDeliveredDate: daysAgo(6),
      lastContactDate: daysAgo(4),
      lastFollowUpCount: 1,
      notes: "示例数据：样品已到货多日，仍未发布视频。",
    }),
    demoRow({
      id: "demo-3",
      username: "demo_creator_partial",
      currentStatus: "Posted",
      sampleShippingStatus: "Delivered",
      sampleDeliveredDate: daysAgo(16),
      videoProgress: "1/2",
      firstVideoPostedDate: daysAgo(8),
      lastContactDate: daysAgo(3),
      lastFollowUpCount: 2,
      notes: "示例数据：已发布 1 条，还差 1 条。",
    }),
    demoRow({
      id: "demo-4",
      username: "demo_creator_in_transit",
      currentStatus: "Sample Shipped",
      sampleShippingStatus: "Sample Shipped",
      sampleDeliveredDate: daysAgo(-2),
      lastContactDate: daysAgo(2),
      notes: "示例数据：样品运输中，预计后天到货。",
    }),
    demoRow({
      id: "demo-5",
      username: "demo_creator_new",
      currentStatus: "To Contact",
      notes: "示例数据：初次邀约阶段。",
    }),
    demoRow({
      id: "demo-6",
      username: "demo_creator_done",
      currentStatus: "Completed",
      sampleShippingStatus: "Delivered",
      sampleDeliveredDate: daysAgo(25),
      videoProgress: "2/2",
      firstVideoPostedDate: daysAgo(14),
      lastContactDate: daysAgo(10),
      lastFollowUpCount: 2,
      notes: "示例数据：合作已完成。",
    }),
  ];
}

export function demoCampaigns(): Campaign[] {
  return [
    {
      id: DEMO_CAMPAIGN_ID,
      productId: DEMO_PRODUCT_ID,
      storeId: DEMO_STORE_ID,
      storeName: DEMO_STORE_NAME,
      productName: DEMO_PRODUCT_NAME,
      sellingPoints: "蒸汽软化浮毛，梳毛同时收集毛发，适合日常宠物护理场景。",
      requirements: [
        "每位达人 2 条视频",
        "每条视频 60 秒以上",
        "必须 tag 品牌账号",
        "必须挂 TikTok Shop 产品链接",
      ],
      keyContentPoints: [
        "展示雾化功能",
        "展示梳下来的浮毛",
        "展示宠物真实反应",
        "展示清理过程",
      ],
      avoidShots: "",
      videoCount: "每位达人 2 条视频",
      videoLength: "每条视频 60 秒以上",
      tagRequirement:
        "必须挂 TikTok Shop 产品链接，并按 campaign 要求 tag 品牌账号。",
      productLink: "",
      referenceLinks: [],
      defaultMessageSetting: "",
      notes: "示例产品项目，仅用于演示。",
    },
  ];
}
