import { normalizeVideoProgress, parseRequiredVideos } from './sopRules';
import type { Channel, GeneratedMessage, Task } from './types';

export const CHANNELS: Channel[] = ['TikTok DM', 'TikTok Shop Affiliate Message', 'Email', 'WhatsApp'];

export type CreatorFilmingRequirements = {
  productName: string;
  requirements: string[];
  keyContentPoints: string[];
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
};

function scenarioForTask(task: Task): string {
  if (task.failedWarnings.length > 0) return 'Final Follow-up Before Failed Candidate';
  if (task.priority === 'Highest') return 'Sample Delivered Follow-up';
  if (task.priority === 'High') return 'Second Video Reminder';
  if (task.priority === 'Medium') return 'Second Follow-up';
  return 'Light Follow-up';
}

function matchesFilmingRequirementsProduct(task: Task, filmingRequirements: CreatorFilmingRequirements): boolean {
  const taskProduct = task.product.trim().toLowerCase();
  const requirementProduct = filmingRequirements.productName.trim().toLowerCase();

  if (!taskProduct || !requirementProduct) return false;
  return taskProduct.includes(requirementProduct) || requirementProduct.includes(taskProduct);
}

function toEnglishContentPoint(point: string): string {
  const translationMap: Record<string, string> = {
    展示雾化功能: 'the mist feature',
    展示梳下来的浮毛: 'the loose hair removed',
    展示宠物真实反应: "your pet’s real reaction",
    展示自然的日常宠物护理场景: 'a natural daily pet-care scene',
    展示清理过程: 'the cleanup process',
  };

  return translationMap[point] ?? point;
}

function joinEnglishList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function filmingRequirementsLine(task: Task, filmingRequirements: CreatorFilmingRequirements): string {
  if (!matchesFilmingRequirementsProduct(task, filmingRequirements)) return '';

  const keyContentPoints = filmingRequirements.keyContentPoints.map(toEnglishContentPoint).filter(Boolean);
  const requirements = filmingRequirements.requirements.filter(Boolean);
  const contentPointText = joinEnglishList(keyContentPoints);
  const requirementsText = requirements.length > 0 ? ` Requirements: ${requirements.join('; ')}.` : '';

  if (!contentPointText && !requirementsText) return '';
  return `Please follow the current creator filming requirements (达人拍摄要求)${contentPointText ? ` and clearly show ${contentPointText}` : ''}.${requirementsText}`;
}

export function generateMessage(
  task: Task,
  channel: Channel,
  filmingRequirements: CreatorFilmingRequirements = defaultCreatorFilmingRequirements,
): GeneratedMessage {
  const scenario = scenarioForTask(task);
  const name = task.username.startsWith('@') ? task.username : `@${task.username}`;
  const product = task.product || 'the product';
  const filmingRequirementsReminder = filmingRequirementsLine(task, filmingRequirements);
  const keyContentPointText = joinEnglishList(filmingRequirements.keyContentPoints.map(toEnglishContentPoint).filter(Boolean));
  const requiredVideos = parseRequiredVideos(filmingRequirements);
  const progress = normalizeVideoProgress(task.videoProgress, requiredVideos);
  const missingVideos = typeof progress.postedCount === 'number' ? Math.max(0, requiredVideos - progress.postedCount) : null;

  let english = '';

  if (scenario === 'Sample Delivered Follow-up') {
    const request = `Just checking in now that the ${product} sample has been delivered. When you film, please focus on the main usage shots from the creator filming requirements (达人拍摄要求)${keyContentPointText ? `: ${keyContentPointText}` : ''}. Please let us know your expected posting date for the first video.`;
    english = byChannel(channel, name, request, filmingRequirementsReminder);
  } else if (scenario === 'Second Video Reminder') {
    const request = `Thanks for posting ${progress.postedCount ?? 'part of'} ${typeof progress.postedCount === 'number' && progress.postedCount === 1 ? 'video' : 'videos'} for ${product}. Since this collaboration includes ${requiredVideos} ${requiredVideos === 1 ? 'video' : 'videos'}${missingVideos !== null && missingVideos > 0 ? ` and ${missingVideos} ${missingVideos === 1 ? 'video is' : 'videos are'} still missing` : ''}, could you let us know when you plan to post the remaining content? ${filmingRequirementsReminder || 'Please keep the remaining video content aligned with the current creator filming requirements (达人拍摄要求) and add the product link.'}`;
    english = byChannel(channel, name, request, filmingRequirementsReminder);
  } else if (scenario === 'Second Follow-up') {
    const request = `Just following up again on ${product}. Could you send us a quick update on whether you are still moving forward and your expected timeline? If anything is blocking filming or posting, please let us know so we can plan the next step.`;
    english = byChannel(channel, name, request, filmingRequirementsReminder);
  } else if (scenario === 'Final Follow-up Before Failed Candidate') {
    const request = `We wanted to check in one final time about the ${product} collaboration. Please let us know if you are still able to move forward and share a clear posting timeline. If you are no longer able to continue, please tell us so we can update the campaign status on our side.`;
    english = byChannel(channel, name, request, filmingRequirementsReminder);
  } else {
    const request = `Just checking in to see if you are interested in moving forward with the ${product} collaboration. If it sounds like a fit, please let us know and we can confirm the next step.`;
    english = byChannel(channel, name, request, filmingRequirementsReminder);
  }

  return {
    english,
    chineseExplanation: buildChineseExplanation(scenario, channel),
    scenario,
  };
}

function byChannel(channel: Channel, name: string, request: string, filmingRequirementsReminder: string): string {
  if (channel === 'TikTok DM') {
    return `Hi ${name}, ${request.split('. ').slice(0, 2).join('. ')}. ${filmingRequirementsReminder}`.replace('..', '.').trim();
  }

  if (channel === 'TikTok Shop Affiliate Message') {
    return `Hi ${name}, ${request} ${filmingRequirementsReminder ? 'This helps viewers understand the product clearly and keeps the content aligned with the current creator filming requirements (达人拍摄要求).' : 'This helps us keep the collaboration timeline clear.'}`.trim();
  }

  if (channel === 'WhatsApp') {
    return `Hi ${name}, ${request} ${filmingRequirementsReminder || 'A quick update is totally fine — we just want to keep the collaboration timeline clear.'}`.trim();
  }

  return `Hi ${name},\n\n${request}\n\n${filmingRequirementsReminder || 'This helps us keep the collaboration timeline clear and make sure the content matches the campaign requirements.'}\n\nBest,\nBrand Team`;
}

function buildChineseExplanation(scenario: string, channel: Channel): string {
  const channelNote: Record<Channel, string> = {
    'TikTok DM': 'TikTok DM 版本更短、更自然，适合快速提醒，不会显得强势。',
    'TikTok Shop Affiliate Message': 'TikTok Shop 达人联盟消息更完整，明确说明合作背景和下一步动作。',
    Email: '邮件版本结构更正式，包含问候、背景、请求、下一步和结尾。',
    WhatsApp: 'WhatsApp 版本保持聊天感，但比 DM 稍微更详细，方便对方快速回复。',
  };

  return `这条消息用于「${scenario}」场景。语气保持专业、温和、直接，不使用过度恭维或请求式表达。${channelNote[channel]} 文案重点是让达人明确下一步：回复状态、确认发布时间，或说明是否无法继续合作。`;
}
