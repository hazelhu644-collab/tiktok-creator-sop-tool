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

export type GeneratedMessage = {
  english: string;
  chineseExplanation: string;
  scenario: string;
};
