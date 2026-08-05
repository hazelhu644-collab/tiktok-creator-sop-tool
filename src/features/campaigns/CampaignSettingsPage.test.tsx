import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Campaign } from "../../types";
import { CampaignSettingsPage } from "./CampaignSettingsPage";
import type { CampaignSettingsPageProps } from "./campaignSettingsTypes";

function campaign(patch: Partial<Campaign> = {}): Campaign {
  return {
    id: "pet-brush",
    productId: "product::terrapaw::pet-brush",
    storeId: "terrapaw",
    storeName: "TerraPaw",
    productName: "Pet Brush",
    sellingPoints: "Gentle steam grooming",
    requirements: [],
    keyContentPoints: ["Show steam"],
    avoidShots: "No medical claims",
    videoCount: "2",
    videoLength: "40s+",
    tagRequirement: "Tag the product",
    productLink: "",
    referenceLinks: ["https://example.com/reference"],
    defaultMessageSetting: "",
    notes: "",
    ...patch,
  };
}

function createProps(
  overrides: Partial<CampaignSettingsPageProps> = {},
): CampaignSettingsPageProps {
  const targetCampaign = campaign();
  const base: CampaignSettingsPageProps = {
    data: {
      target: {
        campaign: targetCampaign,
        selectValue: "terrapaw::pet-brush",
        storeId: "terrapaw",
        keyContentPointsText: "Show steam",
        productLinkRequirementText: "Tag the product",
        referenceLinksText: "https://example.com/reference",
      },
      campaignOptions: [
        { value: "terrapaw::pet-brush", label: "TerraPaw · Pet Brush" },
      ],
      storeOptions: [
        { id: "terrapaw", name: "TerraPaw" },
        { id: "pinepaw", name: "PinePaw" },
      ],
      storeCleanupItems: [
        { id: "terrapaw", name: "TerraPaw", canHide: false },
        { id: "empty-store", name: "Empty Store", canHide: true },
      ],
    },
    uiState: { showArchivedProducts: false },
    actions: {
      selectCampaign: vi.fn(),
      setShowArchivedProducts: vi.fn(),
      createCampaign: vi.fn(),
      announceEditable: vi.fn(),
      duplicateCampaign: vi.fn(),
      archiveCampaign: vi.fn(),
      restoreCampaign: vi.fn(),
      deleteCampaign: vi.fn(),
      assignStore: vi.fn(),
      renameProduct: vi.fn(),
      updateKeyContentPoints: vi.fn(),
      updateSellingPoints: vi.fn(),
      updateVideoLength: vi.fn(),
      updateVideoCount: vi.fn(),
      syncVideoCount: vi.fn(),
      updateAvoidShots: vi.fn(),
      updateProductLinkRequirement: vi.fn(),
      updateReferenceLinks: vi.fn(),
      inspectStore: vi.fn(),
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

describe("CampaignSettingsPage", () => {
  it("renders the controlled campaign form and store cleanup state", () => {
    render(<CampaignSettingsPage {...createProps()} />);

    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByLabelText("选择产品 / Campaign")).toHaveValue(
      "terrapaw::pet-brush",
    );
    const form = within(screen.getByTestId("campaign-settings-form"));
    expect(form.getByLabelText("店铺 / 品牌")).toHaveValue("terrapaw");
    expect(form.getByLabelText("产品名称")).toHaveValue("Pet Brush");
    expect(form.getByLabelText("必须展示内容")).toHaveValue("Show steam");
    expect(form.getByLabelText("Campaign 产品卖点")).toHaveValue(
      "Gentle steam grooming",
    );
    expect(
      screen.getByRole("button", { name: "检查店铺：TerraPaw" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "隐藏空店铺：Empty Store" }),
    ).toBeInTheDocument();
  });

  it("forwards controlled selection, editing, campaign actions, and store checks", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<CampaignSettingsPage {...props} />);

    fireEvent.change(screen.getByLabelText("选择产品 / Campaign"), {
      target: { value: "terrapaw::pet-brush" },
    });
    expect(props.actions.selectCampaign).toHaveBeenCalledWith(
      "terrapaw::pet-brush",
    );

    await user.click(screen.getByLabelText("显示已归档产品"));
    expect(props.actions.setShowArchivedProducts).toHaveBeenCalledWith(true);

    const form = within(screen.getByTestId("campaign-settings-form"));
    fireEvent.change(form.getByLabelText("店铺 / 品牌"), {
      target: { value: "pinepaw" },
    });
    expect(props.actions.assignStore).toHaveBeenCalledWith("pinepaw");
    fireEvent.change(form.getByLabelText("产品名称"), {
      target: { value: "New Brush" },
    });
    expect(props.actions.renameProduct).toHaveBeenCalledWith("New Brush");
    fireEvent.change(form.getByLabelText("视频数量要求"), {
      target: { value: "1" },
    });
    expect(props.actions.updateVideoCount).toHaveBeenCalledWith("1");

    await user.click(
      screen.getByRole("button", { name: "同步视频数量到达人记录" }),
    );
    expect(props.actions.syncVideoCount).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "复制" }));
    expect(props.actions.duplicateCampaign).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole("button", { name: "检查店铺：TerraPaw" }),
    );
    expect(props.actions.inspectStore).toHaveBeenCalledWith("terrapaw");
  });

  it("preserves archived restore controls and the no-target state", async () => {
    const user = userEvent.setup();
    const archived = campaign({ archivedAt: "2026-06-22" });
    const props = createProps({
      data: {
        ...createProps().data,
        target: {
          ...createProps().data.target!,
          campaign: archived,
        },
      },
      uiState: { showArchivedProducts: true },
    });
    const { rerender } = render(<CampaignSettingsPage {...props} />);
    await user.click(screen.getByRole("button", { name: "恢复" }));
    expect(props.actions.restoreCampaign).toHaveBeenCalledTimes(1);

    rerender(
      <CampaignSettingsPage
        {...createProps({ data: { ...createProps().data, target: null } })}
      />,
    );
    expect(
      screen.queryByTestId("campaign-settings-form"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "新增产品" }),
    ).not.toBeInTheDocument();
  });
});
