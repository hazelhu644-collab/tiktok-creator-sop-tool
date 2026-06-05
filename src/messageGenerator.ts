import type { Channel, GeneratedMessage, Task } from './types';

export const CHANNELS: Channel[] = ['TikTok DM', 'TikTok Shop Affiliate Message', 'Email', 'WhatsApp'];

export const steamGroomingBrushBrief = {
  productName: '蒸汽梳毛器',
  requirements: [
    '每位达人 2 条视频',
    '每条视频 60 秒以上',
    '必须 tag 品牌账号',
    '必须挂 TikTok Shop 产品链接',
  ],
  priorities: ['Loose hair removed', 'Mist feature', 'Pet’s real reaction', 'Natural daily pet-care scene', 'Easy cleanup'],
};

function scenarioForTask(task: Task): string {
  if (task.failedWarnings.length > 0) return 'Final Follow-up Before Failed Candidate';
  if (task.priority === 'Highest') return 'Sample Delivered Follow-up';
  if (task.priority === 'High') return 'Second Video Reminder';
  if (task.priority === 'Medium') return 'Second Follow-up';
  return 'Light Follow-up';
}

function briefLine(task: Task): string {
  if (!task.product.toLowerCase().includes('steam grooming brush')) return '';
  return 'Please make sure the video clearly shows the mist feature, the loose hair removed, your pet’s real reaction, and the TikTok Shop product link.';
}

export function generateMessage(task: Task, channel: Channel): GeneratedMessage {
  const scenario = scenarioForTask(task);
  const name = task.username.startsWith('@') ? task.username : `@${task.username}`;
  const product = task.product || 'the product';
  const brief = briefLine(task);

  let english = '';

  if (scenario === 'Sample Delivered Follow-up') {
    const request = `Just checking in now that the ${product} sample has been delivered. When you film, please focus on the main usage shots from the brief: loose hair removed, the mist feature, your pet’s real reaction, and easy cleanup. Please let us know your expected posting date for the first video.`;
    english = byChannel(channel, name, request, brief);
  } else if (scenario === 'Second Video Reminder') {
    const request = `Thanks for posting the first video for ${product}. Since this collaboration includes 2 videos, could you let us know when you plan to post the second one? ${brief || 'Please keep the second video aligned with the original brief and add the product link.'}`;
    english = byChannel(channel, name, request, brief);
  } else if (scenario === 'Second Follow-up') {
    const request = `Just following up again on ${product}. Could you send us a quick update on whether you are still moving forward and your expected timeline? If anything is blocking filming or posting, please let us know so we can plan the next step.`;
    english = byChannel(channel, name, request, brief);
  } else if (scenario === 'Final Follow-up Before Failed Candidate') {
    const request = `We wanted to check in one final time about the ${product} collaboration. Please let us know if you are still able to move forward and share a clear posting timeline. If you are no longer able to continue, please tell us so we can update the campaign status on our side.`;
    english = byChannel(channel, name, request, brief);
  } else {
    const request = `Just checking in to see if you are interested in moving forward with the ${product} collaboration. If it sounds like a fit, please let us know and we can confirm the next step.`;
    english = byChannel(channel, name, request, brief);
  }

  return {
    english,
    chineseExplanation: buildChineseExplanation(scenario, channel),
    scenario,
  };
}

function byChannel(channel: Channel, name: string, request: string, brief: string): string {
  if (channel === 'TikTok DM') {
    return `Hi ${name}, ${request.split('. ').slice(0, 2).join('. ')}.`.replace('..', '.');
  }

  if (channel === 'TikTok Shop Affiliate Message') {
    return `Hi ${name}, ${request} ${brief ? 'This helps viewers understand the product clearly and keeps the content aligned with the campaign brief.' : 'This helps us keep the collaboration timeline clear.'}`.trim();
  }

  if (channel === 'WhatsApp') {
    return `Hi ${name}, ${request} A quick update is totally fine — we just want to keep the collaboration timeline clear.`;
  }

  return `Hi ${name},\n\n${request}\n\nThis helps us keep the collaboration timeline clear and make sure the content matches the campaign requirements.\n\nBest,\nBrand Team`;
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
