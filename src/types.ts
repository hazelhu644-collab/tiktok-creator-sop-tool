import type { ProductCategoryId } from "./productCategories";

export type Priority = "Highest" | "High" | "Medium" | "Low" | "None";

export type Channel =
  "TikTok DM" | "TikTok Shop Affiliate Message" | "Email" | "WhatsApp";

export type VideoProgressNormalization = {
  normalized: string;
  warning?: string;
  postedCount?: number;
  requiredVideos?: number;
  isOverRequired?: boolean;
};

export type FollowUpHistoryEntry = {
  date: string;
  action:
    | "Message Sent"
    | "Creator Replied"
    | "No Reply"
    | "Skipped Today"
    | "Video Posted"
    | "Completed"
    | "Failed"
    | "Archived"
    | "Restored";
  channel?: Channel | string;
  scenario?: string;
  message?: string;
  note?: string;
};

export type TrackingStatus =
  | "Followed Up"
  | "Replied"
  | "Reply Pending"
  | "No Reply Pending"
  | "Skipped Today"
  | "Video Posted"
  | "Completed"
  | "Failed"
  | "";

export type Store = {
  id: string;
  name: string;
};

/**
 * How the collaboration is paid for and tracked.
 *
 * - `affiliate-link`: the creator posts a TikTok Shop product link and earns
 *   the platform's affiliate commission on it.
 * - `discount-code`: the creator gets a personal discount code, their audience
 *   gets money off, and commission is attributed through the code.
 */
export type CollabModel = "affiliate-link" | "discount-code";

/** Who actually places the order that puts the product in the creator's hands. */
export type OrderMethod = "brand-ships" | "creator-orders";

/** Where the creator came from. TCM creators have already opted in. */
export type CreatorSource = "Outreach" | "TCM";

/**
 * The commercial terms a message is allowed to state. Kept together rather than
 * spread across the campaign so the scripts have one object to read from.
 */
export type CollaborationTerms = {
  collabModel: CollabModel;
  /** The creator's personal code, e.g. "JAMIE10". Empty until one is issued. */
  discountCode: string;
  /** What the audience saves, e.g. "10%". */
  audienceDiscount: string;
  /** What the creator earns, e.g. "10%". */
  creatorCommission: string;
  /** How long code attribution lasts, e.g. "6 months". */
  commissionWindow: string;
  orderMethod: OrderMethod;
  /** Months of content-usage rights granted, e.g. "12". Empty to omit. */
  contentUsageMonths: string;
  /** Whether the brief must ask for an #ad / sponsored disclosure. */
  requiresDisclosure: boolean;
};

export type CreatorRow = {
  id: string;
  storeId?: string;
  storeName?: string;
  campaignId?: string;
  productId?: string;
  username: string;
  profileLink: string;
  contactMethod: string;
  product: string;
  currentStatus: string;
  sampleShippingStatus: string;
  sampleDeliveredDate: string;
  videoProgress: string;
  videoProgressWarning?: string;
  firstVideoPostedDate: string;
  latestVideoPostedDate?: string;
  lastContactDate: string;
  lastFollowUpCount: number;
  notes: string;
  trackingStatus?: TrackingStatus | string;
  lastMessageScenario?: string;
  lastMessageChannel?: Channel | string;
  lastMessageSentAt?: string;
  lastHandledDate?: string;
  nextFollowUpDate?: string;
  lastCreatorResponse?: string;
  followUpHistory?: FollowUpHistoryEntry[];
  archivedAt?: string;
  archiveReason?: "Completed" | "Failed" | string;
  /**
   * Which outreach round of the product this record belongs to. Rows saved
   * before rounds existed have none and count as round 1.
   */
  round?: number;
  /**
   * Where the creator came from. TCM creators already accepted the invitation
   * on TikTok Creator Marketplace, so cold-outreach wording is wrong for them.
   * Rows saved before this existed have none and count as `Outreach`.
   */
  source?: CreatorSource | string;
  /**
   * The creator's own order number, only used when the campaign has them place
   * the order themselves. Its absence is what the order-number chase keys on.
   */
  orderNumber?: string;
};

export type Task = CreatorRow & {
  priority: Priority;
  priorityRank: number;
  stageRank: number;
  triggerReason: string;
  suggestedAction: string;
  failedWarnings: string[];
  needsFollowUp: boolean;
};

export type Summary = {
  totalCreators: number;
  needsFollowUp: number;
  highest: number;
  high: number;
  medium: number;
  low: number;
  failedWarnings: number;
};

export type UrgencyLevel = "极高" | "高" | "中" | "低" | "归档";

export type CommunicationAction =
  | "未合作邀约"
  | "老达人再建联"
  | "TCM 达人跟进"
  | "确认合作内容"
  | "发送下单方式"
  | "催订单号"
  | "确认收货信息"
  | "样品运输中，提前沟通拍摄要求"
  | "样品在路上，提醒达人提前规划拍摄内容"
  | "提醒达人注意签收并准备拍摄"
  | "确认样品是否收到"
  | "确认物流 / 是否签收"
  | "物流异常确认"
  | "样品到货催拍"
  | "剩余视频履约"
  | "视频修改"
  | "最后确认"
  | "回复达人消息"
  | "合作完成维护"
  | "合作失败归档";

/** One selectable script angle for the current scenario. */
export type MessageVariantOption = {
  id: string;
  /** Chinese label shown on the variant switcher. */
  label: string;
  /** One-line Chinese description of when to pick this angle. */
  angle: string;
};

export type GeneratedMessage = {
  english: string;
  chineseExplanation: string;
  scenario: string;
  scenarioReason: string;
  urgencyLevel: UrgencyLevel;
  communicationAction: CommunicationAction;
  /** Which angle produced `english`. 0 when the scenario has no variants. */
  variantIndex: number;
  /** Every angle available for this scenario, in switcher order. */
  variants: MessageVariantOption[];
  /**
   * Subject line for the Email channel. Absent on other channels, and absent
   * on follow-ups that should stay in the existing thread — `emailThreadNote`
   * explains that case instead.
   */
  emailSubject?: string;
  /** Chinese note shown in place of a subject when replying in-thread. */
  emailThreadNote?: string;
};

export type Campaign = {
  id: string;
  productId?: string;
  storeId?: string;
  storeName?: string;
  /**
   * Which product-category preset supplies the English lexicon and filming
   * defaults. Campaigns saved before categories existed leave this unset and
   * the category is inferred from the product name and content.
   */
  categoryId?: ProductCategoryId;
  productName: string;
  sellingPoints: string;
  requirements: string[];
  keyContentPoints: string[];
  avoidShots: string;
  videoCount: string;
  videoLength: string;
  tagRequirement: string;
  productLink: string;
  referenceLinks: string[];
  defaultMessageSetting: string;
  notes: string;
  /**
   * Commercial terms. Absent on campaigns saved before collaboration models
   * existed; those fall back to the affiliate-link defaults, which is what the
   * tool has always assumed.
   */
  collabModel?: CollabModel;
  discountCode?: string;
  audienceDiscount?: string;
  creatorCommission?: string;
  commissionWindow?: string;
  orderMethod?: OrderMethod;
  contentUsageMonths?: string;
  requiresDisclosure?: boolean;
  archivedAt?: string;
  /**
   * The outreach round new creators for this product join. Campaigns saved
   * before rounds existed have none and count as round 1.
   */
  currentRound?: number;
};
