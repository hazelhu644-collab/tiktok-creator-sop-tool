import type { Channel, CreatorFilmingRequirements, GeneratedMessage, Task } from './types';

export const CHANNELS: Channel[] = ['TikTok DM', 'TikTok Shop Affiliate Message', 'Email', 'WhatsApp'];

function scenarioForTask(task: Task): string {
  if (task.failedWarnings.length > 0) return 'Final Follow-up Before Failed Candidate';
  if (task.priority === 'Highest') return 'Sample Delivered Follow-up';
  if (task.priority === 'High') return 'Second Video Reminder';
  if (task.priority === 'Medium') return 'Second Follow-up';
  return 'Light Follow-up';
}

function requirementsText(requirements: CreatorFilmingRequirements): string {
  const parts = [
    `${requirements.videoCount} videos total`,
    requirements.videoDurationRequirement,
    requirements.brandTagRequirement,
    requirements.productLinkRequirement,
  ];
  return parts.filter(Boolean).join(', ');
}

function contentPointsText(requirements: CreatorFilmingRequirements): string {
  return requirements.keyContentPoints.filter(Boolean).join(', ');
}

function filmingRequirementsLine(requirements: CreatorFilmingRequirements): string {
  const contentPoints = contentPointsText(requirements);
  const requirementsSummary = requirementsText(requirements);

  if (!contentPoints) return `Please keep the content aligned with the filming requirements: ${requirementsSummary}.`;
  return `Please keep the content aligned with the filming requirements: ${requirementsSummary}. Main filming priorities: ${contentPoints}.`;
}

export function generateMessage(task: Task, channel: Channel, requirements: CreatorFilmingRequirements): GeneratedMessage {
  const scenario = scenarioForTask(task);
  const name = task.username.startsWith('@') ? task.username : `@${task.username}`;
  const product = task.product || requirements.productName || 'the product';
  const filmingLine = filmingRequirementsLine(requirements);
  const videoCount = requirements.videoCount || 2;

  let english = '';

  if (scenario === 'Sample Delivered Follow-up') {
    const request = `Just checking in now that the ${product} sample has been delivered. When you film, ${filmingLine} Please let us know your expected posting date for the first video.`;
    english = byChannel(channel, name, request, filmingLine);
  } else if (scenario === 'Second Video Reminder') {
    const request = `Thanks for posting the first video for ${product}. Since this collaboration includes ${videoCount} videos, could you let us know when you plan to post the next one? ${filmingLine}`;
    english = byChannel(channel, name, request, filmingLine);
  } else if (scenario === 'Second Follow-up') {
    const request = `Just following up again on ${product}. Could you send us a quick update on whether you are still moving forward and your expected timeline? ${filmingLine}`;
    english = byChannel(channel, name, request, filmingLine);
  } else if (scenario === 'Final Follow-up Before Failed Candidate') {
    const request = `We wanted to check in one final time about the ${product} collaboration. Please let us know if you are still able to move forward and share a clear posting timeline. If you are no longer able to continue, please tell us so we can update the campaign status on our side.`;
    english = byChannel(channel, name, request, filmingLine);
  } else {
    const request = `Just checking in to see if you are interested in moving forward with the ${product} collaboration. If it sounds like a fit, please let us know and we can confirm the next step. ${filmingLine}`;
    english = byChannel(channel, name, request, filmingLine);
  }

  return {
    english,
    chineseExplanation: buildChineseExplanation(scenario, channel, requirements),
    scenario,
  };
}

function byChannel(channel: Channel, name: string, request: string, filmingLine: string): string {
  if (channel === 'TikTok DM') {
    return `Hi ${name}, ${request.split('. ').slice(0, 2).join('. ')}.`.replace('..', '.');
  }

  if (channel === 'TikTok Shop Affiliate Message') {
    return `Hi ${name}, ${request} ${filmingLine ? 'This helps viewers understand the product clearly and keeps the content aligned with the campaign requirements.' : 'This helps us keep the collaboration timeline clear.'}`.trim();
  }

  if (channel === 'WhatsApp') {
    return `Hi ${name}, ${request} A quick update is totally fine — we just want to keep the collaboration timeline clear.`;
  }

  return `Hi ${name},\n\n${request}\n\nThis helps us keep the collaboration timeline clear and make sure the content matches the campaign requirements.\n\nBest,\nBrand Team`;
}

function buildChineseExplanation(scenario: string, channel: Channel, requirements: CreatorFilmingRequirements): string {
  const channelNote: Record<Channel, string> = {
    'TikTok DM': 'TikTok DM 版本更短、更自然，适合快速提醒，不会显得强势。',
    'TikTok Shop Affiliate Message': 'TikTok Shop 达人联盟消息更完整，明确说明合作背景和下一步动作。',
    Email: '邮件版本结构更正式，包含问候、背景、请求、下一步和结尾。',
    WhatsApp: 'WhatsApp 版本保持聊天感，但比 DM 稍微更详细，方便对方快速回复。',
  };

  return `这条消息用于「${scenario}」场景。语气保持专业、温和、直接，不使用过度恭维或请求式表达。${channelNote[channel]} 文案重点是让达人明确下一步：回复状态、确认发布时间，或说明是否无法继续合作。当前话术会使用「${requirements.productName}」的达人拍摄要求。`;
}
