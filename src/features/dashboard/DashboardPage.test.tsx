import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import type { DashboardPageProps } from "./dashboardTypes";
import type { MessageComposerProps } from "../messaging/messageComposerTypes";

function createProps(): DashboardPageProps {
  const base: DashboardPageProps = {
    data: {
      campaignCards: [
        {
          value: "store-1::pet-brush",
          label: "Pet Brush",
          ariaLabel: "Pet Brush2 位达人",
          creatorCount: 2,
          activeCount: 2,
          todayFollowUp: 1,
          highPriority: 1,
          inTransit: 0,
          deliveredPending: 1,
          postedVideos: 1,
          completed: 0,
          failed: 0,
        },
      ],
      metricCards: [
        {
          label: "今日待跟进达人数量",
          value: 1,
          filterKey: "follow_up_today",
        },
      ],
      selectedCampaignName: "Pet Brush",
      workbenchFilterLabel: "",
      highestPendingCount: 1,
      queueItems: [
        {
          id: "creator-1",
          creatorHandle: "@alpha_creator",
          priorityLabel: "最高",
          statusLabel: "待跟进",
          multiSample: false,
          subLine: "Pet Brush · 已签收",
        },
      ],
      selectedCreator: {
        id: "creator-1",
        displayName: "alpha_creator",
        storeName: "TerraPaw",
        productName: "Pet Brush",
        statusLabel: "已签收",
        priorityLabel: "最高",
        triggerReason: "产品已送达 2 天，视频进度仍为 0/2。",
        suggestedAction: "发送拍摄跟进。",
        trackingStatus: "待跟进",
        notes: "Creator prefers weekends",
        crossStoreCreator: false,
        otherActiveSampleCount: 0,
        filmingRequirements: [{ label: "产品名称", value: "Pet Brush" }],
        moreInfo: [{ label: "联系渠道", value: "TikTok DM" }],
      },
      hasNextTask: true,
      channelOptions: ["TikTok DM", "Email"],
      messageComposerProps: null,
    },
    uiState: {
      onlyCurrentCreator: false,
      queueExpanded: true,
      followupSearch: "",
      creatorSearchStatus: "",
      showArchivedCollaborations: false,
      urgency: "All",
      showProcessedToday: false,
      selectedCreatorId: "creator-1",
      channel: "TikTok DM",
      historicalReadOnly: false,
      queueRef: createRef<HTMLElement>(),
      currentCreatorRef: createRef<HTMLDivElement>(),
    },
    actions: {
      openCreatorDatabase: vi.fn(),
      selectCampaignCard: vi.fn(),
      selectMetricCard: vi.fn(),
      toggleOnlyCurrentCreator: vi.fn(),
      clearWorkbenchFilter: vi.fn(),
      toggleQueue: vi.fn(),
      setFollowupSearch: vi.fn(),
      locateCreator: vi.fn(),
      setShowArchivedCollaborations: vi.fn(),
      setUrgency: vi.fn(),
      setShowProcessedToday: vi.fn(),
      selectCreator: vi.fn(),
      setChannel: vi.fn(),
      generateMessage: vi.fn(),
      processNextCreator: vi.fn(),
      showOtherSamples: vi.fn(),
      showMultiSampleReminder: vi.fn(),
    },
  };

  return base;
}

function createMessageComposerProps(): MessageComposerProps {
  return {
    data: {
      creatorReply: "I can post Friday.",
      notes: "Creator prefers weekends",
      channel: "TikTok DM",
      chineseTranslation: "",
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
      replyFocus: "",
      relationshipNote: "",
      replyTone: "中立专业",
      replyGoal: "",
      replyConcession: "",
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
}

describe("DashboardPage", () => {
  it("renders the existing Dashboard overview, queue, and current creator", () => {
    render(<DashboardPage {...createProps()} />);

    expect(
      screen.getByRole("heading", { name: "今日工作台" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "产品项目概览" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pet Brush2 位达人" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /今日待跟进达人数量1Pet Brush/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "@alpha_creator",
    );
    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent(
      "Creator prefers weekends",
    );
  });

  it("forwards controlled dashboard, queue, and creator selection callbacks", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<DashboardPage {...props} />);

    await user.click(screen.getByRole("button", { name: "Pet Brush2 位达人" }));
    expect(props.actions.selectCampaignCard).toHaveBeenCalledWith(
      "store-1::pet-brush",
    );

    await user.click(
      screen.getByRole("button", { name: /今日待跟进达人数量/ }),
    );
    expect(props.actions.selectMetricCard).toHaveBeenCalledWith(
      props.data.metricCards[0],
    );

    fireEvent.change(screen.getByLabelText("搜索队列"), {
      target: { value: "alpha" },
    });
    expect(props.actions.setFollowupSearch).toHaveBeenCalledWith("alpha");
    fireEvent.keyDown(screen.getByLabelText("搜索队列"), { key: "Enter" });
    expect(props.actions.locateCreator).toHaveBeenCalledTimes(1);

    await user.selectOptions(screen.getByLabelText("紧急程度"), "Highest");
    expect(props.actions.setUrgency).toHaveBeenCalledWith("Highest");
    await user.selectOptions(screen.getByLabelText("选择达人"), "creator-1");
    expect(props.actions.selectCreator).toHaveBeenCalledWith("creator-1");
  });

  it("renders collapsed and filtered empty queue states", () => {
    const props = createProps();
    const { rerender } = render(
      <DashboardPage
        {...{
          ...props,
          uiState: {
            ...props.uiState,
            queueExpanded: false,
            onlyCurrentCreator: false,
          },
        }}
      />,
    );

    expect(screen.getByText("达人队列已收起。")).toBeInTheDocument();

    rerender(
      <DashboardPage
        {...{
          ...props,
          data: {
            ...props.data,
            selectedCreator: null,
            queueItems: [],
            workbenchFilterLabel: "今日待跟进达人数量",
          },
        }}
      />,
    );

    expect(screen.getAllByText("当前筛选下暂无待处理达人。")).toHaveLength(2);
    expect(screen.getByText("暂无待处理达人。")).toBeInTheDocument();
  });

  it("renders current-creator warnings and forwards their actions", async () => {
    const user = userEvent.setup();
    const props = createProps();
    const selectedCreator = {
      ...props.data.selectedCreator!,
      crossStoreCreator: true,
      otherActiveSampleCount: 2,
      filmingRequirements: [{ label: "必须展示", value: "展示开箱" }],
      moreInfo: [
        { label: "主页链接", value: "https://www.tiktok.com/@alpha_creator" },
      ],
    };
    render(
      <DashboardPage
        {...{
          ...props,
          data: { ...props.data, selectedCreator },
        }}
      />,
    );

    expect(screen.getByText("跨店铺达人")).toBeInTheDocument();
    expect(screen.getByText("同达人多样品")).toBeInTheDocument();
    expect(screen.getByText("展示开箱")).toBeInTheDocument();
    expect(
      screen.getByText("https://www.tiktok.com/@alpha_creator"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查看其他样品记录" }));
    expect(props.actions.showOtherSamples).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole("button", { name: "生成多样品合并提醒" }),
    );
    expect(props.actions.showMultiSampleReminder).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "处理下一个达人" }));
    expect(props.actions.processNextCreator).toHaveBeenCalledTimes(1);
  });

  it("composes the existing message composer and keeps historical helper copy", () => {
    const props = createProps();
    const { rerender } = render(
      <DashboardPage
        {...{
          ...props,
          data: {
            ...props.data,
            messageComposerProps: createMessageComposerProps(),
          },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "达人回复处理" }),
    ).toBeInTheDocument();

    rerender(
      <DashboardPage
        {...{
          ...props,
          data: {
            ...props.data,
            messageComposerProps: createMessageComposerProps(),
          },
          uiState: { ...props.uiState, historicalReadOnly: true },
        }}
      />,
    );

    expect(
      screen.getByText(
        "当前为历史统计下钻，只读展示；如需继续合作，请先恢复达人。",
      ),
    ).toBeInTheDocument();
  });
});
