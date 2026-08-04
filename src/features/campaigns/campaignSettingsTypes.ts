import type { Campaign, Store } from "../../types";

export type CampaignSettingsOption = {
  value: string;
  label: string;
};

export type CampaignSettingsTargetView = {
  campaign: Campaign;
  selectValue: string;
  storeId: string;
  keyContentPointsText: string;
  productLinkRequirementText: string;
  referenceLinksText: string;
};

export type CampaignStoreCleanupView = {
  id: string;
  name: string;
  canHide: boolean;
};

export type CampaignSettingsData = {
  target: CampaignSettingsTargetView | null;
  campaignOptions: CampaignSettingsOption[];
  storeOptions: Store[];
  storeCleanupItems: CampaignStoreCleanupView[];
};

export type CampaignSettingsUiState = {
  showArchivedProducts: boolean;
};

export type CampaignSettingsActions = {
  selectCampaign: (value: string) => void;
  setShowArchivedProducts: (value: boolean) => void;
  createCampaign: () => void;
  announceEditable: () => void;
  duplicateCampaign: () => void;
  archiveCampaign: () => void;
  restoreCampaign: () => void;
  deleteCampaign: () => void;
  assignStore: (storeId: string) => void;
  renameProduct: (productName: string) => void;
  updateKeyContentPoints: (value: string) => void;
  updateSellingPoints: (value: string) => void;
  updateVideoLength: (value: string) => void;
  updateVideoCount: (value: string) => void;
  syncVideoCount: () => void;
  updateAvoidShots: (value: string) => void;
  updateProductLinkRequirement: (value: string) => void;
  updateReferenceLinks: (value: string) => void;
  inspectStore: (storeId: string) => void;
};

export type CampaignSettingsPageProps = {
  data: CampaignSettingsData;
  uiState: CampaignSettingsUiState;
  actions: CampaignSettingsActions;
};
