import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CreatorRow } from "../../types";
import { CreatorDatabasePage } from "./CreatorDatabasePage";
import type { CreatorDatabasePageProps } from "./creatorDatabaseTypes";

function creatorRow(patch: Partial<CreatorRow> = {}): CreatorRow {
  return {
    id: "creator-1",
    username: "alpha_creator",
    profileLink: "https://www.tiktok.com/@alpha_creator",
    contactMethod: "TikTok DM",
    storeName: "TerraPaw",
    product: "Pet Brush",
    currentStatus: "Invited",
    sampleShippingStatus: "",
    sampleDeliveredDate: "",
    videoProgress: "0/2",
    firstVideoPostedDate: "",
    lastContactDate: "",
    lastFollowUpCount: 0,
    notes: "",
    ...patch,
  };
}

function createProps(
  overrides: Partial<CreatorDatabasePageProps> = {},
): CreatorDatabasePageProps {
  const row = creatorRow();
  const base: CreatorDatabasePageProps = {
    data: {
      rows: [
        {
          row,
          displayName: "alpha_creator",
          archived: false,
          canRestore: false,
          duplicate: {
            possibleDuplicate: false,
            multiSample: false,
            crossStoreCreator: false,
          },
        },
      ],
      exportableRowCount: 1,
      statusOptions: [
        { value: "Invited", label: "已邀约" },
        { value: "Sample Approved", label: "样品已通过" },
      ],
      productTotalCount: 1,
      archivedProductCount: 0,
      archivedSearchMatchCount: 0,
      defaultStoreName: "默认店铺",
    },
    uiState: {
      search: "",
      statusFilter: "All",
      creatorTypeFilter: "All",
      followerFilter: "All",
      avgViewsFilter: "All",
      gmvFilter: "All",
      selectedIds: [],
      showArchivedCollaborations: false,
      bulkStatus: "Invited",
      fileName: "",
      importSummary: "",
      error: "",
      pendingDuplicate: null,
    },
    actions: {
      setSearch: vi.fn(),
      setStatusFilter: vi.fn(),
      setCreatorTypeFilter: vi.fn(),
      setFollowerFilter: vi.fn(),
      setAvgViewsFilter: vi.fn(),
      setGmvFilter: vi.fn(),
      setShowArchivedCollaborations: vi.fn(),
      setBulkStatus: vi.fn(),
      toggleSelected: vi.fn(),
      toggleSelectAll: vi.fn(),
      updateRow: vi.fn(),
      bulkCopyOutreach: vi.fn(),
      bulkUpdateStatus: vi.fn(),
      copyOutreach: vi.fn(),
      archiveCreator: vi.fn(),
      restoreCreator: vi.fn(),
      importFile: vi.fn(),
      exportCsv: vi.fn(),
      addCreator: vi.fn(),
      continueDuplicate: vi.fn(),
      copyDuplicateBase: vi.fn(),
      cancelDuplicate: vi.fn(),
    },
  };

  return {
    ...base,
    ...overrides,
    data: { ...base.data, ...overrides.data },
    uiState: { ...base.uiState, ...overrides.uiState },
    actions: { ...base.actions, ...overrides.actions },
  };
}

describe("CreatorDatabasePage", () => {
  it("renders the existing database columns and controlled creator row", () => {
    render(<CreatorDatabasePage {...createProps()} />);

    expect(
      screen.getByRole("heading", { name: "达人数据库" }),
    ).toBeInTheDocument();
    const headers = within(screen.getByRole("table"))
      .getAllByRole("columnheader")
      .map((header) => header.textContent ?? "");
    expect(headers.slice(1, 18)).toEqual([
      "达人账号",
      "主页链接",
      "联系渠道",
      "店铺 / 品牌",
      "产品",
      "合作状态",
      "样品到货日期",
      "视频进度",
      "首条视频发布日期",
      "最近联系日期",
      "跟进次数",
      "跟进状态",
      "最近沟通动作",
      "最近沟通渠道",
      "下次跟进日期",
      "达人回复",
      "达人备注",
    ]);
    expect(screen.getByDisplayValue("alpha_creator")).toBeInTheDocument();
    expect(screen.queryByText("样品物流状态")).not.toBeInTheDocument();
  });

  it("forwards controlled search, row editing, selection, and bulk actions", async () => {
    const user = userEvent.setup();
    const props = createProps();
    const { rerender } = render(<CreatorDatabasePage {...props} />);

    fireEvent.change(screen.getByLabelText("搜索"), {
      target: { value: "alpha" },
    });
    expect(props.actions.setSearch).toHaveBeenCalledWith("alpha");

    await user.click(screen.getByLabelText("选择 alpha_creator"));
    expect(props.actions.toggleSelected).toHaveBeenCalledWith("creator-1");

    await user.clear(screen.getByLabelText("达人账号"));
    await user.type(screen.getByLabelText("达人账号"), "beta_creator");
    expect(props.actions.updateRow).toHaveBeenCalledWith(
      "creator-1",
      "username",
      expect.any(String),
    );

    rerender(
      <CreatorDatabasePage
        {...createProps({
          actions: props.actions,
          uiState: { ...props.uiState, selectedIds: ["creator-1"] },
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "批量复制邀约话术" }));
    expect(props.actions.bulkCopyOutreach).toHaveBeenCalledTimes(1);
  });

  it("renders archived state and forwards restore without changing eligibility", async () => {
    const user = userEvent.setup();
    const row = creatorRow({
      archivedAt: "2026-06-11",
      archiveReason: "Manual",
    });
    const props = createProps({
      data: {
        ...createProps().data,
        rows: [
          {
            row,
            displayName: "alpha_creator",
            archived: true,
            canRestore: true,
            duplicate: {
              possibleDuplicate: false,
              multiSample: false,
              crossStoreCreator: false,
            },
          },
        ],
        archivedProductCount: 1,
      },
      uiState: {
        ...createProps().uiState,
        showArchivedCollaborations: true,
      },
    });

    render(<CreatorDatabasePage {...props} />);
    expect(screen.getByText("已归档")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "恢复达人" }));
    expect(props.actions.restoreCreator).toHaveBeenCalledWith("creator-1");
  });

  it("keeps export available when filtered display rows are empty", async () => {
    const user = userEvent.setup();
    const props = createProps({
      data: {
        ...createProps().data,
        rows: [],
        exportableRowCount: 1,
      },
    });
    render(<CreatorDatabasePage {...props} />);

    const exportButton = screen.getByRole("button", { name: "导出 CSV" });
    expect(exportButton).toBeEnabled();
    await user.click(exportButton);
    expect(props.actions.exportCsv).toHaveBeenCalledTimes(1);
  });
});
