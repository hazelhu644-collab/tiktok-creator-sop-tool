import {
  arrivalDateDeltaDays,
  isDeliveredLogisticsStatus,
  isInTransitLogisticsStatus,
  normalizeVideoProgress,
  parseRequiredVideos,
} from "./sopRules";
import {
  detectProductCategory,
  getProductCategory,
  translateAvoidShots,
  translateContentPointsDetailed,
  translateProductName,
  type ProductCategoryId,
} from "./productCategories";
import {
  DEFAULT_CREATOR_TIER,
  emailSubjectFor,
  getScriptVariant,
  getScriptVariants,
  isTierAwareScenario,
  resolveVariantIndex,
  tierClosingLine,
  tierOpeningLine,
  type CreatorTier,
  type ScriptContext,
} from "./messageVariants";
import type {
  Channel,
  CollaborationTerms,
  CommunicationAction,
  FollowUpHistoryEntry,
  GeneratedMessage,
  Task,
  UrgencyLevel,
} from "./types";

export const CHANNELS: Channel[] = [
  "TikTok DM",
  "TikTok Shop Affiliate Message",
  "Email",
  "WhatsApp",
];

export type CreatorFilmingRequirements = {
  productName: string;
  requiredScenes: string;
  sellingPoints: string;
  videoLength: string;
  videoCount: string;
  avoidShots: string;
  productLinkRequirement: string;
  referenceVideoLinks: string;
  requirements: string[];
  keyContentPoints: string[];
  referenceLinks?: string[];
  /**
   * Which category preset supplies the English lexicon and defaults. Campaigns
   * saved before categories existed leave this unset and get auto-detected.
   */
  categoryId?: ProductCategoryId;
  /**
   * Commercial terms the scripts may state. Absent on campaigns saved before
   * collaboration models existed; `resolveTerms` fills in the affiliate-link
   * defaults the tool has always assumed.
   */
  terms?: Partial<CollaborationTerms>;
};

/** What the tool assumed before collaboration models were configurable. */
export const defaultCollaborationTerms: CollaborationTerms = {
  collabModel: "affiliate-link",
  discountCode: "",
  audienceDiscount: "",
  creatorCommission: "",
  commissionWindow: "",
  orderMethod: "brand-ships",
  contentUsageMonths: "",
  requiresDisclosure: true,
};

function resolveTerms(
  filmingRequirements: CreatorFilmingRequirements,
): CollaborationTerms {
  // Explicitly-undefined keys must not overwrite the defaults. A plain spread
  // would turn `requiresDisclosure: undefined` into a falsy value and silently
  // drop the FTC line from every campaign that never set the field.
  const configured = Object.fromEntries(
    Object.entries(filmingRequirements.terms ?? {}).filter(
      ([, value]) => value !== undefined,
    ),
  );
  return { ...defaultCollaborationTerms, ...configured };
}

export type MessageGenerationOptions = {
  /**
   * Which script angle to use. Index 0 is the wording the generator has always
   * produced; the UI increments this when the operator asks for another angle.
   * Wraps around, so any integer is valid.
   */
  variantIndex?: number;
  /** Relationship tier driving how hard the message pushes. */
  creatorTier?: CreatorTier;
  /**
   * True when another creator record shows a finished collaboration with the
   * same person. Only the caller can know this — it requires looking across
   * rows, and a returning creator gets a fresh row for each outreach round.
   */
  hasPriorCollaboration?: boolean;
};

export type ReplyTone = "中立专业" | "友好一点" | "坚定推进" | "最后确认";

export type CreatorReplyPersonalization = {
  relationshipNote?: string;
  replyTone?: ReplyTone;
  replyGoal?: string;
  acceptableConcession?: string;
};

export const defaultCreatorFilmingRequirements: CreatorFilmingRequirements = {
  productName: "蒸汽梳毛器",
  requiredScenes:
    "展示雾化功能；展示梳下来的浮毛；展示宠物真实反应；展示自然的日常宠物护理场景；展示清理过程",
  sellingPoints: "蒸汽软化浮毛，梳毛同时收集毛发，适合日常宠物护理场景。",
  videoLength: "每条视频 60 秒以上",
  videoCount: "每位达人 2 条视频",
  avoidShots: "",
  productLinkRequirement:
    "必须挂 TikTok Shop 产品链接，并按 campaign 要求 tag 品牌账号。",
  referenceVideoLinks: "",
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
    "展示自然的日常宠物护理场景",
    "展示清理过程",
  ],
  referenceLinks: [],
};

const chineseCharacterPattern = /[\u3400-\u9fff]/;

type MessageScenario = {
  scenario: string;
  reason: string;
  highRisk: boolean;
  urgencyLevel: UrgencyLevel;
  communicationAction: CommunicationAction;
};

export type CreatorFollowUpClassification = {
  urgencyLevel: UrgencyLevel;
  communicationAction: CommunicationAction;
  reason: string;
  highRisk: boolean;
};

function hasChineseCharacters(value: string): boolean {
  return chineseCharacterPattern.test(value);
}

function normalizeForScenario(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeTrackingStatus(value: string | undefined): string {
  const normalized = normalizeForScenario(value ?? "");
  if (
    normalized === "replied" ||
    normalized === "creator replied" ||
    normalized === "reply pending" ||
    normalized === "达人已回复" ||
    normalized === "达人回复待处理"
  )
    return "reply-pending";
  if (normalized === "followed up" || normalized === "已发送待回复")
    return "sent-waiting";
  if (normalized === "completed" || normalized === "已完成") return "completed";
  if (normalized === "failed" || normalized === "已失败") return "failed";
  return normalized;
}

function isReplyPendingTask(task: Task): boolean {
  const latestCreatorReply = task.followUpHistory
    ?.slice()
    .reverse()
    .find((entry) => entry.action === "Creator Replied" && entry.note?.trim())
    ?.note?.trim();
  const savedReply =
    task.lastCreatorResponse?.trim() || latestCreatorReply || task.notes.trim();
  return (
    normalizeTrackingStatus(task.trackingStatus) === "reply-pending" &&
    Boolean(savedReply)
  );
}

function statusIncludes(task: Task, terms: string[]): boolean {
  const status = normalizeForScenario(task.currentStatus);
  return terms.some((term) => status.includes(term));
}

function hasSampleInTransitEvidence(task: Task): boolean {
  return (
    (isInTransitLogisticsStatus(task.sampleShippingStatus) ||
      isInTransitLogisticsStatus(task.currentStatus)) &&
    !hasSampleDeliveredEvidence(task)
  );
}

function hasSampleDeliveredEvidence(task: Task): boolean {
  return (
    isDeliveredLogisticsStatus(task.sampleShippingStatus) ||
    /delivered|waiting video|已签收|已到货|签收|到货|等待视频/i.test(
      task.currentStatus,
    )
  );
}

function progressForTask(task: Task, configuredRequiredVideos?: number) {
  const progressRequiredVideos =
    task.videoProgress.match(/(?:\/|of\s+)(\d+)/i)?.[1];
  const fallbackRequiredVideos = progressRequiredVideos
    ? Number.parseInt(progressRequiredVideos, 10)
    : configuredRequiredVideos;
  return normalizeVideoProgress(task.videoProgress, fallbackRequiredVideos);
}

function isCompletedTask(
  task: Task,
  configuredRequiredVideos: number,
): boolean {
  const progress = progressForTask(task, configuredRequiredVideos);
  return (
    statusIncludes(task, ["completed"]) ||
    (typeof progress.postedCount === "number" &&
      progress.postedCount >= configuredRequiredVideos)
  );
}

function clearlyMeetsFinalFailedCandidateConditions(
  task: Task,
  configuredRequiredVideos: number,
): boolean {
  if (
    hasSampleInTransitEvidence(task) ||
    isCompletedTask(task, configuredRequiredVideos) ||
    statusIncludes(task, ["failed"]) ||
    !hasSampleDeliveredEvidence(task)
  )
    return false;

  const warningText = task.failedWarnings.join(" ");
  const deliveredDate = task.sampleDeliveredDate.trim();
  const deliveredAgeInDays = deliveredDate
    ? Math.floor(
        (Date.now() - new Date(`${deliveredDate}T00:00:00Z`).getTime()) /
          86_400_000,
      )
    : 0;
  const hasStaleZeroPostWarning = task.failedWarnings.some(
    (warning) =>
      warning.includes("样品已到货") && warning.includes("视频进度仍为 0/"),
  );

  return (
    task.lastFollowUpCount >= 2 ||
    deliveredAgeInDays >= 30 ||
    (hasStaleZeroPostWarning &&
      task.lastFollowUpCount === 0 &&
      !task.triggerReason.includes("达人还没有发布视频")) ||
    /长期未回复|没有明确拍摄计划|合作状态较差|不愿意修改视频|long-time no reply|long time no reply|no filming plan|bad cooperation|unwilling/i.test(
      warningText,
    )
  );
}

/**
 * A creator we have actually worked with before. Re-contacting them warrants a
 * different opening than a cold DM.
 *
 * The campaign's round number is deliberately NOT used: creators added while a
 * campaign sits on round 2 inherit that round without ever having appeared in
 * round 1, and telling a stranger "great working with you last time" is worse
 * than sending them plain cold outreach. A genuine returning creator gets a
 * fresh row each round, so the evidence lives either in this row's own history
 * or in `hasPriorCollaboration`, which the caller derives from the other rows.
 */
function isReturningCreator(
  task: Task,
  hasPriorCollaboration: boolean,
): boolean {
  if (hasPriorCollaboration) return true;
  return Boolean(
    task.followUpHistory?.some(
      (entry) => entry.action === "Completed" || entry.action === "Archived",
    ),
  );
}

/** A creator who opted in on TikTok Creator Marketplace rather than by replying to outreach. */
function isTcmCreator(task: Task): boolean {
  return (task.source ?? "").trim().toUpperCase() === "TCM";
}

/**
 * Stage of the self-order flow, for campaigns where the creator places the
 * order themselves with a 100%-off code instead of the brand shipping a sample.
 * Returns null when the flow does not apply or has already moved past ordering.
 */
function creatorOrderStage(
  task: Task,
  terms: CollaborationTerms,
): "confirm-details" | "send-order-instructions" | "chase-order-number" | null {
  if (terms.orderMethod !== "creator-orders") return null;
  // Once the order exists the normal shipping and filming stages take over.
  if (task.orderNumber?.trim()) return null;
  if (hasSampleDeliveredEvidence(task) || hasSampleInTransitEvidence(task))
    return null;

  if (task.lastMessageScenario === "Order Instructions")
    return "chase-order-number";
  if (statusIncludes(task, ["sample requested", "sample approved"]))
    return "send-order-instructions";
  if (statusIncludes(task, ["replied"])) return "confirm-details";
  return null;
}

/** The sample is blocked on shipping details rather than on the creator's interest. */
function needsAddressConfirmation(task: Task): boolean {
  const haystack = `${task.currentStatus} ${task.notes}`.toLowerCase();
  return (
    /address|shipping info|收货|收件|地址/.test(haystack) &&
    !hasSampleDeliveredEvidence(task) &&
    !hasSampleInTransitEvidence(task)
  );
}

export function classifyCreatorFollowUp(
  task: Task,
  configuredRequiredVideos = 2,
  terms: CollaborationTerms = defaultCollaborationTerms,
  /** True when another record shows a finished collaboration with this creator. */
  hasPriorCollaboration = false,
): CreatorFollowUpClassification {
  const progress = progressForTask(task, configuredRequiredVideos);
  const postedCount = progress.postedCount ?? 0;
  const requiredVideos = progress.requiredVideos ?? configuredRequiredVideos;
  const currentStatus = task.currentStatus.trim() || "未填写";
  const sampleShippingStatus = task.sampleShippingStatus.trim() || "未填写";
  const status = normalizeForScenario(task.currentStatus);
  const shippingStatus = normalizeForScenario(task.sampleShippingStatus);
  const hasDeliveredEvidence = hasSampleDeliveredEvidence(task);
  const hasInTransitEvidence = hasSampleInTransitEvidence(task);
  const trackingStatus = normalizeTrackingStatus(task.trackingStatus);
  const isCompleted =
    isCompletedTask(task, configuredRequiredVideos) ||
    trackingStatus === "completed";
  const isFailed =
    statusIncludes(task, ["failed"]) || trackingStatus === "failed";
  const needsRevision =
    statusIncludes(task, ["needs revision", "revision"]) ||
    /revision|revise|edit|修改|调整|重拍/i.test(task.notes);
  const partialCompletion = postedCount > 0 && postedCount < requiredVideos;
  const finalFollowUp = clearlyMeetsFinalFailedCandidateConditions(
    task,
    configuredRequiredVideos,
  );
  const hasLogisticsExceptionRisk =
    hasInTransitEvidence &&
    !hasDeliveredEvidence &&
    (task.priority === "Highest" ||
      task.lastFollowUpCount >= 2 ||
      task.failedWarnings.length > 0 ||
      /shipping delay|logistics|tracking|delivery issue|delayed|stuck|lost|物流|快递|延迟|异常/i.test(
        task.notes,
      ));
  const hasNoSampleStarted =
    !shippingStatus ||
    shippingStatus === "not shipped" ||
    shippingStatus === "not started" ||
    shippingStatus === "pending";
  const isFirstOutreach =
    (!status || status.includes("to contact")) &&
    hasNoSampleStarted &&
    !task.sampleDeliveredDate.trim() &&
    postedCount === 0;

  if (isFailed) {
    return {
      urgencyLevel: "归档",
      communicationAction: "合作失败归档",
      reason: `当前状态为 ${currentStatus}，应从活跃跟进队列归档，只做最终 campaign status 确认。`,
      highRisk: false,
    };
  }

  if (isReplyPendingTask(task)) {
    return {
      urgencyLevel: "高",
      communicationAction: "回复达人消息",
      reason: `达人已回复且「达人回复/下一步备注」不为空，需要基于达人回复继续推进沟通，而不是只记录回复。`,
      highRisk: false,
    };
  }

  if (hasInTransitEvidence && !hasDeliveredEvidence) {
    const arrivalDelta = arrivalDateDeltaDays(
      task.sampleDeliveredDate,
      new Date(),
    );
    if (
      hasLogisticsExceptionRisk ||
      (arrivalDelta !== null && arrivalDelta < 0)
    ) {
      return {
        urgencyLevel: "高",
        communicationAction: "确认物流 / 是否签收",
        reason: `原因：样品已发出但尚未确认送达，需要优先确认物流 / 是否签收。样品仍处于运输中，不能催促视频履约或做最后确认。`,
        highRisk: true,
      };
    }

    if (arrivalDelta === 0) {
      return {
        urgencyLevel: "高",
        communicationAction: "确认样品是否收到",
        reason: `样品到货日期为今天，在运输中语境下按预计到货日期处理，应确认样品是否收到并提醒拍摄计划。`,
        highRisk: false,
      };
    }

    if (arrivalDelta === 1) {
      return {
        urgencyLevel: task.priority === "High" ? "高" : "中",
        communicationAction: "提醒达人注意签收并准备拍摄",
        reason: `样品预计明天到货，应提醒达人注意签收并提前准备拍摄内容。`,
        highRisk: false,
      };
    }

    return {
      urgencyLevel:
        task.priority === "High" || task.priority === "Highest" ? "高" : "中",
      communicationAction: "样品运输中，提前沟通拍摄要求",
      reason: `物流状态为 ${sampleShippingStatus} 或 Current status 为 ${currentStatus}，样品到货日期在运输中语境下按预计到货日期处理。物流状态已发货/运输中，当前应提前沟通拍摄要求、内容结构、视频长度数量和挂链要求，不能催促视频履约。`,
      highRisk: false,
    };
  }

  if (isCompleted) {
    return {
      urgencyLevel: "归档",
      communicationAction: "合作完成维护",
      reason: `当前状态为 ${currentStatus}，或视频进度已达到 ${postedCount}/${configuredRequiredVideos}，合作已完成，应做维护而不是催发视频。`,
      highRisk: false,
    };
  }

  if (needsRevision && hasDeliveredEvidence) {
    return {
      urgencyLevel: task.priority === "Highest" ? "极高" : "高",
      communicationAction: "视频修改",
      reason: `当前状态或备注显示需要修改视频，应清楚说明修改点并推动达人完成调整。`,
      highRisk: false,
    };
  }

  if (needsRevision) {
    return {
      urgencyLevel: task.priority === "Highest" ? "极高" : "高",
      communicationAction: "视频修改",
      reason: `当前状态或备注显示需要修改视频，应清楚说明修改点并推动达人完成调整。`,
      highRisk: false,
    };
  }

  if (partialCompletion) {
    const urgent =
      task.priority === "Highest" ||
      task.lastFollowUpCount >= 2 ||
      task.failedWarnings.length > 0;
    return {
      urgencyLevel: urgent ? "极高" : "高",
      communicationAction: "剩余视频履约",
      reason: `达人已发布部分视频，但当前视频进度为 ${postedCount}/${requiredVideos}，仍有剩余视频未完成${urgent ? "，且已有较高跟进压力或风险提醒" : ""}。`,
      highRisk: urgent,
    };
  }

  if (finalFollowUp) {
    return {
      urgencyLevel: "极高",
      communicationAction: "最后确认",
      reason: `达人跟进次数较高或已有失败风险提醒，合作仍未完成，需要今天确认是否还能继续履约。`,
      highRisk: true,
    };
  }

  if (hasDeliveredEvidence && postedCount === 0) {
    const urgent =
      task.priority === "Highest" ||
      task.lastFollowUpCount >= 2 ||
      task.failedWarnings.length > 0;
    return {
      urgencyLevel: urgent ? "极高" : "高",
      communicationAction: "样品到货催拍",
      reason: `物流状态为 ${sampleShippingStatus}，样品到货日期${task.sampleDeliveredDate.trim() ? "已填写" : "未填写"}；样品已送达或已填写到货日期，但当前视频进度为 0/${requiredVideos}，需要确认拍摄和发布时间。`,
      highRisk: urgent,
    };
  }

  const orderStage = creatorOrderStage(task, terms);
  if (orderStage === "chase-order-number") {
    return {
      urgencyLevel: "高",
      communicationAction: "催订单号",
      reason: `下单方式已发送但还没有收到订单号，样品无法发出，需要先拿到订单号才能给运单号。`,
      highRisk: false,
    };
  }
  if (orderStage === "send-order-instructions") {
    return {
      urgencyLevel: "高",
      communicationAction: "发送下单方式",
      reason: `本 campaign 由达人自己下单，合作内容已确认，需要发送下单链接和折扣码并说明留 TikTok 账号。`,
      highRisk: false,
    };
  }
  if (orderStage === "confirm-details") {
    return {
      urgencyLevel: "中",
      communicationAction: "确认合作内容",
      reason: `达人已表示有兴趣，需要先确认产品数量和交付时间，再进入下单环节。`,
      highRisk: false,
    };
  }

  // Only brand-shipped samples need an address from us; a creator placing the
  // order enters their own at checkout.
  if (terms.orderMethod === "brand-ships" && needsAddressConfirmation(task)) {
    return {
      urgencyLevel: "中",
      communicationAction: "确认收货信息",
      reason: `当前状态或备注显示收货信息尚未确认，样品无法发出，需要先确认收件人、地址和联系方式。`,
      highRisk: false,
    };
  }

  if (isTcmCreator(task) && !hasDeliveredEvidence && !hasInTransitEvidence) {
    return {
      urgencyLevel: "中",
      communicationAction: "TCM 达人跟进",
      reason: `该达人来自 TikTok Creator Marketplace 且已接受邀请，应直接跟进合作细节，不要用冷启动邀约话术。`,
      highRisk: false,
    };
  }

  if (isFirstOutreach) {
    if (isReturningCreator(task, hasPriorCollaboration)) {
      return {
        urgencyLevel: "低",
        communicationAction: "老达人再建联",
        reason: `该达人已有完成或归档的历史合作记录，适合用老达人再建联话术而不是冷启动邀约。`,
        highRisk: false,
      };
    }
    return {
      urgencyLevel: "低",
      communicationAction: "未合作邀约",
      reason: `当前状态为 ${currentStatus}，样品尚未发出且没有到货或视频进度，适合发送首次合作邀约。`,
      highRisk: false,
    };
  }

  if (
    statusIncludes(task, [
      "sample requested",
      "invited",
      "waiting for sample request",
      "contacted",
      "waiting for reply",
      "no reply",
    ])
  ) {
    return {
      urgencyLevel: "中",
      communicationAction: "未合作邀约",
      reason: `达人处于正常建联或样品申请推进阶段，当前不紧急，但需要保持合作流程继续移动。`,
      highRisk: false,
    };
  }

  return {
    urgencyLevel:
      task.priority === "Low" || task.priority === "None" ? "低" : "中",
    communicationAction: "未合作邀约",
    reason: `当前状态为 ${currentStatus}，未命中特定样品或视频阶段，按常规合作进度确认处理。`,
    highRisk: false,
  };
}

function scenarioForTask(
  task: Task,
  configuredRequiredVideos: number,
  terms: CollaborationTerms,
  hasPriorCollaboration: boolean,
): MessageScenario {
  const progress = progressForTask(task, configuredRequiredVideos);
  const postedCount = progress.postedCount ?? 0;
  const requiredVideos = progress.requiredVideos ?? configuredRequiredVideos;
  const currentStatus = task.currentStatus.trim() || "未填写";
  const sampleShippingStatus = task.sampleShippingStatus.trim() || "未填写";
  const hasDeliveredEvidence = hasSampleDeliveredEvidence(task);
  const hasInTransitEvidence = hasSampleInTransitEvidence(task);
  const classification = classifyCreatorFollowUp(
    task,
    configuredRequiredVideos,
    terms,
    hasPriorCollaboration,
  );
  const withClassification = (
    scenario: string,
    reason = classification.reason,
    highRisk = classification.highRisk,
  ): MessageScenario => ({
    scenario,
    reason,
    highRisk,
    urgencyLevel: classification.urgencyLevel,
    communicationAction: classification.communicationAction,
  });

  if (classification.communicationAction === "回复达人消息")
    return withClassification("Creator Reply Follow-up");
  if (classification.communicationAction === "老达人再建联")
    return withClassification("Re-engagement Outreach");
  if (classification.communicationAction === "TCM 达人跟进")
    return withClassification("TCM Follow-up");
  if (classification.communicationAction === "确认合作内容")
    return withClassification("Collaboration Details Confirmation");
  if (classification.communicationAction === "发送下单方式")
    return withClassification("Order Instructions");
  if (classification.communicationAction === "催订单号")
    return withClassification("Order Number Reminder");
  if (classification.communicationAction === "确认收货信息")
    return withClassification("Address Confirmation");
  if (classification.communicationAction === "合作失败归档")
    return withClassification("Failed Archive Confirmation");
  if (classification.communicationAction === "合作完成维护")
    return withClassification("Completed Thank You");
  if (classification.communicationAction === "视频修改")
    return withClassification("Needs Revision Reminder");
  if (classification.communicationAction === "最后确认")
    return withClassification("Final Follow-up Before Failed Candidate");
  if (classification.communicationAction === "剩余视频履约")
    return withClassification("Partial Video Completion Follow-up");
  if (classification.communicationAction === "样品到货催拍")
    return withClassification("Sample Delivered Follow-up");
  if (
    classification.communicationAction === "物流异常确认" ||
    classification.communicationAction === "确认物流 / 是否签收"
  )
    return withClassification("Logistics Exception Confirmation");
  if (
    [
      "样品运输中，提前沟通拍摄要求",
      "样品在路上，提醒达人提前规划拍摄内容",
      "提醒达人注意签收并准备拍摄",
      "确认样品是否收到",
    ].includes(classification.communicationAction)
  )
    return withClassification("Sample In Transit Reminder");

  if (statusIncludes(task, ["to contact"])) {
    return withClassification(
      "First Outreach",
      `当前状态为 ${currentStatus}，还未正式建联，因此生成首次合作介绍话术。`,
      false,
    );
  }

  if (statusIncludes(task, ["contacted", "waiting for reply", "no reply"])) {
    return withClassification(
      "No Reply Follow-up",
      `当前状态为 ${currentStatus}，重点是简短确认达人是否仍有合作兴趣。`,
      false,
    );
  }

  if (statusIncludes(task, ["invited", "waiting for sample request"])) {
    return withClassification(
      "Sample Request Reminder",
      `当前状态为 ${currentStatus}，达人已收到邀请但还需要申请样品。`,
      false,
    );
  }

  if (statusIncludes(task, ["sample requested"])) {
    return withClassification(
      "Sample Request Confirmation",
      `当前状态为 ${currentStatus}，适合确认样品申请已收到并说明下一步。`,
      false,
    );
  }

  if (hasDeliveredEvidence && postedCount > 0 && postedCount < requiredVideos) {
    return withClassification("Partial Video Completion Follow-up");
  }

  if (hasDeliveredEvidence && postedCount === 0) {
    return withClassification(
      "Sample Delivered Follow-up",
      `虽然 Current status 为 ${currentStatus}，但物流状态为 ${sampleShippingStatus} 或样品到货日期已填写，说明达人已进入样品合作流程，因此生成样品到货后催拍。`,
      false,
    );
  }

  if (hasInTransitEvidence) {
    return withClassification(
      "Sample In Transit Reminder",
      `物流状态为 ${sampleShippingStatus}，物流状态已发货/运输中，优先按样品流程生成话术。`,
      false,
    );
  }

  if (task.priority === "Medium") {
    return withClassification(
      "Second Follow-up",
      `系统优先级为中，说明此前已跟进但合作仍未完成，需要再次确认进展。`,
      true,
    );
  }

  return withClassification(
    "Light Follow-up",
    `当前状态为 ${currentStatus}，未命中特定阶段，生成轻量合作进度确认话术。`,
    false,
  );
}

/**
 * Picks the category whose lexicon and defaults apply. An explicit choice on
 * the campaign wins; otherwise it is inferred from the product name and the
 * configured content, so campaigns saved before categories existed keep working.
 */
function resolveCategoryId(
  filmingRequirements: CreatorFilmingRequirements,
  productName: string,
): ProductCategoryId {
  if (filmingRequirements.categoryId) return filmingRequirements.categoryId;
  return detectProductCategory(
    productName,
    filmingRequirements.productName,
    filmingRequirements.sellingPoints,
    filmingRequirements.requiredScenes,
    filmingRequirements.keyContentPoints,
  );
}

function toEnglishProductName(
  product: string,
  categoryId: ProductCategoryId,
): string {
  return translateProductName(product, categoryId);
}

function toEnglishRequirement(requirement: string): string {
  const normalized = requirement.trim();
  if (!normalized) return "";

  const videoCountMatch = normalized.match(/每位达人\s*(\d+)\s*条视频/);
  if (videoCountMatch) {
    const count = Number(videoCountMatch[1]);
    return `complete ${count} ${count === 1 ? "video" : "videos"}`;
  }

  const durationMatch = normalized.match(/每条视频\s*(\d+)\s*秒以上/);
  if (durationMatch)
    return `keep each video at least ${durationMatch[1]} seconds`;

  if (normalized.includes("必须") && normalized.toLowerCase().includes("tag"))
    return "tag the brand account";
  if (
    normalized.includes("TikTok Shop") &&
    (normalized.includes("产品链接") ||
      normalized.toLowerCase().includes("link"))
  )
    return "include the TikTok Shop product link";

  // Common phrasings that are not category-specific. Without these, any
  // campaign that words its requirements slightly differently loses the line.
  const looseCountMatch = normalized.match(/(\d+)\s*条视频/);
  if (looseCountMatch) {
    const count = Number(looseCountMatch[1]);
    return `complete ${count} ${count === 1 ? "video" : "videos"}`;
  }

  const looseDurationMatch = normalized.match(
    /(?:不少于|不低于|至少|超过)?\s*(\d+)\s*秒(?:以上)?/,
  );
  if (looseDurationMatch)
    return `keep each video at least ${looseDurationMatch[1]} seconds`;

  if (/挂车|小黄车|购物车/.test(normalized))
    return "include the TikTok Shop product link";
  if (/原创/.test(normalized)) return "post original content";
  if (/出镜/.test(normalized)) return "appear on camera";
  if (/(?:真实)?使用产品|实际使用/.test(normalized))
    return "actually use the product on camera";
  if (/审核|过稿|初剪/.test(normalized))
    return "send a draft for review before posting";
  const keepLiveMatch = normalized.match(/保留\s*(\d+)\s*天|不(?:能|要)删除/);
  if (keepLiveMatch)
    return keepLiveMatch[1]
      ? `keep the video live for at least ${keepLiveMatch[1]} days`
      : "keep the video live after posting";

  return hasChineseCharacters(normalized) ? "" : normalized;
}

function joinEnglishList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function isGuidelineScenario(scenario: string): boolean {
  return (
    scenario === "Creator Reply Follow-up" ||
    scenario === "Sample Delivered Follow-up" ||
    scenario === "Sample In Transit Reminder" ||
    scenario === "Logistics Exception Confirmation" ||
    scenario === "Partial Video Completion Follow-up" ||
    scenario === "Needs Revision Reminder" ||
    scenario === "Final Follow-up Before Failed Candidate" ||
    scenario === "Second Follow-up"
  );
}

function referenceLinksLine(
  scenario: string,
  filmingRequirements: CreatorFilmingRequirements,
): string {
  const referenceLinks = (filmingRequirements.referenceLinks ?? [])
    .map((link) => link.trim())
    .filter((link) => link && !hasChineseCharacters(link))
    .slice(0, 3);
  if (referenceLinks.length === 0 || !isGuidelineScenario(scenario)) return "";

  const linksText = referenceLinks.join("; ");

  if (
    scenario === "Final Follow-up Before Failed Candidate" ||
    scenario === "Second Follow-up"
  ) {
    return `You can use the reference links as direction for the remaining video(s): ${linksText}.`;
  }

  if (scenario === "Partial Video Completion Follow-up") {
    return `You can also use these reference videos as direction for the next post: ${linksText}.`;
  }

  return `Here are a few reference videos you can use for filming direction: ${linksText}.`;
}

function remainingVideoPhrase(count: number | null): string {
  if (count === null || count <= 0) return "remaining video(s)";
  return `${count} remaining ${count === 1 ? "video" : "videos"}`;
}

function partialCompletionGuidelinesLine(
  filmingRequirements: CreatorFilmingRequirements,
  hasReferenceLinks: boolean,
): string {
  return `For the remaining video, please keep following the filming guidelines we shared${hasReferenceLinks ? " and reference direction" : ""}, and ${(englishOnly(filmingRequirements.productLinkRequirement) || "make sure the TikTok Shop product link is attached").replace(/^please\s+/i, "")}.`;
}

function englishOnly(value: string): string {
  return hasChineseCharacters(value) ? "" : value.trim();
}

function shortFilmingReminder(
  filmingRequirements: CreatorFilmingRequirements,
  hasReferenceLinks = false,
): string {
  const linkRequirement =
    englishOnly(filmingRequirements.productLinkRequirement) ||
    "make sure the TikTok Shop product link is attached";
  const referenceDirection = hasReferenceLinks
    ? " and the reference direction"
    : "";
  return `Please follow the filming requirements we shared${referenceDirection}, and ${linkRequirement.replace(/^please\s+/i, "")}.`;
}

/** Which configured field the brief's content points come from. */
function briefContentSource(
  filmingRequirements: CreatorFilmingRequirements,
): string[] {
  return filmingRequirements.requiredScenes &&
    filmingRequirements.requiredScenes !==
      defaultCreatorFilmingRequirements.requiredScenes
    ? filmingRequirements.requiredScenes.split(/[；;\n]/)
    : filmingRequirements.keyContentPoints;
}

function fullFilmingBriefLine(
  task: Task,
  filmingRequirements: CreatorFilmingRequirements,
  categoryId: ProductCategoryId,
  terms: CollaborationTerms,
): string {
  // Falls back to the category's English content points rather than dropping
  // the clause, which is what used to happen for every non-pet campaign.
  const contentPoints = translateContentPointsDetailed(
    briefContentSource(filmingRequirements),
    categoryId,
  ).points;
  const sellingPoints = englishOnly(filmingRequirements.sellingPoints);
  const videoLength =
    englishOnly(filmingRequirements.videoLength) ||
    filmingRequirements.requirements
      .map(toEnglishRequirement)
      .find((item) => item.includes("seconds")) ||
    toEnglishRequirement(filmingRequirements.videoLength) ||
    "";
  const videoCount =
    englishOnly(filmingRequirements.videoCount) ||
    filmingRequirements.requirements
      .map(toEnglishRequirement)
      .find((item) => item.startsWith("complete ")) ||
    toEnglishRequirement(filmingRequirements.videoCount) ||
    "";
  const avoidShots = translateAvoidShots(
    filmingRequirements.avoidShots,
    categoryId,
  );
  const linkRequirement =
    englishOnly(filmingRequirements.productLinkRequirement) ||
    "include the TikTok Shop product link when posting";
  const pieces = [
    "Please follow the filming guidelines we shared in this product-specific filming brief",
  ];

  if (contentPoints.length) pieces.push(joinEnglishList(contentPoints));
  if (sellingPoints) pieces.push(`highlight ${sellingPoints}`);
  if (videoLength) pieces.push(`video length: ${videoLength}`);
  if (videoCount) pieces.push(`video quantity: ${videoCount}`);
  if (avoidShots) pieces.push(`avoid: ${avoidShots}`);
  if (linkRequirement) pieces.push(linkRequirement);
  // Required for US creators under FTC endorsement guidance, and easy for a
  // creator to forget, so it belongs in the brief rather than in a side note.
  if (terms.requiresDisclosure)
    pieces.push(
      "disclose the partnership in the post using #ad or the branded-content label",
    );
  if (terms.contentUsageMonths)
    pieces.push(
      `content usage: by taking part you allow us to reuse this content on our own channels — website, social, paid ads, and email — for ${terms.contentUsageMonths} months`,
    );

  return `${pieces.join("; ")}.`;
}

function filmingGuidelinesLine(
  task: Task,
  filmingRequirements: CreatorFilmingRequirements,
  categoryId: ProductCategoryId,
  terms: CollaborationTerms,
  mode: "short" | "full",
  hasReferenceLinks = false,
): string {
  if (mode === "short")
    return shortFilmingReminder(filmingRequirements, hasReferenceLinks);
  return fullFilmingBriefLine(task, filmingRequirements, categoryId, terms);
}

function creatorGreeting(username: string): string {
  const normalized = username.trim();
  if (!normalized || hasChineseCharacters(normalized)) return "there";
  return normalized.startsWith("@") ? normalized : `@${normalized}`;
}

/**
 * How each scenario's request text is wrapped for the channel: whether the
 * filming reminder is appended by `byChannel` (rather than already being inside
 * the request) and whether the copy uses the high-risk, more direct closing.
 */
const SCENARIO_WRAPPING: Record<
  string,
  { appendReminder: boolean; forceHighRisk?: boolean }
> = {
  "First Outreach": { appendReminder: false },
  "Re-engagement Outreach": { appendReminder: false },
  "No Reply Follow-up": { appendReminder: false },
  "Sample Request Reminder": { appendReminder: false },
  "Sample Request Confirmation": { appendReminder: false },
  "Address Confirmation": { appendReminder: false },
  "Sample In Transit Reminder": { appendReminder: true },
  "Logistics Exception Confirmation": { appendReminder: true },
  "Sample Delivered Follow-up": { appendReminder: false },
  "Partial Video Completion Follow-up": { appendReminder: true },
  "Needs Revision Reminder": { appendReminder: true },
  "Completed Thank You": { appendReminder: false },
  "Failed Archive Confirmation": { appendReminder: false },
  "Second Follow-up": { appendReminder: true, forceHighRisk: true },
  "Final Follow-up Before Failed Candidate": {
    appendReminder: true,
    forceHighRisk: true,
  },
  "Light Follow-up": { appendReminder: false },
};

export function generateMessage(
  task: Task,
  channel: Channel,
  filmingRequirements: CreatorFilmingRequirements = defaultCreatorFilmingRequirements,
  userReplyFocus = "",
  replyPersonalization: CreatorReplyPersonalization = {},
  options: MessageGenerationOptions = {},
): GeneratedMessage {
  const configuredRequiredVideos = parseRequiredVideos(filmingRequirements);
  const terms = resolveTerms(filmingRequirements);
  const scenarioSelection = scenarioForTask(
    task,
    configuredRequiredVideos,
    terms,
    options.hasPriorCollaboration ?? false,
  );
  const { scenario, highRisk } = scenarioSelection;
  const name = creatorGreeting(task.username);
  const categoryId = resolveCategoryId(
    filmingRequirements,
    task.product || filmingRequirements.productName,
  );
  const product = toEnglishProductName(
    task.product || filmingRequirements.productName,
    categoryId,
  );
  const cleanReferenceLinks = (filmingRequirements.referenceLinks ?? [])
    .map((link) => link.trim())
    .filter((link) => link && !hasChineseCharacters(link));
  const hasReferenceLinks = cleanReferenceLinks.length > 0;
  const guidelineLine =
    scenario === "Creator Reply Follow-up"
      ? filmingGuidelinesLine(
          task,
          filmingRequirements,
          categoryId,
          terms,
          /what to film|film|requirements|brief|拍什么|要求|brief/i.test(
            `${userReplyFocus} ${task.lastCreatorResponse ?? ""} ${task.notes}`,
          )
            ? "full"
            : "short",
          hasReferenceLinks,
        )
      : scenario === "Partial Video Completion Follow-up"
        ? partialCompletionGuidelinesLine(
            filmingRequirements,
            hasReferenceLinks,
          )
        : scenario === "Final Follow-up Before Failed Candidate" ||
            scenario === "Second Follow-up"
          ? ""
          : isGuidelineScenario(scenario)
            ? filmingGuidelinesLine(
                task,
                filmingRequirements,
                categoryId,
                terms,
                scenario === "Sample In Transit Reminder" ||
                  scenario === "Sample Delivered Follow-up"
                  ? "full"
                  : "short",
                hasReferenceLinks,
              )
            : "";
  const filmingRequirementsReminder = [
    guidelineLine,
    referenceLinksLine(scenario, {
      ...filmingRequirements,
      referenceLinks: cleanReferenceLinks,
    }),
  ]
    .filter(Boolean)
    .join(" ");
  const progress = progressForTask(task, configuredRequiredVideos);
  const missingVideos =
    typeof progress.postedCount === "number"
      ? Math.max(0, configuredRequiredVideos - progress.postedCount)
      : null;
  const remainingVideos = remainingVideoPhrase(missingVideos);

  const variantIndex = resolveVariantIndex(scenario, options.variantIndex ?? 0);
  const tier = options.creatorTier ?? DEFAULT_CREATOR_TIER;
  const scriptContext: ScriptContext = {
    product,
    category: getProductCategory(categoryId),
    tier,
    remainingVideos,
    requiredVideos: configuredRequiredVideos,
    reminder: filmingRequirementsReminder,
    terms,
    productLink:
      englishOnly(filmingRequirements.productLinkRequirement).match(
        /https?:\/\/\S+/,
      )?.[0] ?? "",
  };
  const variant = getScriptVariant(scenario, variantIndex);

  let english: string;

  if (variant?.request) {
    english = renderVariant(
      scenario,
      variant.request(scriptContext),
      scriptContext,
      channel,
      name,
      filmingRequirementsReminder,
      highRisk,
    );
  } else if (scenario === "Sample In Transit Reminder") {
    english = sampleInTransitMessage(
      channel,
      name,
      product,
      filmingRequirementsReminder,
    );
  } else if (scenario === "Logistics Exception Confirmation") {
    english = logisticsExceptionMessage(
      channel,
      name,
      product,
      filmingRequirementsReminder,
    );
  } else if (scenario === "Creator Reply Follow-up") {
    english = creatorReplyMessage(
      channel,
      name,
      product,
      task,
      userReplyFocus,
      filmingRequirementsReminder,
      replyPersonalization,
      terms,
    );
  } else if (scenario === "Partial Video Completion Follow-up") {
    english = partialCompletionMessage(
      channel,
      name,
      remainingVideos,
      filmingRequirementsReminder,
    );
  } else {
    // Scenarios with no variant table fall back to the light check-in.
    const request = `I’m checking in on the ${product} collaboration. Please send a quick update on the current status so we can keep the campaign status accurate on our side.`;
    english = byChannel(channel, name, request, "", highRisk);
  }

  return {
    english: removeChineseCharacters(english),
    chineseExplanation: buildChineseExplanation(
      scenario,
      channel,
      hasReferenceLinks,
      variant?.label,
      tier,
      translateContentPointsDetailed(
        briefContentSource(filmingRequirements),
        categoryId,
      ).untranslated,
    ),
    scenario,
    scenarioReason: scenarioSelection.reason,
    urgencyLevel: scenarioSelection.urgencyLevel,
    communicationAction: scenarioSelection.communicationAction,
    variantIndex,
    variants: getScriptVariants(scenario).map(({ id, label, angle }) => ({
      id,
      label,
      angle,
    })),
    ...(channel === "Email" ? emailSubjectFor(scenario, scriptContext) : {}),
  };
}

/**
 * Wraps a variant's request for the channel, layering in the relationship tone
 * lines where they apply. The DM sentence budget is widened only when tier
 * lines are actually added, so default output is byte-for-byte unchanged.
 */
function renderVariant(
  scenario: string,
  request: string,
  context: ScriptContext,
  channel: Channel,
  name: string,
  filmingRequirementsReminder: string,
  highRisk: boolean,
): string {
  const wrapping = SCENARIO_WRAPPING[scenario] ?? { appendReminder: false };
  const opening = isTierAwareScenario(scenario) ? tierOpeningLine(context) : "";
  const closing = isTierAwareScenario(scenario) ? tierClosingLine(context) : "";
  const extraSentences = [opening, closing].filter(Boolean).length;
  const composed = [opening, request, closing].filter(Boolean).join(" ");

  return byChannel(
    channel,
    name,
    composed,
    wrapping.appendReminder ? filmingRequirementsReminder : "",
    wrapping.forceHighRisk || highRisk,
    extraSentences,
  );
}

function sampleInTransitMessage(
  channel: Channel,
  name: string,
  product: string,
  filmingRequirementsReminder: string,
): string {
  const reminder = filmingRequirementsReminder.trim();
  const compactRequest =
    `Hi ${name}, the ${product} sample is on the way. While it is in transit, we wanted to share the key filming requirements so you can plan the content in advance. Please review this product-specific brief, prepare the required scenes and selling points, follow the required video length and quantity, and make sure the TikTok Shop product link is attached when posting. No posting is needed before the sample is delivered. Once the sample arrives, please let us know when you expect to start filming after receiving the sample and share your expected posting schedule. Thank you. ${reminder}`
      .replace(/\s+/g, " ")
      .trim();

  if (channel === "TikTok DM" || channel === "WhatsApp") return compactRequest;

  return `Hi ${name},

The sample for the ${product} collaboration has been shipped and is currently on the way. While it is in transit, we wanted to share the key filming requirements so you can plan the content in advance.

Please review this product-specific brief, prepare the required scenes and selling points, follow the required video length and quantity, and make sure the TikTok Shop product link is attached when posting. No posting is needed before the sample is delivered. ${reminder}

Once the sample arrives, please let us know when you expect to start filming after receiving the sample and share your expected posting schedule.

Thank you.`;
}

function logisticsExceptionMessage(
  channel: Channel,
  name: string,
  product: string,
  filmingRequirementsReminder: string,
): string {
  const reminder = filmingRequirementsReminder.trim();

  if (channel === "TikTok DM") {
    return `Hi ${name}, I’m checking in on the ${product} sample shipment. It still appears to be in transit on our side. Have you received it or seen any delivery update? Please let us know if there is any delivery issue. Once it arrives, we can move forward with filming based on the guidelines. ${reminder}`
      .replace(/\s+/g, " ")
      .trim();
  }

  if (channel === "TikTok Shop Affiliate Message") {
    return `Hi ${name},

I’m checking in on the sample shipment for the ${product} collaboration. The package appears to still be in transit on our side, so I wanted to confirm whether you’ve received it or seen any delivery updates.

Please let us know if there is any issue with the delivery. Once the sample arrives, we can move forward with the filming plan based on the guidelines we shared. ${reminder}

Thank you.`;
  }

  if (channel === "WhatsApp") {
    return `Hi ${name}, I’m checking in on the ${product} sample shipment. It still appears to be in transit on our side. Could you confirm whether you have received it or seen any delivery updates? Please let us know if there is any delivery issue. Once it arrives, we can move forward with the filming plan. ${reminder}`
      .replace(/\s+/g, " ")
      .trim();
  }

  return `Hi ${name},

I hope you’re doing well. I’m checking in on the sample shipment for the ${product} collaboration. The package appears to still be in transit on our side, so I wanted to confirm whether you have received it or seen any delivery updates.

Please let us know if there is any issue with the delivery. Once the sample arrives, we can move forward with the filming plan based on the guidelines we shared. ${reminder}

Thank you,
Brand Team`;
}

function partialCompletionMessage(
  channel: Channel,
  name: string,
  remainingVideos: string,
  filmingRequirementsReminder: string,
): string {
  const partialReferenceLinks = filmingRequirementsReminder.includes(
    "You can also use these reference videos",
  )
    ? ` ${filmingRequirementsReminder.slice(filmingRequirementsReminder.indexOf("You can also use these reference videos"))}`
    : "";
  const core = `Thank you for posting the first video. The content looks good, and we’re preparing to review it for ad testing. We’ve noted it on our side. There is still ${remainingVideos} for this collaboration. Could you please confirm when you expect to post the second video? Could you please confirm when you expect to post the remaining video? Please confirm the expected posting date for the remaining video so we can keep the collaboration timeline clear. Please make sure the TikTok Shop product link is attached when posting. Thank you.`;

  if (channel === "TikTok DM" || channel === "WhatsApp") {
    return `Hi ${name}, ${core}${partialReferenceLinks}`;
  }

  if (channel === "TikTok Shop Affiliate Message") {
    return `Hi ${name},

${core}

${filmingRequirementsReminder}`.trim();
  }

  return `Hi ${name},

${core}

Thank you,
Brand Team`;
}

function sanitizeEnglishText(value: string): string {
  return removeChineseCharacters(value)
    .replace(/[，。；：、]/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\b(?:for example|e\.g\.)\s*[:：]?\s*/gi, "")
    .replace(/\b(?:no problem|okay|ok)\b[,.]?\s*/gi, "")
    .replace(/\b(?:noted|i'?ll note it|record it)\b[,.]?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

type CreatorReplyIntent =
  | "posting-time"
  | "video-length"
  | "package-not-arrived"
  | "filming-brief"
  | "cannot-continue"
  | "commission-question"
  | "tcm-fee-question"
  | "rate-negotiation"
  | "declining"
  | "busy-later"
  | "more-product"
  | "general";

type ReplyIntentSignal =
  | "posting-time"
  | "ad-planning"
  | "note-internally"
  | "friendly-acknowledgement"
  | "video-length"
  | "product-link"
  | "concession";

type CreatorReplyContext = {
  reply: string;
  intent: CreatorReplyIntent;
  timeline: string;
  focusIntent: CreatorReplyIntent | "product-link" | "confirmation" | "general";
  cleanFocus: string;
  goalIntent: CreatorReplyIntent | "product-link" | "confirmation" | "general";
  cleanGoal: string;
  cleanRelationshipNote: string;
  concessionText: string;
  tone: ReplyTone;
  intentSignals: Set<ReplyIntentSignal>;
};

function latestHistoryCreatorReply(
  entries: FollowUpHistoryEntry[] | undefined,
): string {
  return (
    entries
      ?.slice()
      .reverse()
      .find((entry) => entry.action === "Creator Replied" && entry.note?.trim())
      ?.note?.trim() ?? ""
  );
}

function creatorReplySource(task: Task): string {
  const historyReply = latestHistoryCreatorReply(task.followUpHistory);
  if (historyReply) return historyReply;
  if (task.lastCreatorResponse?.trim()) return task.lastCreatorResponse.trim();

  const notes = task.notes.trim();
  if (normalizeTrackingStatus(task.trackingStatus) === "reply-pending" && notes)
    return notes;
  return "";
}

function detectCreatorReplyIntent(value: string): CreatorReplyIntent {
  const normalized = normalizeForScenario(value);

  // Checked before "cannot-continue" because a creator quoting a rate or
  // turning the campaign down reads as "can't do it" to the looser pattern
  // below, and those three need very different replies.

  // TCM's own fee field is a separate question from "what do you pay?" — the
  // creator is asking why the marketplace shows a specific number.
  if (
    /\btcm\b|creator marketplace/i.test(normalized) &&
    /\b(?:rate|fee|amount|price|offer|budget|number)\b|金额|报价|费用/.test(
      normalized,
    )
  )
    return "tcm-fee-question";
  if (
    /\b(?:my rate|rates? (?:are|is)|flat fee|upfront|paid post|posting fee|charge|budget)\b|\$\s?\d|\d+\s?(?:usd|dollars)\b|报价|坑位费|费用/.test(
      normalized,
    )
  )
    return "rate-negotiation";
  if (
    /\bcommission\b|\bhow much\b|\bwhat.{0,10}\bpay\b|\bis (?:this|it) (?:free|paid)\b|\bdo (?:i|you) (?:get|pay)\b|\bpayment\b|佣金|多少钱|有没有钱|免费吗/.test(
      normalized,
    )
  )
    return "commission-question";
  if (
    /\bnot interested\b|\bno thanks?\b|\bi'?ll pass\b|\bgonna pass\b|\bnot a (?:good )?fit\b|\bnot for me\b|没兴趣|不合适|不参加/.test(
      normalized,
    )
  )
    return "declining";
  if (
    /\btoo busy\b|\bvery busy\b|\bswamped\b|\bbooked up\b|\btraveling\b|\bon vacation\b|\bnext month\b|\bafter\b.{0,15}\b(?:holiday|vacation|trip)\b|\bcheck back\b|太忙|没空|忙不过来|下个月|出差|旅行/.test(
      normalized,
    )
  )
    return "busy-later";
  if (
    /\banother (?:one|sample|unit)\b|\bone more\b|\bsecond (?:sample|unit)\b|\bdifferent (?:color|size|variant)\b|\bmore product\b|再寄一个|多寄|换一个(?:颜色|尺寸)|另一个尺寸/.test(
      normalized,
    )
  )
    return "more-product";
  if (
    /\b(can'?t|cannot|unable|won'?t|not able|no longer|stop|cancel|quit)\b.*\b(continue|post|do|complete|film|collab|collaboration)?\b|not continue|can't do it|cannot do it|won't be able/.test(
      normalized,
    )
  )
    return "cannot-continue";
  if (
    /not arrived|hasn.?t arrived|haven.?t received|haven.?t arrived|not here|no package|package didn.?t arrive|didn.?t receive|never received|shipping issue|tracking issue|lost|stuck/.test(
      normalized,
    )
  )
    return "package-not-arrived";
  if (
    /too long|60\s*(?:s|sec|second|seconds)|length|duration|shorter|can it be short|that'?s too long/.test(
      normalized,
    )
  )
    return "video-length";
  if (
    /what should i film|what to film|requirements?|guidelines?|brief|any brief|details|what do you need|what format|instructions?/.test(
      normalized,
    )
  )
    return "filming-brief";
  if (
    /\b(end of (?:the )?week|eow|friday|monday|tuesday|wednesday|thursday|saturday|sunday|tomorrow|today|tonight|next week|this week)\b|\b(i'?ll|i will|i can|can)\b.{0,40}\b(post|publish|film|complete|done|get (?:a )?video done|finish|upload)\b|\b(post|publish|film|complete|finish|upload)\b.{0,40}\b(friday|monday|tuesday|wednesday|thursday|saturday|sunday|tomorrow|today|end of (?:the )?week)\b/.test(
      normalized,
    )
  )
    return "posting-time";
  return "general";
}

function detectFocusIntent(value: string): CreatorReplyContext["focusIntent"] {
  const normalized = normalizeForScenario(value);
  if (!normalized) return "general";
  if (/没问题|记录|可以|同意|works|ok|okay|fine|confirm/.test(normalized))
    return "confirmation";
  if (/60|时长|秒|太长|length|duration|shorter/.test(normalized))
    return "video-length";
  if (
    /周五|发布|发|post|publish|friday|tomorrow|today|end of (?:the )?week/.test(
      normalized,
    )
  )
    return "posting-time";
  if (/物流|快递|包裹|delivery|shipping|package|tracking/.test(normalized))
    return "package-not-arrived";
  if (/拍什么|要求|brief|requirement|guideline|film/.test(normalized))
    return "filming-brief";
  if (/挂车|产品链接|shop|link|tag/.test(normalized)) return "product-link";
  if (
    /不能继续|不继续|失败|归档|can'?t|cannot|unable|not continue/.test(
      normalized,
    )
  )
    return "cannot-continue";
  return "general";
}

function hasKeyword(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function detectReplyIntentSignals(
  ...values: Array<string | undefined>
): Set<ReplyIntentSignal> {
  const text = values.filter(Boolean).join(" ").trim().toLowerCase();
  const signals = new Set<ReplyIntentSignal>();
  if (!text) return signals;

  if (
    hasKeyword(text, [
      /具体(?:的)?时间/,
      /什么时候/,
      /几号/,
      /发布(?:时间|日期)?/,
      /发布日期/,
      /预计时间/,
      /时间线/,
      /\btimeline\b/,
      /posting date/,
      /when to post/,
    ])
  )
    signals.add("posting-time");
  if (
    hasKeyword(text, [
      /投流/,
      /广告/,
      /测试/,
      /广告测试/,
      /投放计划/,
      /安排投放/,
      /\bboost\b/,
      /ad testing/,
      /campaign planning/,
      /media buying/,
    ])
  )
    signals.add("ad-planning");
  if (
    hasKeyword(text, [/记录/, /记一下/, /我这里记录/, /\bnote\b/, /\bnoted\b/])
  )
    signals.add("note-internally");
  if (
    hasKeyword(text, [
      /没问题/,
      /好的/,
      /可以/,
      /顺利/,
      /期待/,
      /谢谢/,
      /no problem/,
      /sounds good/,
      /looking forward/,
    ])
  )
    signals.add("friendly-acknowledgement");
  if (
    hasKeyword(text, [
      /60\s*秒/,
      /60\s*s(?:ec|econds?)?\b/,
      /太长/,
      /短一点/,
      /35\s*秒/,
      /35\s*s(?:ec|econds?)?\b/,
      /视频时长/,
      /\blength\b/,
      /shorter/,
      /too long/,
    ])
  )
    signals.add("video-length");
  if (
    hasKeyword(text, [
      /挂车/,
      /产品链接/,
      /shop link/,
      /product link/,
      /\btag\b/,
      /品牌账号/,
    ])
  )
    signals.add("product-link");
  if (
    hasKeyword(text, [
      /可以短一点/,
      /不低于\s*35\s*秒?/,
      /可以先发\s*1\s*条/,
      /再补\s*1\s*条/,
      /周五可以/,
      /可以周五/,
      /can be shorter/,
      /at least 35 seconds/,
    ])
  )
    signals.add("concession");

  return signals;
}

function hasSpecificReplyIntent(context: CreatorReplyContext): boolean {
  return (
    context.intentSignals.size > 0 ||
    context.focusIntent !== "general" ||
    context.goalIntent !== "general" ||
    Boolean(context.concessionText)
  );
}

function replyAcknowledgementLine(context: CreatorReplyContext): string {
  const reply = normalizeForScenario(context.reply);
  if (
    context.intentSignals.has("friendly-acknowledgement") ||
    /no problem|sounds good|okay|ok|sure|thank/.test(reply)
  ) {
    return "Thank you for the update.";
  }
  return "Thank you for the update.";
}

function replyIntentLines(
  context: CreatorReplyContext,
  filmingRequirementsReminder: string,
): string[] {
  const lines: string[] = [];

  if (context.intentSignals.has("friendly-acknowledgement")) {
    lines.push(
      "We’re looking forward to seeing the content and will update the campaign status on our side.",
    );
  }

  if (context.intentSignals.has("posting-time")) {
    const isAskingForTimeline =
      /有没有|什么时候|具体|几号|when|posting date|timeline/i.test(
        `${context.cleanFocus} ${context.cleanGoal}`,
      );
    if (
      !isAskingForTimeline &&
      context.timeline !== "on the timeline you shared"
    ) {
      lines.push(
        `I’ll note that you’re planning to complete the content ${context.timeline}.`,
      );
    } else {
      lines.push(
        "Do you have an estimated posting date or expected posting timeline?",
      );
    }
  }

  if (context.intentSignals.has("ad-planning")) {
    lines.push(
      "This will help our team plan the ad testing schedule, boost timing, and campaign planning accordingly.",
    );
  }

  if (context.intentSignals.has("note-internally")) {
    lines.push("I’ll note this on our side.");
  }

  if (context.intentSignals.has("video-length")) {
    lines.push(videoLengthRequirement(context));
  }

  if (context.intentSignals.has("product-link")) {
    lines.push(
      "Please make sure the TikTok Shop product link is attached when you post, and tag the brand account if required.",
    );
  }

  if (context.intentSignals.has("concession") && context.concessionText) {
    lines.push(
      `${context.concessionText} Please still make sure the key product use is shown clearly.`,
    );
  } else if (context.intentSignals.has("concession")) {
    lines.push(
      "A slightly shorter video is acceptable as long as it is at least 35 seconds and the key product use is shown clearly.",
    );
  }

  if (
    context.intentSignals.has("video-length") &&
    filmingRequirementsReminder &&
    !lines.some((line) => line.includes("60-second"))
  ) {
    lines.push(filmingBriefLine(filmingRequirementsReminder));
  }

  return lines;
}

function extractTimeline(value: string): string {
  const normalized = normalizeForScenario(value);
  if (/月底|周末|end of (?:the )?week|end of week|eow/.test(normalized))
    return "by the end of this week";
  const chineseWeekdays: Record<string, string> = {
    周一: "Monday",
    周二: "Tuesday",
    周三: "Wednesday",
    周四: "Thursday",
    周五: "Friday",
    周六: "Saturday",
    周日: "Sunday",
    周天: "Sunday",
  };
  const chineseWeekday = Object.entries(chineseWeekdays).find(([keyword]) =>
    normalized.includes(keyword),
  );
  if (chineseWeekday) return `on ${chineseWeekday[1]}`;
  const weekdays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const weekday = weekdays.find((day) =>
    normalized.includes(day.toLowerCase()),
  );
  if (weekday) return `on ${weekday}`;
  if (/tomorrow/.test(normalized)) return "tomorrow";
  if (/today|tonight/.test(normalized))
    return normalized.includes("tonight") ? "tonight" : "today";
  if (/next week/.test(normalized)) return "next week";
  if (/this week/.test(normalized)) return "this week";
  return "on the timeline you shared";
}

function englishInstructionFromChinese(
  value: string,
  kind: "focus" | "goal" | "concession" | "relationship",
): string {
  const normalized = normalizeForScenario(value);
  const rawNormalized = value.trim().toLowerCase();
  if (!normalized) return "";
  const parts: string[] = [];

  if (kind !== "concession" && /没问题|可以|同意|记录|顺利/.test(normalized))
    parts.push(
      "Confirm that the update works and say we will note it on our side.",
    );
  if (/周五/.test(normalized)) parts.push("Confirm Friday posting is okay.");
  if (/月底|周末|end of week|end of the week/.test(normalized))
    parts.push("Confirm the end-of-week timeline.");
  if (/60|时长|秒|太长/.test(normalized))
    parts.push("Explain the 60-second requirement clearly.");
  if (/挂车|产品链接|小黄车|shop/.test(normalized))
    parts.push("Remind the creator to attach the TikTok Shop product link.");
  if (/tag|品牌账号/.test(normalized))
    parts.push("Remind the creator to tag the brand account.");
  if (/物流|快递|包裹|没收到|未收到/.test(normalized))
    parts.push(
      "Ask the creator to keep checking delivery updates and tell us if there is a shipping issue.",
    );
  if (/安抚|情绪/.test(normalized))
    parts.push("Keep the reply calm and reassuring.");
  if (/剩余|补|2\s*条|两条/.test(normalized))
    parts.push("Clarify the remaining video deliverables.");
  if (/确认是否继续|是否继续|继续合作/.test(normalized))
    parts.push("Confirm whether the collaboration can continue.");
  if (/不接受不挂车/.test(normalized))
    parts.push("Do not accept posting without the TikTok Shop product link.");
  if (/可以短一点|短一点/.test(normalized))
    parts.push("A slightly shorter video is acceptable.");
  const minSeconds = rawNormalized.match(
    /(?:不能低于|不低于|至少|above|over|minimum|min)\s*(\d+)\s*(?:秒|s|sec|seconds)?/,
  )?.[1];
  if (minSeconds) parts.push(`Keep the video above ${minSeconds} seconds.`);
  if (/先发\s*1|先发一|1\s*条再补|一条再补/.test(normalized))
    parts.push(
      "Posting one video first and completing the remaining video later is acceptable.",
    );
  if (/周五发布/.test(normalized))
    parts.push("Posting on Friday is acceptable.");
  if (/对标|参考/.test(normalized))
    parts.push(
      "The creator can use the reference video direction for a reshoot.",
    );

  if (kind === "relationship") {
    if (/友好|沟通还可以|质量不错|第一次合作|专业/.test(normalized))
      parts.push("Keep the tone professional and friendly.");
    if (/回复比较慢|拖了很久|已经拖/.test(normalized))
      parts.push(
        "Keep the next action clear because the timeline has been slow.",
      );
  }

  return Array.from(new Set(parts)).join(" ");
}

function userDirectionText(
  value: string,
  kind: "focus" | "goal" | "concession" | "relationship",
): string {
  const translated = englishInstructionFromChinese(value, kind);
  const cleaned = sanitizeEnglishText(value);
  return [translated, cleaned].filter(Boolean).join(" ");
}

function buildCreatorReplyContext(
  task: Task,
  userReplyFocus: string,
  personalization: CreatorReplyPersonalization,
): CreatorReplyContext {
  const reply = creatorReplySource(task);
  const focusText = userDirectionText(userReplyFocus, "focus");
  const goalText = userDirectionText(personalization.replyGoal ?? "", "goal");
  return {
    reply,
    intent: detectCreatorReplyIntent(reply),
    timeline: extractTimeline(
      `${reply} ${userReplyFocus} ${personalization.replyGoal ?? ""}`,
    ),
    focusIntent: detectFocusIntent(userReplyFocus),
    cleanFocus: focusText,
    goalIntent: detectFocusIntent(personalization.replyGoal ?? ""),
    cleanGoal: goalText,
    cleanRelationshipNote: userDirectionText(
      personalization.relationshipNote ?? "",
      "relationship",
    ),
    concessionText: userDirectionText(
      `${personalization.acceptableConcession ?? ""} ${userReplyFocus}`,
      "concession",
    ),
    tone: personalization.replyTone ?? "中立专业",
    intentSignals: detectReplyIntentSignals(
      userReplyFocus,
      personalization.replyGoal,
      personalization.acceptableConcession,
    ),
  };
}

function relationshipSentence(context: CreatorReplyContext): string {
  if (!context.cleanRelationshipNote) return "";
  if (/slow|timeline has been slow/i.test(context.cleanRelationshipNote))
    return "To keep the collaboration moving, I want to keep the next step clear.";
  if (
    /friendly|professional/i.test(context.cleanRelationshipNote) &&
    context.tone !== "最后确认"
  )
    return "I appreciate the communication on this collaboration.";
  return "";
}

function toneClosing(context: CreatorReplyContext): string {
  // Nothing upbeat belongs after a decline or a "we have no budget" answer.
  if (
    context.intent === "cannot-continue" ||
    context.intent === "declining" ||
    context.intent === "rate-negotiation"
  )
    return "";
  if (context.tone === "友好一点")
    return "Looking forward to seeing the content.";
  if (context.tone === "坚定推进")
    return "Please keep this timeline so we can continue the campaign smoothly.";
  if (context.tone === "最后确认")
    return "We will use this confirmation to keep the campaign status accurate on our side.";
  return "";
}

function productLinkReminder(context: CreatorReplyContext): string {
  if (
    context.intent === "package-not-arrived" ||
    context.intent === "cannot-continue"
  )
    return "";
  const isExplicit =
    context.focusIntent === "product-link" ||
    context.goalIntent === "product-link";
  return isExplicit
    ? "Please make sure the TikTok Shop product link is attached when you post."
    : "Please make sure the TikTok Shop product link is attached and continue following the filming guidelines we shared.";
}

function videoLengthRequirement(context: CreatorReplyContext): string {
  const concession = context.concessionText;
  const concessionLine = concession
    ? `${concession} Please still make sure the key product use is shown clearly.`
    : "The 60-second direction is important because longer videos usually give us enough product detail for ad testing. If your content style needs a small adjustment, please keep the key product use clear.";
  return `I understand the concern about the video length. ${concessionLine}`;
}

function filmingBriefLine(filmingRequirementsReminder: string): string {
  return (
    filmingRequirementsReminder ||
    "Please follow the filming guidelines we shared, show the main product use clearly, tag the brand account if required, and attach the TikTok Shop product link."
  );
}

function addUserDirection(lines: string[], context: CreatorReplyContext) {
  const direction = [context.cleanGoal, context.cleanFocus]
    .filter(Boolean)
    .join(" ");
  if (!direction) return;
  if (
    context.intent === "posting-time" &&
    /Confirm that the update works|Confirm Friday posting|Confirm the end-of-week timeline/i.test(
      direction,
    )
  )
    return;
  if (
    context.intent === "video-length" &&
    /60-second|shorter|above \d+ seconds/i.test(direction)
  )
    return;
  if (
    context.intent === "package-not-arrived" &&
    /delivery updates|shipping issue/i.test(direction)
  )
    return;
  if (
    context.intent === "filming-brief" &&
    /filming|requirement|guideline/i.test(direction)
  )
    return;
  if (
    context.intent === "cannot-continue" &&
    /campaign status|continue/i.test(direction)
  )
    return;
  lines.push(direction);
}

/**
 * Replies to the commercial questions creators actually ask during outreach.
 * These used to fall through to the generic "I'll note this on our side",
 * which reads as a non-answer and stalls the conversation.
 */
function businessIntentLines(
  context: CreatorReplyContext,
  product: string,
  terms: CollaborationTerms,
): string[] {
  const commission = terms.creatorCommission
    ? `${terms.creatorCommission} commission`
    : "commission";
  const window = terms.commissionWindow
    ? ` for ${terms.commissionWindow} after the video goes live`
    : "";

  switch (context.intent) {
    case "tcm-fee-question":
      return [
        "Happy to explain the number. The amount shown on TikTok Creator Marketplace matches the value of the products we send you — TikTok requires brands to enter a collaboration fee, so we enter the product price there.",
        `On top of that, you earn ${commission} on any order placed with your code${window}, and we promote the video ourselves when it fits the campaign, which puts your code in front of more people.`,
        "The campaign brief and our brand media kit are attached — take a look and tell me if anything is unclear.",
      ];
    case "commission-question":
      return [
        terms.collabModel === "discount-code"
          ? `Happy to lay out the terms. We send the ${product} free of charge and it's yours to keep, you earn ${commission} on every order placed with your code${window}${terms.audienceDiscount ? `, and your audience saves ${terms.audienceDiscount} when they use it` : ""}.`
          : `Happy to lay out the terms. This collaboration is sample-based: we send the ${product} free of charge and you keep it, and you earn ${terms.creatorCommission ? `${terms.creatorCommission} ` : "the standard TikTok Shop affiliate "}commission on every sale made through your product link.`,
        "There is no separate posting fee on this campaign, so what you earn scales with how the video performs.",
      ];
    case "rate-negotiation":
      return [
        "Thanks for sharing your rate. This campaign is set up as sample plus affiliate commission rather than a flat posting fee, so we don’t have a paid-post budget to work against on this one.",
        "If that structure works for you, we’ll get the sample moving. If you only take paid placements, that’s completely understandable — we’ll note it and keep you in mind for campaigns that carry a budget.",
      ];
    case "declining":
      return [
        "Thanks for getting back to us either way — that’s genuinely helpful.",
        "We’ll close this one out and won’t keep following up. If a future product is a better fit for your content, we’d be glad to reach out again.",
      ];
    case "busy-later":
      return [
        "Completely understood — no need to squeeze this in around a busy stretch.",
        "Would it help if we checked back once things settle down? If you can give us a rough window, we’ll hold off until then instead of following up in the meantime.",
      ];
    case "more-product":
      return [
        "Thanks for asking — let us check what we have available for this campaign on our side.",
        "Could you confirm which variant you need and the shipping address you’d like it sent to? We’ll come back to you once we know whether it can be approved for this round.",
      ];
    default:
      return [];
  }
}

function creatorReplyLines(
  product: string,
  task: Task,
  userReplyFocus: string,
  filmingRequirementsReminder: string,
  personalization: CreatorReplyPersonalization,
  terms: CollaborationTerms,
): string[] {
  const context = buildCreatorReplyContext(
    task,
    userReplyFocus,
    personalization,
  );
  const lines: string[] = [];
  const relationship = relationshipSentence(context);
  const specificFocusLines = replyIntentLines(
    context,
    filmingRequirementsReminder,
  );
  const businessLines = businessIntentLines(context, product, terms);
  const hasSpecificFocus = hasSpecificReplyIntent(context);

  if (hasSpecificFocus) {
    lines.push(replyAcknowledgementLine(context));
    if (relationship) lines.push(relationship);
    if (context.intent === "package-not-arrived") {
      lines.push(
        "Please keep checking the delivery updates, and let us know if the package still does not arrive or if you see any shipping issue.",
      );
      lines.push("No need to start filming until the sample has arrived.");
    }
    // Questions about terms, rate, availability — or an outright decline — need
    // a substantive answer even when the operator supplied their own direction.
    lines.push(...businessLines);
    lines.push(...specificFocusLines);

    if (
      specificFocusLines.length === 0 &&
      businessLines.length === 0 &&
      context.intent !== "package-not-arrived"
    ) {
      addUserDirection(lines, context);
    }
  } else if (businessLines.length > 0) {
    lines.push(...businessLines);
  } else if (context.intent === "posting-time") {
    lines.push(
      `Thank you for the update. I’ll note that you’re planning to complete the ${product} content ${context.timeline}.`,
    );
    const reminder = productLinkReminder(context);
    if (reminder) lines.push(reminder);
  } else if (context.intent === "video-length") {
    lines.push(videoLengthRequirement(context));
    const reminder = productLinkReminder({
      ...context,
      focusIntent: "product-link",
    });
    if (reminder) lines.push(reminder);
  } else if (context.intent === "package-not-arrived") {
    lines.push(
      "Thanks for letting me know. Please keep checking the delivery updates, and let us know if the package still does not arrive or if you see any shipping issue.",
    );
    lines.push("No need to start filming until the sample has arrived.");
  } else if (context.intent === "filming-brief") {
    lines.push(
      "Of course — here is the main filming direction for this collaboration.",
    );
    lines.push(filmingBriefLine(filmingRequirementsReminder));
  } else if (context.intent === "cannot-continue") {
    lines.push(
      "Thank you for letting us know. We will update the campaign status on our side.",
    );
    if (context.tone === "最后确认")
      lines.push(
        "No further action is needed from you for this campaign unless anything changes.",
      );
  } else {
    lines.push(`Thank you for the update on the ${product} collaboration.`);
    lines.push("I’ll note this on our side.");
    lines.push("Please keep us posted if anything changes with the timeline.");
  }

  if (!hasSpecificFocus && relationship) lines.splice(1, 0, relationship);
  if (!hasSpecificFocus) addUserDirection(lines, context);
  const closing = toneClosing(context);
  if (closing) lines.push(closing);

  return Array.from(new Set(lines.map((line) => line.trim()).filter(Boolean)));
}

function creatorReplyMessage(
  channel: Channel,
  name: string,
  product: string,
  task: Task,
  userReplyFocus: string,
  filmingRequirementsReminder: string,
  personalization: CreatorReplyPersonalization,
  terms: CollaborationTerms,
): string {
  const lines = creatorReplyLines(
    product,
    task,
    userReplyFocus,
    filmingRequirementsReminder,
    personalization,
    terms,
  );
  const body = lines.join(" ");

  if (channel === "Email") {
    return `Hi ${name},

${lines.join("\n\n")}

Best,
Brand Team`;
  }

  if (channel === "TikTok Shop Affiliate Message") {
    return `Hi ${name},

${lines.join("\n\n")}

Thank you.`;
  }

  if (channel === "WhatsApp") {
    return `Hi ${name}, thank you for the update — ${body.replace(/^Thank you for the update\.\s*/i, "")}`
      .replace(/\s+/g, " ")
      .trim();
  }

  return `Hi ${name}, ${body.charAt(0).toLowerCase()}${body.slice(1)}`;
}

function byChannel(
  channel: Channel,
  name: string,
  request: string,
  filmingRequirementsReminder: string,
  highRisk: boolean,
  /**
   * Extra sentences the DM version is allowed to keep. Tone-layer lines would
   * otherwise push the actual ask past the DM truncation limit.
   */
  extraSentences = 0,
): string {
  const cleanReminder = filmingRequirementsReminder.trim();

  if (channel === "TikTok DM") {
    const limit = (highRisk ? 4 : 3) + extraSentences;
    const sentences = request.split(". ").slice(0, limit);
    const joined = sentences.join(". ");
    // Only add the terminator when the truncated text lost one. Appending
    // unconditionally turned a request ending in a question mark into "?.".
    const body = /[.!?…]$/.test(joined) ? joined : `${joined}.`;
    return `Hi ${name}, ${body} ${cleanReminder}`
      .replace(/\s+/g, " ")
      .replace("..", ".")
      .trim();
  }

  if (channel === "TikTok Shop Affiliate Message") {
    const closing = highRisk
      ? "Thank you."
      : "This helps us keep the collaboration timeline clear.";
    return `Hi ${name}, ${request} ${cleanReminder} ${closing}`
      .replace(/\s+/g, " ")
      .trim();
  }

  if (channel === "WhatsApp") {
    const closing = highRisk
      ? "Thank you."
      : "A quick update is fine so we can keep the collaboration timeline clear.";
    return `Hi ${name}, ${request} ${cleanReminder || closing}`
      .replace(/\s+/g, " ")
      .trim();
  }

  return `Hi ${name},

${request}

${
  cleanReminder
    ? `${cleanReminder}

`
    : ""
}${highRisk ? "Thank you." : "This helps us keep the collaboration timeline clear and make sure the content matches the campaign guidelines."}

Best,
Brand Team`;
}

function buildChineseExplanation(
  scenario: string,
  channel: Channel,
  hasReferenceLinks: boolean,
  variantLabel?: string,
  tier?: CreatorTier,
  untranslatedContentPoints: string[] = [],
): string {
  const channelNote: Record<Channel, string> = {
    "TikTok DM": "TikTok DM 版本更短、更自然，适合快速提醒，不会显得强势。",
    "TikTok Shop Affiliate Message":
      "TikTok Shop 达人联盟消息更完整，明确说明合作背景和下一步动作。",
    Email: "邮件版本结构更正式，包含问候、背景、请求、下一步和结尾。",
    WhatsApp: "WhatsApp 版本保持聊天感，但比 DM 稍微更详细，方便对方快速回复。",
  };

  const scenarioNotes: Record<string, string> = {
    "First Outreach": "首次建联，重点是清楚介绍合作并确认达人是否有兴趣。",
    "No Reply Follow-up":
      "建联后未回复跟进，重点是短句确认是否有兴趣，不施压。",
    "Sample Request Reminder":
      "提醒达人申请样品，重点是让达人完成样品申请动作。",
    "Sample Request Confirmation":
      "样品申请后确认，重点是说明申请已收到或正在处理。",
    "Sample In Transit Reminder":
      "样品运输中提醒，重点是提醒达人关注物流，到货后再开始拍摄。",
    "Logistics Exception Confirmation":
      "物流异常确认，重点是确认达人是否收到包裹、查看物流更新，并说明样品到货后再推进拍摄。",
    "Sample Delivered Follow-up":
      "样品到货后催拍，重点是确认发布时间，并轻量提醒拍摄要求、产品链接和 tag。",
    "Partial Video Completion Follow-up":
      "已发布部分视频，跟进剩余视频，先认可已发布内容，再确认剩余视频发布时间。",
    "Needs Revision Reminder":
      "视频修改提醒，重点是清楚说明需要调整，不情绪化。",
    "Completed Thank You":
      "合作完成感谢 / 后续合作，重点是感谢并说明后续 performance review 或 ad testing。",
    "Failed Archive Confirmation":
      "合作失败归档，默认不催促，只做 campaign status 更新确认。",
    "Final Follow-up Before Failed Candidate":
      "合作失败风险前的最后跟进，重点是让达人明确是否还能完成合作。",
    "Second Follow-up": "第二次跟进，重点是再次确认进度和明确发布时间。",
    "Creator Reply Follow-up":
      "这个话术用于达人已经回复后继续推进沟通。系统根据达人回复内容和你填写的回复重点生成下一步回复。当前版本不调用外部 AI API，而是通过本地规则识别“发布时间、投流计划、让步、挂车提醒”等常见运营意图。如果填写了具体回复重点，话术不应只生成通用模板。",
    "Light Follow-up": "轻量跟进，适合未命中特定阶段时确认当前合作进展。",
    "Re-engagement Outreach":
      "老达人再建联，重点是用已有合作关系降低沟通成本，直接邀请参与新一轮产品。",
    "Address Confirmation":
      "发货前确认收货信息，重点是拿到准确的收件人、地址和联系方式，避免样品退回。",
  };

  const referenceLinksNote = hasReferenceLinks
    ? " 参考视频链接用于给达人参考拍摄模板、内容灵感或后续视频优化方向，并最多放入 3 条。"
    : "";
  const variantNote = variantLabel ? ` 当前话术角度：${variantLabel}。` : "";
  const tierNote =
    tier && tier !== DEFAULT_CREATOR_TIER && isTierAwareScenario(scenario)
      ? ` 按「${tier}」调整了开场和收尾的语气强度。`
      : "";

  // The operator is the only one who can fix an untranslatable content point,
  // and they cannot fix what they cannot see — a silently shortened brief is
  // how a required shot goes missing.
  const untranslatedNote =
    untranslatedContentPoints.length > 0 && isGuidelineScenario(scenario)
      ? ` 注意：有 ${untranslatedContentPoints.length} 条「必须展示内容」无法翻译成英文（${untranslatedContentPoints.slice(0, 3).join("、")}），已用品类通用文案补位。建议在产品设置里改写成常见说法或直接写英文，否则达人收不到这几条要求。`
      : "";

  return `这条消息用于「${scenarioNotes[scenario] ?? scenario}」场景。语气保持专业、冷静、直接，符合美国本地 TikTok Shop affiliate campaign management 的沟通方式。${channelNote[channel]}${referenceLinksNote}${variantNote}${tierNote}${untranslatedNote}`;
}

function removeChineseCharacters(value: string): string {
  return value
    .replace(/[\u3400-\u9fff]/g, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}
