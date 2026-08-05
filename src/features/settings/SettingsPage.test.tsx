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
      aiDraft: null,
      aiDraftLoading: false,
      aiDraftError: "",
      canApplyAiDraft: true,
      aiDraftAppliedTo: "",
    },
    uiState: {
      promptHelperOpen: false,
      promptHelperForm: {
        sellingPoints: "",
        videoCount: "",
        durationRequirement: "",
        targetPetOrScene: "",
        mustShowShots: "",
        avoidShots: "",
        referenceLinks: "",
      },
    },
    actions: {
      togglePromptHelper: vi.fn(),
      updatePromptHelperField: vi.fn(),
      generatePrompt: vi.fn(),
      copyPrompt: vi.fn(),
      generateDraftWithAi: vi.fn(),
      applyAiDraft: vi.fn(),
      dismissAiDraft: vi.fn(),
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
      screen.getByRole("heading", { name: "辅助生成拍摄要求（可选）" }),
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
    expect(
      screen.getByText("提示词已生成。请复制到 ChatGPT 使用。"),
    ).toBeVisible();
    expect(screen.getByText("已复制提示词。")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "复制提示词" }));
    expect(props.actions.copyPrompt).toHaveBeenCalledTimes(1);
  });

  it("exposes every field the filming-requirements endpoint accepts", () => {
    const props = createProps();
    props.uiState.promptHelperOpen = true;

    render(<SettingsPage {...props} />);

    for (const label of [
      "产品卖点",
      "目标视频数量",
      "单条视频时长要求",
      "目标宠物 / 使用场景",
      "必须展示的画面",
      "不希望达人这样拍",
      "对标视频链接（可选，每行一个）",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("forwards AI generation and disables the button while it runs", async () => {
    const user = userEvent.setup();
    const props = createProps();
    props.uiState.promptHelperOpen = true;

    const { rerender } = render(<SettingsPage {...props} />);
    await user.click(
      screen.getByRole("button", { name: "用 AI 直接生成草稿" }),
    );
    expect(props.actions.generateDraftWithAi).toHaveBeenCalledTimes(1);

    const loading = createProps();
    loading.uiState.promptHelperOpen = true;
    loading.data.aiDraftLoading = true;
    rerender(<SettingsPage {...loading} />);

    expect(screen.getByRole("button", { name: "AI 生成中…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "正在调用 AI 生成拍摄要求草稿…",
    );
  });

  it("surfaces the endpoint error without interpreting it", () => {
    const props = createProps();
    props.uiState.promptHelperOpen = true;
    props.data.aiDraftError = "AI 生成失败：未配置 OPENAI_API_KEY。";

    render(<SettingsPage {...props} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "AI 生成失败：未配置 OPENAI_API_KEY。",
    );
    expect(
      screen.queryByRole("button", { name: "应用到当前产品项目" }),
    ).not.toBeInTheDocument();
  });

  it("previews a draft and forwards apply and dismiss without auto-applying", async () => {
    const user = userEvent.setup();
    const props = createProps();
    props.uiState.promptHelperOpen = true;
    props.data.aiDraft = {
      productName: "蒸汽梳毛器",
      requirements: ["每位达人 2 条视频", "必须挂 TikTok Shop 产品链接"],
      priorities: ["展示雾化功能", "展示梳下来的浮毛"],
    };

    render(<SettingsPage {...props} />);

    expect(screen.getByText("AI 草稿：蒸汽梳毛器")).toBeVisible();
    expect(screen.getByText("每位达人 2 条视频")).toBeVisible();
    expect(screen.getByText("展示雾化功能")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "应用到当前产品项目" }),
    );
    expect(props.actions.applyAiDraft).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "放弃这版草稿" }));
    expect(props.actions.dismissAiDraft).toHaveBeenCalledTimes(1);
  });

  it("blocks applying when there is no campaign to write into", () => {
    const props = createProps();
    props.uiState.promptHelperOpen = true;
    props.data.canApplyAiDraft = false;
    props.data.aiDraft = {
      productName: "未命名产品",
      requirements: ["每位达人 2 条视频"],
      priorities: ["展示使用过程"],
    };

    render(<SettingsPage {...props} />);

    expect(
      screen.getByRole("button", { name: "应用到当前产品项目" }),
    ).toBeDisabled();
    expect(
      screen.getByText("当前没有可写入的产品项目，请先在上方新增一个产品。"),
    ).toBeVisible();
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
