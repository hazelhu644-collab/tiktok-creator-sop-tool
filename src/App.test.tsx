import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { CREATOR_ROWS_STORAGE_KEY } from "./creatorData";
import { CAMPAIGNS_STORAGE_KEY } from "./campaignData";
import type { CreatorRow } from "./types";

function creatorRow(overrides: Partial<CreatorRow> = {}): CreatorRow {
  return {
    id: "creator-1",
    username: "fluffy_creator",
    profileLink: "@fluffy_creator",
    contactMethod: "TikTok DM",
    product: "智能宠物饮水机",
    currentStatus: "Delivered",
    sampleShippingStatus: "Delivered",
    sampleDeliveredDate: "2026-06-02",
    videoProgress: "0 of 2",
    firstVideoPostedDate: "",
    lastContactDate: "2026-06-01",
    lastFollowUpCount: 0,
    notes: "",
    trackingStatus: "",
    lastMessageScenario: "",
    lastMessageChannel: "",
    lastMessageSentAt: "",
    nextFollowUpDate: "",
    lastCreatorResponse: "",
    followUpHistory: [],
    ...overrides,
  };
}

function seedCreators(rows: CreatorRow[]) {
  window.localStorage.setItem(CREATOR_ROWS_STORAGE_KEY, JSON.stringify(rows));
}

async function goTo(
  user: ReturnType<typeof userEvent.setup>,
  moduleName: RegExp,
) {
  const nav = screen.getByRole("navigation", { name: "主导航" });
  await user.click(within(nav).getByRole("button", { name: moduleName }));
}

afterEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("operations workbench navigation and dashboard", () => {
  it("renders the fixed module navigation and opens each redesigned page", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText("Creator SOP")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "今日工作台" }),
    ).toBeInTheDocument();

    await goTo(user, /达人数据库/);
    expect(
      screen.getByRole("heading", { name: "达人数据库" }),
    ).toBeInTheDocument();
    expect(screen.getByText("数据导入 / 导出")).toBeInTheDocument();

    await goTo(user, /沟通话术模板/);
    expect(
      screen.getByRole("heading", { name: "沟通话术模板" }),
    ).toBeInTheDocument();

    await goTo(user, /样品追踪/);
    expect(
      screen.getByRole("heading", { name: "样品追踪" }),
    ).toBeInTheDocument();

    await goTo(user, /达人跟进中心/);
    expect(
      screen.getByRole("heading", { name: "今日工作台" }),
    ).toBeInTheDocument();

    await goTo(user, /内容审核/);
    expect(
      screen.getByRole("heading", { name: "内容审核" }),
    ).toBeInTheDocument();

    await goTo(user, /投流素材库/);
    expect(
      screen.getByRole("heading", { name: "投流素材库" }),
    ).toBeInTheDocument();

    await goTo(user, /设置/);
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
  });

  it("keeps Chinese sidebar order with Follow-up Center above Creator Database and Templates", () => {
    render(<App />);
    const navText =
      screen.getByRole("navigation", { name: "主导航" }).textContent ?? "";
    expect(navText.indexOf("达人跟进中心")).toBeGreaterThan(
      navText.indexOf("今日工作台"),
    );
    expect(navText.indexOf("达人跟进中心")).toBeLessThan(
      navText.indexOf("达人数据库"),
    );
    expect(navText.indexOf("达人数据库")).toBeLessThan(
      navText.indexOf("沟通话术模板"),
    );
  });

  it("shows the eight Dashboard metric cards and a priority todo list", () => {
    seedCreators([
      creatorRow({
        id: "invite",
        username: "invite_creator",
        currentStatus: "To Contact",
        sampleShippingStatus: "",
        sampleDeliveredDate: "",
        videoProgress: "0 of 2",
      }),
      creatorRow({
        id: "follow",
        username: "follow_creator",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-05-20",
        videoProgress: "0 of 2",
      }),
      creatorRow({
        id: "request",
        username: "request_creator",
        currentStatus: "Sample Requested",
        sampleShippingStatus: "Not Shipped",
        sampleDeliveredDate: "",
      }),
      creatorRow({
        id: "approved",
        username: "approved_creator",
        currentStatus: "Sample Approved",
        sampleShippingStatus: "Not Shipped",
        sampleDeliveredDate: "",
      }),
      creatorRow({
        id: "shipped",
        username: "shipped_creator",
        currentStatus: "Sample Shipped",
        sampleShippingStatus: "In Transit",
        sampleDeliveredDate: "",
      }),
      creatorRow({
        id: "posted",
        username: "posted_creator",
        currentStatus: "Posted",
        sampleShippingStatus: "Delivered",
        videoProgress: "1 of 2",
        firstVideoPostedDate: "2026-06-01",
      }),
      creatorRow({
        id: "revision",
        username: "revision_creator",
        currentStatus: "Need Revision",
        sampleShippingStatus: "Delivered",
        videoProgress: "1 of 2",
      }),
      creatorRow({
        id: "ads",
        username: "ads_creator",
        currentStatus: "Ready for Ads",
        sampleShippingStatus: "Delivered",
        videoProgress: "2 of 2",
      }),
    ]);

    render(<App />);

    const expectedCardOrder = [
      "今日待跟进达人数量",
      "今日已处理达人人数",
      "已签收待发视频数量",
      "剩余视频待履约数量",
      "本周已发布视频数量",
      "合作完成数量",
      "合作失败数量",
      "样品运输中数量",
    ];
    expectedCardOrder.forEach((label) =>
      expect(
        screen.getByRole("button", { name: new RegExp(label) }),
      ).toBeInTheDocument(),
    );
    [
      "今日待邀约达人数量",
      "待寄样达人数量",
      "已寄样待签收数量",
      "待验收视频数量",
      "可投流素材数量",
    ].forEach((label) =>
      expect(screen.queryByRole("button", { name: new RegExp(label) })).not.toBeInTheDocument(),
    );
    const cardLabels = screen
      .getAllByRole("button")
      .map((button) => button.textContent ?? "")
      .filter((text) =>
        expectedCardOrder.some((label) => text.includes(label)),
      );
    expect(
      cardLabels.map((text) =>
        expectedCardOrder.find((label) => text.includes(label)),
      ),
    ).toEqual(expectedCardOrder);

    expect(
      screen.getByRole("heading", { name: "今日待处理达人队列" }),
    ).toBeInTheDocument();
    expect(screen.getByText("follow_creator")).toBeInTheDocument();
    expect(screen.getByTestId("creator-queue")).toHaveClass("compact-queue");
    expect(screen.getByTestId("current-creator-panel")).toBeInTheDocument();
  });

  it("keeps overview card clicks on 今日工作台 and reveals processed creators from the processed card", async () => {
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "pending",
        username: "pending_creator",
        sampleDeliveredDate: "2026-06-01",
      }),
      creatorRow({
        id: "handled",
        username: "handled_creator",
        sampleDeliveredDate: "2026-06-01",
        trackingStatus: "已发送待回复",
        lastHandledDate: "2026-06-11",
        followUpHistory: [
          { date: "2026-06-11", action: "Message Sent", channel: "TikTok DM" },
        ],
      }),
    ]);

    render(<App />);
    await user.click(
      screen.getByRole("button", { name: /今日待跟进达人数量/ }),
    );
    expect(
      screen.getByRole("heading", { name: "今日工作台" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "今日待处理达人队列" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "pending_creator",
    );
    expect(screen.getByTestId("creator-queue")).not.toHaveTextContent(
      "handled_creator",
    );

    await user.click(
      screen.getByRole("button", { name: /今日已处理达人人数/ }),
    );
    expect(
      screen.getByRole("heading", { name: "今日工作台" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("显示今日已处理")).toBeChecked();
    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "handled_creator",
    );
    expect(screen.getByTestId("creator-queue")).toHaveTextContent("今日已处理");
  });

  it("uses one editable 联系渠道 selector for selected creator workflow and stores it in sent history", async () => {
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "channel",
        username: "channel_creator",
        sampleDeliveredDate: "2026-06-01",
      }),
    ]);

    render(<App />);
    const editableChannelSelectors = screen.getAllByLabelText("联系渠道");
    expect(editableChannelSelectors).toHaveLength(1);
    await user.selectOptions(
      editableChannelSelectors[0],
      "TikTok Shop Affiliate Message",
    );
    expect(
      screen.getByText("当前联系渠道：TikTok Shop Affiliate Message"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/渠道：TikTok Shop Affiliate Message/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "标记为已发送" }));
    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      expect(saved[0].lastMessageChannel).toBe("TikTok Shop Affiliate Message");
      expect(saved[0].followUpHistory?.[0]).toMatchObject({
        action: "Message Sent",
        channel: "TikTok Shop Affiliate Message",
      });
    });
  });

  it("uses product-first workflow to filter overview, queue, and current creator panel while preserving 全部产品", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "fountain",
        username: "fountain_creator",
        product: "Pet Fountain",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-05-20",
      }),
      creatorRow({
        id: "comb",
        username: "comb_creator",
        product: "Pet Comb",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-05-20",
      }),
    ]);

    render(<App />);

    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "fountain_creator",
    );
    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "comb_creator",
    );

    await user.selectOptions(
      screen.getAllByLabelText("当前产品项目")[0],
      "Pet Fountain",
    );

    expect(
      screen.getByRole("button", { name: /今日待跟进达人数量1Pet Fountain/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "fountain_creator",
    );
    expect(screen.getByTestId("creator-queue")).not.toHaveTextContent(
      "comb_creator",
    );
    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent(
      "Pet Fountain",
    );

    await user.selectOptions(
      screen.getAllByLabelText("当前产品项目")[0],
      "ALL",
    );
    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "comb_creator",
    );
  });

  it("selecting a creator collapses the compact queue and processing next creator advances within the filter", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "first",
        username: "first_creator",
        product: "Pet Fountain",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-05-20",
      }),
      creatorRow({
        id: "second",
        username: "second_creator",
        product: "Pet Fountain",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-05-21",
      }),
    ]);

    render(<App />);
    await user.selectOptions(screen.getByLabelText("选择达人"), "first");

    expect(screen.queryByTestId("creator-queue")).not.toBeInTheDocument();
    expect(screen.getByText("达人队列已收起。")).toBeInTheDocument();
    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent(
      "first_creator",
    );

    await user.click(screen.getByRole("button", { name: "生成话术" }));
    await user.click(screen.getByRole("button", { name: "标记为已发送" }));
    const nextButtons = screen.getAllByRole("button", {
      name: "处理下一个达人",
    });
    await user.click(nextButtons[nextButtons.length - 1]);

    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent(
      "second_creator",
    );
  });

  it("clicking an overview card stays on Today Workbench and filters the processing queue", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "invite",
        username: "invite_creator",
        currentStatus: "To Contact",
        sampleShippingStatus: "",
        sampleDeliveredDate: "",
      }),
      creatorRow({
        id: "delivered",
        username: "delivered_creator",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
      }),
    ]);

    render(<App />);
    await user.click(
      screen.getByRole("button", { name: /已签收待发视频数量/ }),
    );

    expect(
      screen.getByRole("heading", { name: "今日工作台" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "达人数据库" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "delivered_creator",
    );
    expect(screen.getByTestId("creator-queue")).not.toHaveTextContent(
      "invite_creator",
    );
    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent(
      "delivered_creator",
    );
  });

  it("shows an actionable empty state when there are no todo items", () => {
    render(<App />);

    expect(screen.getByText("暂无待处理达人。")).toBeInTheDocument();
    expect(
      screen.getByText("请导入达人数据，或切换到「全部产品」查看完整队列。"),
    ).toBeInTheDocument();
  });
});

describe("creator database redesigned table", () => {
  it("uses the requested 1.0-style dense Chinese column order", async () => {
    seedCreators([creatorRow({ id: "columns", username: "columns_creator" })]);
    render(<App />);
    const user = userEvent.setup();
    await goTo(user, /达人数据库/);

    const headers = within(screen.getByRole("table")).getAllByRole("columnheader").map((header) => header.textContent ?? "");
    expect(headers.slice(1, 18)).toEqual([
      "达人账号",
      "主页链接",
      "联系渠道",
      "产品",
      "合作状态",
      "样品物流状态",
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
    expect(screen.getByRole("table")).toHaveClass("spreadsheet-table");
  });

  it("supports search, status filtering, and editable table fields", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "alpha",
        username: "alpha_creator",
        product: "Water Fountain",
        currentStatus: "To Contact",
        sampleShippingStatus: "",
        sampleDeliveredDate: "",
      }),
      creatorRow({
        id: "beta",
        username: "beta_creator",
        product: "Pet Comb",
        currentStatus: "Ready for Ads",
        sampleShippingStatus: "Delivered",
        videoProgress: "2 of 2",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人数据库/);

    await user.type(screen.getByLabelText("搜索"), "alpha");
    expect(screen.getByDisplayValue("alpha_creator")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("beta_creator")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("搜索"));
    await user.selectOptions(
      screen.getAllByLabelText("合作状态")[0],
      "Ready for Ads",
    );
    expect(screen.getByDisplayValue("beta_creator")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("alpha_creator")).not.toBeInTheDocument();

    await user.clear(screen.getAllByLabelText("产品名称")[0]);
    await user.type(screen.getAllByLabelText("产品名称")[0], "Updated Brush");
    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      expect(saved.find((row) => row.id === "beta")?.product).toBe(
        "Updated Brush",
      );
    });
  });

  it("bulk-selects creators, copies outreach scripts, and bulk-updates status", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    seedCreators([
      creatorRow({
        id: "alpha",
        username: "alpha_creator",
        currentStatus: "To Contact",
        sampleShippingStatus: "",
        sampleDeliveredDate: "",
      }),
      creatorRow({
        id: "beta",
        username: "beta_creator",
        currentStatus: "To Contact",
        sampleShippingStatus: "",
        sampleDeliveredDate: "",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人数据库/);

    await user.click(screen.getByLabelText("选择 alpha_creator"));
    await user.click(screen.getByLabelText("选择 beta_creator"));
    expect(screen.getByText("已选择 2 位达人")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "批量复制邀约话术" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("@alpha_creator"),
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("@beta_creator"),
    );

    await user.selectOptions(
      within(
        screen
          .getByText("已选择 2 位达人")
          .closest(".sticky-action-bar") as HTMLElement,
      ).getByRole("combobox"),
      "Sample Approved",
    );
    await user.click(screen.getByRole("button", { name: "批量更新状态" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      expect(saved.map((row) => row.currentStatus)).toEqual([
        "Sample Approved",
        "Sample Approved",
      ]);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "已更新 2 位达人状态为 样品已通过。",
    );
  });

  it("adds and deletes creators from the redesigned database page", async () => {
    const user = userEvent.setup();
    seedCreators([creatorRow({ id: "alpha", username: "alpha_creator" })]);
    vi.spyOn(window, "prompt").mockReturnValueOnce("").mockReturnValueOnce("智能宠物饮水机");

    render(<App />);
    await goTo(user, /达人数据库/);
    await user.click(screen.getByRole("button", { name: "新增达人" }));

    expect(screen.getAllByLabelText("达人账号")).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "删除达人" })[0]);
    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      expect(saved).toHaveLength(1);
    });
  });

  it("shows duplicate options when manually adding an existing creator", async () => {
    const user = userEvent.setup();
    seedCreators([creatorRow({ id: "alpha", username: "alpha_creator", product: "Pet Brush" })]);
    const prompt = vi.spyOn(window, "prompt");
    prompt.mockReturnValueOnce("alpha_creator").mockReturnValueOnce("Cat Teaser Wand");

    render(<App />);
    await goTo(user, /达人数据库/);
    await user.click(screen.getByRole("button", { name: "新增达人" }));

    expect(screen.getByText("该达人已存在。你可以选择：")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续新增为不同样品" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制已有达人基础信息" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消新增" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "复制已有达人基础信息" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      expect(saved).toHaveLength(2);
      expect(saved.map((row) => row.product)).toContain("Cat Teaser Wand");
    });
  });

  it("keeps multi-sample creator rows separate in the workbench and current panel", () => {
    seedCreators([
      creatorRow({ id: "brush", username: "multi_creator", product: "Pet Brush", sampleShippingStatus: "In Transit", currentStatus: "Sample Shipped", sampleDeliveredDate: "2026-06-08" }),
      creatorRow({ id: "wand", username: "multi_creator", product: "Cat Teaser Wand", sampleShippingStatus: "Delivered", currentStatus: "Delivered", sampleDeliveredDate: "2026-06-01" }),
    ]);

    render(<App />);

    const queue = screen.getByTestId("creator-queue");
    expect(within(queue).getByText(/Pet Brush/)).toBeInTheDocument();
    expect(within(queue).getByText(/Cat Teaser Wand/)).toBeInTheDocument();
    expect(screen.getAllByText("同达人多样品").length).toBeGreaterThan(0);
    expect(screen.getByText(/该达人还有 1 个其他样品合作/)).toBeInTheDocument();
  });
});

describe("templates, follow-up, samples, review, and ads modules", () => {
  it("generates variable-based outreach templates and copies a scenario script", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<App />);
    await goTo(user, /沟通话术模板/);

    await user.type(screen.getByLabelText("达人名称"), "Bella Pets");
    await user.clear(screen.getByLabelText("产品名称"));
    await user.type(screen.getByLabelText("产品名称"), "Paw Cleaner");

    expect(screen.getByText("初次邀约")).toBeInTheDocument();
    expect(screen.getAllByText("英文话术").length).toBeGreaterThan(0);
    expect(screen.getAllByText("中文对照").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bella Pets/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "复制英文话术" }).length,
    ).toBeGreaterThan(0);

    await user.click(
      screen.getAllByRole("button", { name: "复制英文话术" })[0],
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Bella Pets"),
    );
    expect(String(writeText.mock.calls[0]?.[0] ?? "")).not.toMatch(
      /[\u3400-\u9fff]/,
    );
  });

  it("tracks sample logistics and shows automatic next-action hints", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "shipped",
        username: "shipped_creator",
        currentStatus: "Sample Shipped",
        sampleShippingStatus: "In Transit",
        sampleDeliveredDate: "",
        notes: "carrier: UPS\ntracking: 1Z999",
      }),
      creatorRow({
        id: "delivered",
        username: "delivered_creator",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-05-20",
        videoProgress: "0 of 2",
      }),
    ]);

    render(<App />);
    await goTo(user, /样品追踪/);

    expect(screen.getByText("shipped_creator")).toBeInTheDocument();
    expect(screen.getByText("UPS")).toBeInTheDocument();
    expect(screen.getByText("1Z999")).toBeInTheDocument();
    expect(
      screen.getByText("已寄出但未签收：确认物流是否卡住。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("已签收 5 天未发布：催发视频并确认拍摄计划。"),
    ).toBeInTheDocument();
  });

  it("shows a local recommended message and tracking actions immediately without DeepSeek", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    seedCreators([
      creatorRow({
        id: "immediate-local",
        username: "local_creator",
        product: "Pet Fountain",
        sampleDeliveredDate: "2026-06-02",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);

    await waitFor(() =>
      expect(screen.getByText("本地推荐话术")).toBeInTheDocument(),
    );
    expect(screen.getByText("场景 / 沟通动作")).toBeInTheDocument();
    expect(screen.getByText("中文对照 / 中文解释")).toBeInTheDocument();
    expect(screen.getByText("发送后追踪")).toBeInTheDocument();
    expect(
      screen.getByText(
        "默认先使用本地专业话术。DeepSeek 仅用于复杂回复或需要个性化优化时。",
      ),
    ).toBeInTheDocument();
    const localEnglish = (
      screen.getByLabelText("英文话术") as HTMLTextAreaElement
    ).value;
    expect(localEnglish).toContain("Hi @local_creator");
    expect(localEnglish).toContain("expected posting date");
    expect(localEnglish).not.toMatch(/[㐀-鿿]/);
    [
      "复制英文话术",
      "标记为已发送",
      "标记达人已回复",
      "标记未回复",
      "标记已发布 1 条",
      "标记已发布 2 条 / 合作完成",
      "手动更新视频进度",
      "标记合作完成",
      "标记合作失败",
      "今日暂不跟进",
    ].forEach((name) =>
      expect(screen.getByRole("button", { name })).toBeInTheDocument(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("updates video progress from the workbench quick actions and refreshes counts", async () => {
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "video-one",
        username: "video_one_creator",
        sampleDeliveredDate: "2026-06-01",
        videoProgress: "0 of 2",
      }),
      creatorRow({
        id: "video-two",
        username: "video_two_creator",
        sampleDeliveredDate: "2026-06-01",
        videoProgress: "1 of 2",
        firstVideoPostedDate: "2026-06-09",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    expect(screen.getByRole("button", { name: /今日待跟进达人数量2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标记已发布 1 条" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("选择达人"), "video-one");
    await user.click(screen.getByRole("button", { name: "标记已发布 1 条" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      const updated = saved.find((row) => row.id === "video-one");
      expect(updated?.videoProgress).toBe("1 of 2");
      expect(updated?.currentStatus).toBe("已发布 1 条 / 待补第 2 条");
      expect(updated?.trackingStatus).toBe("已发布部分视频");
      expect(updated?.firstVideoPostedDate).toBe("2026-06-11");
      expect(updated?.followUpHistory?.[Number(updated?.followUpHistory?.length) - 1]).toMatchObject({
        action: "Video Posted",
        note: "已记录达人发布 1 条视频。",
      });
    });
    expect(screen.getByRole("button", { name: /今日已处理达人人数1/ })).toBeInTheDocument();
    expect(screen.queryByTestId("creator-queue")?.textContent ?? "").not.toContain("video_one_creator");

    await user.selectOptions(screen.getByLabelText("选择达人"), "video-two");
    const localEnglish = (screen.getByLabelText("英文话术") as HTMLTextAreaElement).value;
    expect(localEnglish).toContain("There is still 1 remaining video");
    expect(localEnglish).toContain("post the second video");

    await user.click(screen.getByRole("button", { name: "标记已发布 2 条 / 合作完成" }));
    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      const updated = saved.find((row) => row.id === "video-two");
      expect(updated?.videoProgress).toBe("2 of 2");
      expect(updated?.currentStatus).toBe("合作完成");
      expect(updated?.trackingStatus).toBe("合作完成");
      expect(updated?.followUpHistory?.[Number(updated?.followUpHistory?.length) - 1]).toMatchObject({
        action: "Completed",
        note: "已记录达人完成 2 条视频。",
      });
    });
    expect(screen.getByRole("button", { name: /今日已处理达人人数2/ })).toBeInTheDocument();
  });

  it("processes local-message tracking actions without calling DeepSeek", async () => {
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    seedCreators([
      creatorRow({
        id: "local-sent",
        username: "local_sent",
        sampleDeliveredDate: "2026-06-01",
      }),
      creatorRow({
        id: "local-no-reply",
        username: "local_no_reply",
        sampleDeliveredDate: "2026-06-01",
      }),
      creatorRow({
        id: "local-skip",
        username: "local_skip",
        sampleDeliveredDate: "2026-06-01",
      }),
      creatorRow({
        id: "local-complete",
        username: "local_complete",
        sampleDeliveredDate: "2026-06-01",
      }),
      creatorRow({
        id: "local-fail",
        username: "local_fail",
        sampleDeliveredDate: "2026-06-01",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    await waitFor(() =>
      expect(screen.getByText("本地推荐话术")).toBeInTheDocument(),
    );

    await user.selectOptions(screen.getByLabelText("选择达人"), "local-sent");
    await user.clear(screen.getByLabelText("英文话术"));
    await user.type(screen.getByLabelText("英文话术"), "Manual local message");
    await user.click(screen.getByRole("button", { name: "标记为已发送" }));

    await user.selectOptions(
      screen.getByLabelText("选择达人"),
      "local-no-reply",
    );
    await user.click(screen.getByRole("button", { name: "标记未回复" }));

    await user.selectOptions(screen.getByLabelText("选择达人"), "local-skip");
    await user.click(screen.getByRole("button", { name: "今日暂不跟进" }));

    await user.selectOptions(
      screen.getByLabelText("选择达人"),
      "local-complete",
    );
    await user.click(screen.getByRole("button", { name: "标记合作完成" }));

    await user.selectOptions(screen.getByLabelText("选择达人"), "local-fail");
    await user.click(screen.getByRole("button", { name: "标记合作失败" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      expect(saved.find((row) => row.id === "local-sent")?.trackingStatus).toBe(
        "已发送待回复",
      );
      expect(
        saved.find((row) => row.id === "local-sent")?.lastMessageChannel,
      ).toBe("TikTok DM");
      const sentHistory =
        saved.find((row) => row.id === "local-sent")?.followUpHistory ?? [];
      expect(sentHistory[sentHistory.length - 1]).toMatchObject({
        action: "Message Sent",
        date: "2026-06-11",
        message: "Manual local message",
      });
      expect(
        saved.find((row) => row.id === "local-no-reply")?.trackingStatus,
      ).toBe("未回复待跟进");
      expect(saved.find((row) => row.id === "local-skip")?.trackingStatus).toBe(
        "今日已跳过",
      );
      expect(
        saved.find((row) => row.id === "local-complete")?.trackingStatus,
      ).toBe("合作完成");
      expect(saved.find((row) => row.id === "local-fail")?.trackingStatus).toBe(
        "合作失败",
      );
    });
    const expandQueueButton = screen.queryByRole("button", {
      name: "展开达人队列",
    });
    if (expandQueueButton) await user.click(expandQueueButton);
    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "当前筛选下暂无待处理达人。",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only calls DeepSeek from DeepSeek buttons and keeps the local message visible on failure", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: "未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    seedCreators([
      creatorRow({
        id: "deepseek-optional",
        username: "optional_creator",
        trackingStatus: "达人回复待处理",
        lastCreatorResponse: "Can I post Friday?",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    await waitFor(() =>
      expect(screen.getByText("本地推荐话术")).toBeInTheDocument(),
    );
    const localMessage = (
      screen.getByLabelText("英文话术") as HTMLTextAreaElement
    ).value;
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "复制英文话术" }));
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "DeepSeek 生成英文回复" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。",
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("英文话术")).toHaveValue(localMessage);
    expect(
      screen.getByRole("button", { name: "标记为已发送" }),
    ).toBeInTheDocument();
  });

  it("uses DeepSeek output as the active message for copy and tracking when generation succeeds", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              englishMessage:
                "Hi @ai_creator, thanks for confirming. Please post on Friday so we can review the campaign schedule.",
              chineseExplanation: "DeepSeek 版本用于确认周五发布时间。",
              detectedIntent: "确认发布时间",
              recommendedTrackingStatus: "等待周五发布",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    seedCreators([
      creatorRow({
        id: "ai-active",
        username: "ai_creator",
        trackingStatus: "达人回复待处理",
        lastCreatorResponse: "I can post Friday.",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    await user.click(
      screen.getByRole("button", { name: "DeepSeek 生成英文回复" }),
    );

    await waitFor(() =>
      expect(screen.getByText("DeepSeek 优化话术")).toBeInTheDocument(),
    );
    expect(
      (screen.getByLabelText("英文话术") as HTMLTextAreaElement).value,
    ).toContain("Please post on Friday");
    await user.click(screen.getByRole("button", { name: "复制英文话术" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Please post on Friday"),
    );

    await user.click(screen.getByRole("button", { name: "标记为已发送" }));
    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      const history = saved[0].followUpHistory ?? [];
      expect(history[history.length - 1]?.message).toContain(
        "Please post on Friday",
      );
      expect(saved[0].trackingStatus).toBe("已发送待回复");
    });
  });

  it("uses compact creator selector labels and keeps details in current creator panel", async () => {
    const user = userEvent.setup();
    const longProduct = "Pet Brush for Shedding & Grooming Extra Long Campaign Product Name";
    const longActionStatus = "Delivered / Waiting for Video";
    seedCreators([
      creatorRow({
        id: "compact-a",
        username: "callie.the.weenie",
        product: longProduct,
        currentStatus: longActionStatus,
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-06-01",
        trackingStatus: "已发送待回复",
      }),
      creatorRow({
        id: "compact-b",
        username: "happyfeet111",
        product: "另一个产品",
        currentStatus: "Invited",
        sampleShippingStatus: "Pending",
        sampleDeliveredDate: "",
        lastContactDate: "2026-06-10",
        trackingStatus: "待跟进",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);

    const selector = screen.getByLabelText("选择达人") as HTMLSelectElement;
    const firstOption = within(selector).getByRole("option", { name: /@callie\.the\.weenie · 极高 · 已发送待回复/ });
    expect(firstOption).toHaveTextContent("@callie.the.weenie · 极高 · 已发送待回复");
    expect(firstOption).not.toHaveTextContent(longProduct);
    expect(firstOption).not.toHaveTextContent("发送第一次拍摄跟进");
    expect(firstOption).not.toHaveTextContent(longActionStatus);

    await user.selectOptions(selector, "compact-b");
    expect(selector.selectedOptions[0].textContent).toBe("@happyfeet111 · 中 · 待跟进");
    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent("happyfeet111");
    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent("另一个产品");
    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent("Invited");
    expect((screen.getByLabelText("英文话术") as HTMLTextAreaElement).value).toContain("happyfeet111");

    await user.click(screen.getByRole("button", { name: "展开达人队列" }));
    const search = screen.getByLabelText("搜索队列");
    await user.clear(search);
    await user.type(search, "Grooming Extra Long");
    expect(within(screen.getByTestId("creator-queue")).getByText(/@callie\.the\.weenie/)).toBeInTheDocument();
    expect(within(screen.getByTestId("creator-queue")).queryByText(/@happyfeet111/)).not.toBeInTheDocument();
  });

  it("shows short priority reason in the current creator panel", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "reason-reply",
        username: "reply_creator",
        trackingStatus: "Replied",
        lastCreatorResponse: "I can post tomorrow.",
        sampleShippingStatus: "",
        sampleDeliveredDate: "",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);

    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent("优先级原因");
    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent("达人已回复，需先处理对话。");
  });

  it("generates follow-up copy and marks a message as sent", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    seedCreators([
      creatorRow({
        id: "follow",
        username: "follow_creator",
        sampleDeliveredDate: "2026-05-20",
        lastFollowUpCount: 1,
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    await user.click(screen.getByRole("button", { name: "生成话术" }));

    expect(screen.getByText("场景 / 沟通动作")).toBeInTheDocument();
    expect(screen.getAllByText("英文话术").length).toBeGreaterThan(0);
    expect(screen.getByText("中文对照 / 中文解释")).toBeInTheDocument();
    expect(screen.getByText("发送后追踪")).toBeInTheDocument();
    expect(screen.getByText(/发送后请点击/)).toBeInTheDocument();
    expect(
      (screen.getByLabelText("英文话术") as HTMLTextAreaElement).value,
    ).not.toMatch(/[\u3400-\u9fff]/);

    await user.click(screen.getByRole("button", { name: "复制英文话术" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("follow_creator"),
    );

    await user.click(screen.getByRole("button", { name: "标记为已发送" }));
    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      )[0] as CreatorRow;
      expect(saved.trackingStatus).toBe("已发送待回复");
      expect(saved.lastFollowUpCount).toBe(2);
      expect(saved.followUpHistory?.[0]).toMatchObject({
        action: "Message Sent",
      });
    });
    expect(screen.getAllByText("已记录处理结果。").length).toBeGreaterThan(0);
  });

  it("records no reply without increasing count and removes creator from today's pending queue", async () => {
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "no-reply",
        username: "no_reply_creator",
        sampleDeliveredDate: "2026-06-01",
        lastFollowUpCount: 2,
      }),
      creatorRow({
        id: "next",
        username: "next_creator",
        sampleDeliveredDate: "2026-06-01",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    await user.selectOptions(screen.getByLabelText("选择达人"), "no-reply");
    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent(
      "no_reply_creator",
    );
    expect(
      screen.getByRole("button", { name: "标记未回复" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "标记未回复" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      const row = saved.find((item) => item.id === "no-reply");
      expect(row?.trackingStatus).toBe("未回复待跟进");
      expect(row?.lastFollowUpCount).toBe(2);
      expect(row?.lastHandledDate).toBe("2026-06-11");
      expect(row?.nextFollowUpDate).toBe("2026-06-12");
      expect(
        row?.followUpHistory?.[row.followUpHistory.length - 1],
      ).toMatchObject({
        action: "No Reply",
        date: "2026-06-11",
        note: "今日检查，达人未回复。",
      });
    });
    await user.click(screen.getByRole("button", { name: "展开达人队列" }));
    expect(
      within(screen.getByTestId("creator-queue")).queryByText(
        /no_reply_creator/,
      ),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("已记录处理结果。").length).toBeGreaterThan(0);
  });

  it("skips today with an optional note, keeps count unchanged, and can reveal processed creators", async () => {
    vi.setSystemTime(new Date("2026-06-11T10:00:00Z"));
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "skip",
        username: "skip_creator",
        sampleDeliveredDate: "2026-06-01",
        lastFollowUpCount: 1,
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    expect(
      screen.getByRole("button", { name: "今日暂不跟进" }),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("处理备注 / 达人备注"),
      "达人说周五发布，今天不催",
    );
    await user.click(screen.getByRole("button", { name: "今日暂不跟进" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      expect(saved[0].trackingStatus).toBe("今日已跳过");
      expect(saved[0].lastFollowUpCount).toBe(1);
      expect(
        saved[0].followUpHistory?.[saved[0].followUpHistory.length - 1],
      ).toMatchObject({
        action: "Skipped Today",
        note: "达人说周五发布，今天不催",
      });
    });
    const expandQueueButton = screen.queryByRole("button", {
      name: "展开达人队列",
    });
    if (expandQueueButton) await user.click(expandQueueButton);
    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "当前筛选下暂无待处理达人。",
    );
    await user.click(screen.getByLabelText("显示今日已处理"));
    expect(
      within(screen.getByTestId("creator-queue")).getByText(
        /今日已处理 · 今日已跳过 · 达人说周五发布/,
      ),
    ).toBeInTheDocument();
  });

  it("selects the next creator after processing and shows creator notes in the compact panel and database", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "first",
        username: "first_creator",
        sampleDeliveredDate: "2026-06-01",
        notes: "回复慢，不要每天催",
      }),
      creatorRow({
        id: "second",
        username: "second_creator",
        sampleDeliveredDate: "2026-06-01",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    await user.selectOptions(screen.getByLabelText("选择达人"), "first");

    const panel = screen.getByTestId("current-creator-panel");
    expect(panel).toHaveTextContent("处理备注 / 达人备注");
    expect(panel).toHaveTextContent("回复慢，不要每天催");
    expect(panel).toHaveTextContent("更多信息");
    await user.click(screen.getByRole("button", { name: "标记为已发送" }));
    await user.click(
      screen.getAllByRole("button", { name: "处理下一个达人" }).slice(-1)[0],
    );
    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent(
      "second_creator",
    );

    await goTo(user, /达人数据库/);
    expect(
      screen.getByRole("columnheader", { name: "达人备注" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("回复慢，不要每天催")).toBeInTheDocument();
  });

  it("records a creator reply from Follow-up Center", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("Creator can post Friday");
    seedCreators([creatorRow({ id: "reply", username: "reply_creator" })]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    await user.click(screen.getByRole("button", { name: "生成话术" }));
    await user.click(screen.getByRole("button", { name: "标记达人已回复" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      )[0] as CreatorRow;
      expect(saved.currentStatus).toBe("Replied");
      expect(saved.lastCreatorResponse).toBe("Creator can post Friday");
      expect(saved.followUpHistory?.[0]).toMatchObject({
        action: "Creator Replied",
        note: "Creator can post Friday",
      });
    });
  });

  it("shows personalized reply processing fields and lets Chinese focus shape the generated reply", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "reply-focus",
        username: "focus_creator",
        trackingStatus: "达人回复待处理",
        currentStatus: "Replied",
        lastCreatorResponse: "No problem!",
        followUpHistory: [
          {
            date: "2026-06-10",
            action: "Creator Replied",
            note: "No problem!",
          },
        ],
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);

    expect(
      screen.getByRole("heading", { name: "达人回复处理" }),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("我想回复的重点"),
      "期待你拍的视频，有没有具体的时间让我团队安排投流计划",
    );
    await user.click(screen.getByRole("button", { name: "生成话术" }));

    const english = String(
      screen.getByLabelText("英文话术").getAttribute("value") ??
        (screen.getByLabelText("英文话术") as HTMLTextAreaElement).value,
    );
    expect(english).toContain("estimated posting date");
    expect(english).toMatch(/ad testing|boost timing|campaign planning/);
    expect(english).not.toMatch(/[㐀-鿿]/);
    expect(
      screen.getByText("中文对照 / 中文解释").nextElementSibling?.textContent ??
        "",
    ).toMatch(/[㐀-鿿]/);
  });

  it("shows DeepSeek optional reply buttons and helper text in creator reply handling", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "deepseek-ui",
        trackingStatus: "达人回复待处理",
        lastCreatorResponse: "Can I post Friday?",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);

    expect(
      screen.getByRole("button", { name: "DeepSeek 翻译达人回复" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "DeepSeek 生成英文回复" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "DeepSeek 翻译只做直译；英文回复会把你的中文重点准确转成 creator-facing English。",
      ),
    ).toBeInTheDocument();
  });

  it("clicking DeepSeek translate shows loading and then AI Chinese understanding", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    seedCreators([
      creatorRow({
        id: "deepseek-translate",
        product: "Pet Fountain",
        trackingStatus: "达人回复待处理",
        lastCreatorResponse: "I can post Friday.",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    const originalReply = screen.getByLabelText(
      "达人回复原文",
    ) as HTMLTextAreaElement;
    await user.clear(originalReply);
    await user.type(originalReply, "Yes, I fell and sprained my ankle.");
    await user.click(
      screen.getByRole("button", { name: "DeepSeek 翻译达人回复" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("DeepSeek 生成中…");
    resolveFetch(
      new Response(
        JSON.stringify({
          chineseTranslation: "我可以周五发布。",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await waitFor(() =>
      expect(screen.getByText("中文翻译")).toBeInTheDocument(),
    );
    expect(screen.getAllByText("我可以周五发布。").length).toBeGreaterThan(0);
    expect(screen.queryByText(/建议下一步/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/deepseek-reply",
      expect.objectContaining({ method: "POST" }),
    );
    const payload = JSON.parse(
      String(
        (fetchMock.mock.calls[0] as unknown[])[1] &&
          ((fetchMock.mock.calls[0] as unknown[])[1] as { body?: string }).body,
      ),
    );
    expect(payload).toMatchObject({
      action: "translate_creator_reply",
      channel: "TikTok DM",
      productName: "Pet Fountain",
      creatorReply: "Yes, I fell and sprained my ankle.",
    });
    expect(screen.getAllByText("中文翻译")).toHaveLength(1);
    expect(payload.campaignContext).toContain("Pet Fountain");
  });

  it("clicking DeepSeek generate fills English message and shows Chinese explanation", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    seedCreators([
      creatorRow({
        id: "deepseek-generate",
        username: "deep_creator",
        product: "Pet Fountain",
        trackingStatus: "达人回复待处理",
        lastCreatorResponse:
          "I sprained my ankle but my daughter is editing today.",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    await user.clear(screen.getByLabelText("达人回复原文"));
    await user.type(
      screen.getByLabelText("达人回复原文"),
      "I cannot continue this content.",
    );
    await user.type(screen.getByLabelText("我想回复的重点"), "好的样品寄回来");
    await user.click(
      screen.getByRole("button", { name: "DeepSeek 生成英文回复" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("DeepSeek 生成中…");
    resolveFetch(
      new Response(
        JSON.stringify({
          englishMessage:
            "Hi @deep_creator, thank you for the update. Could you confirm the expected posting date so our team can plan the ad testing schedule?",
          chineseExplanation:
            "这条回复先表示理解，再确认发布时间，方便投流安排。",
          detectedIntent: "因个人情况延迟但仍会完成",
          recommendedTrackingStatus: "达人已回复，等待确认发布时间",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await waitFor(() =>
      expect(
        (screen.getByLabelText("英文话术") as HTMLTextAreaElement).value,
      ).toContain("ad testing schedule"),
    );
    expect(
      (screen.getByLabelText("英文话术") as HTMLTextAreaElement).value,
    ).not.toMatch(/[㐀-鿿]/);
    expect(screen.getByText("中文解释")).toBeInTheDocument();
    expect(
      screen.getAllByText("这条回复先表示理解，再确认发布时间，方便投流安排。")
        .length,
    ).toBeGreaterThan(0);
    const payload = JSON.parse(
      String(
        (fetchMock.mock.calls[0] as unknown[])[1] &&
          ((fetchMock.mock.calls[0] as unknown[])[1] as { body?: string }).body,
      ),
    );
    expect(payload).toMatchObject({
      action: "generate_personalized_reply",
      channel: "TikTok DM",
      productName: "Pet Fountain",
      creatorReply: "I cannot continue this content.",
      userReplyFocus: "好的样品寄回来",
      requiredScenes: expect.any(String),
      productSellingPoints: expect.any(String),
      requiredVideoCount: expect.any(String),
      requiredVideoLength: expect.any(String),
      doNotFilmLikeThis: expect.any(String),
      productLinkRequirement: expect.any(String),
      referenceVideoLinks: expect.any(String),
    });
    expect(payload.campaignContext).toContain("产品名称：Pet Fountain");
    expect(payload.campaignContext).toContain("必须展示内容：");
  });

  it("DeepSeek API failure shows a clear error and keeps local fallback message", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: "未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    seedCreators([
      creatorRow({
        id: "deepseek-fail",
        username: "fail_creator",
        trackingStatus: "达人回复待处理",
        lastCreatorResponse: "No problem!",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    await user.click(screen.getByRole("button", { name: "生成话术" }));
    const localMessage = (
      screen.getByLabelText("英文话术") as HTMLTextAreaElement
    ).value;

    await user.click(
      screen.getByRole("button", { name: "DeepSeek 生成英文回复" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。",
      ),
    );
    expect(screen.getByLabelText("英文话术")).toHaveValue(localMessage);
  });

  it("marks a selected creator as sent from the standard template library", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "template-creator",
        username: "template_creator",
        product: "Cat Teaser Wand",
      }),
    ]);

    render(<App />);
    await goTo(user, /沟通话术模板/);
    await user.selectOptions(
      screen.getByLabelText("选择模板达人"),
      "template-creator",
    );
    await user.click(
      screen.getAllByRole("button", { name: "标记为已发送" })[0],
    );

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      )[0] as CreatorRow;
      expect(saved.trackingStatus).toBe("已发送待回复");
      expect(saved.lastFollowUpCount).toBe(1);
      expect(saved.lastMessageScenario).toBe("初次邀约");
      expect(saved.followUpHistory?.[0]).toMatchObject({
        action: "Message Sent",
        scenario: "初次邀约",
      });
    });
  });

  it("renders content review checklists and ads material tags", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "ads",
        username: "ads_creator",
        currentStatus: "Ready for Ads",
        videoProgress: "2 of 2",
        notes: "video url: https://tiktok.com/video/1\nhook: Before After",
      }),
    ]);

    render(<App />);
    await goTo(user, /内容审核/);
    expect(screen.getByText(/是否展示必须展示内容/)).toBeInTheDocument();
    expect(screen.getByText(/是否挂 TikTok Shop 产品链接/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("审核通过")).toBeInTheDocument();

    await goTo(user, /投流素材库/);
    expect(screen.getByText("爪部清洁")).toBeInTheDocument();
    expect(screen.getByText("高 CTR 潜力")).toBeInTheDocument();
    expect(screen.getByText("https://tiktok.com/video/1")).toBeInTheDocument();
    expect(screen.getAllByText("Before After").length).toBeGreaterThan(0);
  });
});

describe("settings and prompt helper", () => {
  it("saves, displays, and restores optional reference links in Settings", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await goTo(user, /设置/);

    fireEvent.change(screen.getByLabelText("参考视频链接"), {
      target: {
        value:
          " https://tiktok.com/reference-one \n\nhttps://shop.tiktok.com/reference-two ",
      },
    });

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CAMPAIGNS_STORAGE_KEY) ?? "[]",
      );
      expect(saved[0].referenceLinks).toEqual([
        "https://tiktok.com/reference-one",
        "https://shop.tiktok.com/reference-two",
      ]);
    });

    unmount();
    render(<App />);
    await goTo(user, /设置/);
    expect(screen.getByLabelText("参考视频链接")).toHaveValue(
      "https://tiktok.com/reference-one\nhttps://shop.tiktok.com/reference-two",
    );
  });

  it("prefills saved reference links in the optional ChatGPT helper form", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      CAMPAIGNS_STORAGE_KEY,
      JSON.stringify([{
        id: "蒸汽梳毛器",
        productName: "蒸汽梳毛器",
        sellingPoints: "",
        requirements: ["每位达人 2 条视频"],
        keyContentPoints: ["展示雾化功能"],
        avoidShots: "",
        videoCount: "每位达人 2 条视频",
        videoLength: "",
        tagRequirement: "必须挂 TikTok Shop 产品链接",
        productLink: "",
        referenceLinks: ["https://tiktok.com/prefill-reference"],
        defaultMessageSetting: "",
        notes: "",
      }]),
    );

    render(<App />);
    await goTo(user, /设置/);
    await user.click(screen.getByRole("button", { name: "展开辅助生成" }));

    expect(screen.getByLabelText("对标视频链接（可选，每行一个）")).toHaveValue(
      "https://tiktok.com/prefill-reference",
    );
  });

  it("generates and copies a local ChatGPT prompt without calling an API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<App />);
    await goTo(user, /设置/);
    await user.click(screen.getByRole("button", { name: "展开辅助生成" }));
    await user.type(screen.getAllByLabelText("产品卖点").slice(-1)[0] as HTMLElement, "静音循环水");
    await user.click(screen.getByRole("button", { name: "生成可复制提示词" }));

    const prompt = screen.getByLabelText("ChatGPT 提示词");
    expect((prompt as HTMLTextAreaElement).value).toContain("静音循环水");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "复制提示词" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("静音循环水"),
    );
    expect(screen.getAllByText("已复制提示词。").length).toBeGreaterThan(0);
  });

  it("clears local creator data from Settings", async () => {
    const user = userEvent.setup();
    seedCreators([creatorRow({ id: "alpha", username: "alpha_creator" })]);
    vi.spyOn(window, "prompt").mockReturnValueOnce("").mockReturnValueOnce("智能宠物饮水机");

    render(<App />);
    await goTo(user, /设置/);
    await user.click(screen.getByRole("button", { name: "清空当前数据" }));

    await waitFor(() =>
      expect(window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY)).toBeNull(),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "已清空本地达人数据。",
    );
  });
});
