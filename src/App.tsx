import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  clearSavedCreatorRows,
  createBlankCreatorRow,
  deleteCreatorRow,
  downloadCreatorRowsCsv,
  loadCreatorRows,
  saveCreatorRows,
  updateCreatorField,
  type EditableCreatorField,
} from "./creatorData";
import { parseCreatorFile } from "./fileParser";
import {
  analyzeCreators,
  daysSince,
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
  campaignToFilmingRequirements,
  createCampaignFromName,
  loadCampaigns,
  mergeDetectedCampaigns,
  saveCampaigns,
} from "./campaignData";
import type {
  Campaign,
  Channel,
  CreatorRow,
  GeneratedMessage,
  Task,
} from "./types";
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
type WorkbenchFilterKey =
  | "follow_up_today"
  | "processed_today"
  | "delivered_waiting_video"
  | "remaining_video"
  | "posted_this_week"
  | "completed"
  | "failed"
  | "sample_shipped";
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

  const savedRequirements = window.localStorage.getItem(
    FILMING_REQUIREMENTS_STORAGE_KEY,
  );
  if (!savedRequirements) return defaultCreatorFilmingRequirements;

  try {
    const parsedRequirements = JSON.parse(
      savedRequirements,
    ) as Partial<CreatorFilmingRequirements>;
    return {
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

function saveFilmingRequirements(requirements: CreatorFilmingRequirements) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    FILMING_REQUIREMENTS_STORAGE_KEY,
    JSON.stringify(requirements),
  );
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
    ? "极高"
    : task.priority === "High"
      ? "高"
      : task.priority === "Medium"
        ? "中"
        : "低";
}

function compactCreatorLabel(task: Task): string {
  return `${creatorHandle(task)} · ${priorityLabel(task)} · ${queueStatusLabelText(task)}`;
}

function queueStatusLabelText(task: Task): string {
  if (task.trackingStatus?.trim()) return task.trackingStatus.trim();
  if (task.priority === "Low" && task.triggerReason.includes("今日已处理")) return "今日已处理";
  if (task.priority === "Low" && task.triggerReason.includes("暂不催")) return "暂不催";
  if (task.priority === "Highest") return "待优先处理";
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

function hasAny(value: string, terms: string[]) {
  const normalized = safeLower(value);
  return terms.some((term) => normalized.includes(term));
}

function isCurrentWeek(dateValue: string) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = today.getUTCDay() || 7;
  const weekStart = new Date(today);
  weekStart.setUTCDate(today.getUTCDate() - day + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  return date >= weekStart && date < weekEnd;
}

function videoProgressCounts(row: Pick<CreatorRow, "videoProgress">, requiredVideos: number) {
  const progress = normalizeVideoProgress(row.videoProgress, requiredVideos);
  return {
    posted: progress.postedCount ?? 0,
    required: progress.requiredVideos ?? requiredVideos,
  };
}

function isSampleDeliveredForVideo(row: CreatorRow, requiredVideos: number) {
  return ["Delivered", "Waiting Video"].includes(inferStatus(row, requiredVideos));
}

function isSampleInTransitForDaily(row: CreatorRow, requiredVideos: number) {
  return inferStatus(row, requiredVideos) === "Sample Shipped";
}

function inferStatus(row: CreatorRow, requiredVideos: number): CreatorStatus {
  const status = safeLower(row.currentStatus);
  const shipping = safeLower(row.sampleShippingStatus);
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
  if ((progress.postedCount ?? 0) > 0 || hasAny(status, ["posted"]))
    return "Posted";
  if (hasAny(status, ["waiting video", "waiting for video"]))
    return "Waiting Video";
  if (
    shipping === "delivered" ||
    Boolean(row.sampleDeliveredDate.trim()) ||
    hasAny(status, ["delivered"])
  )
    return "Delivered";
  if (
    hasAny(shipping, ["shipped", "in transit"]) ||
    hasAny(status, ["sample shipped", "in transit"])
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
  const [rows, setRows] = useState<CreatorRow[]>(() => loadCreatorRows());
  const [activeModule, setActiveModule] = useState<ModuleKey>("dashboard");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<Toast>(null);
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
  const [filmingRequirements, setFilmingRequirements] =
    useState<CreatorFilmingRequirements>(() => loadFilmingRequirements());
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadCampaigns());
  const [selectedCampaign, setSelectedCampaign] = useState("ALL");
  const [isEditingFilmingRequirements, setIsEditingFilmingRequirements] =
    useState(false);
  const [filmingProductNameDraft, setFilmingProductNameDraft] = useState(
    () => defaultCreatorFilmingRequirements.productName,
  );
  const [filmingRequirementsDraft, setFilmingRequirementsDraft] = useState(() =>
    listToText(defaultCreatorFilmingRequirements.requirements),
  );
  const [keyContentPointsDraft, setKeyContentPointsDraft] = useState(() =>
    listToText(defaultCreatorFilmingRequirements.keyContentPoints),
  );
  const [referenceLinksDraft, setReferenceLinksDraft] = useState(() =>
    listToText(defaultCreatorFilmingRequirements.referenceLinks),
  );
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
  const [deepSeekLoadingAction, setDeepSeekLoadingAction] =
    useState<DeepSeekAction | null>(null);
  const [deepSeekError, setDeepSeekError] = useState("");
  const [deepSeekChineseTranslation, setDeepSeekChineseTranslation] =
    useState("");
  const [deepSeekDetectedIntent, setDeepSeekDetectedIntent] = useState("");
  const [deepSeekChineseExplanation, setDeepSeekChineseExplanation] =
    useState("");
  const [
    deepSeekRecommendedTrackingStatus,
    setDeepSeekRecommendedTrackingStatus,
  ] = useState("");
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
  const [lastProcessingResult, setLastProcessingResult] = useState("");
  const queueRef = useRef<HTMLElement | null>(null);
  const currentCreatorRef = useRef<HTMLDivElement | null>(null);
  const messageAreaRef = useRef<HTMLDivElement | null>(null);

  const mergedCampaigns = useMemo(
    () => mergeDetectedCampaigns(campaigns, rows, filmingRequirements),
    [campaigns, rows, filmingRequirements],
  );
  const activeCampaign =
    selectedCampaign === "ALL"
      ? undefined
      : mergedCampaigns.find(
          (campaign) => campaign.productName === selectedCampaign,
        );
  const activeFilmingRequirements = useMemo(
    () => campaignToFilmingRequirements(activeCampaign, filmingRequirements),
    [activeCampaign, filmingRequirements],
  );
  const requiredVideos = useMemo(
    () => parseRequiredVideos(activeFilmingRequirements),
    [activeFilmingRequirements],
  );
  const visibleRows = useMemo(
    () =>
      selectedCampaign === "ALL"
        ? rows
        : rows.filter((row) => row.product.trim() === selectedCampaign),
    [rows, selectedCampaign],
  );
  const tasks = useMemo(
    () => analyzeCreators(visibleRows, undefined, requiredVideos),
    [visibleRows, requiredVideos],
  );
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const matchesWorkbenchFilter = (task: Task, key: WorkbenchFilterKey) => {
    const status = inferStatus(task, requiredVideos);
    const taskMeta = tasksById.get(task.id);
    const progress = normalizeVideoProgress(task.videoProgress, requiredVideos);
    switch (key) {
      case "follow_up_today":
        return Boolean(taskMeta?.needsFollowUp || task.needsFollowUp) && !isHandledToday(task);
      case "processed_today":
        return isHandledToday(task);
      case "sample_shipped":
        return isSampleInTransitForDaily(task, requiredVideos);
      case "delivered_waiting_video":
        return isSampleDeliveredForVideo(task, requiredVideos) && (progress.postedCount ?? 0) === 0;
      case "remaining_video":
        return (progress.postedCount ?? 0) > 0 && (progress.postedCount ?? 0) < (progress.requiredVideos ?? requiredVideos);
      case "posted_this_week":
        return isCurrentWeek(task.firstVideoPostedDate) || isCurrentWeek(task.latestVideoPostedDate ?? "");
      case "completed":
        return status === "Completed";
      case "failed":
        return status === "Lost";
      default:
        return true;
    }
  };
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
        (entry) =>
          entry.date === today && handledActions.includes(entry.action),
      )
    );
  }

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
    return priorityLabel(task);
  }

  const filteredTasks = useMemo(() => {
    const normalized = followupSearch.trim().toLowerCase();
    return tasks
      .filter((task) => {
        const urgencyLabel =
          task.priority === "Highest"
            ? "极高"
            : task.priority === "High"
              ? "高"
              : task.priority === "Medium"
                ? "中"
                : "低";
        const haystack = [
          task.username,
          task.profileLink,
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
          (showProcessedToday || !isHandledToday(task)) &&
          (!workbenchFilter ||
            matchesWorkbenchFilter(task, workbenchFilter.key)) &&
          (followupUrgency === "All" || task.priority === followupUrgency) &&
          (!normalized || haystack.includes(normalized))
        );
      })
      .sort((a, b) => a.stageRank - b.stageRank || a.priorityRank - b.priorityRank);
  }, [
    tasks,
    followupSearch,
    followupUrgency,
    workbenchFilter,
    requiredVideos,
    tasksById,
    showProcessedToday,
  ]);
  const selectedTask =
    (selectedCreatorId &&
      tasks.find((task) => task.id === selectedCreatorId)) ||
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
    setDeepSeekDetectedIntent("");
    setDeepSeekRecommendedTrackingStatus("");
    setIsTranslationEditing(false);
    setMessageSource("local");
    const selected = tasks.find((task) => task.id === creatorId);
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
  useEffect(() => {
    if (
      selectedCampaign !== "ALL" &&
      !mergedCampaigns.some(
        (campaign) => campaign.productName === selectedCampaign,
      )
    )
      setSelectedCampaign("ALL");
  }, [mergedCampaigns, selectedCampaign]);
  useEffect(() => {
    const target = activeCampaign ?? mergedCampaigns[0];
    if (!target) return;
    setTemplateForm((form) => ({
      ...form,
      productName: target.productName,
      sellingPoint: target.sellingPoints,
      requirement: [...target.requirements, ...target.keyContentPoints]
        .filter(Boolean)
        .join("; "),
      length: target.videoLength || form.length,
      videos:
        target.videoCount ||
        String(
          parseRequiredVideos(
            campaignToFilmingRequirements(target, filmingRequirements),
          ),
        ),
      tagRequirement: target.tagRequirement || form.tagRequirement,
    }));
  }, [activeCampaign, mergedCampaigns, filmingRequirements]);

  useEffect(() => {
    if (!selectedTemplateCreator) return;
    const creatorCampaign = mergedCampaigns.find(
      (campaign) => campaign.productName === selectedTemplateCreator.product,
    );
    const creatorRequirements = campaignToFilmingRequirements(
      creatorCampaign,
      activeFilmingRequirements,
    );
    setTemplateForm((form) => ({
      ...form,
      creatorName: selectedTemplateCreator.username || form.creatorName,
      productName:
        selectedTemplateCreator.product || creatorRequirements.productName,
      sellingPoint: creatorCampaign?.sellingPoints || form.sellingPoint,
      requirement:
        [
          ...creatorRequirements.requirements,
          ...creatorRequirements.keyContentPoints,
        ]
          .filter(Boolean)
          .join("; ") || form.requirement,
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
          ? form.trackingNumber
          : parseNumberFromNotes(selectedTemplateCreator.notes, [
              "tracking",
              "tracking number",
            ]),
      deadline: selectedTemplateCreator.nextFollowUpDate || form.deadline,
    }));
  }, [selectedTemplateCreator, mergedCampaigns, activeFilmingRequirements]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const enrichedRows = useMemo(
    () =>
      visibleRows.map((row) => ({
        row,
        task: tasksById.get(row.id),
        status: inferStatus(row, requiredVideos),
        creatorType: creatorType(row),
        followers: followerCount(row),
        avgViews: avgViews(row),
        gmv: gmvRange(row),
      })),
    [visibleRows, tasksById, requiredVideos],
  );

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return enrichedRows.filter((entry) => {
      const haystack = [
        entry.row.username,
        entry.row.profileLink,
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

  const todayTodo = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            task.needsFollowUp ||
            task.failedWarnings.length > 0 ||
            inferStatus(task, requiredVideos) === "Product Tag Missing" ||
            inferStatus(task, requiredVideos) === "Ready for Ads",
        )
        .sort((a, b) => a.stageRank - b.stageRank || a.priorityRank - b.priorityRank)
        .slice(0, 12),
    [tasks, requiredVideos],
  );

  const processedTodayCount = tasks.filter((task) =>
    isHandledToday(task),
  ).length;
  const pendingFollowUpCount = tasks.filter(
    (task) => task.needsFollowUp && !isHandledToday(task),
  ).length;

  const deliveredWaitingVideoCount = enrichedRows.filter((entry) => {
    const { posted } = videoProgressCounts(entry.row, requiredVideos);
    return isSampleDeliveredForVideo(entry.row, requiredVideos) && posted === 0;
  }).length;
  const remainingVideoCount = enrichedRows.filter((entry) => {
    const { posted, required } = videoProgressCounts(entry.row, requiredVideos);
    return posted > 0 && posted < required;
  }).length;
  const postedThisWeekCount = enrichedRows.reduce((count, entry) => {
    const dateSet = new Set(
      [entry.row.firstVideoPostedDate, entry.row.latestVideoPostedDate ?? ""].filter(
        (date) => date && isCurrentWeek(date),
      ),
    );
    return count + dateSet.size;
  }, 0);

  const dashboardCards: Array<{
    label: string;
    value: number;
    filterKey: WorkbenchFilterKey;
  }> = [
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
      label: "剩余视频待履约数量",
      value: remainingVideoCount,
      filterKey: "remaining_video",
    },
    {
      label: "本周已发布视频数量",
      value: postedThisWeekCount,
      filterKey: "posted_this_week",
    },
    {
      label: "合作完成数量",
      value: enrichedRows.filter((entry) => entry.status === "Completed").length,
      filterKey: "completed",
    },
    {
      label: "合作失败数量",
      value: enrichedRows.filter((entry) => entry.status === "Lost").length,
      filterKey: "failed",
    },
    {
      label: "样品运输中数量",
      value: enrichedRows.filter((entry) =>
        isSampleInTransitForDaily(entry.row, requiredVideos),
      ).length,
      filterKey: "sample_shipped",
    },
  ];


  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      setError("");
      const parsedRows = await parseCreatorFile(file, requiredVideos);
      setRows(parsedRows);
      setFileName(file.name);
      setSelectedIds([]);
      setToast({ tone: "success", text: "导入成功，已刷新工作台数据。" });
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
      currentRows.map((row) =>
        row.id === rowId
          ? updateCreatorField(row, field, value, requiredVideos)
          : row,
      ),
    );
    setMessage(null);
    setMessageSource("local");
  }

  function handleDashboardCardClick(card: (typeof dashboardCards)[number]) {
    setActiveModule("dashboard");
    setWorkbenchFilter({ key: card.filterKey, label: card.label });
    setFollowupSearch("");
    setFollowupUrgency("All");
    setShowProcessedToday(card.filterKey === "processed_today");
    setOnlyCurrentCreator(false);
    setIsQueueExpanded(true);
    const firstMatch = tasks.find((task) =>
      matchesWorkbenchFilter(task, card.filterKey),
    );
    setSelectedCreatorId(firstMatch?.id ?? "");
    setMessage(firstMatch ? buildLocalMessageForTask(firstMatch) : null);
    setMessageSource("local");
    setShowNextCreatorPrompt(false);
    scrollToQueue();
  }

  function handleAddCreator() {
    const choice = window.prompt(
      "所属产品（输入现有产品名称，或输入新产品项目名称）：",
      selectedCampaign === "ALL"
        ? (mergedCampaigns[0]?.productName ?? filmingRequirements.productName)
        : selectedCampaign,
    );
    const productName =
      choice?.trim() ||
      (selectedCampaign === "ALL"
        ? mergedCampaigns[0]?.productName
        : selectedCampaign) ||
      filmingRequirements.productName;
    if (
      !mergedCampaigns.some((campaign) => campaign.productName === productName)
    )
      setCampaigns((current) => [
        ...current,
        createCampaignFromName(productName, filmingRequirements),
      ]);
    const newRow = createBlankCreatorRow(productName, requiredVideos);
    setRows((currentRows) => [newRow, ...currentRows]);
    setSelectedCreatorId(newRow.id);
    setActiveModule("creators");
    setToast({ tone: "success", text: "已新增达人，可直接编辑表格字段。" });
  }

  function toggleSelected(rowId: string) {
    setSelectedIds((ids) =>
      ids.includes(rowId) ? ids.filter((id) => id !== rowId) : [...ids, rowId],
    );
  }

  function toggleSelectAll(event: ChangeEvent<HTMLInputElement>) {
    setSelectedIds(
      event.target.checked ? filteredRows.map((entry) => entry.row.id) : [],
    );
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

  function handleBulkStatusUpdate() {
    if (selectedIds.length === 0) return;
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

  function buildOutreachForRow(row: CreatorRow) {
    const campaignRequirements = campaignToFilmingRequirements(
      mergedCampaigns.find((campaign) => campaign.productName === row.product),
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
    return `Hi ${greetingName}, we love your TikTok pet content and would like to invite you to collaborate on ${product}. Are you open to receiving a sample and creating ${parseRequiredVideos(campaignRequirements)} TikTok Shop video(s)?`;
  }

  function handleBulkCopyOutreach() {
    const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
    if (selectedRows.length === 0) return;
    void copyText(
      selectedRows.map(buildOutreachForRow).join("\n\n---\n\n"),
      `已复制 ${selectedRows.length} 条邀约话术。`,
    );
  }

  function buildLocalMessageForTask(task: Task): GeneratedMessage {
    const creatorCampaign = mergedCampaigns.find(
      (campaign) => campaign.productName === task.product,
    );
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
    setDeepSeekDetectedIntent("");
    setDeepSeekRecommendedTrackingStatus("");
  }

  function buildCampaignContext(task: Task): string {
    const campaign = mergedCampaigns.find(
      (item) => item.productName === task.product,
    );
    const requirements = campaignToFilmingRequirements(
      campaign,
      activeFilmingRequirements,
    );
    return [
      `产品：${task.product || requirements.productName}`,
      campaign?.sellingPoints ? `卖点：${campaign.sellingPoints}` : "",
      requirements.requirements.length
        ? `拍摄要求：${requirements.requirements.join("；")}`
        : "",
      requirements.keyContentPoints.length
        ? `内容重点：${requirements.keyContentPoints.join("；")}`
        : "",
      campaign?.avoidShots ? `避免事项：${campaign.avoidShots}` : "",
      campaign?.productLink ? `产品链接：${campaign.productLink}` : "",
      requirements.referenceLinks?.length
        ? `参考链接：${requirements.referenceLinks.join("；")}`
        : "",
      campaign?.notes ? `项目备注：${campaign.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function buildDeepSeekPayload(task: Task, action: DeepSeekAction) {
    const campaign = mergedCampaigns.find(
      (item) => item.productName === task.product,
    );
    const requirements = campaignToFilmingRequirements(
      campaign,
      activeFilmingRequirements,
    );
    return {
      action,
      creatorUsername: displayName(task),
      creatorReply: currentCreatorReply(task),
      userReplyFocus: replyFocus,
      creatorRelationshipNote: replyRelationshipNote,
      replyTone,
      replyGoal,
      acceptableConcession: replyConcession,
      channel,
      productName: task.product || requirements.productName,
      productSellingPoints:
        campaign?.sellingPoints || requirements.keyContentPoints.join("；"),
      filmingRequirements: requirements.requirements.join("；"),
      requiredVideoCount:
        campaign?.videoCount || String(parseRequiredVideos(requirements)),
      requiredVideoLength:
        campaign?.videoLength ||
        requirements.requirements.find((item) => item.includes("秒")) ||
        "",
      productLinkRequirement:
        campaign?.tagRequirement ||
        requirements.requirements.find(
          (item) =>
            item.includes("链接") ||
            item.toLowerCase().includes("product link"),
        ) ||
        "必须挂 TikTok Shop 产品链接",
      referenceVideoLinks: requirements.referenceLinks?.join("\n") || "",
      currentStatus:
        task.currentStatus || displayStatus(inferStatus(task, requiredVideos)),
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
        setDeepSeekDetectedIntent("");
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
      setDeepSeekDetectedIntent(result.detectedIntent || "");
      setDeepSeekChineseExplanation(result.chineseExplanation || "");
      setDeepSeekRecommendedTrackingStatus(
        result.recommendedTrackingStatus || "",
      );
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
                inferStatus(row, requiredVideos) === "Not Contacted"
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

  function markVideoProgress(postedCount: 1 | 2) {
    if (!selectedTask) return;
    const today = todayString();
    const isComplete = postedCount >= 2;
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== selectedTask.id) return row;
        return {
          ...row,
          currentStatus: isComplete ? "合作完成" : "已发布 1 条 / 待补第 2 条",
          trackingStatus: isComplete ? "合作完成" : "已发布部分视频",
          videoProgress: isComplete ? "2 of 2" : "1 of 2",
          videoProgressWarning: undefined,
          firstVideoPostedDate: row.firstVideoPostedDate || today,
          latestVideoPostedDate: today,
          lastHandledDate: today,
          nextFollowUpDate: isComplete ? "" : addDays(2),
          followUpHistory: [
            ...(row.followUpHistory ?? []),
            {
              date: today,
              action: isComplete ? "Completed" : "Video Posted",
              note: isComplete
                ? "已记录达人完成 2 条视频。"
                : "已记录达人发布 1 条视频。",
            },
          ],
        };
      }),
    );
    finishProcessing(isComplete ? "已记录达人完成 2 条视频。" : "已记录达人发布 1 条视频。");
  }

  function handleManualVideoProgressUpdate() {
    if (!selectedTask) return;
    const progress = window.prompt(
      "视频进度：可填 0/2、1/2、2/2 或自定义",
      selectedTask.videoProgress || "0/2",
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
    const note = window.prompt("视频进度备注（可留空）", "手动更新视频进度。") ?? "";
    const today = todayString();
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== selectedTask.id) return row;
        const updated = updateCreatorField(row, "videoProgress", progress, requiredVideos);
        return {
          ...updated,
          firstVideoPostedDate: firstDate,
          latestVideoPostedDate: latestDate,
          lastHandledDate: today,
          nextFollowUpDate: normalizeVideoProgress(progress, requiredVideos).postedCount === 2 ? "" : row.nextFollowUpDate,
          followUpHistory: [
            ...(row.followUpHistory ?? []),
            { date: today, action: "Video Posted", note: note || `手动更新视频进度为 ${progress}。` },
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
              followUpHistory: [
                ...(row.followUpHistory ?? []),
                {
                  date: today,
                  action: outcome,
                  note:
                    outcome === "Completed"
                      ? "今日标记合作完成。"
                      : "今日标记合作失败。",
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
      text: outcome === "Completed" ? "已标记合作完成。" : "已标记合作失败。",
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

  function handleSaveFilmingRequirements() {
    const next = {
      productName:
        filmingProductNameDraft.trim() ||
        defaultCreatorFilmingRequirements.productName,
      requirements: normalizeListText(filmingRequirementsDraft),
      keyContentPoints: normalizeListText(keyContentPointsDraft),
      referenceLinks: normalizeListText(referenceLinksDraft),
    };
    setFilmingRequirements(next);
    setTemplateForm((form) => ({
      ...form,
      productName: next.productName,
      videos: String(parseRequiredVideos(next)),
    }));
    saveFilmingRequirements(next);
    setIsEditingFilmingRequirements(false);
    setToast({ tone: "success", text: "拍摄要求已保存。" });
  }

  function handleEditFilmingRequirements() {
    setFilmingProductNameDraft(filmingRequirements.productName);
    setFilmingRequirementsDraft(listToText(filmingRequirements.requirements));
    setKeyContentPointsDraft(listToText(filmingRequirements.keyContentPoints));
    setReferenceLinksDraft(listToText(filmingRequirements.referenceLinks));
    setIsEditingFilmingRequirements(true);
  }

  function handleRestoreDefaultFilmingRequirements() {
    setFilmingProductNameDraft(defaultCreatorFilmingRequirements.productName);
    setFilmingRequirementsDraft(
      listToText(defaultCreatorFilmingRequirements.requirements),
    );
    setKeyContentPointsDraft(
      listToText(defaultCreatorFilmingRequirements.keyContentPoints),
    );
    setReferenceLinksDraft(
      listToText(defaultCreatorFilmingRequirements.referenceLinks),
    );
    setFilmingRequirements(defaultCreatorFilmingRequirements);
    saveFilmingRequirements(defaultCreatorFilmingRequirements);
    setIsEditingFilmingRequirements(false);
    setToast({ tone: "success", text: "已恢复默认拍摄要求。" });
  }

  function handleOpenPromptHelper() {
    setPromptHelperForm({
      sellingPoints: "",
      videoCount: String(requiredVideos),
      durationRequirement: "",
      targetPetOrScene: "",
      mustShowShots: "",
      avoidShots: "",
      referenceLinks: listToText(filmingRequirements.referenceLinks),
    });
    setGeneratedChatGptPrompt("");
    setPromptCopyStatus("");
    setIsPromptHelperOpen(true);
  }

  function buildChatGptPrompt() {
    return `请你作为熟悉美国 TikTok Shop 达人合作沟通的内容运营，基于下面的产品信息，生成一版可以直接发给达人的中文「达人拍摄要求」。\n\n【产品信息】\n- 产品名称：${activeFilmingRequirements.productName}\n- 产品卖点：${promptHelperForm.sellingPoints || "请补充"}\n- 目标视频数量：${promptHelperForm.videoCount || requiredVideos}\n- 单条视频时长要求：${promptHelperForm.durationRequirement || "40s+"}\n- 目标宠物 / 使用场景：${promptHelperForm.targetPetOrScene || "真实宠物使用场景"}\n- 必须展示的画面：${promptHelperForm.mustShowShots || "开箱、使用过程、CTA"}\n- 不希望达人这样拍：${promptHelperForm.avoidShots || "避免违规表述"}\n- 对标视频链接（可选）：${promptHelperForm.referenceLinks || "无"}\n\n请按以下结构输出，全部使用简体中文：\n1. 产品名称\n2. 达人拍摄要求\n3. 重点拍摄内容`;
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
      <section className="campaign-switcher" aria-label="当前产品项目">
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
            {mergedCampaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.productName}>
                {campaign.productName}
              </option>
            ))}
          </select>
        </label>
        <div className="campaign-context">
          <strong>
            {selectedCampaign === "ALL" ? "全部产品组合视图" : selectedCampaign}
          </strong>
          <span>
            {selectedCampaign === "ALL"
              ? "看板、表格、队列合并显示，所有明细展示产品标签。"
              : "当前页面按该产品项目过滤，并使用该产品的拍摄要求与参考链接。"}
          </span>
        </div>
      </section>
    );
  }

  function campaignStats(campaign: Campaign) {
    const campaignRows = rows.filter(
      (row) => row.product.trim() === campaign.productName,
    );
    const campaignRequirements = campaignToFilmingRequirements(
      campaign,
      filmingRequirements,
    );
    const campaignRequiredVideos = parseRequiredVideos(campaignRequirements);
    const campaignTasks = analyzeCreators(
      campaignRows,
      undefined,
      campaignRequiredVideos,
    );
    const campaignTaskMap = new Map(
      campaignTasks.map((task) => [task.id, task]),
    );
    return {
      creatorCount: campaignRows.length,
      todayFollowUp: campaignTasks.filter(
        (task) => task.needsFollowUp && !isHandledToday(task),
      ).length,
      highest: campaignTasks.filter((task) => task.priority === "Highest")
        .length,
      high: campaignTasks.filter((task) => task.priority === "High").length,
      inTransit: campaignRows.filter(
        (row) => inferStatus(row, campaignRequiredVideos) === "Sample Shipped",
      ).length,
      deliveredPending: campaignRows.filter((row) =>
        ["Delivered", "Waiting Video"].includes(
          inferStatus(row, campaignRequiredVideos),
        ),
      ).length,
      remainingVideos: campaignRows.reduce((sum, row) => {
        const progress = normalizeVideoProgress(
          row.videoProgress,
          campaignRequiredVideos,
        );
        return (
          sum +
          Math.max(
            0,
            (progress.requiredVideos ?? campaignRequiredVideos) -
              (progress.postedCount ?? 0),
          )
        );
      }, 0),
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

  function renderCampaignOverview() {
    return (
      <section className="campaign-overview">
        <div className="section-heading">
          <div>
            <h2>产品项目概览</h2>
            <p className="muted">
              按产品 Campaign 分离达人、样品、视频履约和失败风险。
            </p>
          </div>
        </div>
        <div className="campaign-card-grid">
          {mergedCampaigns.map((campaign) => {
            const stats = campaignStats(campaign);
            return (
              <button
                type="button"
                key={campaign.id}
                className="campaign-card"
                onClick={() => setSelectedCampaign(campaign.productName)}
              >
                <span className="product-badge">{campaign.productName}</span>
                <strong>{stats.creatorCount} 位达人</strong>
                <div className="campaign-metrics">
                  <span>
                    今日需跟进 <b>{stats.todayFollowUp}</b>
                  </span>
                  <span>
                    极高 <b>{stats.highest}</b>
                  </span>
                  <span>
                    高 <b>{stats.high}</b>
                  </span>
                  <span>
                    样品运输中 <b>{stats.inTransit}</b>
                  </span>
                  <span>
                    到货待拍 <b>{stats.deliveredPending}</b>
                  </span>
                  <span>
                    剩余视频 <b>{stats.remainingVideos}</b>
                  </span>
                  <span>
                    已完成 <b>{stats.completed}</b>
                  </span>
                  <span>
                    已失败 <b>{stats.failed}</b>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  function renderImportCard() {
    return (
      <section className="panel compact-panel">
        <div className="section-heading">
          <div>
            <h2>数据导入 / 导出</h2>
            <p className="muted">
              支持 Excel / CSV 导入导出，数据保存在当前浏览器。
            </p>
          </div>
          <div className="inline-actions">
            <label className="file-button">
              导入 Excel / CSV
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() => downloadCreatorRowsCsv(rows)}
              disabled={rows.length === 0}
            >
              导出 CSV
            </button>
            <button type="button" onClick={handleAddCreator}>
              新增达人
            </button>
          </div>
        </div>
        {fileName && <p className="muted">已加载：{fileName}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  function renderDashboard() {
    const shouldShowReplyBlock = Boolean(
      selectedTask &&
      (message ||
        (selectedTask.trackingStatus ?? "").match(
          /Replied|Reply Pending|达人已回复|达人回复待处理/i,
        ) ||
        selectedTask.lastCreatorResponse?.trim() ||
        selectedTask.notes.trim()),
    );
    const priorityText = priorityLabel;
    const selectedStatus = selectedTask
      ? inferStatus(selectedTask, requiredVideos)
      : "Not Contacted";

    return (
      <>
        {renderPageHeader(
          "今日工作台",
          "每天打开后，先选产品项目，再按优先级处理今天要联系的达人。",
          <button type="button" onClick={() => setActiveModule("creators")}>
            打开达人数据库
          </button>,
        )}
        {renderCampaignOverview()}
        <section className="dashboard-grid" aria-label="今日概览">
          {dashboardCards.map((card) => (
            <button
              type="button"
              key={card.label}
              className="metric-card"
              onClick={() => handleDashboardCardClick(card)}
            >
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>
                {selectedCampaign === "ALL" ? "全部产品" : selectedCampaign}
              </small>
            </button>
          ))}
        </section>
        <section
          className="panel generator-panel workbench-panel"
          ref={queueRef}
        >
          <div className="section-heading">
            <div>
              <h2>今日待处理达人队列</h2>
              <p className="muted">
                当前队列已按「
                {selectedCampaign === "ALL" ? "全部产品" : selectedCampaign}
                」过滤{workbenchFilter ? ` · ${workbenchFilter.label}` : ""}
                。选择达人后会自动收起长队列，直接进入处理区。
              </p>
            </div>
            <div className="inline-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setOnlyCurrentCreator((value) => !value)}
              >
                {onlyCurrentCreator ? "显示达人队列" : "只看当前达人"}
              </button>
              {workbenchFilter && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setWorkbenchFilter(null);
                    setSelectedCreatorId("");
                  }}
                >
                  清除卡片筛选
                </button>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => setIsQueueExpanded((value) => !value)}
              >
                {isQueueExpanded ? "收起达人队列" : "展开达人队列"}
              </button>
            </div>
          </div>
          <div className="generator-controls workbench-controls">
            <label>
              搜索队列
              <input
                value={followupSearch}
                onChange={(event) => setFollowupSearch(event.target.value)}
                placeholder="达人 / 产品 / 状态 / 跟进状态 / 紧急程度"
              />
            </label>
            <label>
              紧急程度
              <select
                value={followupUrgency}
                onChange={(event) =>
                  setFollowupUrgency(
                    event.target.value as typeof followupUrgency,
                  )
                }
              >
                <option value="All">全部</option>
                <option value="Highest">极高</option>
                <option value="High">高</option>
                <option value="Medium">中</option>
                <option value="Low">低</option>
              </select>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={showProcessedToday}
                onChange={(event) =>
                  setShowProcessedToday(event.target.checked)
                }
              />
              显示今日已处理
            </label>
            <label>
              选择达人
              <select
                aria-label="选择达人"
                value={selectedTask?.id ?? ""}
                onChange={(event) => handleSelectCreator(event.target.value)}
              >
                {filteredTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {compactCreatorLabel(task)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              联系渠道
              <select
                value={channel}
                onChange={(event) => setChannel(event.target.value as Channel)}
              >
                {CHANNELS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleGenerateMessage}
              disabled={!selectedTask}
            >
              生成话术
            </button>
          </div>
          {!onlyCurrentCreator && isQueueExpanded && (
            <div
              className="queue-list compact-queue"
              data-testid="creator-queue"
            >
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    className={`queue-item ${selectedTask?.id === task.id ? "active" : ""}`}
                    onClick={() => handleSelectCreator(task.id)}
                  >
                    <span className="queue-main-line">
                      <strong>{creatorHandle(task)}</strong>
                      <span className="queue-badges">
                        <em>{priorityLabel(task)}</em>
                        <em>{queueStatusLabel(task)}</em>
                      </span>
                    </span>
                    <span className="queue-sub-line">
                      {task.currentStatus || displayStatus(inferStatus(task, requiredVideos))}
                    </span>
                  </button>
                ))
              ) : (
                <div className="empty-state compact-empty">
                  <strong>当前筛选下暂无待处理达人。</strong>
                </div>
              )}
            </div>
          )}
          {!onlyCurrentCreator && !isQueueExpanded && (
            <div className="collapsed-copy queue-collapsed">
              <strong>达人队列已收起。</strong>
              <span>
                当前只显示处理区，点击「展开达人队列」可继续查看全部待处理达人。
              </span>
            </div>
          )}
          {selectedTask ? (
            <div
              ref={currentCreatorRef}
              className="current-creator-panel"
              data-testid="current-creator-panel"
            >
              <div className="section-heading">
                <div>
                  <h2>当前处理达人</h2>
                  <p className="muted">
                    先确认状态，再生成 / 复制英文话术，发送后回到工具标记。
                  </p>
                </div>
                {nextTask && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleProcessNextCreator}
                  >
                    处理下一个达人
                  </button>
                )}
              </div>
              <div className="current-creator-grid">
                <span>
                  达人账号<b>{displayName(selectedTask)}</b>
                </span>
                <span>
                  产品项目<b>{selectedTask.product || "缺少产品名称"}</b>
                </span>
                <span>
                  当前状态
                  <b>
                    {selectedTask.currentStatus ||
                      displayStatus(selectedStatus)}
                  </b>
                </span>
                <span>
                  紧急程度<b>{priorityText(selectedTask)}</b>
                </span>
                <span>
                  优先级原因<b>{selectedTask.triggerReason}</b>
                </span>
                <span>
                  沟通动作<b>{selectedTask.suggestedAction}</b>
                </span>
                <span>
                  跟进状态<b>{selectedTask.trackingStatus || "—"}</b>
                </span>
                <span className="creator-note-preview">
                  处理备注 / 达人备注<b>{selectedTask.notes.trim() || "—"}</b>
                </span>
              </div>
              <details className="more-info-card">
                <summary>更多信息</summary>
                <div className="current-creator-grid secondary-grid">
                  <span>
                    联系渠道<b>{channel}</b>
                  </span>
                  <span>
                    最近联系日期<b>{selectedTask.lastContactDate || "—"}</b>
                  </span>
                  <span>
                    样品状态<b>{selectedTask.sampleShippingStatus || "—"}</b>
                  </span>
                  <span>
                    样品到货时间<b>{selectedTask.sampleDeliveredDate || "—"}</b>
                  </span>
                  <span>
                    视频进度<b>{selectedTask.videoProgress || "—"}</b>
                  </span>
                  <span>
                    首条视频发布时间
                    <b>{selectedTask.firstVideoPostedDate || "—"}</b>
                  </span>
                  <span>
                    最近回复日期
                    <b>
                      {selectedTask.followUpHistory
                        ?.slice()
                        .reverse()
                        .find((entry) => entry.action === "Creator Replied")
                        ?.date || "—"}
                    </b>
                  </span>
                  <span>
                    主页链接<b>{selectedTask.profileLink || "—"}</b>
                  </span>
                </div>
              </details>
            </div>
          ) : (
            <div className="empty-state">
              <strong>暂无待处理达人。</strong>
              <span>
                {workbenchFilter
                  ? "当前筛选下暂无待处理达人。"
                  : "请导入达人数据，或切换到「全部产品」查看完整队列。"}
              </span>
            </div>
          )}
          {shouldShowReplyBlock && selectedTask && (
            <section className="reply-panel" data-testid="reply-handling-panel">
              <div className="section-heading">
                <div>
                  <h2>达人回复处理</h2>
                  <p className="muted">
                    默认只保留日常 BD 必填信息；高级策略字段已折叠。
                  </p>
                </div>
              </div>
              <div className="reply-two-column">
                <div className="reply-column">
                  <h3>达人回复</h3>
                  <label>
                    达人回复原文
                    <textarea
                      value={currentCreatorReply(selectedTask)}
                      onChange={(event) =>
                        updateCurrentCreatorReply(
                          selectedTask,
                          event.target.value,
                        )
                      }
                      placeholder="可粘贴或手动修正达人原始回复"
                      rows={4}
                    />
                  </label>
                  <p className="muted compact-helper">
                    可粘贴或手动修正达人原始回复，DeepSeek
                    会基于这里的内容翻译和生成回复。
                  </p>
                  <label>
                    处理备注 / 达人备注
                    <textarea
                      value={selectedTask.notes}
                      onChange={(event) =>
                        updateRow(selectedTask.id, "notes", event.target.value)
                      }
                      placeholder="例如：周末发布 / 回复慢，不要每天催 / 脚受伤，周五后再跟进 / 已沟通，等待剪辑 / 今天不催"
                      rows={3}
                    />
                  </label>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        void callDeepSeek("translate_creator_reply")
                      }
                      disabled={deepSeekLoadingAction !== null}
                    >
                      DeepSeek 翻译达人回复
                    </button>
                  </div>
                  <div
                    className={`translation-card ${isTranslationExpanded ? "expanded" : ""}`}
                    data-testid="translation-card"
                  >
                    <div className="translation-card-header">
                      <h3>中文翻译</h3>
                      {deepSeekChineseTranslation && (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() =>
                            void copyText(
                              deepSeekChineseTranslation,
                              "已复制中文翻译。",
                            )
                          }
                        >
                          复制翻译
                        </button>
                      )}
                    </div>
                    {isTranslationEditing ? (
                      <textarea
                        aria-label="编辑中文翻译"
                        value={deepSeekChineseTranslation}
                        onChange={(event) =>
                          setDeepSeekChineseTranslation(event.target.value)
                        }
                        rows={3}
                      />
                    ) : (
                      <p className="translation-text">
                        {deepSeekChineseTranslation ||
                          "点击 DeepSeek 翻译达人回复后，这里只显示直译中文。"}
                      </p>
                    )}
                    {deepSeekChineseTranslation && (
                      <div className="inline-actions compact-actions">
                        <button
                          type="button"
                          className="link-button"
                          onClick={() =>
                            setIsTranslationExpanded((value) => !value)
                          }
                        >
                          {isTranslationExpanded ? "收起" : "展开全文"}
                        </button>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() =>
                            setIsTranslationEditing((value) => !value)
                          }
                        >
                          {isTranslationEditing ? "完成编辑" : "编辑翻译"}
                        </button>
                      </div>
                    )}
                  </div>
                  {deepSeekLoadingAction === "translate_creator_reply" && (
                    <p className="ai-status" role="status">
                      DeepSeek 生成中…
                    </p>
                  )}
                  {deepSeekError && (
                    <p className="error" role="alert">
                      {deepSeekError.includes("DEEPSEEK_API_KEY")
                        ? "未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。"
                        : "DeepSeek 调用失败，请检查 API Key 或稍后重试。"}
                    </p>
                  )}
                </div>
                <div className="reply-column">
                  <h3>生成英文回复</h3>
                  <label>
                    我想回复的重点
                    <textarea
                      value={replyFocus}
                      onChange={(event) => setReplyFocus(event.target.value)}
                      placeholder="例如：表示理解，确认具体发布时间，方便安排投流"
                      rows={3}
                    />
                  </label>
                  <div className="reply-inline-fields">
                    <p className="readonly-channel">当前联系渠道：{channel}</p>
                    <label>
                      回复语气
                      <select
                        value={replyTone}
                        onChange={(event) =>
                          setReplyTone(event.target.value as ReplyTone)
                        }
                      >
                        <option>中立专业</option>
                        <option>友好一点</option>
                        <option>坚定推进</option>
                        <option>最后确认</option>
                      </select>
                    </label>
                  </div>
                  <details
                    className="advanced-reply-settings"
                    open={isAdvancedReplyOpen}
                    onToggle={(event) =>
                      setIsAdvancedReplyOpen(event.currentTarget.open)
                    }
                  >
                    <summary>高级设置</summary>
                    <div className="reply-fields">
                      <label>
                        达人关系备注（可选）
                        <textarea
                          value={replyRelationshipNote}
                          onChange={(event) =>
                            setReplyRelationshipNote(event.target.value)
                          }
                          placeholder="例如：她之前视频质量不错 / 沟通比较慢"
                        />
                      </label>
                      <label>
                        这次回复目标（可选）
                        <textarea
                          value={replyGoal}
                          onChange={(event) => setReplyGoal(event.target.value)}
                          placeholder="例如：确认发布时间 / 推进剩余视频"
                        />
                      </label>
                      <label>
                        可接受让步（可选）
                        <textarea
                          value={replyConcession}
                          onChange={(event) =>
                            setReplyConcession(event.target.value)
                          }
                          placeholder="例如：可以周五发布 / 不能不挂车"
                        />
                      </label>
                    </div>
                  </details>
                  <p className="muted compact-helper">
                    默认先使用本地专业话术。DeepSeek
                    仅用于复杂回复或需要个性化优化时。
                  </p>
                  <p className="muted compact-helper">
                    DeepSeek 翻译只做直译；英文回复会把你的中文重点准确转成
                    creator-facing English。
                  </p>
                  {message && (
                    <div ref={messageAreaRef} className="message-output">
                      <h3>场景 / 沟通动作</h3>
                      <p>
                        {message.scenario} · {message.communicationAction}
                      </p>
                      <h3>英文话术</h3>
                      <p className="message-source-label">
                        {messageSource === "deepseek"
                          ? "DeepSeek 优化话术"
                          : "本地推荐话术"}
                      </p>
                      <label
                        className="sr-only"
                        htmlFor="generated-english-message"
                      >
                        英文话术
                      </label>
                      <textarea
                        id="generated-english-message"
                        value={message.english}
                        onChange={(event) =>
                          updateGeneratedEnglishMessage(event.target.value)
                        }
                        rows={7}
                      />
                      <div className="deepseek-actions">
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              void callDeepSeek("generate_personalized_reply")
                            }
                            disabled={deepSeekLoadingAction !== null}
                          >
                            DeepSeek 生成英文回复
                          </button>
                        </div>
                        {deepSeekLoadingAction ===
                          "generate_personalized_reply" && (
                          <p className="ai-status" role="status">
                            DeepSeek 生成中…
                          </p>
                        )}
                      </div>
                      <h3>中文对照 / 中文解释</h3>
                      <span className="sr-only">中文解释</span>
                      <p>
                        {deepSeekChineseExplanation ||
                          message.chineseExplanation}
                      </p>
                      <h3>发送后追踪</h3>
                      <p>
                        发送后请点击「标记为已发送」，系统会更新最近联系日期、跟进次数和下一次跟进日期。
                      </p>
                      <div className="inline-actions">
                        <button
                          type="button"
                          onClick={() => void handleCopyGeneratedMessage()}
                        >
                          复制英文话术
                        </button>
                        <button type="button" onClick={handleMarkMessageSent}>
                          标记为已发送
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={handleMarkCreatorReplied}
                        >
                          标记达人已回复
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={markCreatorNoReply}
                        >
                          标记未回复
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => markVideoProgress(1)}
                        >
                          标记已发布 1 条
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => markVideoProgress(2)}
                        >
                          标记已发布 2 条 / 合作完成
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={handleManualVideoProgressUpdate}
                        >
                          手动更新视频进度
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => markCreatorOutcome("Completed")}
                        >
                          标记合作完成
                        </button>
                        <button
                          type="button"
                          className="danger secondary"
                          onClick={() => markCreatorOutcome("Failed")}
                        >
                          标记合作失败
                        </button>
                      </div>
                      <div className="skip-today-control">
                        <button
                          type="button"
                          className="secondary"
                          onClick={markCreatorSkippedToday}
                        >
                          今日暂不跟进
                        </button>
                      </div>
                      {trackingStatus && (
                        <p className="tracking-status">{trackingStatus}</p>
                      )}
                      {showNextCreatorPrompt && (
                        <div className="next-creator-prompt">
                          <strong>
                            {lastProcessingResult || "已记录处理结果。"}
                          </strong>
                          <div className="inline-actions">
                            <button
                              type="button"
                              onClick={handleProcessNextCreator}
                              disabled={!nextTask}
                            >
                              处理下一个达人
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => setShowNextCreatorPrompt(false)}
                            >
                              留在当前达人
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </section>
      </>
    );
  }

  function renderCreatorDatabase() {
    const allSelected =
      filteredRows.length > 0 &&
      filteredRows.every((entry) => selectedIds.includes(entry.row.id));
    return (
      <>
        {renderPageHeader(
          "达人数据库",
          "管理达人信息、合作状态、物流状态、视频进度和跟进记录。",
        )}
        {renderImportCard()}
        <section className="panel table-panel">
          <div className="filters-bar">
            <label>
              搜索
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索达人昵称 / 产品 / 状态"
              />
            </label>
            <label>
              合作状态
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as CreatorStatus | "All")
                }
              >
                <option value="All">全部</option>
                {creatorStatuses.map((status) => (
                  <option key={status} value={status}>
                    {displayStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              达人类型
              <select
                value={creatorTypeFilter}
                onChange={(event) => setCreatorTypeFilter(event.target.value)}
              >
                <option value="All">全部</option>
                <option>Pet</option>
                <option>UGC</option>
                <option>Grooming</option>
              </select>
            </label>
            <label>
              粉丝量级
              <select
                value={followerFilter}
                onChange={(event) => setFollowerFilter(event.target.value)}
              >
                <option value="All">全部</option>
                <option>K</option>
                <option>M</option>
                <option>—</option>
              </select>
            </label>
            <label>
              平均播放
              <select
                value={avgViewsFilter}
                onChange={(event) => setAvgViewsFilter(event.target.value)}
              >
                <option value="All">全部</option>
                <option>K</option>
                <option>M</option>
                <option>—</option>
              </select>
            </label>
            <label>
              GMV 区间
              <select
                value={gmvFilter}
                onChange={(event) => setGmvFilter(event.target.value)}
              >
                <option value="All">全部</option>
                <option>$</option>
                <option value="low">低</option>
                <option value="mid">中</option>
                <option value="high">高</option>
                <option>—</option>
              </select>
            </label>
          </div>
          <div className="sticky-action-bar">
            <span>已选择 {selectedIds.length} 位达人</span>
            <button
              type="button"
              className="secondary"
              onClick={handleBulkCopyOutreach}
              disabled={selectedIds.length === 0}
            >
              批量复制邀约话术
            </button>
            <select
              value={bulkStatus}
              onChange={(event) =>
                setBulkStatus(event.target.value as CreatorStatus)
              }
            >
              {creatorStatuses.map((status) => (
                <option key={status} value={status}>
                  {displayStatus(status)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleBulkStatusUpdate}
              disabled={selectedIds.length === 0}
            >
              批量更新状态
            </button>
          </div>
          {filteredRows.length === 0 ? (
            <div className="empty-state">
              <strong>没有匹配的达人。</strong>
              <span>下一步：清空筛选、导入 CSV / Excel，或点击 新增达人。</span>
            </div>
          ) : (
            <div className="table-wrap spreadsheet-wrap">
              <table className="ops-table spreadsheet-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        aria-label="全选达人"
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>达人账号</th>
                    <th>主页链接</th>
                    <th>联系渠道</th>
                    <th>产品</th>
                    <th>合作状态</th>
                    <th>样品物流状态</th>
                    <th>样品到货日期</th>
                    <th>视频进度</th>
                    <th>首条视频发布日期</th>
                    <th>最近联系日期</th>
                    <th>跟进次数</th>
                    <th>跟进状态</th>
                    <th>最近沟通动作</th>
                    <th>最近沟通渠道</th>
                    <th>下次跟进日期</th>
                    <th>达人回复</th>
                    <th>达人备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((entry) => (
                    <tr key={entry.row.id}>
                      <td>
                        <input
                          aria-label={`选择 ${displayName(entry.row)}`}
                          type="checkbox"
                          checked={selectedIds.includes(entry.row.id)}
                          onChange={() => toggleSelected(entry.row.id)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label="达人账号"
                          value={entry.row.username}
                          onChange={(event) =>
                            updateRow(entry.row.id, "username", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label="主页链接"
                          value={entry.row.profileLink}
                          onChange={(event) =>
                            updateRow(entry.row.id, "profileLink", event.target.value)
                          }
                          placeholder="@账号或主页链接"
                        />
                      </td>
                      <td>
                        <input
                          aria-label="联系渠道"
                          value={entry.row.contactMethod}
                          onChange={(event) =>
                            updateRow(entry.row.id, "contactMethod", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label="产品名称"
                          value={entry.row.product}
                          onChange={(event) =>
                            updateRow(entry.row.id, "product", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label="合作状态"
                          value={entry.row.currentStatus}
                          onChange={(event) =>
                            updateRow(entry.row.id, "currentStatus", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label="样品物流状态"
                          value={entry.row.sampleShippingStatus}
                          onChange={(event) =>
                            updateRow(entry.row.id, "sampleShippingStatus", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label="样品到货日期"
                          type="date"
                          value={entry.row.sampleDeliveredDate}
                          onChange={(event) =>
                            updateRow(entry.row.id, "sampleDeliveredDate", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label="视频进度"
                          value={entry.row.videoProgress}
                          onChange={(event) =>
                            updateRow(entry.row.id, "videoProgress", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label="首条视频发布日期"
                          type="date"
                          value={entry.row.firstVideoPostedDate}
                          onChange={(event) =>
                            updateRow(entry.row.id, "firstVideoPostedDate", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label="最近联系日期"
                          type="date"
                          value={entry.row.lastContactDate}
                          onChange={(event) =>
                            updateRow(entry.row.id, "lastContactDate", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label="跟进次数"
                          type="number"
                          min="0"
                          value={entry.row.lastFollowUpCount}
                          onChange={(event) =>
                            updateRow(entry.row.id, "lastFollowUpCount", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label="跟进状态"
                          value={entry.row.trackingStatus ?? ""}
                          onChange={(event) =>
                            updateRow(entry.row.id, "trackingStatus", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label="最近沟通动作"
                          value={entry.row.lastMessageScenario ?? ""}
                          onChange={(event) =>
                            updateRow(entry.row.id, "lastMessageScenario", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label="最近沟通渠道"
                          value={entry.row.lastMessageChannel ?? ""}
                          onChange={(event) =>
                            updateRow(entry.row.id, "lastMessageChannel", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label="下次跟进日期"
                          type="date"
                          value={entry.row.nextFollowUpDate ?? ""}
                          onChange={(event) =>
                            updateRow(entry.row.id, "nextFollowUpDate", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <textarea
                          aria-label="达人回复"
                          value={entry.row.lastCreatorResponse ?? ""}
                          onChange={(event) =>
                            updateRow(entry.row.id, "lastCreatorResponse", event.target.value)
                          }
                          rows={1}
                        />
                      </td>
                      <td>
                        <textarea
                          aria-label="达人备注"
                          value={entry.row.notes}
                          onChange={(event) =>
                            updateRow(entry.row.id, "notes", event.target.value)
                          }
                          rows={1}
                        />
                      </td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className="secondary compact-button"
                          onClick={() =>
                            void copyText(buildOutreachForRow(entry.row), "已复制邀约话术。")
                          }
                        >
                          复制英文话术
                        </button>
                        <button
                          type="button"
                          className="danger secondary compact-button"
                          onClick={() =>
                            setRows((currentRows) =>
                              deleteCreatorRow(currentRows, entry.row.id),
                            )
                          }
                        >
                          删除达人
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    );
  }

  function applyTemplateToSelectedCreator() {
    if (!selectedTemplateCreator) {
      setToast({ tone: "warning", text: "请先选择达人。" });
      return;
    }
    const creatorCampaign = mergedCampaigns.find(
      (campaign) => campaign.productName === selectedTemplateCreator.product,
    );
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
              <input
                value={
                  selectedCampaign === "ALL" ? "全部产品" : selectedCampaign
                }
                readOnly
              />
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
                        className={statusTone(inferStatus(row, requiredVideos))}
                      >
                        {displayStatus(inferStatus(row, requiredVideos))}
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
                    <td>{sampleHint(row, requiredVideos)}</td>
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

  function renderReview() {
    const checklist = [
      "是否 40s+",
      "是否按要求发布 2 条视频",
      "是否挂 TikTok Shop 商品卡",
      "是否展示真实宠物使用场景",
      "是否有清晰开箱/使用过程",
      "是否有 CTA",
      "是否存在违规表述",
      "是否可作为投流素材",
    ];
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
                <span className={statusTone(inferStatus(row, requiredVideos))}>
                  {displayStatus(inferStatus(row, requiredVideos))}
                </span>
              </div>
              {checklist.map((item) => (
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
                      inferStatus(row, requiredVideos),
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
                        {inferStatus(row, requiredVideos) ===
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
    const targetCampaign = activeCampaign ?? mergedCampaigns[0];
    return (
      <>
        {renderPageHeader(
          "设置",
          "管理产品项目、拍摄要求、提示词助手和本地数据。",
        )}
        <section className="panel sop-card">
          <div className="section-heading">
            <div>
              <h2>产品项目设置</h2>
              <p className="muted">
                每个产品项目独立保存卖点、拍摄要求、参考视频和备注。
              </p>
            </div>
            <button type="button" onClick={handleEditFilmingRequirements}>
              编辑拍摄要求
            </button>
          </div>
          {targetCampaign && (
            <div className="settings-form campaign-settings">
              <label>
                产品名称
                <input
                  value={targetCampaign.productName}
                  onChange={(event) =>
                    setCampaigns((current) =>
                      mergedCampaigns.map((campaign) =>
                        campaign.id === targetCampaign.id
                          ? { ...campaign, productName: event.target.value }
                          : campaign,
                      ),
                    )
                  }
                />
              </label>
              <label>
                产品卖点（项目）
                <textarea
                  value={targetCampaign.sellingPoints}
                  onChange={(event) =>
                    setCampaigns(
                      mergedCampaigns.map((campaign) =>
                        campaign.id === targetCampaign.id
                          ? { ...campaign, sellingPoints: event.target.value }
                          : campaign,
                      ),
                    )
                  }
                  rows={3}
                />
              </label>
              <label>
                拍摄要求
                <textarea
                  value={listToText(targetCampaign.requirements)}
                  onChange={(event) =>
                    setCampaigns(
                      mergedCampaigns.map((campaign) =>
                        campaign.id === targetCampaign.id
                          ? {
                              ...campaign,
                              requirements: normalizeListText(
                                event.target.value,
                              ),
                            }
                          : campaign,
                      ),
                    )
                  }
                  rows={5}
                />
              </label>
              <label>
                内容重点
                <textarea
                  value={listToText(targetCampaign.keyContentPoints)}
                  onChange={(event) =>
                    setCampaigns(
                      mergedCampaigns.map((campaign) =>
                        campaign.id === targetCampaign.id
                          ? {
                              ...campaign,
                              keyContentPoints: normalizeListText(
                                event.target.value,
                              ),
                            }
                          : campaign,
                      ),
                    )
                  }
                  rows={5}
                />
              </label>
              <label>
                不希望达人这样拍
                <textarea
                  value={targetCampaign.avoidShots}
                  onChange={(event) =>
                    setCampaigns(
                      mergedCampaigns.map((campaign) =>
                        campaign.id === targetCampaign.id
                          ? { ...campaign, avoidShots: event.target.value }
                          : campaign,
                      ),
                    )
                  }
                  rows={3}
                />
              </label>
              <label>
                视频数量
                <input
                  value={targetCampaign.videoCount}
                  onChange={(event) =>
                    setCampaigns(
                      mergedCampaigns.map((campaign) =>
                        campaign.id === targetCampaign.id
                          ? { ...campaign, videoCount: event.target.value }
                          : campaign,
                      ),
                    )
                  }
                />
              </label>
              <label>
                视频时长
                <input
                  value={targetCampaign.videoLength}
                  onChange={(event) =>
                    setCampaigns(
                      mergedCampaigns.map((campaign) =>
                        campaign.id === targetCampaign.id
                          ? { ...campaign, videoLength: event.target.value }
                          : campaign,
                      ),
                    )
                  }
                />
              </label>
              <label>
                挂车 / Tag 要求
                <input
                  value={targetCampaign.tagRequirement}
                  onChange={(event) =>
                    setCampaigns(
                      mergedCampaigns.map((campaign) =>
                        campaign.id === targetCampaign.id
                          ? { ...campaign, tagRequirement: event.target.value }
                          : campaign,
                      ),
                    )
                  }
                />
              </label>
              <label>
                TikTok Shop 产品链接
                <input
                  value={targetCampaign.productLink}
                  onChange={(event) =>
                    setCampaigns(
                      mergedCampaigns.map((campaign) =>
                        campaign.id === targetCampaign.id
                          ? { ...campaign, productLink: event.target.value }
                          : campaign,
                      ),
                    )
                  }
                />
              </label>
              <label>
                参考视频链接（项目）
                <textarea
                  value={listToText(targetCampaign.referenceLinks)}
                  onChange={(event) =>
                    setCampaigns(
                      mergedCampaigns.map((campaign) =>
                        campaign.id === targetCampaign.id
                          ? {
                              ...campaign,
                              referenceLinks: normalizeListText(
                                event.target.value,
                              ),
                            }
                          : campaign,
                      ),
                    )
                  }
                  rows={3}
                />
              </label>
              <label>
                产品备注
                <textarea
                  value={targetCampaign.notes}
                  onChange={(event) =>
                    setCampaigns(
                      mergedCampaigns.map((campaign) =>
                        campaign.id === targetCampaign.id
                          ? { ...campaign, notes: event.target.value }
                          : campaign,
                      ),
                    )
                  }
                  rows={3}
                />
              </label>
              <p className="ai-status">
                产品项目设置会自动保存到 localStorage。
              </p>
              {targetCampaign.referenceLinks.length > 0 && (
                <div className="collapsed-copy">
                  <h3>参考视频链接</h3>
                  <ul>
                    {targetCampaign.referenceLinks.map((link) => (
                      <li key={link}>{link}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {isEditingFilmingRequirements && (
            <div className="settings-form">
              <label>
                默认产品名称
                <input
                  value={filmingProductNameDraft}
                  onChange={(event) =>
                    setFilmingProductNameDraft(event.target.value)
                  }
                />
              </label>
              <label>
                默认拍摄要求（每行一条）
                <textarea
                  value={filmingRequirementsDraft}
                  onChange={(event) =>
                    setFilmingRequirementsDraft(event.target.value)
                  }
                  rows={5}
                />
              </label>
              <label>
                默认内容重点（每行一条）
                <textarea
                  value={keyContentPointsDraft}
                  onChange={(event) =>
                    setKeyContentPointsDraft(event.target.value)
                  }
                  rows={5}
                />
              </label>
              <label>
                对标视频链接（可选，每行一个）
                <textarea
                  value={referenceLinksDraft}
                  onChange={(event) =>
                    setReferenceLinksDraft(event.target.value)
                  }
                  rows={3}
                />
              </label>
              <div className="inline-actions">
                <button type="button" onClick={handleSaveFilmingRequirements}>
                  保存拍摄要求
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleRestoreDefaultFilmingRequirements}
                >
                  恢复默认拍摄要求
                </button>
              </div>
            </div>
          )}
        </section>
        <section className="panel prompt-helper">
          <div className="section-heading">
            <div>
              <h2>用 ChatGPT 辅助生成拍摄要求（可选）</h2>
              <p className="muted">
                只生成可复制提示词；不会调用 API，也不会自动修改数据。
              </p>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                isPromptHelperOpen
                  ? setIsPromptHelperOpen(false)
                  : handleOpenPromptHelper()
              }
            >
              {isPromptHelperOpen ? "收起辅助生成" : "展开辅助生成"}
            </button>
          </div>
          {isPromptHelperOpen && (
            <div className="settings-form">
              <label>
                产品卖点
                <input
                  value={promptHelperForm.sellingPoints}
                  onChange={(event) =>
                    setPromptHelperForm((form) => ({
                      ...form,
                      sellingPoints: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                单条视频时长要求
                <input
                  value={promptHelperForm.durationRequirement}
                  onChange={(event) =>
                    setPromptHelperForm((form) => ({
                      ...form,
                      durationRequirement: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                对标视频链接（可选，每行一个）
                <textarea
                  value={promptHelperForm.referenceLinks}
                  onChange={(event) =>
                    setPromptHelperForm((form) => ({
                      ...form,
                      referenceLinks: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setGeneratedChatGptPrompt(buildChatGptPrompt());
                  setPromptCopyStatus("");
                }}
              >
                生成可复制提示词
              </button>
              {generatedChatGptPrompt && (
                <>
                  <p className="ai-status">
                    提示词已生成。请复制到 ChatGPT 使用。
                  </p>
                  <label>
                    ChatGPT 提示词
                    <textarea
                      value={generatedChatGptPrompt}
                      readOnly
                      rows={8}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      void copyText(
                        generatedChatGptPrompt,
                        "已复制提示词。",
                      ).then(() => setPromptCopyStatus("已复制提示词。"))
                    }
                  >
                    复制提示词
                  </button>
                  {promptCopyStatus && (
                    <p className="ai-status">{promptCopyStatus}</p>
                  )}
                </>
              )}
            </div>
          )}
        </section>
        <section className="panel danger-zone">
          <div className="section-heading">
            <div>
              <h2>危险操作</h2>
              <p className="muted">
                仅清空当前浏览器 localStorage 中的达人数据，不影响产品项目设置。
              </p>
            </div>
            <button
              type="button"
              className="secondary danger"
              onClick={() => {
                clearSavedCreatorRows();
                setRows([]);
                setToast({ tone: "success", text: "已清空本地达人数据。" });
              }}
            >
              清空当前数据
            </button>
          </div>
        </section>
      </>
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
