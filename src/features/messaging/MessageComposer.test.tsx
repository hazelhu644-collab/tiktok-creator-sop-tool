import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageComposer } from "./MessageComposer";
import type { MessageComposerProps } from "./messageComposerTypes";

function createProps(
  overrides: Partial<MessageComposerProps> = {},
): MessageComposerProps {
  const base: MessageComposerProps = {
    data: {
      creatorReply: "I can post Friday.",
      notes: "Creator prefers weekends",
      channel: "TikTok DM",
      chineseTranslation: "我可以周五发布。",
      errorMessage: "",
      message: {
        english: "Thanks! Please confirm the posting time.",
        chineseExplanation: "确认具体发布时间。",
        scenario: "达人已回复",
        scenarioReason: "达人确认可以发布",
        urgencyLevel: "中",
        communicationAction: "回复达人消息",
      },
      messageSource: "local",
      chineseExplanation: "",
      trackingStatus: "",
      lastProcessingResult: "",
      hasNextTask: true,
    },
    uiState: {
      historicalReadOnly: false,
      loadingAction: null,
      translationExpanded: false,
      translationEditing: false,
      advancedReplyOpen: false,
      replyFocus: "确认周五发布时间",
      relationshipNote: "沟通顺畅",
      replyTone: "中立专业",
      replyGoal: "确认发布时间",
      replyConcession: "可以周五发布",
      showNextCreatorPrompt: false,
      messageOutputRef: createRef<HTMLDivElement>(),
    },
    actions: {
      updateCreatorReply: vi.fn(),
      updateNotes: vi.fn(),
      generateDeepSeekReply: vi.fn(),
      translateCreatorReply: vi.fn(),
      copyTranslation: vi.fn(),
      updateTranslation: vi.fn(),
      setTranslationExpanded: vi.fn(),
      setTranslationEditing: vi.fn(),
      setReplyFocus: vi.fn(),
      setReplyTone: vi.fn(),
      setAdvancedReplyOpen: vi.fn(),
      setRelationshipNote: vi.fn(),
      setReplyGoal: vi.fn(),
      setReplyConcession: vi.fn(),
      updateEnglishMessage: vi.fn(),
      copyEnglishMessage: vi.fn(),
      markMessageSent: vi.fn(),
      markCreatorReplied: vi.fn(),
      markCreatorNoReply: vi.fn(),
      markVideoProgress: vi.fn(),
      updateVideoProgressManually: vi.fn(),
      markCreatorOutcome: vi.fn(),
      markCreatorSkippedToday: vi.fn(),
      processNextCreator: vi.fn(),
      stayOnCurrentCreator: vi.fn(),
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

describe("MessageComposer", () => {
  it("renders controlled reply, translation, English message, and tracking UI", () => {
    render(<MessageComposer {...createProps()} />);

    expect(
      screen.getByRole("heading", { name: "达人回复处理" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("达人回复原文")).toHaveValue(
      "I can post Friday.",
    );
    expect(screen.getByText("我可以周五发布。")).toBeInTheDocument();
    expect(screen.getByLabelText("英文话术")).toHaveValue(
      "Thanks! Please confirm the posting time.",
    );
    expect(screen.getByText("免费本地话术")).toBeInTheDocument();
    expect(screen.getByText("当前联系渠道：TikTok DM")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标记为已发送" })).toBeEnabled();
  });

  it("forwards reply, DeepSeek, translation, and English editing callbacks", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<MessageComposer {...props} />);

    fireEvent.change(screen.getByLabelText("达人回复原文"), {
      target: { value: "Updated reply" },
    });
    expect(props.actions.updateCreatorReply).toHaveBeenCalledWith(
      "Updated reply",
    );
    fireEvent.change(screen.getByLabelText("处理备注 / 达人备注"), {
      target: { value: "Updated note" },
    });
    expect(props.actions.updateNotes).toHaveBeenCalledWith("Updated note");

    await user.click(
      screen.getByRole("button", { name: "DeepSeek 翻译达人回复" }),
    );
    expect(props.actions.translateCreatorReply).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getAllByRole("button", { name: "根据上方重点生成英文回复" })[0],
    );
    expect(props.actions.generateDeepSeekReply).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "复制翻译" }));
    expect(props.actions.copyTranslation).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "展开全文" }));
    expect(props.actions.setTranslationExpanded).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole("button", { name: "编辑翻译" }));
    expect(props.actions.setTranslationEditing).toHaveBeenCalledWith(true);

    fireEvent.change(screen.getByLabelText("我想回复的重点"), {
      target: { value: "Confirm Friday" },
    });
    expect(props.actions.setReplyFocus).toHaveBeenCalledWith("Confirm Friday");
    fireEvent.change(screen.getByLabelText("回复语气"), {
      target: { value: "坚定推进" },
    });
    expect(props.actions.setReplyTone).toHaveBeenCalledWith("坚定推进");
    fireEvent.change(screen.getByLabelText("英文话术"), {
      target: { value: "Edited English" },
    });
    expect(props.actions.updateEnglishMessage).toHaveBeenCalledWith(
      "Edited English",
    );
    await user.click(screen.getByRole("button", { name: "复制英文话术" }));
    expect(props.actions.copyEnglishMessage).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "标记为已发送" }));
    expect(props.actions.markMessageSent).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "标记达人已回复" }));
    expect(props.actions.markCreatorReplied).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "标记未回复" }));
    expect(props.actions.markCreatorNoReply).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "发布 1 条视频" }));
    expect(props.actions.markVideoProgress).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "今日暂不跟进" }));
    expect(props.actions.markCreatorSkippedToday).toHaveBeenCalledTimes(1);
  });

  it("renders loading, editable translation, and API error state without interpreting it", () => {
    const props = createProps({
      data: {
        ...createProps().data,
        errorMessage: "未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。",
      },
      uiState: {
        ...createProps().uiState,
        loadingAction: "translate_creator_reply",
        translationEditing: true,
        translationExpanded: true,
      },
    });
    render(<MessageComposer {...props} />);

    expect(screen.getByRole("status")).toHaveTextContent("DeepSeek 生成中…");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。",
    );
    expect(screen.getByLabelText("编辑中文翻译")).toHaveValue(
      "我可以周五发布。",
    );
    expect(screen.getByRole("button", { name: "收起" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "完成编辑" }),
    ).toBeInTheDocument();
  });

  it("forwards tracking actions and preserves historical disabled states", async () => {
    const user = userEvent.setup();
    const props = createProps({
      uiState: {
        ...createProps().uiState,
        historicalReadOnly: true,
        showNextCreatorPrompt: true,
      },
      data: {
        ...createProps().data,
        trackingStatus: "已记录处理结果。",
        lastProcessingResult: "已记录处理结果。",
        hasNextTask: false,
      },
    });
    render(<MessageComposer {...props} />);

    expect(screen.getByRole("button", { name: "标记为已发送" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "标记达人已回复" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "标记未回复" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "发布 1 条视频" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "今日暂不跟进" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "处理下一个达人" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "留在当前达人" }));
    expect(props.actions.stayOnCurrentCreator).toHaveBeenCalledTimes(1);
  });
});
