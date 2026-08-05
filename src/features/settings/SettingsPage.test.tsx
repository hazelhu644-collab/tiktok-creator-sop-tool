import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";
import type { SettingsPageProps } from "./settingsTypes";

function createProps(
  overrides: Partial<SettingsPageProps> = {},
): SettingsPageProps {
  const base: SettingsPageProps = {
    data: {
      campaignSettingsProps: {
        data: {
          target: null,
          campaignOptions: [],
          storeOptions: [],
          storeCleanupItems: [],
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
      },
      generatedPrompt: "",
      promptCopyStatus: "",
    },
    uiState: {
      promptHelperOpen: false,
      promptHelperForm: {
        sellingPoints: "",
        durationRequirement: "",
        referenceLinks: "",
      },
    },
    actions: {
      togglePromptHelper: vi.fn(),
      updatePromptHelperField: vi.fn(),
      generatePrompt: vi.fn(),
      copyPrompt: vi.fn(),
      clearLocalCreatorData: vi.fn(),
    },
  };

  return { ...base, ...overrides };
}

describe("SettingsPage", () => {
  it("composes campaign settings and keeps the prompt helper collapsed by default", () => {
    render(<SettingsPage {...createProps()} />);

    expect(
      screen.getByRole("heading", { name: "产品项目设置" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "用 ChatGPT 辅助生成拍摄要求（可选）",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "展开辅助生成" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("产品卖点")).not.toBeInTheDocument();
  });

  it("forwards prompt helper edits and generation without interpreting them", async () => {
    const user = userEvent.setup();
    const props = createProps();
    props.uiState.promptHelperOpen = true;
    props.uiState.promptHelperForm.sellingPoints = "Steam softens loose hair";

    render(<SettingsPage {...props} />);

    expect(screen.getByRole("button", { name: "收起辅助生成" })).toBeVisible();
    expect(screen.getByLabelText("产品卖点")).toHaveValue(
      "Steam softens loose hair",
    );

    await user.type(screen.getByLabelText("单条视频时长要求"), "6");
    expect(props.actions.updatePromptHelperField).toHaveBeenCalledWith(
      "durationRequirement",
      "6",
    );

    await user.click(screen.getByRole("button", { name: "生成可复制提示词" }));
    expect(props.actions.generatePrompt).toHaveBeenCalledTimes(1);
  });

  it("shows the generated prompt read-only with copy status", async () => {
    const user = userEvent.setup();
    const props = createProps();
    props.uiState.promptHelperOpen = true;
    props.data.generatedPrompt = "请你作为熟悉美国 TikTok Shop 的内容运营…";
    props.data.promptCopyStatus = "已复制提示词。";

    render(<SettingsPage {...props} />);

    expect(screen.getByLabelText("ChatGPT 提示词")).toHaveAttribute("readonly");
    expect(screen.getByText("提示词已生成。请复制到 ChatGPT 使用。")).toBeVisible();
    expect(screen.getByText("已复制提示词。")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "复制提示词" }));
    expect(props.actions.copyPrompt).toHaveBeenCalledTimes(1);
  });

  it("forwards the danger-zone clear action", async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<SettingsPage {...props} />);

    expect(screen.getByRole("heading", { name: "危险操作" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "清空当前数据" }));
    expect(props.actions.clearLocalCreatorData).toHaveBeenCalledTimes(1);
  });
});
