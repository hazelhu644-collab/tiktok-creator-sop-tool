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

function hasChineseCharacters(value: string): boolean {
  return chineseCharacterPattern.test(value);
}

function scenarioForTask(task: Task): string {
  if (task.failedWarnings.length > 0) return 'Final Follow-up Before Failed Candidate';
  if (task.priority === 'Highest') return 'Sample Delivered Follow-up';
  if (task.priority === 'High') return 'Second Video Reminder';
  if (task.priority === 'Medium') return 'Second Follow-up';
  return 'Light Follow-up';
}

function isHighRiskScenario(scenario: string): boolean {
  return scenario === 'Final Follow-up Before Failed Candidate' || scenario === 'Second Follow-up';
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

function referenceLinksLine(scenario: string, filmingRequirements: CreatorFilmingRequirements): string {
  const referenceLinks = (filmingRequirements.referenceLinks ?? []).map((link) => link.trim()).filter(Boolean).slice(0, 3);
  if (referenceLinks.length === 0) return '';

  const linksText = referenceLinks.join('; ');

  if (isHighRiskScenario(scenario)) {
    return `You can use the reference links as direction for the remaining video(s): ${linksText}.`;
  }

  return `Here are a few reference videos you can use for filming direction: ${linksText}.`;
}

function filmingGuidelinesLine(task: Task, filmingRequirements: CreatorFilmingRequirements): string {
  if (!matchesFilmingRequirementsProduct(task, filmingRequirements)) return '';

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

export function generateMessage(
  task: Task,
  channel: Channel,
  filmingRequirements: CreatorFilmingRequirements = defaultCreatorFilmingRequirements,
): GeneratedMessage {
  const scenario = scenarioForTask(task);
  const name = task.username.startsWith('@') ? task.username : `@${task.username}`;
  const product = toEnglishProductName(task.product || filmingRequirements.productName);
  const highRisk = isHighRiskScenario(scenario);
  const filmingRequirementsReminder = [
    highRisk ? '' : filmingGuidelinesLine(task, filmingRequirements),
    referenceLinksLine(scenario, filmingRequirements),
  ].filter(Boolean).join(' ');
  const requiredVideos = parseRequiredVideos(filmingRequirements);
  const progress = normalizeVideoProgress(task.videoProgress, requiredVideos);
  const missingVideos = typeof progress.postedCount === 'number' ? Math.max(0, requiredVideos - progress.postedCount) : null;

  let english = '';

  if (scenario === 'Sample Delivered Follow-up') {
    const request = `Just checking in now that the ${product} sample has been delivered. Please follow the filming guidelines we shared and let us know your expected posting date for the first video.`;
    english = byChannel(channel, name, request, filmingRequirementsReminder, highRisk);
  } else if (scenario === 'Second Video Reminder') {
    const request = `Thanks for posting ${progress.postedCount ?? 'part of the'} ${typeof progress.postedCount === 'number' && progress.postedCount === 1 ? 'video' : 'videos'} for ${product}. The collaboration still has ${missingVideos !== null && missingVideos > 0 ? `${missingVideos} ${missingVideos === 1 ? 'video' : 'videos'}` : 'remaining video(s)'} incomplete; please confirm when you plan to post the remaining content.`;
    english = byChannel(channel, name, request, filmingRequirementsReminder, highRisk);
  } else if (scenario === 'Second Follow-up') {
    const request = `I’m checking in on the ${product} collaboration. The required video(s) are still incomplete on our side. Please let us know if you’re still able to complete the remaining video(s), and if so, confirm your expected posting date. If you’re no longer able to continue, please let us know so we can update the campaign status on our end.`;
    english = byChannel(channel, name, request, filmingRequirementsReminder, highRisk);
  } else if (scenario === 'Final Follow-up Before Failed Candidate') {
    const request = `I’m checking in on the ${product} collaboration. The required video(s) are still incomplete on our side. Please let us know if you’re still able to complete the remaining video(s), and if so, confirm your expected posting date. If you’re no longer able to continue, please let us know so we can update the campaign status on our end.`;
    english = byChannel(channel, name, request, filmingRequirementsReminder, highRisk);
  } else {
    const request = `Just checking in to see if you are interested in moving forward with the ${product} collaboration. If it sounds like a fit, please let us know and we can confirm the next step.`;
    english = byChannel(channel, name, request, filmingRequirementsReminder, highRisk);
  }

  return {
    english,
    chineseExplanation: buildChineseExplanation(scenario, channel, (filmingRequirements.referenceLinks ?? []).filter(Boolean).length > 0),
    scenario,
  };
}

function byChannel(channel: Channel, name: string, request: string, filmingRequirementsReminder: string, highRisk: boolean): string {
  if (channel === 'TikTok DM') {
    const sentences = highRisk ? request.split('. ').slice(0, 4) : request.split('. ').slice(0, 2);
    return `Hi ${name}, ${sentences.join('. ')}. ${filmingRequirementsReminder}`.replace(/\s+/g, ' ').replace('..', '.').trim();
  }

  if (channel === 'TikTok Shop Affiliate Message') {
    const closing = highRisk
      ? 'Thank you.'
      : filmingRequirementsReminder ? 'This keeps the content aligned and easy for viewers to understand.' : 'This helps us keep the collaboration timeline clear.';
    return `Hi ${name}, ${request} ${filmingRequirementsReminder} ${closing}`.replace(/\s+/g, ' ').trim();
  }

  if (channel === 'WhatsApp') {
    const closing = highRisk ? 'Thank you.' : 'A quick update is fine so we can keep the collaboration timeline clear.';
    return `Hi ${name}, ${request} ${filmingRequirementsReminder || closing}`.replace(/\s+/g, ' ').trim();
  }

  const emailClosing = highRisk
    ? 'Thank you.'
    : filmingRequirementsReminder || 'This helps us keep the collaboration timeline clear and make sure the content matches the campaign guidelines.';

  return `Hi ${name},

${request}

${filmingRequirementsReminder ? `${filmingRequirementsReminder}

` : ''}${emailClosing}

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

  const referenceLinksNote = hasReferenceLinks
    ? ' 参考视频链接用于给达人参考拍摄模板、内容灵感或后续视频优化方向。'
    : '';

  return `这条消息用于「${scenario}」场景。语气保持专业、冷静、直接，不使用过度兴奋、道歉或施压式表达。${channelNote[channel]} 文案重点是让达人明确下一步：确认是否还能完成合作、给出发布时间，或说明是否无法继续，以便我们更新 campaign 状态。${referenceLinksNote}`;
}
