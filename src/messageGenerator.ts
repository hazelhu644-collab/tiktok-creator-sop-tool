import { normalizeVideoProgress, parseRequiredVideos } from './sopRules';
import type { Channel, GeneratedMessage, Task } from './types';

export const CHANNELS: Channel[] = ['TikTok DM', 'TikTok Shop Affiliate Message', 'Email', 'WhatsApp'];

export type CreatorFilmingRequirements = {
  productName: string;
  requirements: string[];
  keyContentPoints: string[];
  referenceLinks?: string[];
};

export const defaultCreatorFilmingRequirements: CreatorFilmingRequirements = {
  productName: '蒸汽梳毛器',
  requirements: [
    '每位达人 2 条视频',
    '每条视频 60 秒以上',
    '必须 tag 品牌账号',
    '必须挂 TikTok Shop 产品链接',
  ],
  keyContentPoints: [
    '展示雾化功能',
    '展示梳下来的浮毛',
    '展示宠物真实反应',
    '展示自然的日常宠物护理场景',
    '展示清理过程',
  ],
  referenceLinks: [],
};

const chineseCharacterPattern = /[\u3400-\u9fff]/;

type MessageScenario = {
  scenario: string;
  reason: string;
  highRisk: boolean;
};

function hasChineseCharacters(value: string): boolean {
  return chineseCharacterPattern.test(value);
}

function normalizeForScenario(value: string): string {
  return value.trim().toLowerCase();
}

function statusIncludes(task: Task, terms: string[]): boolean {
  const status = normalizeForScenario(task.currentStatus);
  return terms.some((term) => status.includes(term));
}

function shippingMatches(task: Task, terms: string[]): boolean {
  const shippingStatus = normalizeForScenario(task.sampleShippingStatus);
  return terms.some((term) => shippingStatus === term);
}

function hasSampleInTransitEvidence(task: Task): boolean {
  return statusIncludes(task, ['sample shipped']) || shippingMatches(task, ['shipped', 'in transit']);
}

function hasSampleDeliveredEvidence(task: Task): boolean {
  return statusIncludes(task, ['delivered', 'waiting for video'])
    || shippingMatches(task, ['delivered'])
    || Boolean(task.sampleDeliveredDate.trim());
}

function progressForTask(task: Task, configuredRequiredVideos?: number) {
  const progressRequiredVideos = task.videoProgress.match(/(?:\/|of\s+)(\d+)/i)?.[1];
  const fallbackRequiredVideos = progressRequiredVideos ? Number.parseInt(progressRequiredVideos, 10) : configuredRequiredVideos;
  return normalizeVideoProgress(task.videoProgress, fallbackRequiredVideos);
}

function isPartialVideoCompletionTask(task: Task, configuredRequiredVideos?: number): boolean {
  const progress = progressForTask(task, configuredRequiredVideos);
  return typeof progress.postedCount === 'number'
    && progress.postedCount > 0
    && typeof progress.requiredVideos === 'number'
    && progress.postedCount < progress.requiredVideos;
}

function isCompletedTask(task: Task, configuredRequiredVideos: number): boolean {
  const progress = progressForTask(task, configuredRequiredVideos);
  return statusIncludes(task, ['completed'])
    || (typeof progress.postedCount === 'number' && progress.postedCount >= configuredRequiredVideos);
}

function clearlyMeetsFinalFailedCandidateConditions(task: Task, configuredRequiredVideos: number): boolean {
  if (isCompletedTask(task, configuredRequiredVideos) || statusIncludes(task, ['failed'])) return false;

  const warningText = task.failedWarnings.join(' ');
  return task.lastFollowUpCount >= 2
    || /长期未回复|没有明确拍摄计划|合作状态较差|不愿意修改视频|long-time no reply|long time no reply|no filming plan|bad cooperation|unwilling/i.test(warningText)
    || task.failedWarnings.some((warning) => warning.includes('样品已到货') && warning.includes('视频进度仍为 0/'));
}

function scenarioForTask(task: Task, configuredRequiredVideos: number): MessageScenario {
  const progress = progressForTask(task, configuredRequiredVideos);
  const postedCount = progress.postedCount ?? 0;
  const requiredVideos = progress.requiredVideos ?? configuredRequiredVideos;
  const currentStatus = task.currentStatus.trim() || '未填写';
  const sampleShippingStatus = task.sampleShippingStatus.trim() || '未填写';
  const hasDeliveredEvidence = hasSampleDeliveredEvidence(task);
  const hasInTransitEvidence = hasSampleInTransitEvidence(task);

  if (statusIncludes(task, ['failed'])) {
    return {
      scenario: 'Failed Archive Confirmation',
      reason: `当前状态为 ${currentStatus}，适合做合作失败归档确认，不默认催促达人继续发布。`,
      highRisk: false,
    };
  }

  if (isCompletedTask(task, configuredRequiredVideos)) {
    return {
      scenario: 'Completed Thank You',
      reason: hasDeliveredEvidence
        ? `物流或到货信息显示达人已进入样品合作流程，且视频进度已达到 ${postedCount}/${configuredRequiredVideos}，合作已完成。`
        : `当前状态为 ${currentStatus}，或视频进度已达到 ${postedCount}/${configuredRequiredVideos}，合作已完成。`,
      highRisk: false,
    };
  }

  if (statusIncludes(task, ['needs revision', 'revision'])) {
    return {
      scenario: 'Needs Revision Reminder',
      reason: `当前状态为 ${currentStatus}，需要专业说明视频修改点并提醒达人调整。`,
      highRisk: false,
    };
  }

  if (clearlyMeetsFinalFailedCandidateConditions(task, configuredRequiredVideos)) {
    return {
      scenario: 'Final Follow-up Before Failed Candidate',
      reason: `跟进次数或风险提醒较高，且合作动作尚未完成，需要在归档失败前做最后一次明确确认。`,
      highRisk: true,
    };
  }

  if (hasDeliveredEvidence && postedCount > 0 && postedCount < requiredVideos) {
    return {
      scenario: 'Partial Video Completion Follow-up',
      reason: `物流或到货信息显示达人已进入样品合作流程，视频进度为 ${postedCount}/${requiredVideos}，应跟进剩余视频。`,
      highRisk: false,
    };
  }

  if (hasDeliveredEvidence && postedCount === 0) {
    return {
      scenario: 'Sample Delivered Follow-up',
      reason: `虽然 Current status 为 ${currentStatus}，但物流状态为 ${sampleShippingStatus} 或样品到货日期已填写，说明达人已进入样品合作流程，因此生成样品到货后催拍。`,
      highRisk: false,
    };
  }

  if (hasInTransitEvidence) {
    return {
      scenario: 'Sample In Transit Reminder',
      reason: `物流状态为 ${sampleShippingStatus}，物流状态已发货/运输中，优先按样品流程生成话术。`,
      highRisk: false,
    };
  }

  if (statusIncludes(task, ['to contact'])) {
    return {
      scenario: 'First Outreach',
      reason: `当前状态为 ${currentStatus}，还未正式建联，因此生成首次合作介绍话术。`,
      highRisk: false,
    };
  }

  if (statusIncludes(task, ['contacted', 'waiting for reply', 'no reply'])) {
    return {
      scenario: 'No Reply Follow-up',
      reason: `当前状态为 ${currentStatus}，重点是简短确认达人是否仍有合作兴趣。`,
      highRisk: false,
    };
  }

  if (statusIncludes(task, ['invited', 'waiting for sample request'])) {
    return {
      scenario: 'Sample Request Reminder',
      reason: `当前状态为 ${currentStatus}，达人已收到邀请但还需要申请样品。`,
      highRisk: false,
    };
  }

  if (statusIncludes(task, ['sample requested'])) {
    return {
      scenario: 'Sample Request Confirmation',
      reason: `当前状态为 ${currentStatus}，适合确认样品申请已收到并说明下一步。`,
      highRisk: false,
    };
  }

  if (statusIncludes(task, ['posted video', 'waiting for next video']) || (postedCount > 0 && postedCount < requiredVideos)) {
    return {
      scenario: 'Partial Video Completion Follow-up',
      reason: `视频进度为 ${postedCount}/${requiredVideos}，已发布部分视频但剩余 deliverables 尚未完成。`,
      highRisk: false,
    };
  }

  if (task.priority === 'Medium') {
    return {
      scenario: 'Second Follow-up',
      reason: `系统优先级为中，说明此前已跟进但合作仍未完成，需要再次确认进展。`,
      highRisk: true,
    };
  }

  return {
    scenario: 'Light Follow-up',
    reason: `当前状态为 ${currentStatus}，未命中特定阶段，生成轻量合作进度确认话术。`,
    highRisk: false,
  };
}

function matchesFilmingRequirementsProduct(task: Task, filmingRequirements: CreatorFilmingRequirements): boolean {
  const taskProduct = task.product.trim().toLowerCase();
  const requirementProduct = filmingRequirements.productName.trim().toLowerCase();

  if (!taskProduct || !requirementProduct) return false;
  return taskProduct.includes(requirementProduct) || requirementProduct.includes(taskProduct);
}

function toEnglishProductName(product: string): string {
  const normalized = product.trim();
  const translationMap: Record<string, string> = {
    蒸汽梳毛器: 'steam grooming brush',
    智能宠物饮水机: 'smart pet water fountain',
  };

  if (!normalized) return 'the product';
  if (translationMap[normalized]) return translationMap[normalized];
  return hasChineseCharacters(normalized) ? 'the product' : normalized;
}

function toEnglishContentPoint(point: string): string {
  const normalized = point.trim();
  const translationMap: Record<string, string> = {
    展示雾化功能: 'show the mist feature',
    展示梳下来的浮毛: 'show the loose hair removed',
    展示宠物真实反应: "show your pet’s real reaction",
    展示自然的日常宠物护理场景: 'show a natural daily pet-care scene',
    展示清理过程: 'show the cleanup process',
    展示逗猫棒很好玩: 'show that the cat teaser is fun to use',
  };

  if (!normalized) return '';
  if (translationMap[normalized]) return translationMap[normalized];
  return hasChineseCharacters(normalized) ? '' : normalized;
}

function toEnglishRequirement(requirement: string): string {
  const normalized = requirement.trim();
  if (!normalized) return '';

  const videoCountMatch = normalized.match(/每位达人\s*(\d+)\s*条视频/);
  if (videoCountMatch) {
    const count = Number(videoCountMatch[1]);
    return `complete ${count} ${count === 1 ? 'video' : 'videos'}`;
  }

  const durationMatch = normalized.match(/每条视频\s*(\d+)\s*秒以上/);
  if (durationMatch) return `keep each video at least ${durationMatch[1]} seconds`;

  if (normalized.includes('必须') && normalized.toLowerCase().includes('tag')) return 'tag the brand account';
  if (normalized.includes('TikTok Shop') && (normalized.includes('产品链接') || normalized.toLowerCase().includes('link'))) return 'include the TikTok Shop product link';

  return hasChineseCharacters(normalized) ? '' : normalized;
}

function joinEnglishList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function isGuidelineScenario(scenario: string): boolean {
  return scenario === 'Sample Delivered Follow-up'
    || scenario === 'Sample In Transit Reminder'
    || scenario === 'Partial Video Completion Follow-up'
    || scenario === 'Needs Revision Reminder'
    || scenario === 'Final Follow-up Before Failed Candidate'
    || scenario === 'Second Follow-up';
}

function referenceLinksLine(scenario: string, filmingRequirements: CreatorFilmingRequirements): string {
  const referenceLinks = (filmingRequirements.referenceLinks ?? [])
    .map((link) => link.trim())
    .filter((link) => link && !hasChineseCharacters(link))
    .slice(0, 3);
  if (referenceLinks.length === 0 || !isGuidelineScenario(scenario)) return '';

  const linksText = referenceLinks.join('; ');

  if (scenario === 'Final Follow-up Before Failed Candidate' || scenario === 'Second Follow-up') {
    return `You can use the reference links as direction for the remaining video(s): ${linksText}.`;
  }

  if (scenario === 'Partial Video Completion Follow-up') {
    return `You can also use these reference videos as direction for the next post: ${linksText}.`;
  }

  return `Here are a few reference videos you can use for filming direction: ${linksText}.`;
}

function remainingVideoPhrase(count: number | null): string {
  if (count === null || count <= 0) return 'remaining video(s)';
  return `${count} remaining ${count === 1 ? 'video' : 'videos'}`;
}

function partialCompletionGuidelinesLine(hasReferenceLinks: boolean): string {
  const referenceDirection = hasReferenceLinks ? ' and reference direction' : '';
  return `For the remaining video, please keep following the filming guidelines${referenceDirection} we shared, and make sure the TikTok Shop product link is attached.`;
}

function filmingGuidelinesLine(task: Task, filmingRequirements: CreatorFilmingRequirements): string {
  if (!matchesFilmingRequirementsProduct(task, filmingRequirements)) return 'Please follow the filming guidelines we shared and make sure the TikTok Shop product link and required tag are included.';

  const contentPoints = filmingRequirements.keyContentPoints.map(toEnglishContentPoint).filter(Boolean).slice(0, 3);
  const requirements = filmingRequirements.requirements.map(toEnglishRequirement).filter(Boolean);
  const practicalRequirements = requirements.filter((item) => !item.startsWith('complete ')).slice(0, 3);
  const contentPointText = joinEnglishList(contentPoints);
  const requirementText = joinEnglishList(practicalRequirements);

  if (!contentPointText && !requirementText) return 'Please follow the filming guidelines we shared.';

  const parts = ['Please follow the filming guidelines we shared'];
  if (contentPointText) parts.push(`show the main product use case clearly, including ${contentPointText}`);
  if (requirementText) parts.push(requirementText);

  return `${parts.join('; ')}.`;
}

function creatorGreeting(username: string): string {
  const normalized = username.trim();
  if (!normalized || hasChineseCharacters(normalized)) return 'there';
  return normalized.startsWith('@') ? normalized : `@${normalized}`;
}

export function generateMessage(
  task: Task,
  channel: Channel,
  filmingRequirements: CreatorFilmingRequirements = defaultCreatorFilmingRequirements,
): GeneratedMessage {
  const configuredRequiredVideos = parseRequiredVideos(filmingRequirements);
  const scenarioSelection = scenarioForTask(task, configuredRequiredVideos);
  const { scenario, highRisk } = scenarioSelection;
  const name = creatorGreeting(task.username);
  const product = toEnglishProductName(task.product || filmingRequirements.productName);
  const cleanReferenceLinks = (filmingRequirements.referenceLinks ?? []).map((link) => link.trim()).filter((link) => link && !hasChineseCharacters(link));
  const hasReferenceLinks = cleanReferenceLinks.length > 0;
  const guidelineLine = scenario === 'Partial Video Completion Follow-up'
    ? partialCompletionGuidelinesLine(hasReferenceLinks)
    : scenario === 'Final Follow-up Before Failed Candidate' || scenario === 'Second Follow-up'
      ? ''
      : isGuidelineScenario(scenario)
        ? filmingGuidelinesLine(task, filmingRequirements)
        : '';
  const filmingRequirementsReminder = [guidelineLine, referenceLinksLine(scenario, { ...filmingRequirements, referenceLinks: cleanReferenceLinks })]
    .filter(Boolean)
    .join(' ');
  const progress = progressForTask(task, configuredRequiredVideos);
  const missingVideos = typeof progress.postedCount === 'number' ? Math.max(0, configuredRequiredVideos - progress.postedCount) : null;
  const remainingVideos = remainingVideoPhrase(missingVideos);

  let english = '';

  if (scenario === 'First Outreach') {
    english = firstOutreachMessage(channel, name, product);
  } else if (scenario === 'No Reply Follow-up') {
    english = noReplyFollowUpMessage(channel, name, product);
  } else if (scenario === 'Sample Request Reminder') {
    english = sampleRequestReminderMessage(channel, name, product);
  } else if (scenario === 'Sample Request Confirmation') {
    english = sampleRequestConfirmationMessage(channel, name, product);
  } else if (scenario === 'Sample In Transit Reminder') {
    english = sampleInTransitMessage(channel, name, product, filmingRequirementsReminder);
  } else if (scenario === 'Sample Delivered Follow-up') {
    const request = `Just checking in now that the ${product} sample has been delivered. Please confirm your expected posting date for the first video. ${filmingRequirementsReminder}`;
    english = byChannel(channel, name, request, '', highRisk);
  } else if (scenario === 'Partial Video Completion Follow-up') {
    english = partialCompletionMessage(channel, name, remainingVideos, filmingRequirementsReminder);
  } else if (scenario === 'Needs Revision Reminder') {
    english = needsRevisionMessage(channel, name, product, filmingRequirementsReminder);
  } else if (scenario === 'Completed Thank You') {
    english = completedMessage(channel, name, product);
  } else if (scenario === 'Failed Archive Confirmation') {
    english = failedArchiveMessage(channel, name, product);
  } else if (scenario === 'Second Follow-up' || scenario === 'Final Follow-up Before Failed Candidate') {
    const request = `I’m checking in on the ${product} collaboration. The required video(s) are still incomplete on our side. Please let us know if you’re still able to complete the remaining video(s), and if so, confirm your expected posting date. If you’re no longer able to continue, please let us know so we can update the campaign status on our end.`;
    english = byChannel(channel, name, request, filmingRequirementsReminder, true);
  } else {
    const request = `I’m checking in on the ${product} collaboration. Please send a quick update on the current status so we can keep the campaign status accurate on our side.`;
    english = byChannel(channel, name, request, '', highRisk);
  }

  return {
    english: removeChineseCharacters(english),
    chineseExplanation: buildChineseExplanation(scenario, channel, hasReferenceLinks),
    scenario,
    scenarioReason: scenarioSelection.reason,
  };
}

function firstOutreachMessage(channel: Channel, name: string, product: string): string {
  const request = `We manage TikTok Shop affiliate campaigns for US market products, and we’re reaching out about a potential collaboration for the ${product}. If you’re interested, please let us know and we can share the campaign details, product link, and next steps.`;
  return byChannel(channel, name, request, '', false);
}

function noReplyFollowUpMessage(channel: Channel, name: string, product: string): string {
  const request = `I’m following up on the ${product} collaboration we sent over. Please let us know if you’re interested, or if this campaign is not a fit right now.`;
  return byChannel(channel, name, request, '', false);
}

function sampleRequestReminderMessage(channel: Channel, name: string, product: string): string {
  const request = `The sample invitation for the ${product} campaign is available. If you’re still interested in moving forward, please apply for the sample so we can keep the campaign timeline moving.`;
  return byChannel(channel, name, request, '', false);
}

function sampleRequestConfirmationMessage(channel: Channel, name: string, product: string): string {
  const request = `We received your sample request for the ${product} campaign, and it is being reviewed or processed on our side. Once the sample is approved and shipped, we’ll use the shipping update to confirm the next step.`;
  return byChannel(channel, name, request, '', false);
}

function sampleInTransitMessage(channel: Channel, name: string, product: string, filmingRequirementsReminder: string): string {
  const reminder = filmingRequirementsReminder.trim();

  if (channel === 'TikTok DM') {
    return `Hi ${name}, the ${product} sample has shipped and is on the way. The sample is on the way, so please keep an eye on delivery updates. No posting is needed before the sample is delivered. Once it arrives, please plan filming based on the guidelines and attach the TikTok Shop product link. Could you confirm when you expect to start filming after receiving it? ${reminder}`.replace(/\s+/g, ' ').trim();
  }

  if (channel === 'TikTok Shop Affiliate Message') {
    return `Hi ${name},

The sample for the ${product} collaboration has been shipped and is currently on the way. The sample is on the way, so please keep an eye on the delivery updates.

Once it arrives, please plan the content based on the filming guidelines we shared and make sure the TikTok Shop product link is attached. No posting is needed before the sample is delivered. ${reminder}

Could you please confirm when you expect to start filming after receiving the sample?

Thank you.`;
  }

  if (channel === 'WhatsApp') {
    return `Hi ${name}, the ${product} sample has been shipped and is currently on the way. Please keep an eye on delivery updates. Once it arrives, please plan filming based on the guidelines and attach the TikTok Shop product link. Could you confirm when you expect to start filming after receiving it? ${reminder}`.replace(/\s+/g, ' ').trim();
  }

  return `Hi ${name},

The sample for the ${product} collaboration has been shipped and is currently on the way. The sample is on the way, so please keep an eye on the delivery updates so you know when it arrives.

After delivery, please plan the content based on the filming guidelines we shared and make sure the TikTok Shop product link is attached. ${reminder}

Could you please confirm when you expect to start filming after receiving the sample?

Thank you.`;
}

function needsRevisionMessage(channel: Channel, name: string, product: string, filmingRequirementsReminder: string): string {
  const request = `We reviewed the ${product} video and need one adjustment before we can move it forward for campaign review. Please check the product link, tag, and brief requirements, then update the specific item that does not match the filming guidelines.`;
  return byChannel(channel, name, request, filmingRequirementsReminder, false);
}

function completedMessage(channel: Channel, name: string, product: string): string {
  const request = `Thank you for completing the ${product} collaboration. We’ll review performance on our side and consider the content for ad testing or future campaign opportunities. If you’re open to future products, we’ll keep you in mind for the next suitable campaign.`;
  return byChannel(channel, name, request, '', false);
}

function failedArchiveMessage(channel: Channel, name: string, product: string): string {
  const request = `We’re updating the campaign status for the ${product} collaboration on our side. Based on the current status, we’ll archive this campaign as not completed unless there is a final update we should review.`;
  return byChannel(channel, name, request, '', false);
}

function partialCompletionMessage(channel: Channel, name: string, remainingVideos: string, filmingRequirementsReminder: string): string {
  const partialReferenceLinks = filmingRequirementsReminder.includes('You can also use these reference videos')
    ? ` ${filmingRequirementsReminder.slice(filmingRequirementsReminder.indexOf('You can also use these reference videos'))}`
    : '';
  const acknowledgement = 'Thank you for posting the first video — the content looks good, and we’re preparing to review it for ad testing.';
  const pending = `There is still ${remainingVideos} pending for this collaboration.`;
  const confirmQuestion = 'Could you please confirm when you expect to post the remaining video?';

  if (channel === 'TikTok DM') {
    return `Hi ${name}, thanks for posting the first video — it looks good, and we’re preparing to review it for ad testing. There is still ${remainingVideos} pending. Could you confirm when you expect to post it? Please keep following the filming guidelines and attach the product link.${partialReferenceLinks}`;
  }

  if (channel === 'TikTok Shop Affiliate Message') {
    return `Hi ${name},

${acknowledgement}

${pending} ${filmingRequirementsReminder}

${confirmQuestion}

Thank you.`;
  }

  if (channel === 'WhatsApp') {
    return `Hi ${name}, ${acknowledgement} ${pending} Could you confirm when you expect to post the remaining video? Please keep following the filming guidelines and attach the product link.${partialReferenceLinks}`;
  }

  return `Hi ${name},

${acknowledgement}

${pending} ${filmingRequirementsReminder}

Please confirm the expected posting date for the remaining video so we can keep the collaboration timeline clear.

Thank you,
Brand Team`;
}

function byChannel(channel: Channel, name: string, request: string, filmingRequirementsReminder: string, highRisk: boolean): string {
  const cleanReminder = filmingRequirementsReminder.trim();

  if (channel === 'TikTok DM') {
    const sentences = highRisk ? request.split('. ').slice(0, 4) : request.split('. ').slice(0, 3);
    return `Hi ${name}, ${sentences.join('. ')}. ${cleanReminder}`.replace(/\s+/g, ' ').replace('..', '.').trim();
  }

  if (channel === 'TikTok Shop Affiliate Message') {
    const closing = highRisk ? 'Thank you.' : 'This helps us keep the collaboration timeline clear.';
    return `Hi ${name}, ${request} ${cleanReminder} ${closing}`.replace(/\s+/g, ' ').trim();
  }

  if (channel === 'WhatsApp') {
    const closing = highRisk ? 'Thank you.' : 'A quick update is fine so we can keep the collaboration timeline clear.';
    return `Hi ${name}, ${request} ${cleanReminder || closing}`.replace(/\s+/g, ' ').trim();
  }

  return `Hi ${name},

${request}

${cleanReminder ? `${cleanReminder}

` : ''}${highRisk ? 'Thank you.' : 'This helps us keep the collaboration timeline clear and make sure the content matches the campaign guidelines.'}

Best,
Brand Team`;
}

function buildChineseExplanation(scenario: string, channel: Channel, hasReferenceLinks: boolean): string {
  const channelNote: Record<Channel, string> = {
    'TikTok DM': 'TikTok DM 版本更短、更自然，适合快速提醒，不会显得强势。',
    'TikTok Shop Affiliate Message': 'TikTok Shop 达人联盟消息更完整，明确说明合作背景和下一步动作。',
    Email: '邮件版本结构更正式，包含问候、背景、请求、下一步和结尾。',
    WhatsApp: 'WhatsApp 版本保持聊天感，但比 DM 稍微更详细，方便对方快速回复。',
  };

  const scenarioNotes: Record<string, string> = {
    'First Outreach': '首次建联，重点是清楚介绍合作并确认达人是否有兴趣。',
    'No Reply Follow-up': '建联后未回复跟进，重点是短句确认是否有兴趣，不施压。',
    'Sample Request Reminder': '提醒达人申请样品，重点是让达人完成样品申请动作。',
    'Sample Request Confirmation': '样品申请后确认，重点是说明申请已收到或正在处理。',
    'Sample In Transit Reminder': '样品运输中提醒，重点是提醒达人关注物流，到货后再开始拍摄。',
    'Sample Delivered Follow-up': '样品到货后催拍，重点是确认发布时间，并轻量提醒拍摄要求、产品链接和 tag。',
    'Partial Video Completion Follow-up': '已发布部分视频，跟进剩余视频，先认可已发布内容，再确认剩余视频发布时间。',
    'Needs Revision Reminder': '视频修改提醒，重点是清楚说明需要调整，不情绪化。',
    'Completed Thank You': '合作完成感谢 / 后续合作，重点是感谢并说明后续 performance review 或 ad testing。',
    'Failed Archive Confirmation': '合作失败归档，默认不催促，只做 campaign status 更新确认。',
    'Final Follow-up Before Failed Candidate': '合作失败风险前的最后跟进，重点是让达人明确是否还能完成合作。',
    'Second Follow-up': '第二次跟进，重点是再次确认进度和明确发布时间。',
    'Light Follow-up': '轻量跟进，适合未命中特定阶段时确认当前合作进展。',
  };

  const referenceLinksNote = hasReferenceLinks
    ? ' 参考视频链接用于给达人参考拍摄模板、内容灵感或后续视频优化方向，并最多放入 3 条。'
    : '';

  return `这条消息用于「${scenarioNotes[scenario] ?? scenario}」场景。语气保持专业、冷静、直接，符合美国本地 TikTok Shop affiliate campaign management 的沟通方式。${channelNote[channel]}${referenceLinksNote}`;
}

function removeChineseCharacters(value: string): string {
  return value.replace(/[\u3400-\u9fff]/g, '').replace(/\s+([,.!?;:])/g, '$1').trim();
}
