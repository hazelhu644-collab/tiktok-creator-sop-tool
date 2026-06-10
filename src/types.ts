export type Priority = 'Highest' | 'High' | 'Medium' | 'Low' | 'None';

export type Channel =
  | 'TikTok DM'
  | 'TikTok Shop Affiliate Message'
  | 'Email'
  | 'WhatsApp';

export type VideoProgressNormalization = {
  normalized: string;
  warning?: string;
  postedCount?: number;
  requiredVideos?: number;
  isOverRequired?: boolean;
};

export type FollowUpHistoryEntry = {
  date: string;
  action: 'Message Sent' | 'Creator Replied' | 'Completed' | 'Failed';
  channel?: Channel | string;
  scenario?: string;
  message?: string;
  note?: string;
};

export type TrackingStatus = 'Followed Up' | 'Replied' | 'Reply Pending' | 'Completed' | 'Failed' | '';

export type CreatorRow = {
  id: string;
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
  lastContactDate: string;
  lastFollowUpCount: number;
  notes: string;
  trackingStatus?: TrackingStatus | string;
  lastMessageScenario?: string;
  lastMessageChannel?: Channel | string;
  lastMessageSentAt?: string;
  nextFollowUpDate?: string;
  lastCreatorResponse?: string;
  followUpHistory?: FollowUpHistoryEntry[];
};

export type Task = CreatorRow & {
  priority: Priority;
  priorityRank: number;
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

export type UrgencyLevel = '极高' | '高' | '中' | '低' | '归档';

export type CommunicationAction =
  | '未合作邀约'
  | '样品运输中建联'
  | '物流异常确认'
  | '样品到货催拍'
  | '剩余视频履约'
  | '视频修改'
  | '最后确认'
  | '回复达人消息'
  | '合作完成维护'
  | '合作失败归档';

export type GeneratedMessage = {
  english: string;
  chineseExplanation: string;
  scenario: string;
  scenarioReason: string;
  urgencyLevel: UrgencyLevel;
  communicationAction: CommunicationAction;
};


export type Campaign = {
  id: string;
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
};
