import type { RefObject } from "react";
import type { ReplyTone } from "../../messageGenerator";
import type { Channel, GeneratedMessage } from "../../types";

export type MessageComposerLoadingAction =
  "translate_creator_reply" | "generate_personalized_reply" | null;

export type MessageComposerData = {
  creatorReply: string;
  notes: string;
  channel: Channel;
  chineseTranslation: string;
  errorMessage: string;
  message: GeneratedMessage | null;
  messageSource: "local" | "deepseek";
  chineseExplanation: string;
  trackingStatus: string;
  lastProcessingResult: string;
  hasNextTask: boolean;
};

export type MessageComposerUiState = {
  historicalReadOnly: boolean;
  loadingAction: MessageComposerLoadingAction;
  translationExpanded: boolean;
  translationEditing: boolean;
  advancedReplyOpen: boolean;
  replyFocus: string;
  relationshipNote: string;
  replyTone: ReplyTone;
  replyGoal: string;
  replyConcession: string;
  showNextCreatorPrompt: boolean;
  messageOutputRef: RefObject<HTMLDivElement | null>;
};

export type MessageComposerActions = {
  updateCreatorReply: (value: string) => void;
  updateNotes: (value: string) => void;
  generateDeepSeekReply: () => void;
  translateCreatorReply: () => void;
  copyTranslation: () => void;
  updateTranslation: (value: string) => void;
  setTranslationExpanded: (value: boolean) => void;
  setTranslationEditing: (value: boolean) => void;
  setReplyFocus: (value: string) => void;
  setReplyTone: (value: ReplyTone) => void;
  setAdvancedReplyOpen: (value: boolean) => void;
  setRelationshipNote: (value: string) => void;
  setReplyGoal: (value: string) => void;
  setReplyConcession: (value: string) => void;
  updateEnglishMessage: (value: string) => void;
  copyEnglishMessage: () => void;
  markMessageSent: () => void;
  markCreatorReplied: () => void;
  markCreatorNoReply: () => void;
  markVideoProgress: () => void;
  updateVideoProgressManually: () => void;
  markCreatorOutcome: (outcome: "Completed" | "Failed") => void;
  markCreatorSkippedToday: () => void;
  processNextCreator: () => void;
  stayOnCurrentCreator: () => void;
};

export type MessageComposerProps = {
  data: MessageComposerData;
  uiState: MessageComposerUiState;
  actions: MessageComposerActions;
};
