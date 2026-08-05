import type { RefObject } from "react";
import type { Channel } from "../../types";
import type { MessageComposerProps } from "../messaging/messageComposerTypes";

export type WorkbenchFilterKey =
  | "follow_up_today"
  | "processed_today"
  | "delivered_waiting_video"
  | "published_video"
  | "posted_this_week"
  | "completed"
  | "failed"
  | "sample_shipped";

export type DashboardUrgency = "All" | "Highest" | "High" | "Medium" | "Low";

export type DashboardCampaignCardView = {
  value: string;
  label: string;
  ariaLabel: string;
  creatorCount: number;
  activeCount: number;
  todayFollowUp: number;
  highPriority: number;
  inTransit: number;
  deliveredPending: number;
  postedVideos: number;
  completed: number;
  failed: number;
};

export type DashboardMetricCardView = {
  label: string;
  value: number;
  filterKey: WorkbenchFilterKey;
};

export type DashboardQueueItemView = {
  id: string;
  creatorHandle: string;
  priorityLabel: string;
  statusLabel: string;
  multiSample: boolean;
  subLine: string;
};

export type DashboardDetailEntry = {
  label: string;
  value: string;
};

export type DashboardCreatorView = {
  id: string;
  displayName: string;
  storeName: string;
  productName: string;
  statusLabel: string;
  priorityLabel: string;
  triggerReason: string;
  suggestedAction: string;
  trackingStatus: string;
  notes: string;
  crossStoreCreator: boolean;
  otherActiveSampleCount: number;
  filmingRequirements: DashboardDetailEntry[];
  moreInfo: DashboardDetailEntry[];
};

export type DashboardData = {
  campaignCards: DashboardCampaignCardView[];
  metricCards: DashboardMetricCardView[];
  selectedCampaignName: string;
  workbenchFilterLabel: string;
  highestPendingCount: number;
  queueItems: DashboardQueueItemView[];
  selectedCreator: DashboardCreatorView | null;
  hasNextTask: boolean;
  channelOptions: Channel[];
  messageComposerProps: MessageComposerProps | null;
};

export type DashboardUiState = {
  onlyCurrentCreator: boolean;
  queueExpanded: boolean;
  followupSearch: string;
  creatorSearchStatus: string;
  showArchivedCollaborations: boolean;
  urgency: DashboardUrgency;
  showProcessedToday: boolean;
  selectedCreatorId: string;
  channel: Channel;
  historicalReadOnly: boolean;
  queueRef: RefObject<HTMLElement | null>;
  currentCreatorRef: RefObject<HTMLDivElement | null>;
};

export type DashboardActions = {
  openCreatorDatabase: () => void;
  selectCampaignCard: (value: string) => void;
  selectMetricCard: (card: DashboardMetricCardView) => void;
  toggleOnlyCurrentCreator: () => void;
  clearWorkbenchFilter: () => void;
  toggleQueue: () => void;
  setFollowupSearch: (value: string) => void;
  locateCreator: () => void;
  setShowArchivedCollaborations: (value: boolean) => void;
  setUrgency: (value: DashboardUrgency) => void;
  setShowProcessedToday: (value: boolean) => void;
  selectCreator: (creatorId: string) => void;
  setChannel: (channel: Channel) => void;
  generateMessage: () => void;
  processNextCreator: () => void;
  showOtherSamples: () => void;
  showMultiSampleReminder: () => void;
};

export type DashboardPageProps = {
  data: DashboardData;
  uiState: DashboardUiState;
  actions: DashboardActions;
};
