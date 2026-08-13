/**
 * The script library. Each scenario used to have exactly one hardcoded English
 * template, so every creator in a batch received a byte-identical message. This
 * module holds several angles per scenario plus the tone layer that adjusts how
 * hard a message pushes based on how established the relationship is.
 *
 * Variant 0 of every scenario reproduces the wording the generator produced
 * before this module existed, so the default output is unchanged and operators
 * opt into a different angle by switching variants.
 */

import type { ProductCategory } from "./productCategories";

/** How established the relationship is. Drives tone, not content. */
export const CREATOR_TIERS = [
  "冷启动",
  "腰部达人",
  "头部达人",
  "老合作达人",
] as const;

export type CreatorTier = (typeof CREATOR_TIERS)[number];

export const DEFAULT_CREATOR_TIER: CreatorTier = "冷启动";

export type ScriptContext = {
  /** English product name, already translated. */
  product: string;
  category: ProductCategory;
  tier: CreatorTier;
  /** e.g. "1 remaining video" / "remaining video(s)". */
  remainingVideos: string;
  requiredVideos: number;
  /** Filming-requirements reminder, already assembled and English-only. */
  reminder: string;
};

export type ScriptVariant = {
  id: string;
  /** Chinese label shown on the variant switcher. */
  label: string;
  /** One-line Chinese description of when to pick this angle. */
  angle: string;
  /**
   * Builds the core request sentence(s). Absent only for variant 0 of the
   * scenarios that keep a bespoke per-channel body in the generator.
   */
  request?: (context: ScriptContext) => string;
};

/**
 * Scenarios where the relationship tone layer applies. Logistics and revision
 * messages stay neutral regardless of tier — softening a "your video breaks the
 * brief" message for a top creator just makes it unclear.
 */
const TIER_AWARE_SCENARIOS = new Set([
  "First Outreach",
  "Re-engagement Outreach",
  "No Reply Follow-up",
  "Sample Request Reminder",
  "Completed Thank You",
]);

export function isTierAwareScenario(scenario: string): boolean {
  return TIER_AWARE_SCENARIOS.has(scenario);
}

/**
 * A sentence placed before the request, establishing why this creator was
 * picked. Cold outreach deliberately gets nothing — an unearned compliment
 * reads as a mail merge and lowers reply rates.
 */
export function tierOpeningLine(context: ScriptContext): string {
  const hook = context.category.outreachHook;
  switch (context.tier) {
    case "腰部达人":
      return `We’ve been enjoying ${hook}, and the style fits this product well.`;
    case "头部达人":
      return `We’ve been following ${hook} for a while, and this campaign felt like a natural fit.`;
    case "老合作达人":
      return "It was great working with you on the last campaign.";
    default:
      return "";
  }
}

/** A sentence placed after the request, adjusting how much pressure it carries. */
export function tierClosingLine(context: ScriptContext): string {
  switch (context.tier) {
    case "冷启动":
      return "No pressure either way — just let us know if it’s not a fit.";
    case "头部达人":
      return "We’re happy to work around your schedule and content style on this one.";
    case "老合作达人":
      return "Happy to keep the process as easy as it was last time.";
    default:
      return "";
  }
}

const SCRIPT_VARIANTS: Record<string, ScriptVariant[]> = {
  "First Outreach": [
    {
      id: "first-outreach-standard",
      label: "标准介绍",
      angle: "中立说明合作机会，最安全的默认版本。",
      request: ({ product }) =>
        `We’re reaching out about a potential collaboration for the ${product}. If you’re interested, please let us know and we can share the product link, content requirements, and next steps.`,
    },
    {
      id: "first-outreach-content-fit",
      label: "内容契合切入",
      angle: "先说明为什么找这位达人，适合内容风格明确的达人。",
      request: ({ product, category }) =>
        `We’re running a creator campaign for the ${product}, and it lines up well with the kind of content you already make. If you’re open to it, we can send the product free of charge and share the filming direction so you can shoot it inside ${category.useCasePhrase}.`,
    },
    {
      id: "first-outreach-offer-first",
      label: "直接给条件",
      angle: "开门见山讲达人能拿到什么，适合冷启动批量建联。",
      request: ({ product }) =>
        `We’d like to send you the ${product} free of charge for a TikTok Shop collaboration. You keep the product, earn commission on every sale through your link, and we cover the filming brief so there’s no guesswork. Let us know if you’d like the details.`,
    },
    {
      id: "first-outreach-angle-hook",
      label: "内容角度提案",
      angle: "直接给一个可拍的内容角度，降低达人的构思成本。",
      request: ({ product, category }) =>
        `We’re looking for creators to film the ${product} for a TikTok Shop campaign. The angle that performs best is a simple, real clip inside ${category.useCasePhrase} — no script or studio setup needed. If that sounds workable, we’ll send the product and the short brief.`,
    },
    {
      id: "first-outreach-short",
      label: "极简低压",
      angle: "两句话问是否有兴趣，适合首轮大批量试探。",
      request: ({ product }) =>
        `Quick question — would you be open to a paid-commission TikTok Shop collaboration for the ${product}? If so, we’ll send the product and the brief.`,
    },
  ],

  "Re-engagement Outreach": [
    {
      id: "re-engagement-new-product",
      label: "老达人推新品",
      angle: "上一轮合作过，直接邀请参与新产品。",
      request: ({ product }) =>
        `We’re starting a new campaign round for the ${product} and wanted to invite you back. The process is the same as last time, and we can send the sample as soon as you confirm.`,
    },
    {
      id: "re-engagement-performance",
      label: "数据反馈式",
      angle: "用上一条内容的表现作为再合作理由，说服力最强。",
      request: ({ product }) =>
        `Your last video for us performed well on our side, so we wanted to offer you the next collaboration first. This round is for the ${product}. Let us know if you’d like us to send it over.`,
    },
    {
      id: "re-engagement-new-round",
      label: "新一轮通知",
      angle: "把它当作常规轮次通知，语气轻、无压力。",
      request: ({ product }) =>
        `We’re opening a new creator round for the ${product}. You’re on our returning-creator list, so the sample and commission setup are already approved — just reply if you want in for this round.`,
    },
    {
      id: "re-engagement-light",
      label: "简短问候式",
      angle: "先问近况再提合作，适合关系较好的达人。",
      request: ({ product }) =>
        `Hope things have been going well since our last collaboration. We have a new ${product} campaign running and would love to have you on it again if you have capacity this month.`,
    },
  ],

  "No Reply Follow-up": [
    {
      id: "no-reply-standard",
      label: "标准跟进",
      angle: "第一次未回复跟进，中立确认兴趣。",
      request: ({ product }) =>
        `I’m following up on the ${product} collaboration we sent over. Please let us know if you’re interested, or if this campaign is not a fit right now.`,
    },
    {
      id: "no-reply-yes-or-no",
      label: "只要一个是或否",
      angle: "把回复成本降到最低，适合第二次跟进。",
      request: ({ product }) =>
        `Following up on the ${product} campaign — a simple yes or no is all we need. If it’s not a fit, we’ll close it out on our side and stop following up.`,
    },
    {
      id: "no-reply-add-detail",
      label: "补充信息再问",
      angle: "第一次可能信息不够，这次把条件说清楚。",
      request: ({ product }) =>
        `Circling back on the ${product} collaboration. In case the first message was light on detail: the product is free, commission applies on every sale through your link, and the filming brief is short. Would you like us to send it over?`,
    },
    {
      id: "no-reply-deadline",
      label: "给时间节点",
      angle: "用 campaign 名额和截止时间制造轻度紧迫感。",
      request: ({ product }) =>
        `Checking in one more time on the ${product} campaign. We’re finalizing the creator list for this round this week, so let us know by then if you’d like a spot. If we don’t hear back, we’ll assume it’s not a fit for now.`,
    },
    {
      id: "no-reply-close-out",
      label: "友好收尾",
      angle: "最后一次，主动放手，为以后留余地。",
      request: ({ product }) =>
        `Last note from us on the ${product} campaign — we don’t want to keep filling your inbox. We’ll close this one out, and if the timing is better on a future product, we’d be glad to reach out again.`,
    },
  ],

  "Sample Request Reminder": [
    {
      id: "sample-request-standard",
      label: "标准提醒",
      angle: "中立提醒达人去申请样品。",
      request: ({ product }) =>
        `The sample invitation for the ${product} campaign is available. If you’re still interested in moving forward, please apply for the sample so we can keep the campaign timeline moving.`,
    },
    {
      id: "sample-request-action-step",
      label: "说明具体操作",
      angle: "达人常常是不知道在哪申请，直接讲步骤。",
      request: ({ product }) =>
        `Your invitation for the ${product} campaign is waiting in your TikTok Shop affiliate dashboard. Once you accept it and submit the sample request there, we can approve it and ship on our side.`,
    },
    {
      id: "sample-request-window",
      label: "说明发货窗口",
      angle: "用发货批次解释为什么要现在申请。",
      request: ({ product }) =>
        `A quick reminder about the ${product} sample invitation — we ship approved samples in batches, so requesting this week means yours goes out with the current batch instead of waiting for the next one.`,
    },
    {
      id: "sample-request-check-blocker",
      label: "先问是否有障碍",
      angle: "适合已经提醒过一次、仍然没动作的达人。",
      request: ({ product }) =>
        `Following up on the ${product} sample request. If something in the application is unclear or not working on your end, let us know and we’ll sort it out. If the timing just isn’t right, that’s fine too — we’d only like to know either way.`,
    },
  ],

  "Sample Request Confirmation": [
    {
      id: "sample-confirm-standard",
      label: "标准确认",
      angle: "确认收到申请并说明下一步。",
      request: ({ product }) =>
        `We received your sample request for the ${product} campaign, and it is being reviewed or processed on our side. Once the sample is approved and shipped, we’ll use the shipping update to confirm the next step.`,
    },
    {
      id: "sample-confirm-with-prep",
      label: "确认 + 提前预告要求",
      angle: "趁等待期把拍摄要求先铺垫一遍，缩短到货后的沟通。",
      request: ({ product }) =>
        `Thanks for requesting the ${product} sample — it’s approved and being processed on our side. While it ships, it’s worth skimming the filming brief so you can plan the content in advance. Nothing needs to be posted until the sample arrives.`,
    },
    {
      id: "sample-confirm-timeline",
      label: "确认 + 给时间预期",
      angle: "主动给物流预期，减少达人反复来问。",
      request: ({ product }) =>
        `Your ${product} sample request is confirmed and moving into shipping on our side. You’ll get the tracking update once it goes out. If it hasn’t moved after a few days, message us and we’ll check it.`,
    },
  ],

  "Sample In Transit Reminder": [
    {
      // Keeps the bespoke per-channel body the generator already builds.
      id: "in-transit-full-brief",
      label: "完整拍摄要求预告",
      angle: "运输期间把完整 brief 提前给达人，默认版本。",
    },
    {
      id: "in-transit-light",
      label: "轻量提醒",
      angle: "只提醒注意签收，不铺开要求，适合已经发过 brief 的达人。",
      request: ({ product }) =>
        `The ${product} sample is on the way to you. Nothing needs to be filmed or posted yet — just keep an eye out for the delivery, and let us know once it arrives so we can confirm the filming schedule.`,
    },
    {
      id: "in-transit-plan-ahead",
      label: "催拍摄计划",
      angle: "运输期间就锁定拍摄档期，适合进度紧的 campaign。",
      request: ({ product, category }) =>
        `The ${product} sample is in transit. While you wait, could you let us know roughly which day you’d plan to film once it lands? Most creators shoot this inside ${category.useCasePhrase}, so it doesn’t need a dedicated setup — having the date helps us plan the campaign schedule.`,
    },
  ],

  "Logistics Exception Confirmation": [
    {
      // Keeps the bespoke per-channel body the generator already builds.
      id: "logistics-standard",
      label: "标准物流确认",
      angle: "确认是否签收并询问是否有异常，默认版本。",
    },
    {
      id: "logistics-direct",
      label: "直接问是否收到",
      angle: "一句话确认，适合 DM 快速沟通。",
      request: ({ product }) =>
        `Quick check on the ${product} sample — has it reached you yet? Our tracking still shows it in transit, and if it’s stuck we’d rather find out now and fix it.`,
    },
    {
      id: "logistics-offer-reship",
      label: "主动提出补发",
      angle: "物流明显异常时使用，主动给解决方案。",
      request: ({ product }) =>
        `The ${product} sample still shows as in transit on our side, which is longer than it should take. Could you confirm whether it has arrived? If the tracking has stalled or the package looks lost, tell us and we’ll look into a replacement rather than leave you waiting.`,
    },
  ],

  "Sample Delivered Follow-up": [
    {
      id: "delivered-standard",
      label: "标准催拍",
      angle: "确认签收并要发布时间，默认版本。",
      request: ({ product, reminder }) =>
        `Tracking shows the ${product} sample has been delivered. Could you please confirm you received it and share your expected posting date for the first video or filming schedule? ${reminder}`,
    },
    {
      id: "delivered-date-only",
      label: "只要一个日期",
      angle: "不重复要求，只锁定发布日期，适合已看过 brief 的达人。",
      request: ({ product }) =>
        `The ${product} sample shows as delivered — hope it arrived in good shape. All we need at this point is a rough posting date for the first video so we can line up the campaign schedule on our side.`,
    },
    {
      id: "delivered-offer-help",
      label: "先问是否有困难",
      angle: "达人可能卡在不知道怎么拍，主动降低门槛。",
      request: ({ product, category, reminder }) =>
        `Now that the ${product} has arrived, let us know if anything about the filming direction is unclear — most creators shoot this in one take inside ${category.useCasePhrase}. When do you think you’ll be able to film? ${reminder}`,
    },
    {
      id: "delivered-firm",
      label: "明确推进",
      angle: "样品到货已久仍无动作时使用，语气更明确。",
      request: ({ product }) =>
        `The ${product} sample was delivered and we haven’t seen a posting date yet. Could you confirm when you plan to film and post the first video? If something has come up and the timing no longer works, please tell us so we can update the campaign status.`,
    },
  ],

  "Partial Video Completion Follow-up": [
    {
      // Keeps the bespoke per-channel body the generator already builds.
      id: "partial-standard",
      label: "标准剩余视频跟进",
      angle: "先认可已发布内容再确认剩余视频，默认版本。",
    },
    {
      id: "partial-date-only",
      label: "只确认剩余日期",
      angle: "简短版本，只锁定剩余视频的发布日期。",
      request: ({ remainingVideos }) =>
        `Thanks for getting the first video up. There’s still ${remainingVideos} on this collaboration — could you confirm the posting date so we can close out the schedule on our side?`,
    },
    {
      id: "partial-performance",
      label: "用数据推进",
      angle: "用第一条的表现说明为什么值得补完剩余视频。",
      request: ({ remainingVideos }) =>
        `Your first video is performing well enough that we’re reviewing it for ad testing. Completing ${remainingVideos} would give us a second angle to test, which usually means more commission on your side too. When could you get it posted?`,
    },
    {
      id: "partial-offer-angle",
      label: "给第二条角度",
      angle: "达人常常是不知道第二条拍什么，直接给方向。",
      request: ({ remainingVideos, category }) =>
        `Thanks for the first video. For ${remainingVideos}, an easy second angle is a different moment inside ${category.useCasePhrase} rather than repeating the first clip. Could you confirm when you’d be able to post it?`,
    },
  ],

  "Needs Revision Reminder": [
    {
      id: "revision-standard",
      label: "标准修改提醒",
      angle: "说明需要一处调整，中立不情绪化。",
      request: ({ product }) =>
        `We reviewed the ${product} video and need one adjustment before we can move it forward for campaign review. Please check the product link, tag, and brief requirements, then update the specific item that does not match the filming guidelines.`,
    },
    {
      id: "revision-praise-first",
      label: "先肯定再指出",
      angle: "内容本身不错、只是漏了合规项时使用。",
      request: ({ product }) =>
        `The ${product} video looks good overall — there’s just one item to fix before it can pass campaign review. Once the product link, brand tag, and the brief requirement are all in place, we can move it forward.`,
    },
    {
      id: "revision-no-reshoot",
      label: "强调不用重拍",
      angle: "达人最怕重拍，先打消这个顾虑能大幅提高修改率。",
      request: ({ product }) =>
        `Small fix needed on the ${product} video — no reshoot required. It’s an edit to the post itself so it matches the campaign requirements. Could you update it and let us know once it’s live?`,
    },
    {
      id: "revision-deadline",
      label: "带截止时间",
      angle: "已经提过一次修改仍未处理时使用。",
      request: ({ product }) =>
        `Following up on the ${product} video revision. The campaign review closes soon, so we need the adjustment made before then for the video to count toward this round. Please let us know if you’re able to update it.`,
    },
  ],

  "Final Follow-up Before Failed Candidate": [
    {
      id: "final-standard",
      label: "标准最后确认",
      angle: "确认是否还能完成，默认版本。",
      request: ({ product }) =>
        `I’m following up on the ${product} collaboration. The required video(s) are still incomplete on our side. Could you please confirm whether you’re still able to complete the remaining video(s) and confirm your expected posting date? If you’re no longer able to continue, please let us know so we can update the campaign status on our side.`,
    },
    {
      id: "final-either-answer",
      label: "两个答案都可以",
      angle: "明确说明退出也是可接受答案，回复率通常更高。",
      request: ({ product }) =>
        `Checking in one last time on the ${product} collaboration. Either answer works for us — a posting date, or a note that you can’t continue. We just need one of the two so we can close the campaign record accurately.`,
    },
    {
      id: "final-with-date",
      label: "给明确截止日",
      angle: "给一个具体期限，逼出决定。",
      request: ({ product }) =>
        `We’re closing out the ${product} campaign round this week. If the remaining video can still be posted before then, let us know the date. If not, we’ll mark the collaboration as incomplete and stop following up.`,
    },
    {
      id: "final-keep-door-open",
      label: "留后路版本",
      angle: "达人有长期价值时使用，收尾但不切断关系。",
      request: ({ product }) =>
        `Last check on the ${product} collaboration. If it’s no longer workable, that’s completely fine — just tell us and we’ll close it without any issue on our side. We’d still be glad to work with you on a product that fits your schedule better.`,
    },
  ],

  "Completed Thank You": [
    {
      id: "completed-standard",
      label: "标准感谢",
      angle: "感谢并说明后续 review，默认版本。",
      request: ({ product }) =>
        `Thank you for completing the ${product} collaboration. We’ll review performance on our side and consider the content for ad testing or future campaign opportunities. If you’re open to future products, we’ll keep you in mind for the next suitable campaign.`,
    },
    {
      id: "completed-next-campaign",
      label: "直接约下一轮",
      angle: "趁合作刚结束热度最高时锁定下一次。",
      request: ({ product }) =>
        `Thanks for wrapping up the ${product} collaboration — the content came through exactly as briefed. We run new campaign rounds regularly, and we’d like to put you on the returning-creator list so you get first pick on the next product. Let us know if that works.`,
    },
    {
      id: "completed-ask-feedback",
      label: "感谢 + 要反馈",
      angle: "顺便收集达人对产品和流程的反馈，为下一轮优化。",
      request: ({ product }) =>
        `Thank you for completing the ${product} collaboration. If you have a minute, we’d genuinely like to hear what you thought of the product and whether anything in the process was awkward on your end — it helps us make the next round easier for creators.`,
    },
    {
      id: "completed-boost-notice",
      label: "告知投流计划",
      angle: "内容表现好、准备投流时使用，达人通常很在意这一点。",
      request: ({ product }) =>
        `Thanks for completing the ${product} collaboration. The content is performing well enough that we’re looking at putting ad spend behind it, which typically means more reach and more commission on your side. We’ll keep you posted, and we’d be glad to work together on the next product.`,
    },
  ],

  "Failed Archive Confirmation": [
    {
      id: "failed-standard",
      label: "标准归档确认",
      angle: "只做状态更新确认，不催促，默认版本。",
      request: ({ product }) =>
        `We’re updating the campaign status for the ${product} collaboration on our side. Based on the current status, we’ll archive this campaign as not completed unless there is a final update we should review.`,
    },
    {
      id: "failed-no-hard-feelings",
      label: "友好收尾",
      angle: "关系不错但这次没做成时使用，保留未来合作可能。",
      request: ({ product }) =>
        `We’re closing out the ${product} collaboration on our side since it didn’t get completed this round. No issue at all — timing doesn’t always line up. If a future product fits your schedule better, we’d be happy to reach out again.`,
    },
    {
      id: "failed-sample-note",
      label: "带样品说明",
      angle: "样品已寄出但未产出内容时使用，说明处理方式。",
      request: ({ product }) =>
        `We’re marking the ${product} collaboration as not completed for this round. The sample is yours to keep — there’s nothing to return. If anything changes and you’d still like to post, tell us and we’ll see whether it can still count.`,
    },
  ],

  "Light Follow-up": [
    {
      id: "light-standard",
      label: "标准进度确认",
      angle: "轻量确认当前进展，默认版本。",
      request: ({ product }) =>
        `I’m checking in on the ${product} collaboration. Please send a quick update on the current status so we can keep the campaign status accurate on our side.`,
    },
    {
      id: "light-one-line",
      label: "一句话问候",
      angle: "最轻的一版，几乎没有推进压力。",
      request: ({ product }) =>
        `Just a quick check-in on the ${product} collaboration — anything you need from us at this stage?`,
    },
    {
      id: "light-offer-help",
      label: "主动提供支持",
      angle: "怀疑达人卡住但不好意思说时使用。",
      request: ({ product }) =>
        `Checking in on the ${product} collaboration. If anything is holding things up — the brief, the product link, or the timing — let us know and we’ll help sort it out rather than just following up again.`,
    },
  ],

  "Address Confirmation": [
    {
      id: "address-standard",
      label: "标准地址确认",
      angle: "发货前确认收件信息，默认版本。",
      request: ({ product }) =>
        `Before we ship the ${product} sample, could you confirm the shipping name, full address, and a contact number? We’ll use exactly what you send, so it’s worth a quick double-check.`,
    },
    {
      id: "address-mismatch",
      label: "信息不完整或有误",
      angle: "系统里的地址有问题时使用。",
      request: ({ product }) =>
        `The shipping details on the ${product} sample request look incomplete on our side, so the package would likely fail delivery. Could you resend the full address including apartment or unit number? Once we have it, the sample goes out on the next batch.`,
    },
    {
      id: "address-verify-before-ship",
      label: "催确认，说明影响",
      angle: "达人迟迟不确认地址时使用，说明后果。",
      request: ({ product }) =>
        `We still need your shipping confirmation before the ${product} sample can go out, and it’s currently the only thing holding up your slot in this round. A quick reply with the address is all we need.`,
    },
  ],
};

export function getScriptVariants(scenario: string): ScriptVariant[] {
  return SCRIPT_VARIANTS[scenario] ?? [];
}

/**
 * Resolves a requested variant index against what the scenario actually has.
 * Wraps around so the UI's "换一个说法" button can increment forever, and
 * returns 0 for scenarios with no variant table.
 */
export function resolveVariantIndex(scenario: string, index: number): number {
  const variants = getScriptVariants(scenario);
  if (variants.length === 0) return 0;
  const normalized = Math.trunc(index);
  return ((normalized % variants.length) + variants.length) % variants.length;
}

export function getScriptVariant(
  scenario: string,
  index: number,
): ScriptVariant | null {
  const variants = getScriptVariants(scenario);
  if (variants.length === 0) return null;
  return variants[resolveVariantIndex(scenario, index)];
}
