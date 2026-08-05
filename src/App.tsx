import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  buildDuplicateImportSummary,
  clearSavedCreatorRows,
  copyCreatorBaseFields,
  countActiveCreatorSamples,
  createBlankCreatorRow,
  downloadCreatorRowsCsv,
  getDuplicateCheck,
  normalizeCreatorRowStore,
  loadCreatorRows,
  saveCreatorRows,
  updateCreatorField,
  type EditableCreatorField,
} from "./creatorData";
import { parseCreatorFile } from "./fileParser";
import {
  analyzeCreators,
  compareTasks,
  daysSince,
  isDeliveredLogisticsStatus,
  isInTransitLogisticsStatus,
  normalizeVideoProgress,
  parseRequiredVideos,
} from "./sopRules";
import {
  CHANNELS,
  defaultCreatorFilmingRequirements,
  generateMessage,
  type CreatorFilmingRequirements,
  type ReplyTone,
} from "./messageGenerator";
import {
  ALL_STORES,
  DEFAULT_STORE_ID,
  DEFAULT_STORE_NAME,
  campaignIdentity,
  campaignIdFromName,
  campaignToFilmingRequirements,
  createCampaignFromName,
  loadCampaigns,
  mergeDetectedCampaigns,
  productIdForCampaign,
  rowMatchesCampaignIdentity,
  saveCampaigns,
  normalizeStoreId,
  normalizeStoreName,
} from "./campaignData";
import type {
  Campaign,
  Channel,
  CreatorRow,
  GeneratedMessage,
  Task,
} from "./types";
import { CreatorDatabasePage } from "./features/creators/CreatorDatabasePage";
import type {
  CreatorDatabaseRowView,
  CreatorStatusOption,
} from "./features/creators/creatorDatabaseTypes";
import type {
  CampaignSettingsOption,
  CampaignSettingsTargetView,
  CampaignStoreCleanupView,
} from "./features/campaigns/campaignSettingsTypes";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { exitDemoModeUrl, isDemoMode } from "./demoMode";
import type {
  SettingsAiDraft,
  SettingsPromptHelperField,
} from "./features/settings/settingsTypes";
import type {
  DashboardCampaignCardView,
  DashboardCreatorView,
  DashboardMetricCardView,
  WorkbenchFilterKey,
} from "./features/dashboard/dashboardTypes";
import type { MessageComposerProps } from "./features/messaging/messageComposerTypes";
import "./styles.css";

const FILMING_REQUIREMENTS_STORAGE_KEY = "tiktokCreatorSop.filmingRequirements";

const creatorStatuses = [
  "Not Contacted",
  "Invited",
  "Replied",
  "Sample Requested",
  "Sample Approved",
  "Sample Shipped",
  "Delivered",
  "Waiting Video",
  "Posted",
  "Need Revision",
  "Product Tag Missing",
  "Ready for Ads",
  "Spark Ads Requested",
  "Completed",
  "Lost",
] as const;

type CreatorStatus = (typeof creatorStatuses)[number];
type ModuleKey =
  | "dashboard"
  | "creators"
  | "templates"
  | "samples"
  | "followup"
  | "review"
  | "ads"
  | "settings";
type Toast = { tone: "success" | "warning"; text: string } | null;
type DeepSeekAction = "translate_creator_reply" | "generate_personalized_reply";
type MessageSource = "local" | "deepseek";
type PendingDuplicateAdd = { draft: CreatorRow; existing: CreatorRow } | null;
type DeepSeekTranslateResult = { chineseTranslation: string };
type DeepSeekGenerateResult = {
  englishMessage: string;
  chineseExplanation: string;
  detectedIntent: string;
  recommendedTrackingStatus: string;
};

type TemplateForm = {
  creatorName: string;
  productName: string;
  sellingPoint: string;
  requirement: string;
  length: string;
  videos: string;
  tagRequirement: string;
  trackingNumber: string;
  deadline: string;
};

const emptyTemplateForm: TemplateForm = {
  creatorName: "",
  productName: defaultCreatorFilmingRequirements.productName,
  sellingPoint: "",
  requirement:
    "Show a real pet using the product, clear unboxing/use process, CTA, and TikTok Shop product card.",
  length: "40s+",
  videos: "2",
  tagRequirement: "Attach the TikTok Shop product card before publishing.",
  trackingNumber: "",
  deadline: "",
};

const statusLabels: Record<CreatorStatus, string> = {
  "Not Contacted": "未联系",
  Invited: "已邀约",
  Replied: "已回复",
  "Sample Requested": "申请样品",
  "Sample Approved": "样品已通过",
  "Sample Shipped": "样品已寄出",
  Delivered: "样品已签收",
  "Waiting Video": "等待视频",
  Posted: "已发布",
  "Need Revision": "需修改",
  "Product Tag Missing": "未挂商品卡",
  "Ready for Ads": "可投流",
  "Spark Ads Requested": "已申请 Spark Ads",
  Completed: "合作完成",
  Lost: "合作失败",
};

const templateFieldLabels: Record<keyof TemplateForm, string> = {
  creatorName: "达人名称",
  productName: "产品名称",
  sellingPoint: "产品卖点",
  requirement: "拍摄要求",
  length: "视频时长",
  videos: "视频数量",
  tagRequirement: "挂车 / Tag 要求",
  trackingNumber: "物流单号",
  deadline: "截止时间",
};

type TemplateMessage = {
  name: string;
  english: string;
  chinese: string;
};

const navIcons: Record<ModuleKey, string> = {
  dashboard: "⌁",
  creators: "◌",
  templates: "✦",
  samples: "◇",
  followup: "↗",
  review: "✓",
  ads: "◆",
  settings: "⚙",
};

const navItems: Array<{ key: ModuleKey; label: string; helper: string }> = [
  { key: "dashboard", label: "今日工作台", helper: "产品优先日常跟进" },
  { key: "followup", label: "达人跟进中心", helper: "同工作台处理队列" },
  { key: "creators", label: "达人数据库", helper: "搜索、筛选、批量更新" },
  { key: "samples", label: "样品追踪", helper: "物流与到货跟进" },
  { key: "templates", label: "沟通话术模板", helper: "标准英文话术库" },
  { key: "review", label: "内容审核", helper: "视频验收清单" },
  { key: "ads", label: "投流素材库", helper: "可投流 UGC 素材" },
  { key: "settings", label: "设置", helper: "数据与 SOP 默认值" },
];

function loadFilmingRequirements(): CreatorFilmingRequirements {
  if (typeof window === "undefined") return defaultCreatorFilmingRequirements;
  if (isDemoMode()) return defaultCreatorFilmingRequirements;

  const savedRequirements = window.localStorage.getItem(
    FILMING_REQUIREMENTS_STORAGE_KEY,
  );
  if (!savedRequirements) return defaultCreatorFilmingRequirements;

  try {
    const parsedRequirements = JSON.parse(
      savedRequirements,
    ) as Partial<CreatorFilmingRequirements>;
    return {
      ...defaultCreatorFilmingRequirements,
      ...parsedRequirements,
      productName:
        typeof parsedRequirements.productName === "string" &&
        parsedRequirements.productName.trim()
          ? parsedRequirements.productName
          : defaultCreatorFilmingRequirements.productName,
      requirements: Array.isArray(parsedRequirements.requirements)
        ? parsedRequirements.requirements.filter(Boolean)
        : defaultCreatorFilmingRequirements.requirements,
      keyContentPoints: Array.isArray(parsedRequirements.keyContentPoints)
        ? parsedRequirements.keyContentPoints.filter(Boolean)
        : defaultCreatorFilmingRequirements.keyContentPoints,
      referenceLinks: Array.isArray(parsedRequirements.referenceLinks)
        ? parsedRequirements.referenceLinks.filter(Boolean)
        : [],
    };
  } catch {
    return defaultCreatorFilmingRequirements;
  }
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeListText(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(value: string[] | undefined): string {
  return (value ?? []).join("\n");
}

function displayName(row: Pick<CreatorRow, "username">): string {
  return row.username.trim() || "未命名达人";
}

function creatorHandle(row: Pick<CreatorRow, "username">): string {
  const name = displayName(row);
  return name === "未命名达人" || name.startsWith("@") ? name : `@${name}`;
}

function displayStatus(status: CreatorStatus): string {
  return statusLabels[status] ?? status;
}

function priorityLabel(task: Task): string {
  return task.priority === "Highest"
    ? "最高"
    : task.priority === "High"
      ? "高"
      : task.priority === "Medium"
        ? "中"
        : "低";
}

function isHandledToday(task: Task) {
  const today = todayString();
  const handledActions = [
    "Message Sent",
    "No Reply",
    "Skipped Today",
    "Creator Replied",
    "Video Posted",
    "Completed",
    "Failed",
  ];
  return (
    task.lastHandledDate === today ||
    task.lastMessageSentAt === today ||
    task.followUpHistory?.some(
      (entry) => entry.date === today && handledActions.includes(entry.action),
    )
  );
}

/**
 * Rows saved while a sample was still in transit keep saying so even after the
 * expected arrival date passes. Applied when rows are first loaded rather than
 * from an effect, so the first render already shows the corrected state instead
 * of causing a second one.
 */
function markArrivedSamplesDelivered(rows: CreatorRow[]): CreatorRow[] {
  const today = todayString();
  const specialStatus =
    /lost|returned|canceled|failed|completed|合作失败|合作完成|已归档/i;
  let changed = false;

  const nextRows = rows.map((row) => {
    if (
      row.archivedAt ||
      specialStatus.test(
        `${row.currentStatus} ${row.sampleShippingStatus} ${row.trackingStatus ?? ""}`,
      )
    )
      return row;
    if (
      !isInTransitLogisticsStatus(row.sampleShippingStatus) ||
      !row.sampleDeliveredDate ||
      row.sampleDeliveredDate > today
    )
      return row;

    changed = true;
    return {
      ...row,
      sampleShippingStatus: row.sampleShippingStatus.match(/[㐀-鿿]/)
        ? "已签收"
        : "Delivered",
      currentStatus: "Delivered",
      trackingStatus: "确认样品是否收到 / 确认拍摄计划",
      lastMessageScenario: "确认样品是否收到 / 确认拍摄计划",
      nextFollowUpDate: today,
      followUpHistory: [
        ...(row.followUpHistory ?? []),
        {
          date: today,
          action: "Creator Replied" as const,
          note: "系统根据样品到货日期自动更新为 Delivered。",
        },
      ],
    };
  });

  return changed ? nextRows : rows;
}

function priorityActionLabel(task: Task): string {
  if (task.priority === "Highest") return "必须处理";
  if (task.priority === "High") return "待跟进";
  if (task.priority === "Medium") return "轻跟进";
  return "稍后复查";
}

function containsChinese(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function outgoingEnglishValue(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed || containsChinese(trimmed)) return fallback;
  return trimmed;
}

function safeLower(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function parseRequiredVideoCountText(value: string | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  const parsed = parseRequiredVideos(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function campaignRequiredVideoCount(
  campaign: Campaign,
  fallback: CreatorFilmingRequirements,
): number {
  return (
    parseRequiredVideoCountText(campaign.videoCount) ??
    parseRequiredVideos(campaignToFilmingRequirements(campaign, fallback))
  );
}

function campaignOptionValue(campaign: Campaign): string {
  return campaignIdentity(
    normalizeStoreId(campaign.storeId, campaign.storeName),
    campaign.id,
  );
}

function campaignSelectValue(campaign: Campaign): string {
  return campaignOptionValue(campaign);
}

function campaignLabel(campaign: Campaign, showStore = true): string {
  return showStore
    ? `${normalizeStoreName(campaign.storeName)} · ${campaign.productName}`
    : campaign.productName;
}

function rowStoreId(row: CreatorRow): string {
  return normalizeStoreId(row.storeId, row.storeName);
}

function rowMatchesStore(row: CreatorRow, selectedStore: string): boolean {
  return selectedStore === ALL_STORES || rowStoreId(row) === selectedStore;
}

function rowMatchesCampaign(row: CreatorRow, campaign: Campaign): boolean {
  return rowMatchesCampaignIdentity(row, campaign);
}

function hasAny(value: string, terms: string[]) {
  const normalized = safeLower(value);
  return terms.some((term) => normalized.includes(term));
}

function isCurrentWeek(dateValue: string) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = today.getUTCDay() || 7;
  const weekStart = new Date(today);
  weekStart.setUTCDate(today.getUTCDate() - day + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  return date >= weekStart && date < weekEnd;
}

function videoProgressCounts(
  row: Pick<CreatorRow, "videoProgress">,
  requiredVideos: number,
) {
  const progress = normalizeVideoProgress(row.videoProgress, requiredVideos);
  return {
    posted: progress.postedCount ?? 0,
    required: progress.requiredVideos ?? requiredVideos,
  };
}

function isSampleDeliveredForVideo(row: CreatorRow, requiredVideos: number) {
  return ["Delivered", "Waiting Video"].includes(
    inferStatus(row, requiredVideos),
  );
}

function isSampleInTransitForDaily(row: CreatorRow, requiredVideos: number) {
  return inferStatus(row, requiredVideos) === "Sample Shipped";
}

function inferStatus(row: CreatorRow, requiredVideos: number): CreatorStatus {
  const status = safeLower(row.currentStatus);
  const progress = normalizeVideoProgress(row.videoProgress, requiredVideos);
  const notes = safeLower(row.notes);
  const tracking = safeLower(row.trackingStatus);

  if (
    hasAny(status, ["lost", "failed", "cancel", "失败"]) ||
    hasAny(tracking, ["failed", "失败"])
  )
    return "Lost";
  if (
    hasAny(status, ["completed", "complete", "已完成", "合作完成", "完成"]) ||
    hasAny(tracking, ["completed", "合作完成", "完成"])
  )
    return "Completed";
  if (hasAny(status, ["spark"])) return "Spark Ads Requested";
  if (
    hasAny(status, ["ready for ads"]) ||
    hasAny(notes, ["ready for ads", "high ctr", "投流"])
  )
    return "Ready for Ads";
  if (
    hasAny(status, ["tag missing"]) ||
    hasAny(notes, ["product tag missing", "missing product card", "未挂"])
  )
    return "Product Tag Missing";
  if (hasAny(status, ["revision", "revise", "修改"])) return "Need Revision";
  if (
    typeof progress.postedCount === "number" &&
    progress.postedCount >= requiredVideos
  )
    return "Completed";
  if ((progress.postedCount ?? 0) > 0 || hasAny(status, ["posted"]))
    return "Posted";
  if (hasAny(status, ["waiting video", "waiting for video"]))
    return "Waiting Video";
  if (
    isDeliveredLogisticsStatus(row.sampleShippingStatus) ||
    hasAny(status, [
      "delivered",
      "已签收",
      "已到货",
      "waiting video",
      "等待视频",
    ])
  )
    return "Delivered";
  if (
    isInTransitLogisticsStatus(row.sampleShippingStatus) ||
    hasAny(status, ["sample shipped", "in transit", "运输中", "已发货"])
  )
    return "Sample Shipped";
  if (hasAny(status, ["approved"])) return "Sample Approved";
  if (hasAny(status, ["sample requested", "requested"]))
    return "Sample Requested";
  if (
    hasAny(status, ["replied"]) ||
    tracking === "replied" ||
    tracking === "reply pending"
  )
    return "Replied";
  if (
    hasAny(status, ["invited", "contacted", "followed up"]) ||
    tracking === "followed up"
  )
    return "Invited";
  return "Not Contacted";
}

function statusTone(status: CreatorStatus) {
  return `status-pill status-${status.toLowerCase().replace(/\s+/g, "-")}`;
}

function isArchivedCollaboration(
  row: Pick<CreatorRow, "archivedAt" | "currentStatus" | "trackingStatus">,
): boolean {
  return Boolean(
    row.archivedAt ||
    hasAny(`${row.currentStatus} ${row.trackingStatus ?? ""}`, [
      "completed",
      "complete",
      "已完成",
      "合作完成",
      "failed",
      "lost",
      "失败",
      "归档",
    ]),
  );
}

function isActiveDailyCollaboration(
  row: CreatorRow,
  requiredVideos: number,
): boolean {
  const status = inferStatus(row, requiredVideos);
  return (
    !isArchivedCollaboration(row) && status !== "Completed" && status !== "Lost"
  );
}

function parseNumberFromNotes(notes: string, keys: string[]): string {
  for (const key of keys) {
    const expression = new RegExp(`${key}\\s*[:：]\\s*([^,;\\n]+)`, "i");
    const match = notes.match(expression);
    if (match?.[1]) return match[1].trim();
  }
  return "—";
}

function creatorType(row: CreatorRow) {
  return parseNumberFromNotes(row.notes, ["niche", "creator type", "type"]) ===
    "—"
    ? "Pet / UGC"
    : parseNumberFromNotes(row.notes, ["niche", "creator type", "type"]);
}

function followerCount(row: CreatorRow) {
  return parseNumberFromNotes(row.notes, [
    "followers",
    "follower count",
    "粉丝",
  ]);
}

function avgViews(row: CreatorRow) {
  return parseNumberFromNotes(row.notes, [
    "avg views",
    "average views",
    "播放",
  ]);
}

function gmvRange(row: CreatorRow) {
  return parseNumberFromNotes(row.notes, ["gmv", "gmv range"]);
}

function daysDelivered(row: CreatorRow) {
  return row.sampleDeliveredDate ? daysSince(row.sampleDeliveredDate) : null;
}

function sampleHint(row: CreatorRow, requiredVideos: number) {
  const status = inferStatus(row, requiredVideos);
  const deliveredDays = daysDelivered(row);
  const progress = normalizeVideoProgress(row.videoProgress, requiredVideos);

  if (status === "Sample Shipped") return "已寄出但未签收：确认物流是否卡住。";
  if (
    status === "Delivered" &&
    deliveredDays !== null &&
    deliveredDays >= 5 &&
    (progress.postedCount ?? 0) === 0
  )
    return "已签收 5 天未发布：催发视频并确认拍摄计划。";
  if (status === "Delivered" && deliveredDays !== null && deliveredDays >= 3)
    return "已签收 3 天未回复：发送签收后跟进。";
  if (status === "Lost") return "达人取消合作：确认是否需退样。";
  return "按下一次跟进日期复查。";
}

function buildTemplateMessages(form: TemplateForm): TemplateMessage[] {
  const creator = outgoingEnglishValue(form.creatorName, "[Creator Name]");
  const product = outgoingEnglishValue(form.productName, "[Product Name]");
  const sellingPoint = outgoingEnglishValue(
    form.sellingPoint,
    "[Product Selling Point]",
  );
  const requirement = outgoingEnglishValue(
    form.requirement,
    "[Video Requirement]",
  );
  const length = outgoingEnglishValue(form.length, "[Video Length]");
  const videos = outgoingEnglishValue(form.videos, "[Number of Videos]");
  const tag = outgoingEnglishValue(
    form.tagRequirement,
    "[Product Tag Requirement]",
  );
  const tracking = outgoingEnglishValue(
    form.trackingNumber,
    "[Tracking Number]",
  );
  const deadline = outgoingEnglishValue(form.deadline, "[Deadline]");

  return [
    {
      name: "初次邀约",
      english: `Hi ${creator}, we love your pet content and would like to invite you to collaborate on ${product}. Key selling point: ${sellingPoint}. The requirement is ${videos} video(s), ${length}, with ${tag}. Are you open to receiving a sample?`,
      chinese: `向 ${creator} 发起首次合作邀约，说明 ${product} 的核心卖点、视频数量、时长和挂车要求，并询问是否愿意收样。`,
    },
    {
      name: "达人同意合作",
      english: `Amazing, ${creator}! For ${product}, please cover: ${requirement}. Please keep each video ${length}, publish ${videos} video(s), and ${tag}. Deadline target: ${deadline}.`,
      chinese: `达人同意合作后，确认 ${product} 的拍摄要求、视频时长、视频数量、挂车要求和目标截止时间。`,
    },
    {
      name: "样品已寄出",
      english: `Your ${product} sample has been shipped. Tracking number: ${tracking}. Once it arrives, please test it with a real pet scene and share your posting plan.`,
      chinese: `通知达人样品已寄出，提供物流单号，并提醒签收后在真实宠物场景中测试产品、反馈发布计划。`,
    },
    {
      name: "样品已签收跟进",
      english: `Hi ${creator}, tracking shows the ${product} sample was delivered. Could you confirm you received it and let us know your filming schedule?`,
      chinese: `物流显示已签收后，确认达人是否收到 ${product}，并推进达人给出拍摄排期。`,
    },
    {
      name: "催发视频",
      english: `Hi ${creator}, just checking in on the ${product} video(s). The target is ${videos} video(s) by ${deadline}. Please let us know if you need anything before posting.`,
      chinese: `达人已收样但视频未发布时，提醒 ${videos} 条视频和 ${deadline} 截止时间，同时保留支持口径。`,
    },
    {
      name: "提醒挂商品卡",
      english: `Thanks for posting! One important fix: please attach the TikTok Shop product card for ${product}. ${tag}`,
      chinese: `达人已发布但未挂商品卡时，提醒其为 ${product} 补挂 TikTok Shop 商品卡。`,
    },
    {
      name: "要求修改视频",
      english: `Thanks for the draft/post. Could you revise it to include: ${requirement}. Please also keep it ${length} and avoid unsupported claims.`,
      chinese: `视频草稿或已发布内容不符合要求时，清楚说明需要补充的拍摄点、时长要求和合规风险。`,
    },
    {
      name: "索要 Spark Ads 授权",
      english: `This video looks strong for paid boosting. Could you grant Spark Ads authorization / ad code for the ${product} post?`,
      chinese: `视频表现适合投流时，向达人索要 ${product} 内容的 Spark Ads 授权或广告码。`,
    },
    {
      name: "合作取消",
      english: `Understood. We will cancel this collaboration for ${product}. Please confirm no further posts will be made under this campaign.`,
      chinese: `合作终止时，确认取消 ${product} 合作，并要求达人不要继续发布该 campaign 下的内容。`,
    },
    {
      name: "要求退回样品",
      english: `Since the collaboration is cancelled, please return the ${product} sample. We can share the return details and next steps.`,
      chinese: `合作取消且需要追回样品时，说明需退回 ${product} 样品，并表示会提供退回信息。`,
    },
  ];
}

function App() {
  const [demoMode] = useState(isDemoMode);
  const [rows, setRows] = useState<CreatorRow[]>(() =>
    markArrivedSamplesDelivered(loadCreatorRows()),
  );
  const [activeModule, setActiveModule] = useState<ModuleKey>("dashboard");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [importSummary, setImportSummary] = useState("");
  const [pendingDuplicateAdd, setPendingDuplicateAdd] =
    useState<PendingDuplicateAdd>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CreatorStatus | "All">(
    "All",
  );
  const [creatorTypeFilter, setCreatorTypeFilter] = useState("All");
  const [followerFilter, setFollowerFilter] = useState("All");
  const [avgViewsFilter, setAvgViewsFilter] = useState("All");
  const [gmvFilter, setGmvFilter] = useState("All");
  const [bulkStatus, setBulkStatus] = useState<CreatorStatus>("Invited");
  const [channel, setChannel] = useState<Channel>("TikTok DM");
  const [selectedCreatorId, setSelectedCreatorId] = useState("");
  const [message, setMessage] = useState<GeneratedMessage | null>(null);
  const [messageSource, setMessageSource] = useState<MessageSource>("local");
  const [trackingStatus, setTrackingStatus] = useState("");
  const [templateCreatorId, setTemplateCreatorId] = useState("");
  const [followupSearch, setFollowupSearch] = useState("");
  const [followupUrgency, setFollowupUrgency] = useState<
    "All" | "Highest" | "High" | "Medium" | "Low"
  >("All");
  const [replyFocus, setReplyFocus] = useState("");
  const [replyRelationshipNote, setReplyRelationshipNote] = useState("");
  const [replyTone, setReplyTone] = useState<ReplyTone>("中立专业");
  const [replyGoal, setReplyGoal] = useState("");
  const [replyConcession, setReplyConcession] = useState("");
  const [templateForm, setTemplateForm] = useState<TemplateForm>(
    () => emptyTemplateForm,
  );
  // Campaign settings own the editable filming requirements now; this holds the
  // saved fallback used when no campaign is selected, and is never reassigned.
  const [filmingRequirements] = useState<CreatorFilmingRequirements>(() =>
    loadFilmingRequirements(),
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadCampaigns());
  const [selectedStore, setSelectedStore] = useState(ALL_STORES);
  const [selectedCampaign, setSelectedCampaign] = useState("ALL");
  const [isPromptHelperOpen, setIsPromptHelperOpen] = useState(false);
  const [promptHelperForm, setPromptHelperForm] = useState({
    sellingPoints: "",
    videoCount: "",
    durationRequirement: "",
    targetPetOrScene: "",
    mustShowShots: "",
    avoidShots: "",
    referenceLinks: "",
  });
  const [generatedChatGptPrompt, setGeneratedChatGptPrompt] = useState("");
  const [promptCopyStatus, setPromptCopyStatus] = useState("");
  const [aiDraft, setAiDraft] = useState<SettingsAiDraft | null>(null);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiDraftError, setAiDraftError] = useState("");
  const [aiDraftAppliedTo, setAiDraftAppliedTo] = useState("");
  const [deepSeekLoadingAction, setDeepSeekLoadingAction] =
    useState<DeepSeekAction | null>(null);
  const [deepSeekError, setDeepSeekError] = useState("");
  const [deepSeekChineseTranslation, setDeepSeekChineseTranslation] =
    useState("");
  const [deepSeekChineseExplanation, setDeepSeekChineseExplanation] =
    useState("");
  const [workbenchFilter, setWorkbenchFilter] = useState<{
    key: WorkbenchFilterKey;
    label: string;
  } | null>(null);
  const [editedCreatorReplies, setEditedCreatorReplies] = useState<
    Record<string, string>
  >({});
  const [isTranslationExpanded, setIsTranslationExpanded] = useState(false);
  const [isTranslationEditing, setIsTranslationEditing] = useState(false);
  const [isQueueExpanded, setIsQueueExpanded] = useState(true);
  const [onlyCurrentCreator, setOnlyCurrentCreator] = useState(false);
  const [isAdvancedReplyOpen, setIsAdvancedReplyOpen] = useState(false);
  const [showNextCreatorPrompt, setShowNextCreatorPrompt] = useState(false);
  const [showProcessedToday, setShowProcessedToday] = useState(false);
  const [showArchivedCollaborations, setShowArchivedCollaborations] =
    useState(false);
  const [showArchivedProducts, setShowArchivedProducts] = useState(false);
  const [creatorSearchStatus, setCreatorSearchStatus] = useState("");
  const [lastProcessingResult, setLastProcessingResult] = useState("");
  const queueRef = useRef<HTMLElement | null>(null);
  const currentCreatorRef = useRef<HTMLDivElement | null>(null);
  const messageAreaRef = useRef<HTMLDivElement | null>(null);

  const mergedCampaigns = useMemo(
    () =>
      mergeDetectedCampaigns(
        campaigns,
        rows.map(normalizeCreatorRowStore),
        filmingRequirements,
      ),
    [campaigns, rows, filmingRequirements],
  );
  const stores = useMemo(() => {
    const byId = new Map<string, string>();
    rows.forEach((row) => {
      const id = rowStoreId(row);
      if (!byId.has(id)) byId.set(id, normalizeStoreName(row.storeName));
    });
    mergedCampaigns.forEach((campaign) => {
      if (campaign.archivedAt && !showArchivedProducts) return;
      const id = normalizeStoreId(campaign.storeId, campaign.storeName);
      const name = normalizeStoreName(campaign.storeName);
      if (!byId.has(id) || byId.get(id) === DEFAULT_STORE_NAME)
        byId.set(id, name);
    });
    if (byId.size === 0) byId.set(DEFAULT_STORE_ID, DEFAULT_STORE_NAME);
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [rows, mergedCampaigns, showArchivedProducts]);
  const storeFilteredCampaigns = useMemo(
    () =>
      mergedCampaigns.filter(
        (campaign) =>
          selectedStore === ALL_STORES ||
          normalizeStoreId(campaign.storeId, campaign.storeName) ===
            selectedStore,
      ),
    [mergedCampaigns, selectedStore],
  );
  const activeCampaigns = useMemo(
    () =>
      storeFilteredCampaigns.filter(
        (campaign) => showArchivedProducts || !campaign.archivedAt,
      ),
    [storeFilteredCampaigns, showArchivedProducts],
  );
  const showStoreLabels =
    selectedStore === ALL_STORES &&
    stores.some((store) => store.name !== DEFAULT_STORE_NAME);
  const activeCampaign =
    selectedCampaign === "ALL"
      ? undefined
      : (activeCampaigns.find(
          (campaign) => campaignOptionValue(campaign) === selectedCampaign,
        ) ??
        mergedCampaigns.find(
          (campaign) => campaignOptionValue(campaign) === selectedCampaign,
        ));
  /**
   * The campaign the Settings page edits, and the one an AI draft is generated
   * for and written back to. Generation and apply must agree on this, otherwise
   * the draft describes one product and lands on another.
   */
  const settingsTargetCampaign =
    activeCampaign ?? activeCampaigns[0] ?? mergedCampaigns[0];
  const selectedCampaignName =
    selectedCampaign === "ALL"
      ? "全部产品"
      : activeCampaign
        ? campaignLabel(activeCampaign, showStoreLabels)
        : "产品项目不可用";
  const activeFilmingRequirements = useMemo(
    () => campaignToFilmingRequirements(activeCampaign, filmingRequirements),
    [activeCampaign, filmingRequirements],
  );
  const requiredVideos = useMemo(
    () => parseRequiredVideos(activeFilmingRequirements),
    [activeFilmingRequirements],
  );
  // Memoized so the derivations below can depend on these directly instead of
  // restating their inputs, and so they are declared before their first use.
  const campaignForRow = useCallback(
    (
      row: Pick<
        CreatorRow,
        "storeId" | "storeName" | "product" | "campaignId" | "productId"
      >,
    ): Campaign | undefined =>
      mergedCampaigns.find((campaign) =>
        rowMatchesCampaignIdentity(row, campaign),
      ),
    [mergedCampaigns],
  );
  const requiredVideosForRow = useCallback(
    (row: CreatorRow): number =>
      parseRequiredVideos(
        campaignToFilmingRequirements(
          campaignForRow(row),
          activeFilmingRequirements,
        ),
      ),
    [campaignForRow, activeFilmingRequirements],
  );
  const scopedRows = useMemo(
    () =>
      selectedCampaign === "ALL"
        ? rows.filter(
            (row) =>
              rowMatchesStore(row, selectedStore) &&
              (showArchivedProducts || !campaignForRow(row)?.archivedAt),
          )
        : rows.filter((row) =>
            activeCampaign ? rowMatchesCampaign(row, activeCampaign) : false,
          ),
    [
      rows,
      selectedStore,
      selectedCampaign,
      activeCampaign,
      showArchivedProducts,
      campaignForRow,
    ],
  );
  const visibleRows = useMemo(
    () =>
      scopedRows.filter(
        (row) => showArchivedCollaborations || !isArchivedCollaboration(row),
      ),
    [scopedRows, showArchivedCollaborations],
  );
  const dailyQueueRows = useMemo(
    () =>
      visibleRows.filter((row) =>
        isActiveDailyCollaboration(row, requiredVideosForRow(row)),
      ),
    [visibleRows, requiredVideosForRow],
  );
  const tasks = useMemo(
    () =>
      dailyQueueRows
        .flatMap((row) =>
          analyzeCreators([row], undefined, requiredVideosForRow(row)),
        )
        .sort((a, b) => compareTasks(a, b)),
    [dailyQueueRows, requiredVideosForRow],
  );
  const historicalTasks = useMemo(
    () =>
      scopedRows.flatMap((row) =>
        analyzeCreators([row], undefined, requiredVideosForRow(row)),
      ),
    [scopedRows, requiredVideosForRow],
  );
  const usesHistoricalTaskSource =
    workbenchFilter?.key === "published_video" ||
    workbenchFilter?.key === "completed" ||
    workbenchFilter?.key === "failed";
  const workbenchTasks = usesHistoricalTaskSource ? historicalTasks : tasks;
  const highestPendingCount = workbenchTasks.filter(
    (task) => task.priority === "Highest" && !isHandledToday(task),
  ).length;
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const activeSampleCounts = useMemo(
    () =>
      new Map(
        rows.map((row) => [row.id, countActiveCreatorSamples(row, rows)]),
      ),
    [rows],
  );
  const matchesWorkbenchFilter = useCallback(
    (task: Task, key: WorkbenchFilterKey) => {
      const taskRequiredVideos = requiredVideosForRow(task);
      const status = inferStatus(task, taskRequiredVideos);
      const taskMeta = tasksById.get(task.id);
      const progress = normalizeVideoProgress(
        task.videoProgress,
        taskRequiredVideos,
      );
      switch (key) {
        case "follow_up_today":
          return (
            Boolean(taskMeta?.needsFollowUp || task.needsFollowUp) &&
            !isHandledToday(task)
          );
        case "processed_today":
          return isHandledToday(task);
        case "sample_shipped":
          return isSampleInTransitForDaily(task, taskRequiredVideos);
        case "delivered_waiting_video":
          return (
            isSampleDeliveredForVideo(task, taskRequiredVideos) &&
            (progress.postedCount ?? 0) === 0
          );
        case "published_video":
          return (progress.postedCount ?? 0) > 0;
        case "posted_this_week":
          return (
            isCurrentWeek(task.firstVideoPostedDate) ||
            isCurrentWeek(task.latestVideoPostedDate ?? "")
          );
        case "completed":
          return status === "Completed";
        case "failed":
          return status === "Lost";
        default:
          return true;
      }
    },
    [requiredVideosForRow, tasksById],
  );

  function queueStatusLabel(task: Task) {
    const handledToday = isHandledToday(task);
    const latestTodayEntry = task.followUpHistory
      ?.slice()
      .reverse()
      .find((entry) => entry.date === todayString());
    if (handledToday && latestTodayEntry?.action === "No Reply") {
      return `今日已处理 · 未回复 · 明日再跟进`;
    }
    if (handledToday && latestTodayEntry?.action === "Skipped Today") {
      const note = latestTodayEntry.note
        ?.replace(/^今日暂不跟进。?/, "")
        .trim();
      return `今日已处理 · 今日已跳过${note ? ` · ${note}` : ""}`;
    }
    if (handledToday && task.trackingStatus)
      return `今日已处理 · ${task.trackingStatus}`;
    if (task.trackingStatus) return task.trackingStatus;
    return priorityActionLabel(task);
  }

  const filteredTasks = useMemo(() => {
    const normalized = followupSearch.trim().toLowerCase();
    return workbenchTasks
      .filter((task) => {
        const urgencyLabel =
          task.priority === "Highest"
            ? "最高"
            : task.priority === "High"
              ? "高"
              : task.priority === "Medium"
                ? "中"
                : "低";
        const haystack = [
          task.username,
          task.profileLink,
          task.storeName,
          task.product,
          task.currentStatus,
          task.sampleShippingStatus,
          task.suggestedAction,
          task.triggerReason,
          task.trackingStatus ?? "",
          task.notes,
          urgencyLabel,
        ]
          .join(" ")
          .toLowerCase();
        return (
          (showProcessedToday ||
            usesHistoricalTaskSource ||
            !isHandledToday(task)) &&
          (!workbenchFilter ||
            matchesWorkbenchFilter(task, workbenchFilter.key)) &&
          (followupUrgency === "All" || task.priority === followupUrgency) &&
          (!normalized || haystack.includes(normalized))
        );
      })
      .sort((a, b) => compareTasks(a, b));
  }, [
    workbenchTasks,
    followupSearch,
    followupUrgency,
    workbenchFilter,
    matchesWorkbenchFilter,
    showProcessedToday,
    usesHistoricalTaskSource,
  ]);
  const selectedTask =
    (selectedCreatorId &&
      workbenchTasks.find((task) => task.id === selectedCreatorId)) ||
    filteredTasks[0];
  const selectedTemplateCreator =
    visibleRows.find((row) => row.id === templateCreatorId) ??
    visibleRows.find((row) => row.id === selectedCreatorId);

  const currentTaskIndex = selectedTask
    ? filteredTasks.findIndex((task) => task.id === selectedTask.id)
    : -1;
  const nextTask =
    currentTaskIndex >= 0
      ? filteredTasks.find(
          (task, index) =>
            index > currentTaskIndex && task.id !== selectedTask?.id,
        )
      : filteredTasks[0];

  function scrollToQueue() {
    window.requestAnimationFrame(() =>
      queueRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      }),
    );
  }

  function scrollToCurrentCreator() {
    window.requestAnimationFrame(() =>
      currentCreatorRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      }),
    );
  }

  function scrollToMessageArea() {
    window.requestAnimationFrame(() =>
      (messageAreaRef.current ?? currentCreatorRef.current)?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      }),
    );
  }

  function handleSelectCreator(creatorId: string) {
    setSelectedCreatorId(creatorId);
    setIsQueueExpanded(false);
    setShowNextCreatorPrompt(false);
    setDeepSeekError("");
    setDeepSeekChineseTranslation("");
    setDeepSeekChineseExplanation("");
    setIsTranslationEditing(false);
    setMessageSource("local");
    const selected = workbenchTasks.find((task) => task.id === creatorId);
    setMessage(selected ? buildLocalMessageForTask(selected) : null);
    scrollToCurrentCreator();
  }

  function handleProcessNextCreator() {
    if (!nextTask) {
      setTrackingStatus("当前筛选下暂无更多待处理达人。");
      setLastProcessingResult("当前筛选下暂无更多待处理达人。");
      return;
    }
    setMessageSource("local");
    setTrackingStatus("");
    setLastProcessingResult("");
    setShowNextCreatorPrompt(false);
    setIsQueueExpanded(false);
    handleSelectCreator(nextTask.id);
  }
  const templateMessages = useMemo(
    () => buildTemplateMessages(templateForm),
    [templateForm],
  );

  useEffect(() => saveCreatorRows(rows), [rows]);

  useEffect(() => saveCampaigns(mergedCampaigns), [mergedCampaigns]);
  /*
   * A store or campaign can stop existing while it is selected — deleted,
   * archived, or merged away in Settings. Correcting that during render rather
   * than from an effect means the invalid selection is never rendered and no
   * second render is needed.
   *
   * Both branches terminate: the replacement store is either ALL_STORES or one
   * that exists, and the replacement campaign is "ALL", so neither condition
   * can still hold on the immediate re-render.
   */
  if (
    selectedStore !== ALL_STORES &&
    !stores.some((store) => store.id === selectedStore)
  ) {
    setSelectedStore(stores[0]?.id ?? ALL_STORES);
    setSelectedCampaign("ALL");
    setToast({ tone: "warning", text: "当前店铺不存在，已切换到可用店铺。" });
  } else if (
    selectedCampaign !== "ALL" &&
    !activeCampaigns.some(
      (campaign) => campaignOptionValue(campaign) === selectedCampaign,
    )
  ) {
    setSelectedCampaign("ALL");
    setToast({
      tone: "warning",
      text: "当前产品项目不存在或不属于当前店铺，已切换到全部产品。",
    });
  }
  /**
   * The template form refills only when the operator picks a different campaign
   * or creator — identified here by id, not by object identity.
   *
   * This used to run from two effects keyed on `mergedCampaigns`, which changes
   * whenever any campaign is edited anywhere. Editing an unrelated field on the
   * Settings page therefore wiped whatever the operator was typing here. Edits
   * now survive until they actually change the selection.
   *
   * Adjusting state during render rather than in an effect is React's own
   * pattern for this, and avoids the extra render an effect would cause.
   */
  const templateCampaignTarget = activeCampaign ?? mergedCampaigns[0];
  const templateSyncKey = `${
    templateCampaignTarget ? campaignOptionValue(templateCampaignTarget) : ""
  }|${selectedTemplateCreator?.id ?? ""}`;
  const [syncedTemplateKey, setSyncedTemplateKey] = useState<string | null>(
    null,
  );

  /**
   * Fills the form from the selected campaign and creator. Used both by the
   * automatic refill on selection change and by the manual refill button, so
   * the two can never drift apart.
   */
  const fillTemplateFormFromSources = useCallback(
    (form: TemplateForm): TemplateForm => {
      let next = form;

      if (templateCampaignTarget) {
        const target = templateCampaignTarget;
        next = {
          ...next,
          productName: target.productName,
          sellingPoint: target.sellingPoints,
          requirement: target.keyContentPoints.filter(Boolean).join("; "),
          length: target.videoLength || next.length,
          videos:
            target.videoCount ||
            String(
              parseRequiredVideos(
                campaignToFilmingRequirements(target, filmingRequirements),
              ),
            ),
          tagRequirement:
            [target.tagRequirement, target.productLink]
              .filter(Boolean)
              .join("; ") || next.tagRequirement,
        };
      }

      if (selectedTemplateCreator) {
        const creatorRequirements = campaignToFilmingRequirements(
          campaignForRow(selectedTemplateCreator),
          activeFilmingRequirements,
        );
        const trackingNumber = parseNumberFromNotes(
          selectedTemplateCreator.notes,
          ["tracking", "tracking number"],
        );
        next = {
          ...next,
          creatorName: selectedTemplateCreator.username || next.creatorName,
          productName:
            selectedTemplateCreator.product || creatorRequirements.productName,
          sellingPoint: creatorRequirements.sellingPoints || next.sellingPoint,
          requirement: creatorRequirements.requiredScenes || next.requirement,
          length: creatorRequirements.videoLength || next.length,
          videos:
            creatorRequirements.videoCount ||
            String(parseRequiredVideos(creatorRequirements)),
          tagRequirement:
            creatorRequirements.productLinkRequirement || next.tagRequirement,
          trackingNumber:
            trackingNumber === "—" ? next.trackingNumber : trackingNumber,
          deadline: selectedTemplateCreator.nextFollowUpDate || next.deadline,
        };
      }

      return next;
    },
    [
      templateCampaignTarget,
      selectedTemplateCreator,
      campaignForRow,
      filmingRequirements,
      activeFilmingRequirements,
    ],
  );

  if (templateSyncKey !== syncedTemplateKey) {
    setSyncedTemplateKey(templateSyncKey);
    setTemplateForm(fillTemplateFormFromSources);
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const databaseRows = scopedRows;
  const productTotalCount = databaseRows.length;
  const archivedProductCount = databaseRows.filter(
    isArchivedCollaboration,
  ).length;
  const databaseVisibleRows = useMemo(
    () =>
      databaseRows.filter(
        (row) => showArchivedCollaborations || !isArchivedCollaboration(row),
      ),
    [databaseRows, showArchivedCollaborations],
  );

  const enrichedRows = useMemo(
    () =>
      databaseVisibleRows.map((row) => ({
        row,
        task: tasksById.get(row.id),
        status: inferStatus(row, requiredVideosForRow(row)),
        creatorType: creatorType(row),
        followers: followerCount(row),
        avgViews: avgViews(row),
        gmv: gmvRange(row),
      })),
    [databaseVisibleRows, tasksById, requiredVideosForRow],
  );

  const archivedSearchMatches = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized || showArchivedCollaborations) return [];
    return databaseRows.filter((row) => {
      if (!isArchivedCollaboration(row)) return false;
      return [
        row.username,
        row.profileLink,
        row.product,
        row.currentStatus,
        row.sampleShippingStatus,
        row.notes,
        row.trackingStatus ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [databaseRows, search, showArchivedCollaborations]);

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return enrichedRows.filter((entry) => {
      const haystack = [
        entry.row.username,
        entry.row.profileLink,
        entry.row.storeName,
        entry.row.product,
        entry.row.currentStatus,
        entry.row.sampleShippingStatus,
        entry.row.notes,
        entry.status,
      ]
        .join(" ")
        .toLowerCase();
      return (
        (!normalized || haystack.includes(normalized)) &&
        (statusFilter === "All" || entry.status === statusFilter) &&
        (creatorTypeFilter === "All" ||
          entry.creatorType
            .toLowerCase()
            .includes(creatorTypeFilter.toLowerCase())) &&
        (followerFilter === "All" ||
          entry.followers.includes(followerFilter)) &&
        (avgViewsFilter === "All" || entry.avgViews.includes(avgViewsFilter)) &&
        (gmvFilter === "All" ||
          entry.gmv.toLowerCase().includes(gmvFilter.toLowerCase()))
      );
    });
  }, [
    enrichedRows,
    search,
    statusFilter,
    creatorTypeFilter,
    followerFilter,
    avgViewsFilter,
    gmvFilter,
  ]);

  const creatorDatabaseRows = useMemo<CreatorDatabaseRowView[]>(
    () =>
      filteredRows.map((entry) => {
        const duplicate = getDuplicateCheck(entry.row, rows);
        return {
          row: entry.row,
          displayName: displayName(entry.row),
          archived: isArchivedCollaboration(entry.row),
          canRestore:
            isArchivedCollaboration(entry.row) &&
            entry.row.archiveReason === "Manual",
          duplicate: {
            possibleDuplicate: duplicate.possibleDuplicate,
            multiSample: duplicate.multiSample,
            crossStoreCreator: duplicate.crossStoreCreator,
          },
        };
      }),
    [filteredRows, rows],
  );

  const creatorStatusOptions: CreatorStatusOption[] = creatorStatuses.map(
    (status) => ({ value: status, label: displayStatus(status) }),
  );

  const processedTodayCount = tasks.filter((task) =>
    isHandledToday(task),
  ).length;
  const pendingFollowUpCount = tasks.filter(
    (task) => task.needsFollowUp && !isHandledToday(task),
  ).length;

  const activeEnrichedRows = enrichedRows.filter((entry) =>
    isActiveDailyCollaboration(entry.row, requiredVideosForRow(entry.row)),
  );

  const deliveredWaitingVideoCount = activeEnrichedRows.filter((entry) => {
    const rowRequiredVideos = requiredVideosForRow(entry.row);
    const { posted } = videoProgressCounts(entry.row, rowRequiredVideos);
    return (
      isSampleDeliveredForVideo(entry.row, rowRequiredVideos) && posted === 0
    );
  }).length;
  const postedVideoCount = scopedRows.reduce(
    (sum, row) =>
      sum + videoProgressCounts(row, requiredVideosForRow(row)).posted,
    0,
  );
  const postedThisWeekCount = activeEnrichedRows.reduce((count, entry) => {
    const dateSet = new Set(
      [
        entry.row.firstVideoPostedDate,
        entry.row.latestVideoPostedDate ?? "",
      ].filter((date) => date && isCurrentWeek(date)),
    );
    return count + dateSet.size;
  }, 0);

  const dashboardCards: DashboardMetricCardView[] = [
    {
      label: "今日待跟进达人数量",
      value: pendingFollowUpCount,
      filterKey: "follow_up_today",
    },
    {
      label: "今日已处理达人人数",
      value: processedTodayCount,
      filterKey: "processed_today",
    },
    {
      label: "已签收待发视频数量",
      value: deliveredWaitingVideoCount,
      filterKey: "delivered_waiting_video",
    },
    {
      label: "已发布视频数量",
      value: postedVideoCount,
      filterKey: "published_video",
    },
    {
      label: "本周发布数量",
      value: postedThisWeekCount,
      filterKey: "posted_this_week",
    },
    {
      label: "合作完成数量",
      value: databaseRows.filter(
        (row) => inferStatus(row, requiredVideosForRow(row)) === "Completed",
      ).length,
      filterKey: "completed",
    },
    {
      label: "合作失败数量",
      value: databaseRows.filter(
        (row) => inferStatus(row, requiredVideosForRow(row)) === "Lost",
      ).length,
      filterKey: "failed",
    },
    {
      label: "样品运输中数量",
      value: activeEnrichedRows.filter((entry) =>
        isSampleInTransitForDaily(entry.row, requiredVideosForRow(entry.row)),
      ).length,
      filterKey: "sample_shipped",
    },
  ];

  const dashboardCampaignCards: DashboardCampaignCardView[] =
    storeFilteredCampaigns.map((campaign) => {
      const stats = campaignStats(campaign);
      const label = campaignLabel(campaign, showStoreLabels);
      return {
        value: campaignOptionValue(campaign),
        label,
        ariaLabel: `${label}${stats.creatorCount} 位达人`,
        creatorCount: stats.creatorCount,
        activeCount: stats.activeCount,
        todayFollowUp: stats.todayFollowUp,
        highPriority: stats.highPriority,
        inTransit: stats.inTransit,
        deliveredPending: stats.deliveredPending,
        postedVideos: stats.postedVideos,
        completed: stats.completed,
        failed: stats.failed,
      };
    });

  const dashboardQueueItems = filteredTasks.map((task) => ({
    id: task.id,
    creatorHandle: creatorHandle(task),
    priorityLabel: priorityLabel(task),
    statusLabel: queueStatusLabel(task),
    multiSample: (activeSampleCounts.get(task.id) ?? 0) > 1,
    subLine: `${selectedStore === ALL_STORES ? `${task.storeName || DEFAULT_STORE_NAME} · ` : ""}${task.product || "缺少产品名称"} · ${task.currentStatus || displayStatus(inferStatus(task, requiredVideosForRow(task)))}`,
  }));

  const dashboardSelectedCreator: DashboardCreatorView | null = selectedTask
    ? {
        id: selectedTask.id,
        displayName: displayName(selectedTask),
        storeName: selectedTask.storeName || DEFAULT_STORE_NAME,
        productName: selectedTask.product || "缺少产品名称",
        statusLabel:
          selectedTask.currentStatus ||
          displayStatus(
            inferStatus(selectedTask, requiredVideosForRow(selectedTask)),
          ),
        priorityLabel: priorityLabel(selectedTask),
        triggerReason: selectedTask.triggerReason,
        suggestedAction: selectedTask.suggestedAction,
        trackingStatus: selectedTask.trackingStatus || "—",
        notes: selectedTask.notes.trim() || "—",
        crossStoreCreator: getDuplicateCheck(selectedTask, rows)
          .crossStoreCreator,
        otherActiveSampleCount: Math.max(
          (activeSampleCounts.get(selectedTask.id) ?? 1) - 1,
          0,
        ),
        filmingRequirements: campaignRequirementEntries(
          selectedTaskCampaignRequirements(selectedTask),
        ),
        moreInfo: [
          { label: "联系渠道", value: channel },
          { label: "最近联系日期", value: selectedTask.lastContactDate || "—" },
          {
            label: "样品状态",
            value: selectedTask.sampleShippingStatus || "—",
          },
          {
            label: "样品到货日期",
            value: selectedTask.sampleDeliveredDate || "—",
          },
          { label: "视频进度", value: selectedTask.videoProgress || "—" },
          {
            label: "首条视频发布时间",
            value: selectedTask.firstVideoPostedDate || "—",
          },
          {
            label: "最近回复日期",
            value:
              selectedTask.followUpHistory
                ?.slice()
                .reverse()
                .find((entry) => entry.action === "Creator Replied")?.date ||
              "—",
          },
          { label: "主页链接", value: selectedTask.profileLink || "—" },
        ],
      }
    : null;

  const shouldShowReplyBlock = Boolean(
    selectedTask &&
    (message ||
      (selectedTask.trackingStatus ?? "").match(
        /Replied|Reply Pending|达人已回复|达人回复待处理/i,
      ) ||
      selectedTask.lastCreatorResponse?.trim() ||
      selectedTask.notes.trim()),
  );
  const isHistoricalReadOnly = Boolean(
    selectedTask &&
    (usesHistoricalTaskSource || isArchivedCollaboration(selectedTask)),
  );
  const deepSeekDisplayError = deepSeekError
    ? deepSeekError.includes("DEEPSEEK_API_KEY")
      ? "未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。"
      : "DeepSeek 调用失败，请检查 API Key 或稍后重试。"
    : "";
  const dashboardMessageComposerProps: MessageComposerProps | null =
    shouldShowReplyBlock && selectedTask
      ? {
          data: {
            creatorReply: currentCreatorReply(selectedTask),
            notes: selectedTask.notes,
            channel,
            chineseTranslation: deepSeekChineseTranslation,
            errorMessage: deepSeekDisplayError,
            message,
            messageSource,
            chineseExplanation: deepSeekChineseExplanation,
            trackingStatus,
            lastProcessingResult,
            hasNextTask: Boolean(nextTask),
          },
          uiState: {
            historicalReadOnly: isHistoricalReadOnly,
            loadingAction: deepSeekLoadingAction,
            translationExpanded: isTranslationExpanded,
            translationEditing: isTranslationEditing,
            advancedReplyOpen: isAdvancedReplyOpen,
            replyFocus,
            relationshipNote: replyRelationshipNote,
            replyTone,
            replyGoal,
            replyConcession,
            showNextCreatorPrompt,
            messageOutputRef: messageAreaRef,
          },
          actions: {
            updateCreatorReply: (value) =>
              updateCurrentCreatorReply(selectedTask, value),
            updateNotes: (value) => updateRow(selectedTask.id, "notes", value),
            generateDeepSeekReply: () =>
              void callDeepSeek("generate_personalized_reply"),
            translateCreatorReply: () =>
              void callDeepSeek("translate_creator_reply"),
            copyTranslation: () =>
              void copyText(deepSeekChineseTranslation, "已复制中文翻译。"),
            updateTranslation: setDeepSeekChineseTranslation,
            setTranslationExpanded: setIsTranslationExpanded,
            setTranslationEditing: setIsTranslationEditing,
            setReplyFocus,
            setReplyTone,
            setAdvancedReplyOpen: setIsAdvancedReplyOpen,
            setRelationshipNote: setReplyRelationshipNote,
            setReplyGoal,
            setReplyConcession,
            updateEnglishMessage: updateGeneratedEnglishMessage,
            copyEnglishMessage: () => void handleCopyGeneratedMessage(),
            markMessageSent: handleMarkMessageSent,
            markCreatorReplied: handleMarkCreatorReplied,
            markCreatorNoReply,
            markVideoProgress,
            updateVideoProgressManually: handleManualVideoProgressUpdate,
            markCreatorOutcome,
            markCreatorSkippedToday,
            processNextCreator: handleProcessNextCreator,
            stayOnCurrentCreator: () => setShowNextCreatorPrompt(false),
          },
        }
      : null;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      setError("");
      const parsedRows = await parseCreatorFile(
        file,
        requiredVideos,
        selectedStore === ALL_STORES
          ? "未分配店铺"
          : (stores.find((store) => store.id === selectedStore)?.name ??
              DEFAULT_STORE_NAME),
      );
      const summary = buildDuplicateImportSummary(parsedRows, rows);
      const summaryText = `检测到 ${summary.possibleDuplicateCount} 个可能重复达人；检测到 ${summary.multiSampleCount} 个同达人多样品记录。`;
      setRows((currentRows) => [...parsedRows, ...currentRows]);
      setImportSummary(summaryText);
      setFileName(file.name);
      setSelectedIds([]);
      setToast({
        tone: "success",
        text: `导入成功，已追加 ${parsedRows.length} 条记录。${summaryText}`,
      });
      if (parsedRows.length === 0)
        setError("没有找到达人数据。请检查表头和表格内容。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法解析该文件。");
    }
  }

  function updateRow(
    rowId: string,
    field: EditableCreatorField,
    value: string,
  ) {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) return row;
        const rowRequiredVideos = requiredVideosForRow(row);
        let updated = updateCreatorField(row, field, value, rowRequiredVideos);
        if (field === "storeName") {
          const storeName = normalizeStoreName(value);
          const storeId = normalizeStoreId(undefined, storeName);
          const matchedCampaign = mergedCampaigns.find(
            (campaign) =>
              normalizeStoreId(campaign.storeId, campaign.storeName) ===
                storeId && campaign.productName === updated.product,
          );
          const campaignId =
            matchedCampaign?.id ?? campaignIdFromName(updated.product);
          updated = {
            ...updated,
            storeName,
            storeId,
            campaignId,
            productId:
              matchedCampaign?.productId ??
              productIdForCampaign(storeId, campaignId),
          };
        }
        if (field === "product") {
          const storeId = normalizeStoreId(updated.storeId, updated.storeName);
          const matchedCampaign = mergedCampaigns.find(
            (campaign) =>
              normalizeStoreId(campaign.storeId, campaign.storeName) ===
                storeId && campaign.productName === value,
          );
          const campaignId = matchedCampaign?.id ?? campaignIdFromName(value);
          updated = {
            ...updated,
            campaignId,
            productId:
              matchedCampaign?.productId ??
              productIdForCampaign(storeId, campaignId),
          };
          const newRequirement = parseRequiredVideos(
            campaignToFilmingRequirements(matchedCampaign, filmingRequirements),
          );
          const progress = normalizeVideoProgress(
            row.videoProgress,
            rowRequiredVideos,
          );
          if ((progress.postedCount ?? 0) === 0) {
            updated = {
              ...updated,
              videoProgress: `0/${newRequirement}`,
              videoProgressWarning: undefined,
            };
          } else if (
            window.confirm(
              "当前达人已有视频进度，是否根据新产品要求更新视频数量？",
            )
          ) {
            updated = {
              ...updated,
              videoProgress: `${progress.postedCount}/${newRequirement}`,
              videoProgressWarning: undefined,
            };
          }
        }
        if (
          field === "username" ||
          field === "profileLink" ||
          field === "product"
        ) {
          const duplicate = getDuplicateCheck(updated, currentRows);
          if (duplicate.possibleDuplicate) {
            setToast({
              tone: "warning",
              text: "该达人在当前店铺的同一产品项目下可能已重复录入，建议检查是否需要合并。",
            });
          } else if (duplicate.duplicateCreator) {
            setToast({
              tone: "warning",
              text: duplicate.crossStoreCreator
                ? "跨店铺达人：该达人在其他店铺也有合作记录，请确认本次沟通是否需要区分店铺。"
                : "同店铺多样品：该达人在当前店铺有不同产品合作，可继续保存。",
            });
          }
        }
        return updated;
      }),
    );
    setMessage(null);
    setMessageSource("local");
  }

  function archiveCreator(rowId: string) {
    const today = todayString();
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              archivedAt: today,
              archiveReason: "Manual",
              nextFollowUpDate: "",
              followUpHistory: [
                ...(row.followUpHistory ?? []),
                {
                  date: today,
                  action: "Archived",
                  note: "从达人数据库手动归档。",
                },
              ],
            }
          : row,
      ),
    );
    setSelectedIds((current) => current.filter((id) => id !== rowId));
    setToast({ tone: "success", text: "达人合作已归档，历史记录仍会保留。" });
  }

  function restoreCreator(rowId: string) {
    const today = todayString();
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              archivedAt: undefined,
              archiveReason: undefined,
              followUpHistory: [
                ...(row.followUpHistory ?? []),
                {
                  date: today,
                  action: "Restored",
                  note: "从达人数据库恢复到 active workflow。",
                },
              ],
            }
          : row,
      ),
    );
    setToast({ tone: "success", text: "达人合作已恢复到 active workflow。" });
  }

  function handleDashboardCardClick(card: (typeof dashboardCards)[number]) {
    setActiveModule("dashboard");
    setWorkbenchFilter({ key: card.filterKey, label: card.label });
    setFollowupSearch("");
    setFollowupUrgency("All");
    setShowProcessedToday(card.filterKey === "processed_today");
    setOnlyCurrentCreator(false);
    setIsQueueExpanded(true);
    const cardTaskSource =
      card.filterKey === "published_video" ||
      card.filterKey === "completed" ||
      card.filterKey === "failed"
        ? historicalTasks
        : tasks;
    const firstMatch = cardTaskSource.find((task) =>
      matchesWorkbenchFilter(task, card.filterKey),
    );
    setSelectedCreatorId(firstMatch?.id ?? "");
    setMessage(firstMatch ? buildLocalMessageForTask(firstMatch) : null);
    setMessageSource("local");
    setShowNextCreatorPrompt(false);
    scrollToQueue();
  }

  function ensureCampaign(
    productName: string,
    storeId: string,
    storeName: string,
  ) {
    if (
      !mergedCampaigns.some(
        (campaign) =>
          normalizeStoreId(campaign.storeId, campaign.storeName) === storeId &&
          campaign.productName === productName,
      )
    ) {
      setCampaigns((current) => [
        ...current,
        createCampaignFromName(
          productName,
          filmingRequirements,
          storeName,
          storeId,
        ),
      ]);
    }
  }

  function addCreatorDraft(draft: CreatorRow, copyBaseFrom?: CreatorRow) {
    const newRow = copyBaseFrom
      ? copyCreatorBaseFields(draft, copyBaseFrom)
      : draft;
    ensureCampaign(
      newRow.product,
      normalizeStoreId(newRow.storeId, newRow.storeName),
      normalizeStoreName(newRow.storeName),
    );
    setRows((currentRows) => [newRow, ...currentRows]);
    setSelectedCreatorId(newRow.id);
    setActiveModule("creators");
    setPendingDuplicateAdd(null);
    setToast({ tone: "success", text: "已新增达人，可直接编辑表格字段。" });
  }

  function handleAddCreator() {
    const creatorName =
      window.prompt("达人账号（可留空后在表格中填写）：", "")?.trim() ?? "";
    let draftStore =
      selectedStore === ALL_STORES
        ? undefined
        : stores.find((store) => store.id === selectedStore);

    if (!draftStore) {
      if (stores.length === 1) {
        draftStore = stores[0];
      } else {
        const storeChoice = window
          .prompt(
            `请选择店铺/品牌后再新增达人：${stores.map((store) => store.name).join(" / ")}`,
            "",
          )
          ?.trim();
        draftStore = stores.find(
          (store) =>
            store.id === storeChoice ||
            store.name.toLowerCase() === (storeChoice ?? "").toLowerCase(),
        );
        if (!draftStore) {
          setToast({ tone: "warning", text: "请选择店铺/品牌后再新增达人" });
          setActiveModule("creators");
          return;
        }
      }
    }

    const storeId = draftStore.id;
    const storeName = draftStore.name;
    const storeCampaigns = mergedCampaigns.filter(
      (campaign) =>
        normalizeStoreId(campaign.storeId, campaign.storeName) === storeId &&
        (showArchivedProducts || !campaign.archivedAt),
    );
    const defaultProduct =
      activeCampaign &&
      normalizeStoreId(activeCampaign.storeId, activeCampaign.storeName) ===
        storeId
        ? activeCampaign.productName
        : (storeCampaigns[0]?.productName ?? filmingRequirements.productName);
    const choice = window.prompt(
      `所属产品（仅限 ${storeName}；同达人多样品时必须填写不同产品 / 样品项目）：`,
      defaultProduct,
    );
    const productName = choice?.trim() || defaultProduct;
    const matchedCampaign = storeCampaigns.find(
      (campaign) => campaign.productName === productName,
    );
    const productRequirement = parseRequiredVideos(
      campaignToFilmingRequirements(matchedCampaign, filmingRequirements),
    );
    const draft = {
      ...createBlankCreatorRow(
        productName,
        productRequirement,
        storeId,
        storeName,
        matchedCampaign?.id ?? campaignIdFromName(productName),
        matchedCampaign?.productId ??
          productIdForCampaign(
            storeId,
            matchedCampaign?.id ?? campaignIdFromName(productName),
          ),
      ),
      username: creatorName,
    };
    const duplicate = getDuplicateCheck(draft, rows);
    if (
      creatorName &&
      duplicate.duplicateCreator &&
      duplicate.matchingRows[0]
    ) {
      setPendingDuplicateAdd({ draft, existing: duplicate.matchingRows[0] });
      setToast({
        tone: "warning",
        text: duplicate.possibleDuplicate
          ? "该达人在当前店铺的同一产品项目下可能已重复录入，建议检查是否需要合并。"
          : "同店铺多样品：该达人在当前店铺有不同产品合作，可继续保存。",
      });
      setActiveModule("creators");
      return;
    }
    if (creatorName && duplicate.multiSample) {
      setToast({
        tone: "warning",
        text: "同店铺多样品：该达人在当前店铺有不同产品合作，可继续保存。",
      });
    } else if (creatorName && duplicate.crossStoreCreator) {
      setToast({
        tone: "warning",
        text: "跨店铺达人：该达人在其他店铺也有合作记录，请确认本次沟通是否需要区分店铺。",
      });
    }
    addCreatorDraft(draft);
  }

  function toggleSelected(rowId: string) {
    setSelectedIds((ids) =>
      ids.includes(rowId) ? ids.filter((id) => id !== rowId) : [...ids, rowId],
    );
  }

  function toggleAllFilteredCreators(checked: boolean) {
    setSelectedIds(checked ? filteredRows.map((entry) => entry.row.id) : []);
  }

  function applyStatusToRows(ids: string[], status: CreatorStatus) {
    setRows((currentRows) =>
      currentRows.map((row) =>
        ids.includes(row.id) ? { ...row, currentStatus: status } : row,
      ),
    );
    setToast({
      tone: "success",
      text: `已更新 ${ids.length} 位达人状态为 ${displayStatus(status)}。`,
    });
  }

  function selectedRowsSpanMultipleStores() {
    const storeIds = new Set(
      rows.filter((row) => selectedIds.includes(row.id)).map(rowStoreId),
    );
    return storeIds.size > 1;
  }

  function handleBulkStatusUpdate() {
    if (selectedIds.length === 0) return;
    if (
      selectedRowsSpanMultipleStores() &&
      !window.confirm(
        "本次选择包含多个店铺的达人记录，请确认是否继续批量操作。",
      )
    )
      return;
    applyStatusToRows(selectedIds, bulkStatus);
  }

  async function copyText(text: string, successText = "复制成功。") {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ tone: "success", text: successText });
    } catch {
      setToast({ tone: "warning", text: "复制失败，请手动复制。" });
    }
  }

  function copyCreatorOutreach(rowId: string) {
    const row = rows.find((candidate) => candidate.id === rowId);
    if (!row) return;
    void copyText(buildOutreachForRow(row), "已复制邀约话术。");
  }

  function buildOutreachForRow(row: CreatorRow) {
    const campaignRequirements = campaignToFilmingRequirements(
      campaignForRow(row),
      filmingRequirements,
    );
    const product = outgoingEnglishValue(
      row.product || campaignRequirements.productName,
      "[Product Name]",
    );
    const creator = outgoingEnglishValue(
      displayName(row),
      "[Creator Name]",
    ).replace(/^@/, "");
    const greetingName = creator.startsWith("[") ? creator : `@${creator}`;
    return `Hi ${greetingName}, this is for ${row.storeName || DEFAULT_STORE_NAME}. We love your TikTok pet content and would like to invite you to collaborate on ${product}. Are you open to receiving a sample and creating ${parseRequiredVideos(campaignRequirements)} TikTok Shop video(s)?`;
  }

  function handleBulkCopyOutreach() {
    const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
    if (selectedRows.length === 0) return;
    if (
      selectedRowsSpanMultipleStores() &&
      !window.confirm(
        "本次选择包含多个店铺的达人记录，请确认是否继续批量操作。",
      )
    )
      return;
    void copyText(
      selectedRows.map(buildOutreachForRow).join("\n\n---\n\n"),
      `已复制 ${selectedRows.length} 条邀约话术。`,
    );
  }

  function buildLocalMessageForTask(task: Task): GeneratedMessage {
    const creatorCampaign = campaignForRow(task);
    return generateMessage(
      task,
      channel,
      campaignToFilmingRequirements(creatorCampaign, activeFilmingRequirements),
      replyFocus,
      {
        relationshipNote: replyRelationshipNote,
        replyTone,
        replyGoal,
        acceptableConcession: replyConcession,
      },
    );
  }

  useEffect(() => {
    if (!selectedTask) {
      setMessage(null);
      setMessageSource("local");
      return;
    }
    if (messageSource === "deepseek") return;
    setMessage(buildLocalMessageForTask(selectedTask));
    setMessageSource("local");
  }, [
    selectedTask?.id,
    selectedTask?.currentStatus,
    selectedTask?.sampleShippingStatus,
    selectedTask?.sampleDeliveredDate,
    selectedTask?.videoProgress,
    selectedTask?.lastFollowUpCount,
    selectedTask?.trackingStatus,
    selectedTask?.lastCreatorResponse,
    selectedTask?.notes,
    channel,
    replyFocus,
    replyRelationshipNote,
    replyTone,
    replyGoal,
    replyConcession,
    activeFilmingRequirements,
    mergedCampaigns,
    messageSource,
  ]);

  function handleGenerateMessage() {
    if (!selectedTask) return;
    const generated = buildLocalMessageForTask(selectedTask);
    setMessage(generated);
    setMessageSource("local");
    setSelectedCreatorId(selectedTask.id);
    setIsQueueExpanded(false);
    scrollToMessageArea();
  }

  function updateGeneratedEnglishMessage(english: string) {
    if (!message) return;
    setMessage({ ...message, english });
  }

  function baseCreatorReply(task: Task): string {
    const latestCreatorReply = task.followUpHistory
      ?.slice()
      .reverse()
      .find((entry) => entry.action === "Creator Replied" && entry.note?.trim())
      ?.note?.trim();
    return (
      task.lastCreatorResponse?.trim() ||
      latestCreatorReply ||
      task.notes.trim()
    );
  }

  function currentCreatorReply(task: Task): string {
    return editedCreatorReplies[task.id] ?? baseCreatorReply(task);
  }

  function updateCurrentCreatorReply(task: Task, value: string) {
    setEditedCreatorReplies((current) => ({ ...current, [task.id]: value }));
    setDeepSeekChineseTranslation("");
    setDeepSeekChineseExplanation("");
  }

  function selectedTaskCampaignRequirements(
    task: Task,
  ): CreatorFilmingRequirements {
    return campaignToFilmingRequirements(
      campaignForRow(task),
      activeFilmingRequirements,
    );
  }

  function campaignRequirementEntries(
    requirements: CreatorFilmingRequirements,
  ): Array<{ label: string; value: string }> {
    return [
      { label: "产品名称", value: requirements.productName },
      { label: "必须展示内容", value: requirements.requiredScenes },
      { label: "产品卖点", value: requirements.sellingPoints },
      { label: "视频时长要求", value: requirements.videoLength },
      { label: "视频数量要求", value: requirements.videoCount },
      { label: "不希望达人这样拍", value: requirements.avoidShots },
      {
        label: "挂车 / TikTok Shop 产品链接要求",
        value: requirements.productLinkRequirement,
      },
      { label: "参考视频链接", value: requirements.referenceVideoLinks },
    ];
  }

  function buildCampaignContext(task: Task): string {
    const campaign = campaignForRow(task);
    const requirements = campaignToFilmingRequirements(
      campaign,
      activeFilmingRequirements,
    );
    return [
      `店铺 / 品牌：${task.storeName}`,
      `产品名称：${task.product || requirements.productName}`,
      `必须展示内容：${requirements.requiredScenes}`,
      `产品卖点：${requirements.sellingPoints}`,
      `视频时长要求：${requirements.videoLength}`,
      `视频数量要求：${requirements.videoCount}`,
      `不希望达人这样拍：${requirements.avoidShots}`,
      `挂车 / TikTok Shop 产品链接要求：${requirements.productLinkRequirement}`,
      `参考视频链接：${requirements.referenceVideoLinks}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function buildDeepSeekPayload(task: Task, action: DeepSeekAction) {
    const campaign = campaignForRow(task);
    const requirements = campaignToFilmingRequirements(
      campaign,
      activeFilmingRequirements,
    );
    return {
      action,
      creatorUsername: displayName(task),
      storeName: task.storeName,
      creatorReply: currentCreatorReply(task),
      userReplyFocus: replyFocus,
      creatorRelationshipNote: replyRelationshipNote,
      replyTone,
      replyGoal,
      acceptableConcession: replyConcession,
      channel,
      productName: task.product || requirements.productName,
      requiredScenes: requirements.requiredScenes,
      productSellingPoints: requirements.sellingPoints,
      filmingRequirements: requirements.requiredScenes,
      requiredVideoCount: requirements.videoCount,
      requiredVideoLength: requirements.videoLength,
      doNotFilmLikeThis: requirements.avoidShots,
      productLinkRequirement: requirements.productLinkRequirement,
      referenceVideoLinks: requirements.referenceVideoLinks,
      currentStatus:
        task.currentStatus ||
        displayStatus(inferStatus(task, requiredVideosForRow(task))),
      campaignContext: buildCampaignContext(task),
      chineseUnderstanding: deepSeekChineseTranslation,
    };
  }

  function deepSeekErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return "DeepSeek 调用失败，请检查 API Key 或稍后重试。";
  }

  async function callDeepSeek(action: DeepSeekAction) {
    if (!selectedTask) return;
    setDeepSeekLoadingAction(action);
    setDeepSeekError("");
    try {
      if (action === "generate_personalized_reply" && !message) {
        setMessage(buildLocalMessageForTask(selectedTask));
        setMessageSource("local");
      }

      const response = await fetch("/api/deepseek-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDeepSeekPayload(selectedTask, action)),
      });
      const result = (await response.json()) as Partial<
        DeepSeekTranslateResult & DeepSeekGenerateResult & { error: string }
      >;
      if (!response.ok)
        throw new Error(
          result.error || "DeepSeek 调用失败，请检查 API Key 或稍后重试。",
        );

      if (action === "translate_creator_reply") {
        setDeepSeekChineseTranslation(result.chineseTranslation || "");
        return;
      }

      const localFallback = message ?? buildLocalMessageForTask(selectedTask);
      setMessage({
        ...localFallback,
        english: result.englishMessage || localFallback.english,
        chineseExplanation:
          result.chineseExplanation || localFallback.chineseExplanation,
      });
      setMessageSource(result.englishMessage ? "deepseek" : "local");
      setDeepSeekChineseExplanation(result.chineseExplanation || "");
    } catch (error) {
      setDeepSeekError(deepSeekErrorMessage(error));
    } finally {
      setDeepSeekLoadingAction(null);
    }
  }

  async function handleCopyGeneratedMessage() {
    if (!message) return;
    await copyText(message.english, "已复制英文话术。");
    setTrackingStatus("已复制英文话术。");
  }

  function markCreatorMessageSent(
    rowId: string,
    scenario: string,
    english: string,
    selectedChannel: Channel,
  ) {
    const today = todayString();
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              currentStatus:
                inferStatus(row, requiredVideosForRow(row)) === "Not Contacted"
                  ? "Invited"
                  : row.currentStatus,
              lastContactDate: today,
              lastFollowUpCount: row.lastFollowUpCount + 1,
              trackingStatus: "已发送待回复",
              lastMessageScenario: scenario,
              lastMessageChannel: selectedChannel,
              lastMessageSentAt: today,
              lastHandledDate: today,
              nextFollowUpDate: addDays(2),
              lastCreatorResponse:
                editedCreatorReplies[rowId] ?? row.lastCreatorResponse,
              followUpHistory: [
                ...(row.followUpHistory ?? []),
                {
                  date: today,
                  action: "Message Sent",
                  channel: selectedChannel,
                  scenario,
                  message: english,
                },
              ],
            }
          : row,
      ),
    );
  }

  function handleMarkMessageSent() {
    if (!selectedTask || !message) return;
    markCreatorMessageSent(
      selectedTask.id,
      message.scenario,
      message.english,
      channel,
    );
    finishProcessing("已记录处理结果。");
  }

  function markCreatorNoReply() {
    if (!selectedTask) return;
    const today = todayString();
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === selectedTask.id
          ? {
              ...row,
              lastContactDate: today,
              lastHandledDate: today,
              trackingStatus: "未回复待跟进",
              nextFollowUpDate: addDays(1),
              followUpHistory: [
                ...(row.followUpHistory ?? []),
                {
                  date: today,
                  action: "No Reply",
                  note: row.notes.trim() || "今日检查，达人未回复。",
                },
              ],
            }
          : row,
      ),
    );
    finishProcessing("已记录处理结果。");
  }

  function markCreatorSkippedToday() {
    if (!selectedTask) return;
    const today = todayString();
    const note = selectedTask.notes.trim() || "今日暂不跟进。";
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === selectedTask.id
          ? {
              ...row,
              lastHandledDate: today,
              trackingStatus: "今日已跳过",
              nextFollowUpDate: addDays(1),
              followUpHistory: [
                ...(row.followUpHistory ?? []),
                { date: today, action: "Skipped Today", note },
              ],
            }
          : row,
      ),
    );
    finishProcessing("已记录今日暂不跟进。");
  }

  function finishProcessing(messageText: string) {
    setTrackingStatus(messageText);
    setLastProcessingResult(messageText);
    setShowNextCreatorPrompt(true);
    setToast({ tone: "success", text: messageText });
  }

  function markVideoProgress() {
    if (!selectedTask) return;
    const today = todayString();
    const selectedRequiredVideos = parseRequiredVideos(
      selectedTaskCampaignRequirements(selectedTask),
    );
    const current = normalizeVideoProgress(
      selectedTask.videoProgress,
      selectedRequiredVideos,
    );
    const nextPosted = (current.postedCount ?? 0) + 1;
    const reachedRequirement = nextPosted >= selectedRequiredVideos;
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== selectedTask.id) return row;
        return {
          ...row,
          currentStatus: reachedRequirement
            ? "视频已达要求，待确认合作完成"
            : `已发布 ${nextPosted} 条 / 待补剩余视频`,
          trackingStatus: reachedRequirement
            ? "视频数量已达要求"
            : "已发布部分视频",
          videoProgress: `${nextPosted}/${selectedRequiredVideos}`,
          videoProgressWarning: undefined,
          firstVideoPostedDate: row.firstVideoPostedDate || today,
          latestVideoPostedDate: today,
          lastHandledDate: today,
          nextFollowUpDate: reachedRequirement ? today : addDays(2),
          followUpHistory: [
            ...(row.followUpHistory ?? []),
            {
              date: today,
              action: "Video Posted",
              note: `已记录达人发布 1 条视频，当前进度 ${nextPosted}/${selectedRequiredVideos}。`,
            },
          ],
        };
      }),
    );
    finishProcessing(
      reachedRequirement
        ? "已达到产品视频数量要求，请确认是否合作完成。"
        : "已记录达人发布 1 条视频。",
    );
  }

  function handleManualVideoProgressUpdate() {
    if (!selectedTask) return;
    const selectedRequiredVideos = requiredVideosForRow(selectedTask);
    const progress = window.prompt(
      "视频进度：可填 0/1、1/1、0/2、1/2 或自定义",
      selectedTask.videoProgress || `0/${selectedRequiredVideos}`,
    );
    if (progress === null) return;
    const firstDate = window.prompt(
      "首条视频发布日期（YYYY-MM-DD，可留空）",
      selectedTask.firstVideoPostedDate || "",
    );
    if (firstDate === null) return;
    const latestDate = window.prompt(
      "最近视频发布日期（YYYY-MM-DD，可留空）",
      selectedTask.latestVideoPostedDate || firstDate || "",
    );
    if (latestDate === null) return;
    const note =
      window.prompt("视频进度备注（可留空）", "手动更新视频进度。") ?? "";
    const today = todayString();
    const normalizedProgress = normalizeVideoProgress(
      progress,
      selectedRequiredVideos,
    );
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== selectedTask.id) return row;
        const updated = updateCreatorField(
          row,
          "videoProgress",
          progress,
          selectedRequiredVideos,
        );
        return {
          ...updated,
          firstVideoPostedDate: firstDate,
          latestVideoPostedDate: latestDate,
          lastHandledDate: today,
          nextFollowUpDate:
            typeof normalizedProgress.postedCount === "number" &&
            normalizedProgress.postedCount >= selectedRequiredVideos
              ? ""
              : row.nextFollowUpDate,
          followUpHistory: [
            ...(row.followUpHistory ?? []),
            {
              date: today,
              action: "Video Posted",
              note: note || `手动更新视频进度为 ${progress}。`,
            },
          ],
        };
      }),
    );
    finishProcessing("已手动更新视频进度。");
  }

  function markCreatorOutcome(outcome: "Completed" | "Failed") {
    if (!selectedTask) return;
    const today = todayString();
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === selectedTask.id
          ? {
              ...row,
              currentStatus: outcome === "Completed" ? "Completed" : "Lost",
              trackingStatus: outcome === "Completed" ? "合作完成" : "合作失败",
              lastHandledDate: today,
              nextFollowUpDate: "",
              archivedAt: today,
              archiveReason: outcome,
              followUpHistory: [
                ...(row.followUpHistory ?? []),
                {
                  date: today,
                  action: outcome,
                  note:
                    outcome === "Completed"
                      ? "今日合作完成。"
                      : "今日合作失败。",
                },
              ],
            }
          : row,
      ),
    );
    setTrackingStatus("已记录处理结果。");
    setLastProcessingResult("已记录处理结果。");
    setShowNextCreatorPrompt(true);
    setToast({
      tone: "success",
      text: outcome === "Completed" ? "已合作完成。" : "已合作失败。",
    });
  }

  function handleMarkCreatorReplied() {
    if (!selectedTask) return;
    const note = window.prompt("记录达人回复内容或下一步重点：") ?? "";
    const today = todayString();
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === selectedTask.id
          ? {
              ...row,
              currentStatus: "Replied",
              trackingStatus: "达人回复待处理",
              lastContactDate: today,
              lastCreatorResponse: note,
              lastHandledDate: today,
              nextFollowUpDate: addDays(1),
              followUpHistory: [
                ...(row.followUpHistory ?? []),
                { date: today, action: "Creator Replied", note },
              ],
            }
          : row,
      ),
    );
    finishProcessing("已记录达人回复。");
  }

  function handleOpenPromptHelper() {
    const helperRequirements = campaignToFilmingRequirements(
      activeCampaign ?? mergedCampaigns[0],
      filmingRequirements,
    );
    setPromptHelperForm({
      sellingPoints: "",
      videoCount: String(parseRequiredVideos(helperRequirements)),
      durationRequirement: "",
      targetPetOrScene: "",
      mustShowShots: "",
      avoidShots: "",
      referenceLinks:
        helperRequirements.referenceVideoLinks ||
        listToText(helperRequirements.referenceLinks),
    });
    setGeneratedChatGptPrompt("");
    setPromptCopyStatus("");
    setIsPromptHelperOpen(true);
  }

  function buildChatGptPrompt() {
    return `请你作为熟悉美国 TikTok Shop 达人合作沟通的内容运营，基于下面的产品信息，生成一版可以直接发给达人的中文「达人拍摄要求」。\n\n【产品信息】\n- 产品名称：${activeFilmingRequirements.productName}\n- 产品卖点：${promptHelperForm.sellingPoints || "请补充"}\n- 目标视频数量：${promptHelperForm.videoCount || requiredVideos}\n- 单条视频时长要求：${promptHelperForm.durationRequirement || "40s+"}\n- 目标宠物 / 使用场景：${promptHelperForm.targetPetOrScene || "真实宠物使用场景"}\n- 必须展示的画面：${promptHelperForm.mustShowShots || "开箱、使用过程、CTA"}\n- 不希望达人这样拍：${promptHelperForm.avoidShots || "避免违规表述"}\n- 对标视频链接（可选）：${promptHelperForm.referenceLinks || "无"}\n\n请按以下结构输出，全部使用简体中文：\n1. 产品名称\n2. 达人拍摄要求\n3. 重点拍摄内容`;
  }

  async function generateFilmingRequirementsWithAi() {
    setAiDraftLoading(true);
    setAiDraftError("");
    setAiDraftAppliedTo("");
    try {
      const response = await fetch("/api/generate-filming-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName:
            settingsTargetCampaign?.productName ||
            activeFilmingRequirements.productName,
          sellingPoints: promptHelperForm.sellingPoints,
          videoCount: promptHelperForm.videoCount || String(requiredVideos),
          durationRequirement: promptHelperForm.durationRequirement,
          targetPetOrScene: promptHelperForm.targetPetOrScene,
          mustShowShots: promptHelperForm.mustShowShots,
          avoidShots: promptHelperForm.avoidShots,
          referenceLinks: promptHelperForm.referenceLinks,
        }),
      });
      // The endpoint is a serverless function, so a misconfigured deployment
      // (or `vite dev`, which does not serve /api) answers with HTML or an
      // empty body. Parse defensively so the user sees an actionable message
      // instead of a raw JSON.parse failure.
      const rawBody = await response.text();
      let result: Partial<SettingsAiDraft & { error: string }> = {};
      try {
        result = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        result = {};
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            `AI 生成失败：接口返回 ${response.status}。请确认部署环境已启用 /api 接口并配置 OPENAI_API_KEY。`,
        );
      }
      if (!result.requirements?.length || !result.priorities?.length) {
        throw new Error("AI 生成失败：返回内容缺少拍摄要求或重点内容。");
      }
      setAiDraft({
        productName:
          result.productName || activeFilmingRequirements.productName,
        requirements: result.requirements,
        priorities: result.priorities,
      });
    } catch (error) {
      setAiDraft(null);
      setAiDraftError(
        error instanceof Error ? error.message : "AI 生成失败：请稍后重试。",
      );
    } finally {
      setAiDraftLoading(false);
    }
  }

  function applyAiDraftToCampaign() {
    const target = settingsTargetCampaign;
    if (!aiDraft || !target) return;

    const targetIdentity = campaignOptionValue(target);
    setCampaigns(
      mergedCampaigns.map((campaign) =>
        campaignOptionValue(campaign) === targetIdentity
          ? {
              ...campaign,
              requirements: aiDraft.requirements,
              keyContentPoints: aiDraft.priorities,
            }
          : campaign,
      ),
    );
    setAiDraft(null);
    setAiDraftAppliedTo(target.productName);
    setToast({
      tone: "success",
      text: `已把 AI 草稿写入「${target.productName}」的拍摄要求和重点内容。`,
    });
  }

  function renderPageHeader(
    title: string,
    description: string,
    action?: ReactNode,
  ) {
    return (
      <div className="page-header">
        <div>
          <p className="eyebrow">TikTok Shop Creator SOP</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action}
      </div>
    );
  }

  function renderCampaignSelector() {
    return (
      <section className="campaign-switcher" aria-label="当前店铺和产品项目">
        <label>
          当前店铺 / 品牌
          <select
            value={selectedStore}
            onChange={(event) => {
              setSelectedStore(event.target.value);
              setSelectedCampaign("ALL");
              setSelectedIds([]);
              setSelectedCreatorId("");
              setMessage(null);
              setMessageSource("local");
            }}
          >
            <option value={ALL_STORES}>全部店铺</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          当前产品项目
          <select
            value={selectedCampaign}
            onChange={(event) => {
              setSelectedCampaign(event.target.value);
              setSelectedIds([]);
              setSelectedCreatorId("");
              setMessage(null);
              setMessageSource("local");
              setIsQueueExpanded(true);
              setOnlyCurrentCreator(false);
            }}
          >
            <option value="ALL">全部产品</option>
            {activeCampaigns.map((campaign) => (
              <option
                key={campaignOptionValue(campaign)}
                value={campaignSelectValue(campaign)}
              >
                {campaignLabel(campaign, showStoreLabels)}
                {campaign.archivedAt ? "（已归档）" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="campaign-context">
          <strong>
            {selectedCampaign === "ALL"
              ? selectedStore === ALL_STORES
                ? "全部店铺 · 全部产品组合视图"
                : `${stores.find((store) => store.id === selectedStore)?.name ?? "未分配店铺"} · 全部产品`
              : activeCampaign
                ? campaignLabel(activeCampaign, showStoreLabels)
                : "未分配店铺 · 产品项目不可用"}
          </strong>
          <span>
            {selectedCampaign === "ALL"
              ? "看板、表格、队列按当前店铺过滤；全部店铺视图会显示店铺标签，且不会合并同名产品。"
              : "当前页面按该产品项目过滤，并使用该产品的拍摄要求与参考链接。"}
          </span>
        </div>
      </section>
    );
  }

  function campaignStats(campaign: Campaign) {
    const campaignRows = rows.filter((row) =>
      rowMatchesCampaign(row, campaign),
    );
    const campaignRequirements = campaignToFilmingRequirements(
      campaign,
      filmingRequirements,
    );
    const campaignRequiredVideos = parseRequiredVideos(campaignRequirements);
    const activeCampaignRows = campaignRows.filter((row) =>
      isActiveDailyCollaboration(row, campaignRequiredVideos),
    );
    const campaignTasks = analyzeCreators(
      activeCampaignRows,
      undefined,
      campaignRequiredVideos,
    );
    const campaignTaskMap = new Map(
      campaignTasks.map((task) => [task.id, task]),
    );
    return {
      creatorCount: campaignRows.length,
      activeCount: activeCampaignRows.length,
      todayFollowUp: campaignTasks.filter(
        (task) => task.needsFollowUp && !isHandledToday(task),
      ).length,
      highPriority: campaignTasks.filter((task) => task.priority === "High")
        .length,
      inTransit: activeCampaignRows.filter(
        (row) => inferStatus(row, campaignRequiredVideos) === "Sample Shipped",
      ).length,
      deliveredPending: activeCampaignRows.filter((row) =>
        ["Delivered", "Waiting Video"].includes(
          inferStatus(row, campaignRequiredVideos),
        ),
      ).length,
      postedVideos: campaignRows.reduce(
        (sum, row) =>
          sum +
          (normalizeVideoProgress(row.videoProgress, campaignRequiredVideos)
            .postedCount ?? 0),
        0,
      ),
      completed: campaignRows.filter(
        (row) =>
          inferStatus(row, campaignRequiredVideos) === "Completed" ||
          campaignTaskMap.get(row.id)?.trackingStatus === "Completed",
      ).length,
      failed: campaignRows.filter(
        (row) =>
          inferStatus(row, campaignRequiredVideos) === "Lost" ||
          campaignTaskMap.get(row.id)?.trackingStatus === "Failed",
      ).length,
    };
  }

  function handleLocateCreator() {
    const normalized = followupSearch.trim().toLowerCase();
    if (!normalized) {
      setCreatorSearchStatus("请输入达人账号或关键词。");
      return;
    }
    const matches = tasks.filter((task) =>
      [task.username, task.profileLink, task.product, task.notes]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
    if (matches.length === 0) {
      setCreatorSearchStatus("未找到该达人。");
      return;
    }
    if (matches.length === 1) {
      handleSelectCreator(matches[0].id);
      setMessage(buildLocalMessageForTask(matches[0]));
      setCreatorSearchStatus(`已定位 ${displayName(matches[0])}。`);
      return;
    }
    setIsQueueExpanded(true);
    setCreatorSearchStatus(`找到 ${matches.length} 条结果，请在下方列表选择。`);
  }

  function renderDashboard() {
    return (
      <DashboardPage
        data={{
          campaignCards: dashboardCampaignCards,
          metricCards: dashboardCards,
          selectedCampaignName,
          workbenchFilterLabel: workbenchFilter?.label ?? "",
          highestPendingCount,
          queueItems: dashboardQueueItems,
          selectedCreator: dashboardSelectedCreator,
          hasNextTask: Boolean(nextTask),
          channelOptions: CHANNELS,
          messageComposerProps: dashboardMessageComposerProps,
        }}
        uiState={{
          onlyCurrentCreator,
          queueExpanded: isQueueExpanded,
          followupSearch,
          creatorSearchStatus,
          showArchivedCollaborations,
          urgency: followupUrgency,
          showProcessedToday,
          selectedCreatorId: selectedTask?.id ?? "",
          channel,
          historicalReadOnly: isHistoricalReadOnly,
          queueRef,
          currentCreatorRef,
        }}
        actions={{
          openCreatorDatabase: () => setActiveModule("creators"),
          selectCampaignCard: setSelectedCampaign,
          selectMetricCard: handleDashboardCardClick,
          toggleOnlyCurrentCreator: () =>
            setOnlyCurrentCreator((value) => !value),
          clearWorkbenchFilter: () => {
            setWorkbenchFilter(null);
            setSelectedCreatorId("");
          },
          toggleQueue: () => setIsQueueExpanded((value) => !value),
          setFollowupSearch,
          locateCreator: handleLocateCreator,
          setShowArchivedCollaborations,
          setUrgency: setFollowupUrgency,
          setShowProcessedToday,
          selectCreator: handleSelectCreator,
          setChannel,
          generateMessage: handleGenerateMessage,
          processNextCreator: handleProcessNextCreator,
          showOtherSamples: () => {
            if (!selectedTask) return;
            setFollowupSearch(displayName(selectedTask));
            setOnlyCurrentCreator(false);
            setIsQueueExpanded(true);
          },
          showMultiSampleReminder: () =>
            setToast({
              tone: "success",
              text: "生成多样品合并提醒：请在一条消息中列出多个产品，并分别确认每个样品的到货、拍摄和发布时间。",
            }),
        }}
      />
    );
  }
  function renderCreatorDatabase() {
    return (
      <CreatorDatabasePage
        data={{
          rows: creatorDatabaseRows,
          exportableRowCount: rows.length,
          statusOptions: creatorStatusOptions,
          productTotalCount,
          archivedProductCount,
          archivedSearchMatchCount: archivedSearchMatches.length,
          defaultStoreName: DEFAULT_STORE_NAME,
        }}
        uiState={{
          search,
          statusFilter,
          creatorTypeFilter,
          followerFilter,
          avgViewsFilter,
          gmvFilter,
          selectedIds,
          showArchivedCollaborations,
          bulkStatus,
          fileName,
          importSummary,
          error,
          pendingDuplicate: pendingDuplicateAdd,
        }}
        actions={{
          setSearch,
          setStatusFilter: (value) =>
            setStatusFilter(value as CreatorStatus | "All"),
          setCreatorTypeFilter,
          setFollowerFilter,
          setAvgViewsFilter,
          setGmvFilter,
          setShowArchivedCollaborations,
          setBulkStatus: (value) => setBulkStatus(value as CreatorStatus),
          toggleSelected,
          toggleSelectAll: toggleAllFilteredCreators,
          updateRow,
          bulkCopyOutreach: handleBulkCopyOutreach,
          bulkUpdateStatus: handleBulkStatusUpdate,
          copyOutreach: copyCreatorOutreach,
          archiveCreator,
          restoreCreator,
          importFile: (file) => handleFile(file),
          exportCsv: () => downloadCreatorRowsCsv(rows),
          addCreator: handleAddCreator,
          continueDuplicate: () => {
            if (!pendingDuplicateAdd) return;
            addCreatorDraft(
              pendingDuplicateAdd.draft,
              pendingDuplicateAdd.existing,
            );
          },
          copyDuplicateBase: () => {
            if (!pendingDuplicateAdd) return;
            addCreatorDraft(
              pendingDuplicateAdd.draft,
              pendingDuplicateAdd.existing,
            );
          },
          cancelDuplicate: () => setPendingDuplicateAdd(null),
        }}
      />
    );
  }

  function applyTemplateToSelectedCreator() {
    if (!selectedTemplateCreator) {
      setToast({ tone: "warning", text: "请先选择达人。" });
      return;
    }
    const creatorCampaign = campaignForRow(selectedTemplateCreator);
    const creatorRequirements = campaignToFilmingRequirements(
      creatorCampaign,
      activeFilmingRequirements,
    );
    setTemplateForm((form) => ({
      ...form,
      creatorName: selectedTemplateCreator.username,
      productName:
        selectedTemplateCreator.product || creatorRequirements.productName,
      sellingPoint: creatorCampaign?.sellingPoints || form.sellingPoint,
      requirement: [
        ...creatorRequirements.requirements,
        ...creatorRequirements.keyContentPoints,
      ]
        .filter(Boolean)
        .join("; "),
      length: creatorCampaign?.videoLength || form.length,
      videos:
        creatorCampaign?.videoCount ||
        String(parseRequiredVideos(creatorRequirements)),
      tagRequirement: creatorCampaign?.tagRequirement || form.tagRequirement,
      trackingNumber:
        parseNumberFromNotes(selectedTemplateCreator.notes, [
          "tracking",
          "tracking number",
        ]) === "—"
          ? ""
          : parseNumberFromNotes(selectedTemplateCreator.notes, [
              "tracking",
              "tracking number",
            ]),
      deadline: selectedTemplateCreator.nextFollowUpDate || "",
    }));
    setSelectedCreatorId(selectedTemplateCreator.id);
    setToast({ tone: "success", text: "已套用当前达人和产品项目数据。" });
  }

  function markTemplateSent(template: TemplateMessage) {
    if (!selectedTemplateCreator) {
      setToast({ tone: "warning", text: "请先选择达人。" });
      return;
    }
    markCreatorMessageSent(
      selectedTemplateCreator.id,
      template.name,
      template.english,
      channel,
    );
    setSelectedCreatorId(selectedTemplateCreator.id);
    setTrackingStatus("已标记为发送，并同步更新数据表格。");
    setToast({
      tone: "success",
      text: "模板已标记为已发送，并同步到达人跟进记录。",
    });
  }

  function renderTemplates() {
    return (
      <>
        {renderPageHeader(
          "沟通话术模板",
          "标准话术库：维护常用英文模板，可套用到具体达人，但不替代每日跟进队列。",
        )}
        <section className="panel template-selector-panel">
          <div className="section-heading">
            <div>
              <h2>模板套用对象</h2>
              <p className="muted">
                选择达人后，模板会读取同一份达人数据库和产品项目要求。
              </p>
            </div>
          </div>
          <div className="generator-controls">
            <label>
              当前产品项目
              <input value={selectedCampaignName} readOnly />
            </label>
            <label>
              选择达人
              <select
                aria-label="选择模板达人"
                value={selectedTemplateCreator?.id ?? ""}
                onChange={(event) => {
                  setTemplateCreatorId(event.target.value);
                  setSelectedCreatorId(event.target.value);
                }}
              >
                <option value="">不选择达人，使用通用占位符</option>
                {visibleRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {displayName(row)} · {row.product || "缺少产品名称"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              联系渠道
              <select
                aria-label="模板联系渠道"
                value={channel}
                onChange={(event) => setChannel(event.target.value as Channel)}
              >
                {CHANNELS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <section className="panel template-layout">
          <div className="template-form">
            {(Object.keys(templateForm) as Array<keyof TemplateForm>).map(
              (key) => (
                <label key={key}>
                  {templateFieldLabels[key]}
                  <input
                    value={templateForm[key]}
                    onChange={(event) =>
                      setTemplateForm((form) => ({
                        ...form,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ),
            )}
            <div className="template-form-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setTemplateForm(fillTemplateFormFromSources);
                  setToast({
                    tone: "success",
                    text: "已用当前产品项目和达人资料重新填充表单。",
                  });
                }}
              >
                从产品项目重新填充
              </button>
              <p className="muted">
                表单内容会保留到你切换产品或达人为止。在设置里改了拍摄要求后，点这里同步过来。
              </p>
            </div>
          </div>
          <div className="template-results">
            {templateMessages.map((template) => (
              <article className="template-card" key={template.name}>
                <h3>{template.name}</h3>
                <h4>英文话术</h4>
                <p>{template.english}</p>
                <h4>中文对照</h4>
                <p>{template.chinese}</p>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      void copyText(template.english, "英文话术已复制。")
                    }
                  >
                    复制英文话术
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={applyTemplateToSelectedCreator}
                    disabled={!selectedTemplateCreator}
                  >
                    应用到当前达人
                  </button>
                  <button
                    type="button"
                    onClick={() => markTemplateSent(template)}
                    disabled={!selectedTemplateCreator}
                  >
                    标记为已发送
                  </button>
                </div>
                {!selectedTemplateCreator && (
                  <p className="muted">请先选择达人。</p>
                )}
              </article>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderSamples() {
    return (
      <>
        {renderPageHeader(
          "样品追踪",
          "围绕物流状态跟踪样品，自动提示卡点动作。",
        )}
        <section className="panel table-panel">
          <div className="table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>达人名称</th>
                  <th>产品名称</th>
                  <th>样品状态</th>
                  <th>物流商</th>
                  <th>物流单号</th>
                  <th>寄出日期</th>
                  <th>签收日期</th>
                  <th>签收后天数</th>
                  <th>下一步跟进动作</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>{displayName(row)}</td>
                    <td>{row.product || "—"}</td>
                    <td>
                      <span
                        className={statusTone(
                          inferStatus(row, requiredVideosForRow(row)),
                        )}
                      >
                        {displayStatus(
                          inferStatus(row, requiredVideosForRow(row)),
                        )}
                      </span>
                    </td>
                    <td>{parseNumberFromNotes(row.notes, ["carrier"])}</td>
                    <td>
                      {parseNumberFromNotes(row.notes, [
                        "tracking",
                        "tracking number",
                      ])}
                    </td>
                    <td>{parseNumberFromNotes(row.notes, ["shipped date"])}</td>
                    <td>{row.sampleDeliveredDate || "—"}</td>
                    <td>{daysDelivered(row) ?? "—"}</td>
                    <td>{sampleHint(row, requiredVideosForRow(row))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderFollowup() {
    return renderDashboard();
  }

  function reviewChecklistForRow(row: CreatorRow) {
    const requirements = campaignToFilmingRequirements(
      campaignForRow(row),
      activeFilmingRequirements,
    );
    return [
      `是否展示必须展示内容：${requirements.requiredScenes || "按 Campaign 配置"}`,
      `是否体现产品卖点：${requirements.sellingPoints || "按 Campaign 配置"}`,
      `是否满足视频时长要求：${requirements.videoLength || "按 Campaign 配置"}`,
      `是否满足视频数量要求：${requirements.videoCount || "按 Campaign 配置"}`,
      `是否避免“不希望达人这样拍”的内容：${requirements.avoidShots || "按 Campaign 配置"}`,
      `是否挂 TikTok Shop 产品链接：${requirements.productLinkRequirement || "按 Campaign 配置"}`,
      `是否参考了正确的视频方向：${requirements.referenceVideoLinks || "按 Campaign 配置"}`,
    ];
  }

  function renderReview() {
    return (
      <>
        {renderPageHeader(
          "内容审核",
          "逐条验收达人视频，输出可执行的验收状态。",
        )}
        <section className="panel review-grid">
          {visibleRows.map((row) => (
            <article className="review-card" key={row.id}>
              <div>
                <h3>{displayName(row)}</h3>
                <span
                  className={statusTone(
                    inferStatus(row, requiredVideosForRow(row)),
                  )}
                >
                  {displayStatus(inferStatus(row, requiredVideosForRow(row)))}
                </span>
              </div>
              {reviewChecklistForRow(row).map((item) => (
                <label key={item} className="check-row">
                  <input type="checkbox" />
                  {item}
                </label>
              ))}
              <select defaultValue="Approved">
                <option value="Approved">审核通过</option>
                <option value="Need Revision">需要修改</option>
                <option value="Product Tag Missing">未挂商品卡</option>
                <option value="Not Usable for Ads">不可投流</option>
                <option value="Ready for Ads">可投流</option>
              </select>
            </article>
          ))}
        </section>
      </>
    );
  }

  function renderAds() {
    const tags = [
      "爪部清洁",
      "遛后护理",
      "猫咪互动",
      "狗狗梳毛",
      "产品演示",
      "前后对比",
      "UGC 口碑",
      "高 CTR 潜力",
    ];
    return (
      <>
        {renderPageHeader(
          "投流素材库",
          "沉淀可投流 UGC 视频，管理 Spark Ads 和素材授权。",
        )}
        <section className="panel table-panel">
          <div className="tag-cloud">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div className="table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>达人名称</th>
                  <th>产品名称</th>
                  <th>视频链接</th>
                  <th>Hook 角度</th>
                  <th>宠物类型</th>
                  <th>使用场景</th>
                  <th>视频时长</th>
                  <th>自然播放量</th>
                  <th>互动表现</th>
                  <th>转化潜力</th>
                  <th>Spark Ads 状态</th>
                  <th>素材授权状态</th>
                  <th>达人备注</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows
                  .filter((row) =>
                    ["Ready for Ads", "Spark Ads Requested", "Posted"].includes(
                      inferStatus(row, requiredVideosForRow(row)),
                    ),
                  )
                  .map((row) => (
                    <tr key={row.id}>
                      <td>{displayName(row)}</td>
                      <td>{row.product}</td>
                      <td>
                        {parseNumberFromNotes(row.notes, ["video url", "url"])}
                      </td>
                      <td>{parseNumberFromNotes(row.notes, ["hook"])}</td>
                      <td>{parseNumberFromNotes(row.notes, ["pet type"])}</td>
                      <td>{parseNumberFromNotes(row.notes, ["scene"])}</td>
                      <td>{parseNumberFromNotes(row.notes, ["length"])}</td>
                      <td>{parseNumberFromNotes(row.notes, ["views"])}</td>
                      <td>{parseNumberFromNotes(row.notes, ["engagement"])}</td>
                      <td>{parseNumberFromNotes(row.notes, ["potential"])}</td>
                      <td>
                        {inferStatus(row, requiredVideosForRow(row)) ===
                        "Spark Ads Requested"
                          ? "已申请"
                          : "未申请"}
                      </td>
                      <td>{parseNumberFromNotes(row.notes, ["rights"])}</td>
                      <td>{row.notes || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderSettings() {
    const targetCampaign = settingsTargetCampaign;
    const targetCampaignIdentity = targetCampaign
      ? campaignOptionValue(targetCampaign)
      : "";
    const updateCampaign = (patch: Partial<Campaign>) => {
      if (!targetCampaign) return;
      setCampaigns(
        mergedCampaigns.map((campaign) =>
          campaignOptionValue(campaign) === targetCampaignIdentity
            ? { ...campaign, ...patch }
            : campaign,
        ),
      );
    };
    const duplicateProductInStore = (
      campaign: Campaign,
      productName: string,
      storeId = normalizeStoreId(campaign.storeId, campaign.storeName),
    ) =>
      mergedCampaigns.some(
        (item) =>
          campaignOptionValue(item) !== campaignOptionValue(campaign) &&
          normalizeStoreId(item.storeId, item.storeName) === storeId &&
          item.productName.trim().toLowerCase() ===
            productName.trim().toLowerCase(),
      );
    const updateCampaignProductName = (
      campaign: Campaign,
      productName: string,
    ) => {
      if (duplicateProductInStore(campaign, productName)) {
        setToast({
          tone: "warning",
          text: "当前店铺下已存在同名产品，请换一个产品名称。",
        });
        return;
      }
      const linkedRows = rows.filter((row) =>
        rowMatchesCampaign(row, campaign),
      );
      updateCampaign({ productName });
      if (linkedRows.length > 0) {
        const linkedIds = new Set(linkedRows.map((row) => row.id));
        setRows(
          rows.map((row) =>
            linkedIds.has(row.id) ? { ...row, product: productName } : row,
          ),
        );
      }
    };
    const campaignFieldsDiffer = (source: Campaign, target: Campaign) => {
      const serialize = (value: unknown) =>
        Array.isArray(value)
          ? value.join("\n").trim()
          : String(value ?? "").trim();
      return (
        [
          "sellingPoints",
          "requirements",
          "keyContentPoints",
          "avoidShots",
          "videoCount",
          "videoLength",
          "tagRequirement",
          "productLink",
          "referenceLinks",
          "defaultMessageSetting",
          "notes",
        ] as const
      ).some(
        (field) =>
          serialize(source[field]) &&
          serialize(target[field]) &&
          serialize(source[field]) !== serialize(target[field]),
      );
    };
    const mergeMissingCampaignConfig = (
      source: Campaign,
      target: Campaign,
    ): Campaign => {
      const next = { ...target };
      (
        [
          "sellingPoints",
          "avoidShots",
          "videoCount",
          "videoLength",
          "tagRequirement",
          "productLink",
          "defaultMessageSetting",
          "notes",
        ] as const
      ).forEach((field) => {
        if (
          !String(next[field] ?? "").trim() &&
          String(source[field] ?? "").trim()
        )
          next[field] = source[field] as never;
      });
      (["requirements", "keyContentPoints", "referenceLinks"] as const).forEach(
        (field) => {
          if (
            (next[field] ?? []).length === 0 &&
            (source[field] ?? []).length > 0
          )
            next[field] = source[field] as never;
        },
      );
      return next;
    };
    const moveRowsToCampaign = (source: Campaign, target: Campaign) => {
      const movedRows = rows.filter((row) => rowMatchesCampaign(row, source));
      setRows(
        rows.map((row) =>
          rowMatchesCampaign(row, source)
            ? {
                ...row,
                storeId: normalizeStoreId(target.storeId, target.storeName),
                storeName: normalizeStoreName(target.storeName),
                campaignId: target.id,
                productId:
                  target.productId ||
                  productIdForCampaign(
                    normalizeStoreId(target.storeId, target.storeName),
                    target.id,
                  ),
                product: target.productName,
              }
            : row,
        ),
      );
      return movedRows.length;
    };
    const assignCampaignStore = (campaign: Campaign, nextStoreId: string) => {
      const nextStore = stores.find((store) => store.id === nextStoreId);
      if (!nextStore) return;
      const targetDuplicate = mergedCampaigns.find(
        (item) =>
          campaignOptionValue(item) !== campaignOptionValue(campaign) &&
          normalizeStoreId(item.storeId, item.storeName) === nextStore.id &&
          item.productName.trim().toLowerCase() ===
            campaign.productName.trim().toLowerCase(),
      );
      if (targetDuplicate) {
        if (
          !window.confirm(
            "目标店铺下已存在同名产品。是否将当前产品及其达人记录合并到目标产品？",
          )
        )
          return;
        const movedCount = moveRowsToCampaign(campaign, targetDuplicate);
        const hasConfigDiff = campaignFieldsDiffer(campaign, targetDuplicate);
        setCampaigns(
          mergedCampaigns.map((item) => {
            if (
              campaignOptionValue(item) === campaignOptionValue(targetDuplicate)
            )
              return mergeMissingCampaignConfig(campaign, targetDuplicate);
            if (campaignOptionValue(item) === campaignOptionValue(campaign))
              return { ...item, archivedAt: todayString() };
            return item;
          }),
        );
        setSelectedStore(nextStore.id);
        setSelectedCampaign(campaignOptionValue(targetDuplicate));
        setToast({
          tone: hasConfigDiff ? "warning" : "success",
          text: `已将 ${movedCount} 条达人记录合并到 ${nextStore.name} · ${targetDuplicate.productName}。${hasConfigDiff ? "两个产品配置存在不同拍摄要求，已保留目标产品配置，请手动检查。" : ""}`,
        });
        return;
      }
      const movedCount = moveRowsToCampaign(campaign, {
        ...campaign,
        storeId: nextStore.id,
        storeName: nextStore.name,
      });
      updateCampaign({ storeId: nextStore.id, storeName: nextStore.name });
      setSelectedStore(nextStore.id);
      setToast({
        tone: "success",
        text: `已将产品关联到所选店铺 / 品牌，并迁移 ${movedCount} 条达人记录。`,
      });
    };
    const createCampaign = () => {
      const productName = window.prompt("产品 / Campaign 名称：", "")?.trim();
      if (!productName) return;
      let targetStore =
        selectedStore === ALL_STORES
          ? undefined
          : stores.find((store) => store.id === selectedStore);
      if (!targetStore) {
        const storeName = window
          .prompt(
            "请选择该产品所属店铺 / 品牌（输入现有店铺名称）：",
            stores[0]?.name ?? DEFAULT_STORE_NAME,
          )
          ?.trim();
        targetStore = stores.find(
          (store) => store.name.toLowerCase() === storeName?.toLowerCase(),
        );
      }
      if (!targetStore) {
        setToast({
          tone: "warning",
          text: "创建产品前必须选择已有店铺 / 品牌。",
        });
        return;
      }
      if (
        mergedCampaigns.some(
          (campaign) =>
            normalizeStoreId(campaign.storeId, campaign.storeName) ===
              targetStore.id &&
            campaign.productName.trim().toLowerCase() ===
              productName.toLowerCase(),
        )
      ) {
        setToast({
          tone: "warning",
          text: "当前店铺下已存在同名产品，请换一个产品名称。",
        });
        return;
      }
      const nextCampaign = createCampaignFromName(
        productName,
        filmingRequirements,
        targetStore.name,
        targetStore.id,
      );
      setCampaigns([...mergedCampaigns, nextCampaign]);
      setSelectedStore(targetStore.id);
      setSelectedCampaign(campaignOptionValue(nextCampaign));
      setToast({
        tone: "success",
        text: "已新增产品项目，并关联到当前店铺 / 品牌。",
      });
    };
    const linkedRowsCount = (campaign: Campaign) =>
      rows.filter((row) => rowMatchesCampaign(row, campaign)).length;
    const syncCampaignVideoCount = (campaign: Campaign) => {
      const latestCampaign =
        mergedCampaigns.find(
          (item) => campaignOptionValue(item) === campaignOptionValue(campaign),
        ) ?? campaign;
      const targetRequiredVideos = campaignRequiredVideoCount(
        latestCampaign,
        activeFilmingRequirements,
      );
      let updatedCount = 0;
      let preservedPublishedCount = 0;
      let skippedCount = 0;
      const nextRows = rows.map((row) => {
        if (!rowMatchesCampaign(row, latestCampaign)) return row;
        const progress = normalizeVideoProgress(
          row.videoProgress,
          targetRequiredVideos,
        );
        const postedFromText = row.videoProgress.match(
          /^\s*(\d+)\s*(?:\/|of)\s*\d+/i,
        )?.[1];
        const postedCount =
          typeof progress.postedCount === "number"
            ? progress.postedCount
            : postedFromText
              ? Number.parseInt(postedFromText, 10)
              : undefined;
        if (typeof postedCount !== "number" || !Number.isFinite(postedCount)) {
          skippedCount += 1;
          return row;
        }
        if (postedCount > 0) preservedPublishedCount += 1;
        const nextProgress = `${postedCount}/${targetRequiredVideos}`;
        if (row.videoProgress === nextProgress && !row.videoProgressWarning)
          return row;
        updatedCount += 1;
        const normalized = normalizeVideoProgress(
          nextProgress,
          targetRequiredVideos,
        );
        return {
          ...row,
          videoProgress: normalized.normalized,
          videoProgressWarning: normalized.warning,
        };
      });
      setRows(nextRows);
      setToast({
        tone: skippedCount > 0 ? "warning" : "success",
        text: `目标视频数量：${targetRequiredVideos}；已同步 ${updatedCount} 条达人记录；保留 ${preservedPublishedCount} 条已有发布进度；跳过 ${skippedCount} 条需要手动检查。`,
      });
    };
    const duplicateCampaign = (campaign: Campaign) => {
      const id = `${campaign.id}-copy-${Date.now()}`;
      const storeId = normalizeStoreId(campaign.storeId, campaign.storeName);
      const copy = {
        ...campaign,
        id,
        productId: productIdForCampaign(storeId, id),
        productName: `${campaign.productName} Copy`,
        archivedAt: undefined,
      };
      setCampaigns([...mergedCampaigns, copy]);
      setToast({ tone: "success", text: "已复制产品项目。" });
    };
    const archiveCampaign = (campaign: Campaign) => {
      setCampaigns(
        mergedCampaigns.map((item) =>
          campaignOptionValue(item) === campaignOptionValue(campaign)
            ? { ...item, archivedAt: todayString() }
            : item,
        ),
      );
      setToast({
        tone: "success",
        text: "已归档产品，历史达人记录和导出数据会保留。",
      });
    };
    const restoreCampaign = (campaign: Campaign) => {
      setCampaigns(
        mergedCampaigns.map((item) =>
          campaignOptionValue(item) === campaignOptionValue(campaign)
            ? { ...item, archivedAt: undefined }
            : item,
        ),
      );
      setToast({ tone: "success", text: "已恢复产品。" });
    };
    const deleteCampaign = (campaign: Campaign) => {
      const linked = linkedRowsCount(campaign);
      if (linked > 0) {
        setToast({
          tone: "warning",
          text: `该产品已关联 ${linked} 条达人记录，直接删除可能导致历史数据丢失。建议归档该产品。`,
        });
        return;
      }
      setCampaigns(
        mergedCampaigns.filter(
          (item) => campaignOptionValue(item) !== campaignOptionValue(campaign),
        ),
      );
      setToast({ tone: "success", text: "该产品暂无关联数据，可以安全删除。" });
    };
    const campaignSettingsTarget: CampaignSettingsTargetView | null =
      targetCampaign
        ? {
            campaign: targetCampaign,
            selectValue: campaignSelectValue(targetCampaign),
            storeId: normalizeStoreId(
              targetCampaign.storeId,
              targetCampaign.storeName,
            ),
            keyContentPointsText: listToText(targetCampaign.keyContentPoints),
            productLinkRequirementText: [
              targetCampaign.tagRequirement,
              targetCampaign.productLink,
            ]
              .filter(Boolean)
              .join("\n"),
            referenceLinksText: listToText(targetCampaign.referenceLinks),
          }
        : null;

    const campaignSettingsOptions: CampaignSettingsOption[] =
      activeCampaigns.map((campaign) => ({
        value: campaignSelectValue(campaign),
        label: `${campaignLabel(campaign, showStoreLabels)}${
          campaign.archivedAt ? "（已归档）" : ""
        }`,
      }));

    const campaignStoreCleanupItems: CampaignStoreCleanupView[] = stores.map(
      (store) => {
        const linkedCampaigns = mergedCampaigns.filter(
          (campaign) =>
            normalizeStoreId(campaign.storeId, campaign.storeName) ===
              store.id && !campaign.archivedAt,
        ).length;
        const linkedRows = rows.filter(
          (row) => rowStoreId(row) === store.id,
        ).length;
        return {
          id: store.id,
          name: store.name,
          canHide: linkedCampaigns === 0 && linkedRows === 0,
        };
      },
    );
    return (
      <SettingsPage
        data={{
          campaignSettingsProps: {
            data: {
              target: campaignSettingsTarget,
              campaignOptions: campaignSettingsOptions,
              storeOptions: stores,
              storeCleanupItems: campaignStoreCleanupItems,
            },
            uiState: { showArchivedProducts },
            actions: {
              selectCampaign: setSelectedCampaign,
              setShowArchivedProducts,
              createCampaign,
              announceEditable: () =>
                setToast({
                  tone: "success",
                  text: "可直接在下方编辑产品字段。",
                }),
              duplicateCampaign: () => {
                if (targetCampaign) duplicateCampaign(targetCampaign);
              },
              archiveCampaign: () => {
                if (targetCampaign) archiveCampaign(targetCampaign);
              },
              restoreCampaign: () => {
                if (targetCampaign) restoreCampaign(targetCampaign);
              },
              deleteCampaign: () => {
                if (targetCampaign) deleteCampaign(targetCampaign);
              },
              assignStore: (storeId) => {
                if (targetCampaign)
                  assignCampaignStore(targetCampaign, storeId);
              },
              renameProduct: (productName) => {
                if (targetCampaign)
                  updateCampaignProductName(targetCampaign, productName);
              },
              updateKeyContentPoints: (value) =>
                updateCampaign({ keyContentPoints: normalizeListText(value) }),
              updateSellingPoints: (value) =>
                updateCampaign({ sellingPoints: value }),
              updateVideoLength: (value) =>
                updateCampaign({ videoLength: value }),
              updateVideoCount: (value) =>
                updateCampaign({ videoCount: value }),
              syncVideoCount: () => {
                if (targetCampaign) syncCampaignVideoCount(targetCampaign);
              },
              updateAvoidShots: (value) =>
                updateCampaign({ avoidShots: value }),
              updateProductLinkRequirement: (value) =>
                updateCampaign({ tagRequirement: value, productLink: "" }),
              updateReferenceLinks: (value) =>
                updateCampaign({ referenceLinks: normalizeListText(value) }),
              inspectStore: (storeId) => {
                const item = campaignStoreCleanupItems.find(
                  (entry) => entry.id === storeId,
                );
                if (!item) return;
                setToast(
                  item.canHide
                    ? {
                        tone: "success",
                        text: `${item.name} 已无关联产品或达人记录，会从店铺下拉中隐藏。`,
                      }
                    : {
                        tone: "warning",
                        text: "该店铺仍有关联产品或达人记录，请先迁移或合并后再删除。",
                      },
                );
              },
            },
          },
          generatedPrompt: generatedChatGptPrompt,
          promptCopyStatus,
          aiDraft,
          aiDraftLoading,
          aiDraftError,
          canApplyAiDraft: Boolean(targetCampaign),
          aiDraftAppliedTo,
        }}
        uiState={{
          promptHelperOpen: isPromptHelperOpen,
          promptHelperForm,
        }}
        actions={{
          togglePromptHelper: () =>
            isPromptHelperOpen
              ? setIsPromptHelperOpen(false)
              : handleOpenPromptHelper(),
          updatePromptHelperField: (
            field: SettingsPromptHelperField,
            value: string,
          ) => setPromptHelperForm((form) => ({ ...form, [field]: value })),
          generatePrompt: () => {
            setGeneratedChatGptPrompt(buildChatGptPrompt());
            setPromptCopyStatus("");
          },
          copyPrompt: () =>
            void copyText(generatedChatGptPrompt, "已复制提示词。").then(() =>
              setPromptCopyStatus("已复制提示词。"),
            ),
          generateDraftWithAi: () => void generateFilmingRequirementsWithAi(),
          applyAiDraft: applyAiDraftToCampaign,
          dismissAiDraft: () => {
            setAiDraft(null);
            setAiDraftError("");
          },
          clearLocalCreatorData: () => {
            clearSavedCreatorRows();
            setRows([]);
            setToast({ tone: "success", text: "已清空本地达人数据。" });
          },
        }}
      />
    );
  }

  function renderActiveModule() {
    if (activeModule === "dashboard") return renderDashboard();
    if (activeModule === "creators") return renderCreatorDatabase();
    if (activeModule === "templates") return renderTemplates();
    if (activeModule === "samples") return renderSamples();
    if (activeModule === "followup") return renderFollowup();
    if (activeModule === "review") return renderReview();
    if (activeModule === "ads") return renderAds();
    return renderSettings();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>TT</span>
          <div>
            <strong>Creator SOP</strong>
            <small>运营工作台</small>
          </div>
        </div>
        <nav aria-label="主导航">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.key}
              className={activeModule === item.key ? "active" : ""}
              onClick={() => setActiveModule(item.key)}
            >
              <i>{navIcons[item.key]}</i>
              <span>{item.label}</span>
              <small>{item.helper}</small>
            </button>
          ))}
        </nav>
      </aside>
      <main className="workspace">
        {demoMode && (
          <div className="demo-banner" role="status">
            <div>
              <strong>演示模式</strong>
              <p>
                当前显示的是示例数据。本次会话不会读取或写入你的真实达人数据，所有改动刷新后即清空。
              </p>
            </div>
            <a className="demo-banner-exit" href={exitDemoModeUrl()}>
              退出演示模式
            </a>
          </div>
        )}
        {renderCampaignSelector()}
        {renderActiveModule()}
      </main>
      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}

export default App;
