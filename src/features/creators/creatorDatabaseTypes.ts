import type { EditableCreatorField } from "../../creatorData";
import type { CreatorRow } from "../../types";

export type CreatorStatusOption = {
  value: string;
  label: string;
};

export type CreatorDatabaseRowView = {
  row: CreatorRow;
  displayName: string;
  archived: boolean;
  canRestore: boolean;
  duplicate: {
    possibleDuplicate: boolean;
    multiSample: boolean;
    crossStoreCreator: boolean;
  };
};

export type PendingDuplicateView = {
  draft: CreatorRow;
  existing: CreatorRow;
} | null;

export type CreatorDatabaseData = {
  rows: CreatorDatabaseRowView[];
  exportableRowCount: number;
  statusOptions: CreatorStatusOption[];
  productTotalCount: number;
  archivedProductCount: number;
  archivedSearchMatchCount: number;
  defaultStoreName: string;
};

export type CreatorDatabaseUiState = {
  search: string;
  statusFilter: string;
  creatorTypeFilter: string;
  followerFilter: string;
  avgViewsFilter: string;
  gmvFilter: string;
  selectedIds: string[];
  showArchivedCollaborations: boolean;
  bulkStatus: string;
  fileName: string;
  importSummary: string;
  error: string;
  pendingDuplicate: PendingDuplicateView;
};

export type CreatorDatabaseActions = {
  setSearch: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setCreatorTypeFilter: (value: string) => void;
  setFollowerFilter: (value: string) => void;
  setAvgViewsFilter: (value: string) => void;
  setGmvFilter: (value: string) => void;
  setShowArchivedCollaborations: (value: boolean) => void;
  setBulkStatus: (value: string) => void;
  toggleSelected: (rowId: string) => void;
  toggleSelectAll: (checked: boolean) => void;
  updateRow: (
    rowId: string,
    field: EditableCreatorField,
    value: string,
  ) => void;
  bulkCopyOutreach: () => void;
  bulkUpdateStatus: () => void;
  copyOutreach: (rowId: string) => void;
  archiveCreator: (rowId: string) => void;
  restoreCreator: (rowId: string) => void;
  importFile: (file: File | undefined) => void | Promise<void>;
  exportCsv: () => void;
  addCreator: () => void;
  continueDuplicate: () => void;
  copyDuplicateBase: () => void;
  cancelDuplicate: () => void;
};

export type CreatorDatabasePageProps = {
  data: CreatorDatabaseData;
  uiState: CreatorDatabaseUiState;
  actions: CreatorDatabaseActions;
};
