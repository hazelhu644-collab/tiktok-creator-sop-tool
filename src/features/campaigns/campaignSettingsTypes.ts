import type { ProductCategoryId } from "../../productCategories";
import type { Campaign, CollabModel, OrderMethod, Store } from "../../types";

export type CampaignSettingsOption = {
  value: string;
  label: string;
};

export type CampaignSettingsTargetView = {
  campaign: Campaign;
  /** Outreach round this product is currently on. */
  currentRound: number;
  /** Creators in that round who have not been archived yet. */
  activeRoundCreatorCount: number;
  selectValue: string;
  storeId: string;
  keyContentPointsText: string;
  productLinkRequirementText: string;
  referenceLinksText: string;
  /** Explicit category if set, otherwise the one detected from the product. */
  categoryId: ProductCategoryId;
  /** True when the category was inferred rather than chosen by the operator. */
  categoryIsDetected: boolean;
  /** Commercial terms, with defaults already applied for display. */
  collabModel: CollabModel;
  discountCode: string;
  audienceDiscount: string;
  creatorCommission: string;
  commissionWindow: string;
  orderMethod: OrderMethod;
  contentUsageMonths: string;
  requiresDisclosure: boolean;
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
  selectCategory: (categoryId: ProductCategoryId) => void;
  /** Overwrite the filming fields with the current category's preset. */
  applyCategoryPreset: () => void;
  selectCollabModel: (value: CollabModel) => void;
  selectOrderMethod: (value: OrderMethod) => void;
  updateDiscountCode: (value: string) => void;
  updateAudienceDiscount: (value: string) => void;
  updateCreatorCommission: (value: string) => void;
  updateCommissionWindow: (value: string) => void;
  updateContentUsageMonths: (value: string) => void;
  setRequiresDisclosure: (value: boolean) => void;
  updateKeyContentPoints: (value: string) => void;
  updateSellingPoints: (value: string) => void;
  updateVideoLength: (value: string) => void;
  updateVideoCount: (value: string) => void;
  syncVideoCount: () => void;
  endCurrentRound: () => void;
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
