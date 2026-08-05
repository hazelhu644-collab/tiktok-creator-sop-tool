import type { CampaignSettingsPageProps } from "../campaigns/campaignSettingsTypes";

export type SettingsPromptHelperField =
  | "sellingPoints"
  | "videoCount"
  | "durationRequirement"
  | "targetPetOrScene"
  | "mustShowShots"
  | "avoidShots"
  | "referenceLinks";

export type SettingsPromptHelperForm = Record<
  SettingsPromptHelperField,
  string
>;

/** Shape returned by `POST /api/generate-filming-requirements`. */
export type SettingsAiDraft = {
  productName: string;
  requirements: string[];
  priorities: string[];
};

export type SettingsData = {
  campaignSettingsProps: CampaignSettingsPageProps;
  generatedPrompt: string;
  promptCopyStatus: string;
  aiDraft: SettingsAiDraft | null;
  aiDraftLoading: boolean;
  aiDraftError: string;
  /** False when there is no campaign to write the draft into. */
  canApplyAiDraft: boolean;
  aiDraftAppliedTo: string;
};

export type SettingsUiState = {
  promptHelperOpen: boolean;
  promptHelperForm: SettingsPromptHelperForm;
};

export type SettingsActions = {
  togglePromptHelper: () => void;
  updatePromptHelperField: (
    field: SettingsPromptHelperField,
    value: string,
  ) => void;
  generatePrompt: () => void;
  copyPrompt: () => void;
  generateDraftWithAi: () => void;
  applyAiDraft: () => void;
  dismissAiDraft: () => void;
  clearLocalCreatorData: () => void;
};

export type SettingsPageProps = {
  data: SettingsData;
  uiState: SettingsUiState;
  actions: SettingsActions;
};
