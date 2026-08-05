import type { CampaignSettingsPageProps } from "../campaigns/campaignSettingsTypes";

export type SettingsPromptHelperField =
  | "sellingPoints"
  | "durationRequirement"
  | "referenceLinks";

export type SettingsPromptHelperForm = Record<
  SettingsPromptHelperField,
  string
>;

export type SettingsData = {
  campaignSettingsProps: CampaignSettingsPageProps;
  generatedPrompt: string;
  promptCopyStatus: string;
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
  clearLocalCreatorData: () => void;
};

export type SettingsPageProps = {
  data: SettingsData;
  uiState: SettingsUiState;
  actions: SettingsActions;
};
