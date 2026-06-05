export type Priority = 'Highest' | 'High' | 'Medium' | 'Low' | 'None';

export type Channel =
  | 'TikTok DM'
  | 'TikTok Shop Affiliate Message'
  | 'Email'
  | 'WhatsApp';

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
  firstVideoPostedDate: string;
  lastContactDate: string;
  lastFollowUpCount: number;
  notes: string;
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
