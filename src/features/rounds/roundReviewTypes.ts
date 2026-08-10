export type RoundCreatorOutcome = {
  rowId: string;
  displayName: string;
  /** Delivered what the round asked for. */
  completed: boolean;
  statusLabel: string;
  videoProgress: string;
  followUpCount: number;
  notes: string;
  /** Other rounds of this product the same creator also appears in. */
  alsoInRounds: number[];
};

export type RoundSummary = {
  round: number;
  /** The round new creators currently join. */
  isCurrent: boolean;
  total: number;
  completed: number;
  incomplete: number;
  /** Not yet archived — only possible for the current round. */
  active: number;
  creators: RoundCreatorOutcome[];
};

export type RoundReviewData = {
  productName: string;
  /** Empty when 全部产品 is selected, since rounds belong to one product. */
  rounds: RoundSummary[];
  /** True when no single product is selected. */
  needsProductSelection: boolean;
};

export type RoundReviewUiState = {
  expandedRound: number | null;
};

export type RoundReviewActions = {
  toggleRound: (round: number) => void;
  openCreatorInDatabase: (rowId: string) => void;
};

export type RoundReviewPageProps = {
  data: RoundReviewData;
  uiState: RoundReviewUiState;
  actions: RoundReviewActions;
};
